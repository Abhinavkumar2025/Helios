import argparse
import json
import math
import os
import shutil
import sys
import time
from pathlib import Path
import cv2
import geocoder
import numpy as np
from ultralytics import YOLO

# ======================= CONFIGURATION =======================
DEFAULT_VIDEO_PATH = r"D:\DIVY\Hackathon\SIH\waterlog_project\Helios\ai_models\waterlogging\test_media\sampl1.mp4"
TARGET_FPS = 4.0
CLUSTER_DISTANCE_THRESHOLD_M = 10.0
BASE_CONF_DETECTION = 0.25
MIN_WATERLOG_AREA_PX = 4000
IMG_SIZE = 640

MODEL_PATH = os.path.join("weights", "waterlog_best.pt")

EXPLICIT_START_GPS = None
EXPLICIT_END_GPS = None
# =============================================================


def get_laptop_coordinates():
    try:
        g = geocoder.ip('me')
        if g.ok and g.latlng:
            return float(g.latlng[0]), float(g.latlng[1])
    except Exception:
        pass
    return 16.5062, 80.6480


laptop_lat, laptop_lon = get_laptop_coordinates()


def get_frame_gps(frame_progress_ratio):
    if EXPLICIT_START_GPS and EXPLICIT_END_GPS:
        lat = EXPLICIT_START_GPS[0] + (EXPLICIT_END_GPS[0] - EXPLICIT_START_GPS[0]) * frame_progress_ratio
        lon = EXPLICIT_START_GPS[1] + (EXPLICIT_END_GPS[1] - EXPLICIT_START_GPS[1]) * frame_progress_ratio
        return round(lat, 6), round(lon, 6)
    else:
        simulated_lat = laptop_lat + (frame_progress_ratio * 0.0018)
        simulated_lon = laptop_lon + (frame_progress_ratio * 0.0018)
        return round(simulated_lat, 6), round(simulated_lon, 6)


def haversine_m(lat1, lon1, lat2, lon2):
    R = 6371000.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2.0)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2.0)**2
    return R * (2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a)))


def draw_waterlog_hud(annotated, w, h, severity, coverage, w_score, avg_score, lat, lon, mean_conf, hud_color):
    """
    Renders a responsive, multi-line HUD card that never overflows
    regardless of frame resolution or aspect ratio.
    """
    banner_width = min(w - 20, int(w * 0.95))
    banner_height = 110

    overlay = annotated.copy()
    cv2.rectangle(overlay, (10, 10), (10 + banner_width, 10 + banner_height), (20, 20, 20), -1)
    cv2.addWeighted(overlay, 0.80, annotated, 0.20, 0, annotated)

    # Status accent pill on the left
    cv2.rectangle(annotated, (15, 16), (23, 10 + banner_height - 6), hud_color, -1)

    # Dynamic scaling for low-res or vertical frames
    font_scale = 0.58 if w >= 720 else 0.45
    sub_font_scale = 0.48 if w >= 720 else 0.38
    text_x = 32

    # Line 1: Status
    cv2.putText(
        annotated,
        f"Status: {severity} WATERLOGGING",
        (text_x, 34),
        cv2.FONT_HERSHEY_SIMPLEX,
        font_scale,
        hud_color,
        2,
        cv2.LINE_AA
    )

    # Line 2: Water Coverage %
    cv2.putText(
        annotated,
        f"Road Water Coverage: {coverage}%",
        (text_x, 58),
        cv2.FONT_HERSHEY_SIMPLEX,
        font_scale,
        (255, 255, 255),
        2,
        cv2.LINE_AA
    )

    # Line 3: Scores
    cv2.putText(
        annotated,
        f"Hazard Score: {w_score} | Selection Avg: {avg_score}",
        (text_x, 82),
        cv2.FONT_HERSHEY_SIMPLEX,
        sub_font_scale,
        (220, 220, 220),
        1,
        cv2.LINE_AA
    )

    # Line 4: Geolocation & Confidence
    cv2.putText(
        annotated,
        f"GPS: ({lat:.4f}, {lon:.4f}) | Model Conf: {mean_conf:.2f}",
        (text_x, 104),
        cv2.FONT_HERSHEY_SIMPLEX,
        sub_font_scale,
        (180, 180, 180),
        1,
        cv2.LINE_AA
    )

    return annotated


class WaterlogSpatialRegistry:
    def __init__(self, output_root, threshold_m=10.0):
        self.threshold_m = threshold_m
        self.incidents = []
        self.global_best = None
        self.dir_patch_best = os.path.join(output_root, "clean_patch_outputs")
        self.dir_global_best = os.path.join(output_root, "global_best_incident")
        self.dir_telemetry = os.path.join(output_root, "json_telemetry")

    def register_frame(self, frame_img, lat, lon, mean_conf, coverage_pct, w_score, avg_score, severity, frame_id, video_path):
        if severity == "NORMAL" or w_score <= 0.0:
            return None

        # 1. Update Global Best Frame across all patches
        if (self.global_best is None) or (avg_score > self.global_best["avg_score"]):
            for f in os.listdir(self.dir_global_best):
                try:
                    os.remove(os.path.join(self.dir_global_best, f))
                except OSError:
                    pass

            global_img_name = f"GLOBAL_BEST_{frame_id}.jpg"
            cv2.imwrite(os.path.join(self.dir_global_best, global_img_name), frame_img)

            self.global_best = {
                "frame": global_img_name,
                "avg_score": avg_score,
                "conf": mean_conf,
                "score": w_score,
                "coverage": coverage_pct,
                "lat": lat,
                "lon": lon,
                "severity": severity
            }

        # 2. Local 10m Spatial Clustering
        matched = None
        for inc in self.incidents:
            dist = haversine_m(inc["best_lat"], inc["best_lon"], lat, lon)
            if dist <= self.threshold_m:
                matched = inc
                break

        patch_img_name = f"{frame_id}.jpg"

        if matched is not None:
            matched["frames_merged"] += 1
            if avg_score > matched["best_avg_score"]:
                old_img = os.path.join(self.dir_patch_best, matched["best_img_name"])
                if os.path.exists(old_img):
                    try:
                        os.remove(old_img)
                    except OSError:
                        pass

                cv2.imwrite(os.path.join(self.dir_patch_best, patch_img_name), frame_img)
                matched["best_avg_score"] = avg_score
                matched["best_conf"] = mean_conf
                matched["best_score"] = w_score
                matched["best_coverage"] = coverage_pct
                matched["best_lat"] = lat
                matched["best_lon"] = lon
                matched["best_img_name"] = patch_img_name
                matched["severity"] = severity
            return matched["id"]
        else:
            new_id = len(self.incidents) + 1
            cv2.imwrite(os.path.join(self.dir_patch_best, patch_img_name), frame_img)
            self.incidents.append({
                "id": new_id,
                "best_avg_score": avg_score,
                "best_conf": mean_conf,
                "best_score": w_score,
                "best_coverage": coverage_pct,
                "best_lat": lat,
                "best_lon": lon,
                "best_img_name": patch_img_name,
                "severity": severity,
                "frames_merged": 1,
                "video_url": video_path
            })
            return new_id

    def export_telemetry(self):
        for inc in self.incidents:
            iso_timestamp = time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())
            telemetry = {
                "id": f"INC-{int(time.time())}-{inc['id']:03d}",
                "incident_id": f"WATERLOG_PATCH_{inc['id']:03d}",
                "bus_id": "BUS-205",
                "event_type": "waterlogging",
                "status": "detected",
                "camera": "front_dashcam",
                "model": "yolo11n-seg",
                "timestamp": iso_timestamp,
                "frame": inc["best_img_name"],
                "confidence": inc["best_conf"],
                "severity": inc["severity"].lower(),
                "classification": {
                    "severity": inc["severity"],
                    "severity_title": f"{inc['severity']} WATERLOGGING"
                },
                "gps": {
                    "lat": inc["best_lat"],
                    "lon": inc["best_lon"],
                    "speed_kmh": 32.0
                },
                "metrics": {
                    "confidence": inc["best_conf"],
                    "water_hazard_score": inc["best_score"],
                    "road_water_coverage_pct": inc["best_coverage"],
                    "selection_avg_score": inc["best_avg_score"]
                },
                "deduplication_meta": {
                    "cluster_distance_m": self.threshold_m,
                    "continuous_frames_merged": inc["frames_merged"]
                }
            }
            json_path = os.path.join(self.dir_telemetry, inc["best_img_name"].replace(".jpg", ".json"))
            with open(json_path, "w") as jf:
                json.dump(telemetry, jf, indent=2)

        if self.global_best:
            with open(os.path.join(self.dir_global_best, "global_best_meta.json"), "w") as gf:
                json.dump(self.global_best, gf, indent=2)


def process_waterlog_video(video_path, output_root="waterlog_outputs", target_fps=TARGET_FPS):
    dir_all_frames = os.path.join(output_root, "all_annotated_frames")
    dir_patch_best = os.path.join(output_root, "clean_patch_outputs")
    dir_global_best = os.path.join(output_root, "global_best_incident")
    dir_telemetry = os.path.join(output_root, "json_telemetry")

    for d in [dir_all_frames, dir_patch_best, dir_global_best, dir_telemetry]:
        os.makedirs(d, exist_ok=True)

    if not os.path.exists(MODEL_PATH):
        print(f"[!] YOLO weights not found at: {MODEL_PATH}")
        sys.exit(1)

    if not os.path.exists(video_path):
        print(f"[!] Video not found at: {video_path}")
        sys.exit(1)

    print(f"[*] Loading model: {MODEL_PATH}")
    model = YOLO(MODEL_PATH)
    registry = WaterlogSpatialRegistry(output_root=output_root, threshold_m=CLUSTER_DISTANCE_THRESHOLD_M)

    cap = cv2.VideoCapture(video_path)
    native_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    frame_step = max(1, int(round(native_fps / target_fps)))

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    video_out_path = os.path.join(output_root, "output_waterlog.mp4")
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(video_out_path, fourcc, target_fps, (width, height))

    print(f"[*] Processing Video: {video_path}")
    print(f"[*] Extracting @ {target_fps} FPS into '{output_root}/' ...")

    curr_frame = 0
    processed_count = 0

    while curr_frame < total_frames:
        cap.set(cv2.CAP_PROP_POS_FRAMES, curr_frame)
        ret, frame = cap.read()
        if not ret or frame is None:
            break

        processed_count += 1
        h, w, _ = frame.shape
        roi_top, roi_bottom = int(h * 0.30), int(h * 0.95)
        road_pixels = (roi_bottom - roi_top) * w

        results = model.predict(source=frame, conf=BASE_CONF_DETECTION, imgsz=IMG_SIZE, verbose=False)[0]

        full_mask = np.zeros((h, w), dtype=np.uint8)
        confidences = []

        if results.masks is not None and results.boxes is not None:
            boxes_conf = results.boxes.conf.cpu().numpy()
            for idx, mask_tensor in enumerate(results.masks.data):
                m = cv2.resize(mask_tensor.cpu().numpy().astype(np.uint8), (w, h), interpolation=cv2.INTER_NEAREST)
                full_mask = np.bitwise_or(full_mask, m)
                confidences.append(float(boxes_conf[idx]))

        road_mask = np.zeros((h, w), dtype=np.uint8)
        road_mask[roi_top:roi_bottom, :] = full_mask[roi_top:roi_bottom, :]

        water_px = np.count_nonzero(road_mask)
        if water_px < MIN_WATERLOG_AREA_PX:
            water_px = 0
            road_mask[:] = 0
            confidences = []

        coverage = round((water_px / road_pixels) * 100.0 if road_pixels > 0 else 0.0, 2)
        mean_conf = round(float(np.mean(confidences)), 3) if confidences else 0.0
        w_score = round(coverage * mean_conf, 2)
        avg_score = round(((mean_conf * 100.0) + w_score) / 2.0, 2)

        if w_score < 5.0 or coverage < 3.0:
            severity = "NORMAL"
            hud_color = (0, 255, 0)
        elif w_score < 20.0:
            severity = "LOW"
            hud_color = (0, 255, 255)
        elif w_score < 40.0:
            severity = "MODERATE"
            hud_color = (0, 165, 255)
        else:
            severity = "CRITICAL"
            hud_color = (0, 0, 255)

        progress = curr_frame / max(1, total_frames)
        frame_lat, frame_lon = get_frame_gps(progress)

        # Visual Mask Overlay
        annotated = frame.copy()
        annotated[road_mask == 1] = [255, 191, 0]

        # Multi-line HUD Banner that stays within bounds
        annotated = draw_waterlog_hud(
            annotated, w, h, severity, coverage, w_score, avg_score,
            frame_lat, frame_lon, mean_conf, hud_color
        )

        frame_id = f"frame_{processed_count:04d}_{int(time.time())}"

        # 1. Save frame to all_annotated_frames
        cv2.imwrite(os.path.join(dir_all_frames, f"{frame_id}.jpg"), annotated)

        # 2. Write to annotated output video
        out.write(annotated)

        # 3. Register with Spatial Registry
        registry.register_frame(annotated, frame_lat, frame_lon, mean_conf, coverage, w_score, avg_score, severity, frame_id, video_path)

        curr_frame += frame_step

    cap.release()
    out.release()
    registry.export_telemetry()

    print("\n=======================================================")
    print(f" Annotated Video Output       : {video_out_path}")
    print(f" Folder 1 (All Frames)        : {dir_all_frames}/ ({processed_count} frames)")
    print(f" Folder 2 (Patch Best - 10m)  : {dir_patch_best}/ ({len(registry.incidents)} incidents)")
    print(f" Folder 3 (Global Best Event) : {dir_global_best}/ (1 winning frame)")
    print(f" Telemetry Folder             : {dir_telemetry}/")
    print("=======================================================")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Process Recorded Waterlog Video")
    parser.add_argument("--video", default=DEFAULT_VIDEO_PATH, help="Path to input video file")
    parser.add_argument("--output_dir", default="waterlog_outputs", help="Base output directory")
    parser.add_argument("--fps", type=float, default=TARGET_FPS, help="Target FPS sampling")
    args = parser.parse_args()

    process_waterlog_video(video_path=args.video, output_root=args.output_dir, target_fps=args.fps)