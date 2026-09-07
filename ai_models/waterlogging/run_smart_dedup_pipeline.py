import os
import sys
import math
import time
import json
import cv2
import numpy as np
# pyrefly: ignore [missing-import]
import geocoder
from ultralytics import YOLO

# ======================= CONFIGURATION =======================
INPUT_VIDEO_PATH = "test_media/sampl1.mp4"   # Point to your video
TARGET_FPS = 4.0                            # Process at 4 frames per second
CLUSTER_DISTANCE_THRESHOLD_M = 10.0         # 10m range for continuous waterlogging
BASE_CONF_DETECTION = 0.25                  # Detection confidence threshold
MIN_WATERLOG_AREA_PX = 4000                 # Minimum accumulated pixel area to consider real water
IMG_SIZE = 640

MODEL_PATH = os.path.join("weights", "waterlog_best.pt")

# Three distinct output folders
DIR_ALL_FRAMES = "dashcam_all_processed_frames"       # Folder 1: All 4-FPS processed frames
DIR_PATCH_BEST = "dashcam_clean_outputs"              # Folder 2: Best frame per 10m continuous patch
DIR_GLOBAL_BEST = "dashcam_global_best_incident"      # Folder 3: The single overall best frame of all waterlogging
DIR_TELEMETRY = "dashcam_telemetry_dedup"             # Deduplicated telemetry JSON records

# Optional: Explicit GPS bounds. If None, uses laptop geolocation fallback.
EXPLICIT_START_GPS = None
EXPLICIT_END_GPS   = None
# =============================================================

os.makedirs(DIR_ALL_FRAMES, exist_ok=True)
os.makedirs(DIR_PATCH_BEST, exist_ok=True)
os.makedirs(DIR_GLOBAL_BEST, exist_ok=True)
os.makedirs(DIR_TELEMETRY, exist_ok=True)

# ----------------- GPS FALLBACK HANDLER -----------------
def get_laptop_coordinates():
    try:
        g = geocoder.ip('me')
        if g.ok and g.latlng:
            print(f"[+] Using Laptop Live Location: Lat {g.latlng[0]}, Lon {g.latlng[1]} ({g.city or 'Local'})")
            return float(g.latlng[0]), float(g.latlng[1])
    except Exception as e:
        print(f"[!] Geolocation lookup failed ({e}). Defaulting to fallback coordinates.")
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

# ----------------- 10M SPATIAL CLUSTER REGISTRY -----------------
class WaterlogSpatialRegistry:
    def __init__(self, threshold_m=10.0):
        self.threshold_m = threshold_m
        self.incidents = []
        self.global_best = None  # Tracks the single best frame across all patches

    def register_frame(self, frame_img, lat, lon, mean_conf, coverage_pct, w_score, avg_score, severity, frame_id):
        if severity == "NORMAL" or w_score <= 0.0:
            return None

        # 1. Update Global Best Frame across all patches
        if (self.global_best is None) or (avg_score > self.global_best["avg_score"]):
            # Wipe previous global best image so only 1 file exists in the folder
            for f in os.listdir(DIR_GLOBAL_BEST):
                try:
                    os.remove(os.path.join(DIR_GLOBAL_BEST, f))
                except OSError:
                    pass

            global_img_name = f"GLOBAL_BEST_{frame_id}.jpg"
            cv2.imwrite(os.path.join(DIR_GLOBAL_BEST, global_img_name), frame_img)

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
            print(f"[★ GLOBAL WINNER] New highest score across all waterlogging: {avg_score:.2f} @ ({lat}, {lon})")

        # 2. Local 10m Cluster Logic
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
                # Remove prior lower-scoring patch frame
                old_img = os.path.join(DIR_PATCH_BEST, matched["best_img_name"])
                if os.path.exists(old_img):
                    try:
                        os.remove(old_img)
                    except OSError:
                        pass

                cv2.imwrite(os.path.join(DIR_PATCH_BEST, patch_img_name), frame_img)

                matched["best_avg_score"] = avg_score
                matched["best_conf"] = mean_conf
                matched["best_score"] = w_score
                matched["best_coverage"] = coverage_pct
                matched["best_lat"] = lat
                matched["best_lon"] = lon
                matched["best_img_name"] = patch_img_name
                matched["severity"] = severity
                print(f"[*] Updated Continuous Zone #{matched['id']} | Higher Avg: {avg_score:.2f} @ ({lat}, {lon})")
            return matched["id"]

        else:
            new_id = len(self.incidents) + 1
            cv2.imwrite(os.path.join(DIR_PATCH_BEST, patch_img_name), frame_img)

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
                "frames_merged": 1
            })
            print(f"[+] New Waterlogged Zone #{new_id} Detected @ ({lat}, {lon}) | Avg: {avg_score:.2f}")
            return new_id

    def export_telemetry(self):
        """Writes unified municipal telemetry JSONs for each deduplicated waterlogging incident."""
        for inc in self.incidents:
            iso_timestamp = time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())
            
            telemetry = {
                "id": f"INC-{int(time.time())}-{inc['id']:03d}",
                "incident_id": f"WATERLOG_PATCH_{inc['id']:03d}",
                "bus_id": "BUS-205",
                "event_type": "waterlogging",
                "status": "detected",
                "camera": "front",
                "model": "yolo11n-seg",
                "timestamp": iso_timestamp,
                "frame": inc["best_img_name"],
                "image_url": f"/media/detections/dashcam_clean_outputs/{inc['best_img_name']}",
                "video_url": INPUT_VIDEO_PATH,
                "confidence": inc["best_conf"],
                "severity": inc["severity"].lower(),
                "classification": {
                    "severity": inc["severity"],
                    "severity_title": f"{inc['severity']} WATERLOGGING"
                },
                "gps": {
                    "lat": inc["best_lat"],
                    "lon": inc["best_lon"],
                    "lng": inc["best_lon"],
                    "speed_kmh": 32.0
                },
                "metrics": {
                    "confidence": inc["best_conf"],
                    "mean_confidence": inc["best_conf"],
                    "water_hazard_score": inc["best_score"],
                    "road_water_coverage_pct": inc["best_coverage"],
                    "selection_avg_score": inc["best_avg_score"]
                },
                "deduplication_meta": {
                    "cluster_distance_m": self.threshold_m,
                    "continuous_frames_merged": inc["frames_merged"],
                    "selection_criteria": "HIGHEST_AVG_CONFIDENCE_AND_HAZARD_SCORE"
                },
                "metadata_json": json.dumps({
                    "cluster_radius_m": self.threshold_m,
                    "continuous_frames_merged": inc["frames_merged"],
                    "selection_avg_score": inc["best_avg_score"]
                }),
                "notes": f"Representative incident frame retained with highest score across continuous {self.threshold_m}m patch"
            }

            json_path = os.path.join(DIR_TELEMETRY, inc["best_img_name"].replace(".jpg", ".json"))
            with open(json_path, "w") as jf:
                json.dump(telemetry, jf, indent=2)
        # Export metadata for the single global best frame
        if self.global_best:
            with open(os.path.join(DIR_GLOBAL_BEST, "global_best_meta.json"), "w") as gf:
                json.dump(self.global_best, gf, indent=2)

# ======================= MAIN PIPELINE =======================
if not os.path.exists(MODEL_PATH):
    print(f"[!] YOLO weights not found at: {MODEL_PATH}")
    sys.exit(1)

if not os.path.exists(INPUT_VIDEO_PATH):
    print(f"[!] Input video not found at: {INPUT_VIDEO_PATH}")
    sys.exit(1)

print(f"[*] Loading model: {MODEL_PATH} ...")
model = YOLO(MODEL_PATH)

registry = WaterlogSpatialRegistry(threshold_m=CLUSTER_DISTANCE_THRESHOLD_M)

cap = cv2.VideoCapture(INPUT_VIDEO_PATH)
native_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
frame_step = max(1, int(round(native_fps / TARGET_FPS)))

print(f"[*] Extraction Rate: {TARGET_FPS} FPS (Sampling every {frame_step} frames)")

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

    # Restrict segmentation to road ROI
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
    elif w_score < 20.0:
        severity = "LOW"
    elif w_score < 40.0:
        severity = "MODERATE"
    else:
        severity = "CRITICAL"

    progress = curr_frame / max(1, total_frames)
    frame_lat, frame_lon = get_frame_gps(progress)

    # Annotated HUD Frame
    annotated = frame.copy()
    annotated[road_mask == 1] = [255, 191, 0]
    cv2.putText(annotated, f"{severity} | Conf: {mean_conf:.2f} | Haz: {w_score} | Avg: {avg_score}", 
                (25, 45), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 255, 255), 2)

    frame_id = f"frame_{processed_count:04d}_{int(time.time())}"

    # FOLDER 1: Save every 4-FPS processed frame
    cv2.imwrite(os.path.join(DIR_ALL_FRAMES, f"{frame_id}.jpg"), annotated)

    # FOLDER 2 & 3: Save patch best (10m) and single global best frame
    registry.register_frame(annotated, frame_lat, frame_lon, mean_conf, coverage, w_score, avg_score, severity, frame_id)

    curr_frame += frame_step

cap.release()
registry.export_telemetry()

print("\n=======================================================")
print(f" Folder 1 (All 4-FPS Frames)    : {DIR_ALL_FRAMES}/ ({processed_count} frames)")
print(f" Folder 2 (Patch Best - 10m)     : {DIR_PATCH_BEST}/ ({len(registry.incidents)} incidents)")
print(f" Folder 3 (Global Best Overall)  : {DIR_GLOBAL_BEST}/ (1 single winning frame)")
print(f" Telemetry Folder               : {DIR_TELEMETRY}/")
print("=======================================================")