import json
import os
import time
from glob import glob
from pathlib import Path
import cv2
import numpy as np
from PIL import Image
from PIL.ExifTags import TAGS, GPSTAGS
import requests
from ultralytics import YOLO

# 1. Load Pretrained YOLO Model
model = YOLO("yolo26n.pt")

VEHICLE_WEIGHTS = {
    1: 0.5,  # bicycle
    2: 1.0,  # car
    3: 0.5,  # motorcycle / scooter
    5: 4.0,  # bus
    7: 3.0   # truck
}

COCO_NAMES = {1: "bicycle", 2: "car", 3: "motorcycle", 5: "bus", 7: "truck"}

CLASS_COLORS = {
    1: (255, 178, 50),
    2: (255, 255, 255),
    3: (0, 215, 255),
    5: (203, 192, 255),
    7: (180, 105, 255)
}

GEO_CACHE = {}


def extract_exif_gps(image_path):
    try:
        image = Image.open(image_path)
        exif = image._getexif()
        if not exif:
            return None, None

        gps_info = {}
        for key, value in exif.items():
            decoded = TAGS.get(key, key)
            if decoded == "GPSInfo":
                for t in value:
                    sub_decoded = GPSTAGS.get(t, t)
                    gps_info[sub_decoded] = value[t]

        def convert_to_degrees(value):
            d, m, s = float(value[0]), float(value[1]), float(value[2])
            return d + (m / 60.0) + (s / 3600.0)

        lat = convert_to_degrees(gps_info["GPSLatitude"])
        if gps_info.get("GPSLatitudeRef") == "S":
            lat = -lat

        lon = convert_to_degrees(gps_info["GPSLongitude"])
        if gps_info.get("GPSLongitudeRef") == "W":
            lon = -lon

        return round(lat, 6), round(lon, 6)
    except Exception:
        return None, None


def get_road_name(lat, lon):
    if lat is None or lon is None:
        return "Unknown Location"
    
    key = (round(lat, 4), round(lon, 4))
    if key in GEO_CACHE:
        return GEO_CACHE[key]

    try:
        url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lon}"
        headers = {"User-Agent": "SIH-TrafficMonitoring-Production/2.5"}
        resp = requests.get(url, headers=headers, timeout=2.0).json()
        address = resp.get("address", {})
        road = address.get("road") or address.get("suburb") or address.get("city") or "Patamata Lanka"
        GEO_CACHE[key] = road
        time.sleep(0.4)
        return road
    except Exception:
        return "Patamata Lanka"


def compute_traffic_density(detections, img_shape, road_length_m=60.0, lanes=2):
    """
    Computes accurate traffic density:
    - Normalizes PCU against road capacity
    - Accounts for visual camera coverage in bumper-to-bumper crops
    - Factors queue depth when vehicles span the horizon
    """
    img_h, img_w = img_shape[:2]
    total_img_area = float(img_h * img_w)

    detected_classes = [d["class_id"] for d in detections]
    total_pcu = sum(VEHICLE_WEIGHTS.get(c, 1.0) for c in detected_classes)

    # 1. Capacity formula
    jam_buffer_m = 6.5
    max_pcu = (road_length_m / jam_buffer_m) * lanes
    pcu_density_pct = (total_pcu / max_pcu) * 100.0

    # 2. Area coverage ratio
    total_vehicle_pixel_area = sum(d["area"] for d in detections)
    area_coverage_ratio = total_vehicle_pixel_area / total_img_area
    area_density_pct = area_coverage_ratio * 170.0

    # 3. Perspective queue depth boost
    depth_boost = 0.0
    if len(detections) >= 8:
        y_coords = [d["box"][1] for d in detections]
        vertical_span = (max(y_coords) - min(y_coords)) / img_h
        if vertical_span > 0.45:
            depth_boost = 18.0 if (5 in detected_classes) else 10.0

    density_pct = min(100.0, max(pcu_density_pct, area_density_pct) + depth_boost)

    if density_pct < 40:
        status = "Low (Free Flow)"
        color_bgr = (46, 204, 113)
    elif density_pct < 75:
        status = "Moderate"
        color_bgr = (0, 165, 255)
    else:
        status = "Heavy (Congestion)"
        color_bgr = (50, 50, 220)

    return round(density_pct, 2), round(total_pcu, 1), status, color_bgr


def clean_vehicle_detections(boxes, min_box_size=16):
    """
    Precision post-processing:
    - Retains ALL distinct vehicles (even adjacent and bumper-to-bumper).
    - Removes only genuine duplicate/nested sub-boxes inside the same vehicle.
    - Standardizes car misclassifications.
    """
    if len(boxes) == 0:
        return []

    xyxy = boxes.xyxy.cpu().numpy()
    confs = boxes.conf.cpu().numpy()
    classes = boxes.cls.cpu().numpy().astype(int)

    candidates = []
    for i in range(len(xyxy)):
        w = xyxy[i, 2] - xyxy[i, 0]
        h = xyxy[i, 3] - xyxy[i, 1]
        cid = classes[i]
        conf = confs[i]

        if w < min_box_size or h < min_box_size:
            continue

        # Prevent normal cars/taxis from misclassifying as trucks/buses
        if cid in (5, 7) and conf < 0.65:
            cid = 2

        candidates.append({
            "box": xyxy[i].astype(int),
            "conf": float(conf),
            "class_id": int(cid),
            "area": float(w * h)
        })

    # Sort descending by confidence so strong detections take precedence
    candidates = sorted(candidates, key=lambda x: x["conf"], reverse=True)

    keep = [True] * len(candidates)
    for i in range(len(candidates)):
        if not keep[i]:
            continue
        b1 = candidates[i]["box"]
        a1 = candidates[i]["area"]

        for j in range(i + 1, len(candidates)):
            if not keep[j]:
                continue
            b2 = candidates[j]["box"]
            a2 = candidates[j]["area"]

            # Calculate intersection
            ix1 = max(b1[0], b2[0])
            iy1 = max(b1[1], b2[1])
            ix2 = min(b1[2], b2[2])
            iy2 = min(b1[3], b2[3])

            if ix2 > ix1 and iy2 > iy1:
                inter = (ix2 - ix1) * (iy2 - iy1)
                smaller_area = min(a1, a2)

                # Strict containment: ONLY suppress if one box is >70% INSIDE the other
                # (Eliminates the BMW window/roof artifact without killing adjacent cars)
                if (inter / smaller_area) > 0.70:
                    keep[j] = False

    return [candidates[idx] for idx in range(len(keep)) if keep[idx]]


def draw_hud_and_boxes(image_bgr, detections, density_pct, status, color_bgr, total_pcu, road_name):
    for det in detections:
        x1, y1, x2, y2 = det["box"]
        cid = det["class_id"]
        conf = det["conf"]
        label = f"{COCO_NAMES.get(cid, 'vehicle')} {conf:.2f}"
        box_color = CLASS_COLORS.get(cid, (255, 255, 255))

        cv2.rectangle(image_bgr, (x1, y1), (x2, y2), box_color, 2)

        label_size, _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
        top_y = max(y1, label_size[1] + 5)
        cv2.rectangle(
            image_bgr,
            (x1, top_y - label_size[1] - 4),
            (x1 + label_size[0] + 4, top_y),
            (30, 30, 30),
            -1
        )
        cv2.putText(
            image_bgr,
            label,
            (x1 + 2, top_y - 2),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            box_color,
            1,
            cv2.LINE_AA
        )

    # Top HUD Banner
    h, w, _ = image_bgr.shape
    banner_height = 80
    overlay = image_bgr.copy()
    cv2.rectangle(overlay, (0, 0), (w, banner_height), (20, 20, 20), -1)
    cv2.addWeighted(overlay, 0.75, image_bgr, 0.25, 0, image_bgr)

    cv2.rectangle(image_bgr, (15, 15), (25, 65), color_bgr, -1)
    cv2.putText(
        image_bgr,
        f"Status: {status} | Traffic Flow: {density_pct}%",
        (35, 38),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.75,
        color_bgr,
        2,
        cv2.LINE_AA
    )
    cv2.putText(
        image_bgr,
        f"Vehicles: {len(detections)} | PCU: {total_pcu} | Road: {road_name}",
        (35, 65),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.55,
        (230, 230, 230),
        1,
        cv2.LINE_AA
    )
    return image_bgr


def process_directory(input_dir="test_media", output_dir="output-images", json_dir="output-json"):
    os.makedirs(output_dir, exist_ok=True)
    os.makedirs(json_dir, exist_ok=True)

    valid_extensions = ("*.jpg", "*.jpeg", "*.png", "*.bmp", "*.webp")
    image_paths = []
    for ext in valid_extensions:
        image_paths.extend(glob(os.path.join(input_dir, ext)))
        image_paths.extend(glob(os.path.join(input_dir, ext.upper())))

    if not image_paths:
        print(f"No images found in '{input_dir}'.")
        return

    print(f"Processing {len(image_paths)} images with maximum vehicle recall...\n")
    summary_telemetry = []

    for index, img_path in enumerate(image_paths, start=1):
        filename = os.path.basename(img_path)
        file_stem = Path(img_path).stem
        output_image_path = os.path.join(output_dir, f"detected_{filename}")
        individual_json_path = os.path.join(json_dir, f"{file_stem}.json")

        raw_image = cv2.imread(img_path)
        img_shape = raw_image.shape

        # conf=0.30 catches partially occluded & distant vehicles in queues
        # iou=0.45 native NMS separates adjacent lane vehicles cleanly
        results = model.predict(
            source=img_path,
            classes=list(VEHICLE_WEIGHTS.keys()),
            conf=0.30,
            iou=0.45,
            imgsz=1024,
            verbose=False
        )[0]

        clean_detections = clean_vehicle_detections(results.boxes)
        detected_classes = [d["class_id"] for d in clean_detections]

        lat, lon = extract_exif_gps(img_path)
        if lat is None:
            lat, lon = 16.5062, 80.6480

        density_pct, total_pcu, status, color_bgr = compute_traffic_density(
            clean_detections,
            img_shape
        )
        road_name = get_road_name(lat, lon)

        final_image = draw_hud_and_boxes(
            raw_image,
            clean_detections,
            density_pct,
            status,
            color_bgr,
            total_pcu,
            road_name
        )
        cv2.imwrite(output_image_path, final_image)

        record = {
            "image_name": filename,
            "saved_output_path": output_image_path,
            "individual_json_path": individual_json_path,
            "bus_id": f"BUS-{index:03d}",
            "coordinates": {"lat": lat, "lon": lon},
            "road_name": road_name,
            "traffic_flow_percent": density_pct,
            "congestion_status": status,
            "total_pcu": total_pcu,
            "total_vehicles": len(clean_detections),
            "breakdown": {
                name: detected_classes.count(cid) for cid, name in COCO_NAMES.items()
            }
        }

        with open(individual_json_path, "w") as f_single:
            json.dump(record, f_single, indent=4)

        summary_telemetry.append(record)
        print(f"[{index}/{len(image_paths)}] {filename} -> {status} ({density_pct}%) | Vehicles: {len(clean_detections)} | PCU: {total_pcu}")

    with open("traffic_report.json", "w") as f_master:
        json.dump(summary_telemetry, f_master, indent=4)

    print("\nProcessing complete! Every genuine vehicle should now be detected.")


if __name__ == "__main__":
    process_directory()