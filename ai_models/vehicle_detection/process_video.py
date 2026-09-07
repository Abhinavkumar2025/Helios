import argparse
import json
import os
import shutil
import time
from pathlib import Path
import cv2
import numpy as np
import requests
from ultralytics import YOLO

# 1. Load Pretrained YOLO Model
model = YOLO("yolo26n.pt")

VEHICLE_WEIGHTS = {1: 0.5, 2: 1.0, 3: 0.5, 5: 3.5, 7: 3.0}
COCO_NAMES = {1: "bicycle", 2: "car", 3: "motorcycle", 5: "bus", 7: "truck"}
CLASS_COLORS = {
    1: (255, 178, 50),
    2: (255, 255, 255),
    3: (0, 215, 255),
    5: (203, 192, 255),
    7: (180, 105, 255)
}

GEO_CACHE = {}


def get_road_name(lat, lon):
    key = (round(lat, 4), round(lon, 4))
    if key in GEO_CACHE:
        return GEO_CACHE[key]
    try:
        url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lon}"
        headers = {"User-Agent": "SIH-Traffic-Video/2.0"}
        resp = requests.get(url, headers=headers, timeout=2.0).json()
        road = resp.get("address", {}).get("road") or "Patamata Lanka"
        GEO_CACHE[key] = road
        return road
    except Exception:
        return "Patamata Lanka"


def compute_traffic_density(detections, img_shape, road_length_m=65.0, lanes=2):
    if not detections:
        return 0.0, 0.0, "Low (Free Flow)", (46, 204, 113)

    img_h, img_w = img_shape[:2]
    total_img_area = float(img_h * img_w)

    detected_classes = [d["class_id"] for d in detections]
    total_pcu = sum(VEHICLE_WEIGHTS.get(c, 1.0) for c in detected_classes)
    n_vehicles = len(detections)

    total_vehicle_pixel_area = sum(d["area"] for d in detections)
    occupancy_ratio = min(1.0, total_vehicle_pixel_area / (total_img_area * 0.75))

    jam_buffer_m = 7.0
    nominal_pcu_cap = (road_length_m / jam_buffer_m) * lanes
    load_ratio = total_pcu / nominal_pcu_cap

    y_coords = [d["box"][1] for d in detections]
    vertical_span = (max(y_coords) - min(y_coords)) / float(img_h)

    stress_index = (0.55 * occupancy_ratio) + (0.45 * min(1.6, load_ratio))
    if vertical_span > 0.45 and n_vehicles >= 10:
        stress_index += 0.12

    if stress_index < 0.40:
        density_pct = (stress_index / 0.40) * 38.0
    elif stress_index < 0.75:
        density_pct = 38.0 + ((stress_index - 0.40) / 0.35) * 34.0
    else:
        excess = stress_index - 0.75
        saturation_curve = 1.0 - np.exp(-1.8 * excess)
        density_pct = 78.0 + (saturation_curve * 19.5)

    density_pct = min(98.5, max(5.0, density_pct))

    if density_pct < 40.0:
        status = "Low (Free Flow)"
        color_bgr = (46, 204, 113)
    elif density_pct < 75.0:
        status = "Moderate"
        color_bgr = (0, 165, 255)
    else:
        status = "Heavy (Congestion)"
        color_bgr = (50, 50, 220)

    return round(float(density_pct), 2), round(float(total_pcu), 1), status, color_bgr


def clean_tracked_detections(boxes, img_shape):
    if len(boxes) == 0:
        return []

    img_h, img_w = img_shape[:2]
    min_pixel_area = (img_h * img_w) * 0.003

    xyxy = boxes.xyxy.cpu().numpy()
    confs = boxes.conf.cpu().numpy()
    classes = boxes.cls.cpu().numpy().astype(int)
    track_ids = boxes.id.int().cpu().tolist() if boxes.id is not None else [None] * len(xyxy)

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
            "track_id": track_ids[i],
            "area": float(area)
        })

    n = len(candidates)
    if n == 0:
        return []

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
        t_id = next((candidates[k]["track_id"] for k in component if candidates[k]["track_id"] is not None), None)
        comp_classes = [candidates[k]["class_id"] for k in component]
        dominant_cls = 5 if (5 in comp_classes) else (7 if (7 in comp_classes) else comp_classes[0])

        merged_detections.append({
            "box": np.array([x1, y1, x2, y2]),
            "conf": best_conf,
            "class_id": dominant_cls,
            "track_id": t_id,
            "area": float((x2 - x1) * (y2 - y1))
        })
    return merged_detections


def draw_hud_and_boxes(image_bgr, detections, density_pct, status, color_bgr, total_pcu, road_name):
    # 1. Draw vehicle bounding boxes
    for det in detections:
        x1, y1, x2, y2 = det["box"]
        cid = det["class_id"]
        t_id = det["track_id"]

        label = f"{COCO_NAMES.get(cid, 'vehicle')}"
        if t_id is not None:
            label += f" #{t_id}"

        box_color = CLASS_COLORS.get(cid, (255, 255, 255))
        cv2.rectangle(image_bgr, (x1, y1), (x2, y2), box_color, 2)

        label_size, _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
        top_y = max(y1, label_size[1] + 5)
        cv2.rectangle(image_bgr, (x1, top_y - label_size[1] - 4), (x1 + label_size[0] + 4, top_y), (30, 30, 30), -1)
        cv2.putText(image_bgr, label, (x1 + 2, top_y - 2), cv2.FONT_HERSHEY_SIMPLEX, 0.5, box_color, 1, cv2.LINE_AA)

    # 2. Multi-Line Top HUD Banner (No text overflow)
    h, w, _ = image_bgr.shape
    banner_height = 105
    overlay = image_bgr.copy()
    cv2.rectangle(overlay, (0, 0), (w, banner_height), (20, 20, 20), -1)
    cv2.addWeighted(overlay, 0.75, image_bgr, 0.25, 0, image_bgr)

    # Vertical accent pill
    cv2.rectangle(image_bgr, (15, 15), (25, 90), color_bgr, -1)

    # Line 1: Status
    cv2.putText(
        image_bgr,
        f"Status: {status}",
        (35, 34),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.65,
        color_bgr,
        2,
        cv2.LINE_AA
    )

    # Line 2: Traffic Flow %
    cv2.putText(
        image_bgr,
        f"Traffic Flow: {density_pct}%",
        (35, 62),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.65,
        (255, 255, 255),
        2,
        cv2.LINE_AA
    )

    # Line 3: Vehicle Breakdown & Road Name
    cv2.putText(
        image_bgr,
        f"Vehicles: {len(detections)} | PCU: {total_pcu} | Road: {road_name}",
        (35, 88),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.50,
        (220, 220, 220),
        1,
        cv2.LINE_AA
    )

    return image_bgr


def process_video_file(video_path, target_fps=4, output_dir="outputs", output_video="output_traffic.mp4"):
    all_frames_dir = os.path.join(output_dir, "all_annotated_frames")
    global_best_dir = os.path.join(output_dir, "global_best")
    json_telemetry_dir = os.path.join(output_dir, "json_telemetry")

    os.makedirs(all_frames_dir, exist_ok=True)
    os.makedirs(global_best_dir, exist_ok=True)
    os.makedirs(json_telemetry_dir, exist_ok=True)

    if not os.path.exists(video_path):
        print(f"Error: Video file not found: {video_path}")
        return

    cap = cv2.VideoCapture(video_path)
    orig_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    frame_step = max(1, int(round(orig_fps / target_fps)))

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    video_out_path = os.path.join(output_dir, output_video)
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(video_out_path, fourcc, target_fps, (width, height))

    print(f"Analyzing '{video_path}' ({total_frames} frames @ {orig_fps:.1f} FPS -> sampled to {target_fps} FPS)")
    print(f"Outputs will be stored in: '{output_dir}/'")

    lat, lon = 16.5062, 80.6480
    road_name = get_road_name(lat, lon)
    frame_idx = 0
    sampled_idx = 0
    all_records = []

    best_incident = {
        "traffic_flow_percent": -1.0,
        "saved_img_path": None,
        "record": None
    }

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        frame_idx += 1
        if frame_idx % frame_step != 0:
            continue

        sampled_idx += 1

        results = model.track(
            source=frame,
            persist=True,
            tracker="bytetrack.yaml",
            classes=list(VEHICLE_WEIGHTS.keys()),
            conf=0.30,
            iou=0.45,
            imgsz=960,
            verbose=False
        )[0]

        clean_detections = clean_tracked_detections(results.boxes, frame.shape)
        detected_classes = [d["class_id"] for d in clean_detections]
        density_pct, total_pcu, status, color_bgr = compute_traffic_density(clean_detections, frame.shape)

        annotated_frame = draw_hud_and_boxes(
            frame, clean_detections, density_pct, status, color_bgr, total_pcu, road_name
        )
        out.write(annotated_frame)

        # 1. Save frame to all_annotated_frames
        frame_filename = f"frame_{sampled_idx:05d}.jpg"
        frame_save_path = os.path.join(all_frames_dir, frame_filename)
        cv2.imwrite(frame_save_path, annotated_frame)

        # 2. Build and save individual frame JSON
        record = {
            "frame_index": sampled_idx,
            "timestamp_sec": round(frame_idx / orig_fps, 2),
            "road_name": road_name,
            "coordinates": {"lat": lat, "lon": lon},
            "traffic_flow_percent": density_pct,
            "status": status,
            "total_vehicles": len(clean_detections),
            "total_pcu": total_pcu,
            "active_track_ids": [d["track_id"] for d in clean_detections if d["track_id"] is not None],
            "vehicle_breakdown": {
                name: detected_classes.count(cid) for cid, name in COCO_NAMES.items()
            }
        }

        json_filename = f"frame_{sampled_idx:05d}.json"
        json_save_path = os.path.join(json_telemetry_dir, json_filename)
        with open(json_save_path, "w") as jf:
            json.dump(record, jf, indent=4)

        all_records.append(record)

        # 3. Track best global incident (peak congestion)
        if density_pct > best_incident["traffic_flow_percent"]:
            best_incident["traffic_flow_percent"] = density_pct
            best_incident["saved_img_path"] = frame_save_path
            best_incident["record"] = record

        if sampled_idx % 8 == 0:
            print(f"[{sampled_idx}] Frame {frame_idx}/{total_frames} -> {status} ({density_pct}%) | Active: {len(clean_detections)}")

    cap.release()
    out.release()

    # Save peak congestion event in global_best
    if best_incident["saved_img_path"]:
        peak_img_dest = os.path.join(global_best_dir, "peak_traffic_incident.jpg")
        shutil.copyfile(best_incident["saved_img_path"], peak_img_dest)

        peak_json_dest = os.path.join(global_best_dir, "peak_traffic_incident.json")
        with open(peak_json_dest, "w") as pf:
            json.dump(best_incident["record"], pf, indent=4)

        print(f"\n[GLOBAL BEST IDENTIFIED]: Peak flow of {best_incident['traffic_flow_percent']}% saved to '{global_best_dir}/'")

    # Save master summary JSON
    summary_path = os.path.join(json_telemetry_dir, f"{Path(video_path).stem}_summary_report.json")
    with open(summary_path, "w") as sf:
        json.dump(all_records, sf, indent=4)

    print(f"\nCompleted! Outputs available in '{output_dir}/'")


if __name__ == "__main__":
    default_video_path = r"D:\DIVY\Hackathon\SIH\waterlog_project\Helios\ai_models\vehicle_detection\test_media\vd1.mp4"

    parser = argparse.ArgumentParser(description="Process Traffic Video into Segregated Folders")
    parser.add_argument("--video", default=default_video_path, help="Path to input video file")
    parser.add_argument("--fps", type=int, default=4, help="Sampling FPS (default: 4)")
    parser.add_argument("--output_dir", default="outputs", help="Directory where folders will be created")
    args = parser.parse_args()

    process_video_file(video_path=args.video, target_fps=args.fps, output_dir=args.output_dir)