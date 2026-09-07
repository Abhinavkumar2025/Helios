import json
import os
import time
from pathlib import Path
import cv2
import numpy as np
from PIL import Image
from PIL.ExifTags import TAGS, GPSTAGS
import requests
from ultralytics import YOLO

# 1. Load Pretrained YOLO Model
_weights_path = Path(__file__).resolve().parent / "weights" / "yolo26n.pt"
if not _weights_path.exists():
    _weights_path = Path(__file__).resolve().parent / "yolo26n.pt"
model = YOLO(str(_weights_path) if _weights_path.exists() else "yolo26n.pt")

VEHICLE_WEIGHTS = {
    1: 0.5,  # bicycle
    2: 1.0,  # car
    3: 0.5,  # motorcycle / scooter
    5: 3.5,  # bus
    7: 3.0   # truck
}

COCO_NAMES = {1: "bicycle", 2: "car", 3: "motorcycle", 5: "bus", 7: "truck"}

CLASS_COLORS = {
    1: (255, 178, 50),   # cyan/blue
    2: (255, 255, 255),  # white
    3: (0, 215, 255),    # gold
    5: (203, 192, 255),  # light pink
    7: (180, 105, 255)   # hot pink
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
        return "Patamata Lanka"
    
    key = (round(lat, 4), round(lon, 4))
    if key in GEO_CACHE:
        return GEO_CACHE[key]

    try:
        url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lon}"
        headers = {"User-Agent": "SIH-TrafficMonitoring-Production/3.8"}
        resp = requests.get(url, headers=headers, timeout=2.0).json()
        address = resp.get("address", {})
        road = address.get("road") or address.get("suburb") or address.get("city") or "Patamata Lanka"
        GEO_CACHE[key] = road
        time.sleep(0.3)
        return road
    except Exception:
        return "Patamata Lanka"


def compute_traffic_density(detections, img_shape, road_length_m=65.0, lanes=2):
    """
    Calibrated Non-Linear Density Engine:
    Uses an asymptotic saturation curve so heavy congestion realistically distributes
    into 80%, 88%, 93%, 96% rather than pegging flat at 100%.
    """
    if not detections:
        return 0.0, 0.0, "Low (Free Flow)", (46, 204, 113)

    img_h, img_w = img_shape[:2]
    total_img_area = float(img_h * img_w)

    detected_classes = [d["class_id"] for d in detections]
    total_pcu = sum(VEHICLE_WEIGHTS.get(c, 1.0) for c in detected_classes)
    n_vehicles = len(detections)

    # 1. Screen Visual Saturation (Occupancy Ratio)
    total_vehicle_pixel_area = sum(d["area"] for d in detections)
    occupancy_ratio = min(1.0, total_vehicle_pixel_area / (total_img_area * 0.75))

    # 2. Segment Physical Load
    jam_buffer_m = 7.0
    nominal_pcu_cap = (road_length_m / jam_buffer_m) * lanes
    load_ratio = total_pcu / nominal_pcu_cap

    # 3. Queue Dispersion / Depth Factor
    y_coords = [d["box"][1] for d in detections]
    vertical_span = (max(y_coords) - min(y_coords)) / float(img_h)
    
    # 4. Asymptotic Traffic Flow Calculation
    stress_index = (0.55 * occupancy_ratio) + (0.45 * min(1.6, load_ratio))

    if vertical_span > 0.45 and n_vehicles >= 10:
        stress_index += 0.12  # Perspective depth bonus for long queues

    # Smooth non-linear curve
    if stress_index < 0.40:
        density_pct = (stress_index / 0.40) * 38.0
    elif stress_index < 0.75:
        density_pct = 38.0 + ((stress_index - 0.40) / 0.35) * 34.0
    else:
        excess = stress_index - 0.75
        saturation_curve = 1.0 - np.exp(-1.8 * excess)
        density_pct = 78.0 + (saturation_curve * 19.5)

    density_pct = min(98.5, max(5.0, density_pct))

    # Categorization
    if density_pct < 40.0:
        status = "Low (Free Flow)"
        color_bgr = (46, 204, 113)  # Green
    elif density_pct < 75.0:
        status = "Moderate"
        color_bgr = (0, 165, 255)   # Amber
    else:
        status = "Heavy (Congestion)"
        color_bgr = (50, 50, 220)   # Red

    return round(float(density_pct), 2), round(float(total_pcu), 1), status, color_bgr


def clean_vehicle_detections(boxes, img_shape):
    if len(boxes) == 0:
        return []

    img_h, img_w = img_shape[:2]
    min_pixel_area = (img_h * img_w) * 0.003

    xyxy = boxes.xyxy.cpu().numpy()
    confs = boxes.conf.cpu().numpy()
    classes = boxes.cls.cpu().numpy().astype(int)

    candidates = []
    for i in range(len(xyxy)):
        w = xyxy[i, 2] - xyxy[i, 0]
        h = xyxy[i, 3] - xyxy[i, 1]
        area = w * h
        cid = classes[i]
        conf = confs[i]

        if area < min_pixel_area or w < 16 or h < 16:
            continue
        if (h / float(w) > 2.2) and area < (img_h * img_w * 0.01):
            continue

        if cid in (5, 7) and conf < 0.65:
            cid = 2

        candidates.append({
            "box": xyxy[i].astype(int),
            "conf": float(conf),
            "class_id": int(cid),
            "area": float(area)
        })

    if not candidates:
        return []

    n = len(candidates)
    adj = [[] for _ in range(n)]

    for i in range(n):
        b1 = candidates[i]["box"]
        a1 = candidates[i]["area"]
        for j in range(i + 1, n):
            b2 = candidates[j]["box"]
            a2 = candidates[j]["area"]

            ix1 = max(b1[0], b2[0])
            iy1 = max(b1[1], b2[1])
            ix2 = min(b1[2], b2[2])
            iy2 = min(b1[3], b2[3])

            should_merge = False

            if ix2 > ix1 and iy2 > iy1:
                inter = (ix2 - ix1) * (iy2 - iy1)
                smaller = min(a1, a2)
                iou = inter / float(a1 + a2 - inter)

                if (inter / smaller) > 0.50 or iou > 0.25:
                    should_merge = True

            x_dist = max(0, max(b1[0], b2[0]) - min(b1[2], b2[2]))
            y_overlap = max(0, min(b1[3], b2[3]) - max(b1[1], b2[1]))
            min_h = min(b1[3] - b1[1], b2[3] - b2[1])

            if x_dist <= 15 and (y_overlap / float(min_h)) > 0.60:
                comb_w = max(b1[2], b2[2]) - min(b1[0], b2[0])
                comb_h = max(b1[3], b2[3]) - min(b1[1], b2[1])
                if (comb_w / float(comb_h)) <= 2.2:
                    should_merge = True

            if should_merge:
                adj[i].append(j)
                adj[j].append(i)

    visited = [False] * n
    merged_detections = []

    for i in range(n):
        if visited[i]:
            continue

        component = []
        stack = [i]
        visited[i] = True

        while stack:
            curr = stack.pop()
            component.append(curr)
            for neighbor in adj[curr]:
                if not visited[neighbor]:
                    visited[neighbor] = True
                    stack.append(neighbor)

        comp_boxes = [candidates[k]["box"] for k in component]
        x1 = min(b[0] for b in comp_boxes)
        y1 = min(b[1] for b in comp_boxes)
        x2 = max(b[2] for b in comp_boxes)
        y2 = max(b[3] for b in comp_boxes)

        best_conf = max(candidates[k]["conf"] for k in component)
        comp_classes = [candidates[k]["class_id"] for k in component]
        dominant_cls = 5 if (5 in comp_classes) else (7 if (7 in comp_classes) else comp_classes[0])

        merged_detections.append({
            "box": np.array([x1, y1, x2, y2]),
            "conf": best_conf,
            "class_id": dominant_cls,
            "area": float((x2 - x1) * (y2 - y1))
        })

    return merged_detections


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

    # Case-insensitive deduplication for Windows paths
    valid_exts = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
    image_paths = sorted(
        str(p) for p in Path(input_dir).iterdir() if p.suffix.lower() in valid_exts
    )

    if not image_paths:
        print(f"No images found in '{input_dir}'.")
        return

    print(f"Processing {len(image_paths)} unique images with non-linear calibrated engine...\n")
    summary_telemetry = []

    for index, img_path in enumerate(image_paths, start=1):
        filename = os.path.basename(img_path)
        file_stem = Path(img_path).stem
        output_image_path = os.path.join(output_dir, f"detected_{filename}")
        individual_json_path = os.path.join(json_dir, f"{file_stem}.json")

        raw_image = cv2.imread(img_path)
        img_shape = raw_image.shape

        results = model.predict(
            source=img_path,
            classes=list(VEHICLE_WEIGHTS.keys()),
            conf=0.30,
            iou=0.45,
            imgsz=1024,
            verbose=False
        )[0]

        clean_detections = clean_vehicle_detections(results.boxes, img_shape)
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

    print("\nProcessing complete! Run and check output-images.")


if __name__ == "__main__":
    process_directory()