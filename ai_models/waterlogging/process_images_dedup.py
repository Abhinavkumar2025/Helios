import os
import sys
import math
import time
import json
import glob
import cv2
import numpy as np
import geocoder
from PIL import Image
from PIL.ExifTags import TAGS, GPSTAGS
from ultralytics import YOLO

# ======================= CONFIGURATION =======================
INPUT_IMAGES_DIR = "test_media"              # Folder containing test photos
CLUSTER_DISTANCE_THRESHOLD_M = 10.0          # 10-meter continuous threshold
BASE_CONF_DETECTION = 0.25                   # Detection confidence threshold
MIN_WATERLOG_AREA_PX = 4000                  # Minimum accumulated water pixels
IMG_SIZE = 640

MODEL_PATH = os.path.join("weights", "waterlog_best.pt")

# Three distinct output folders
DIR_ALL_FRAMES = "dashcam_all_processed_frames"       # Folder 1: All annotated photos
DIR_PATCH_BEST = "dashcam_clean_outputs"              # Folder 2: Best photo per 10m cluster
DIR_GLOBAL_BEST = "dashcam_global_best_incident"      # Folder 3: Overall session winner photo
DIR_TELEMETRY = "dashcam_telemetry_dedup"             # Deduplicated telemetry JSONs
# =============================================================

os.makedirs(DIR_ALL_FRAMES, exist_ok=True)
os.makedirs(DIR_PATCH_BEST, exist_ok=True)
os.makedirs(DIR_GLOBAL_BEST, exist_ok=True)
os.makedirs(DIR_TELEMETRY, exist_ok=True)

# ----------------- GPS EXTRACTION & FALLBACK -----------------
def get_laptop_coordinates():
    try:
        g = geocoder.ip('me')
        if g.ok and g.latlng:
            print(f"[+] Using Laptop Live Location: Lat {g.latlng[0]}, Lon {g.latlng[1]} ({g.city or 'Local'})")
            return float(g.latlng[0]), float(g.latlng[1])
    except Exception as e:
        print(f"[!] Geolocation fallback used: {e}")
    return 16.5062, 80.6480

laptop_lat, laptop_lon = get_laptop_coordinates()

def extract_exif_gps(image_path):
    """Attempts to extract real latitude and longitude from photo EXIF tags."""
    try:
        with Image.open(image_path) as pil_img:
            exif = pil_img._getexif()
            if not exif:
                return None

            gps_info = {}
            for tag_id, val in exif.items():
                tag_name = TAGS.get(tag_id, tag_id)
                if tag_name == "GPSInfo":
                    for t in val:
                        gps_info[GPSTAGS.get(t, t)] = val[t]

            if "GPSLatitude" in gps_info and "GPSLongitude" in gps_info:
                def to_deg(coord, ref):
                    d = float(coord[0])
                    m = float(coord[1])
                    s = float(coord[2])
                    deg = d + (m / 60.0) + (s / 3600.0)
                    if ref in ['S', 'W']:
                        deg = -deg
                    return deg

                lat = to_deg(gps_info["GPSLatitude"], gps_info.get("GPSLatitudeRef", "N"))
                lon = to_deg(gps_info["GPSLongitude"], gps_info.get("GPSLongitudeRef", "E"))
                return round(lat, 6), round(lon, 6)
    except Exception:
        pass
    return None

def haversine_m(lat1, lon1, lat2, lon2):
    R = 6371000.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2.0)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2.0)**2
    return R * (2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a)))

# ----------------- 10M SPATIAL REGISTRY -----------------
class WaterlogSpatialRegistry:
    def __init__(self, threshold_m=10.0):
        self.threshold_m = threshold_m
        self.incidents = []
        self.global_best = None

    def register_frame(self, frame_img, lat, lon, mean_conf, coverage_pct, w_score, avg_score, severity, frame_id, original_name):
        if severity == "NORMAL" or w_score <= 0.0:
            return None

        # 1. Update Global Winner across all images
        if (self.global_best is None) or (avg_score > self.global_best["avg_score"]):
            for f in os.listdir(DIR_GLOBAL_BEST):
                try:
                    os.remove(os.path.join(DIR_GLOBAL_BEST, f))
                except OSError:
                    pass

            global_img_name = f"GLOBAL_BEST_{frame_id}.jpg"
            cv2.imwrite(os.path.join(DIR_GLOBAL_BEST, global_img_name), frame_img)

            self.global_best = {
                "frame": global_img_name,
                "original_source": original_name,
                "avg_score": avg_score,
                "conf": mean_conf,
                "score": w_score,
                "coverage": coverage_pct,
                "lat": lat,
                "lon": lon,
                "severity": severity
            }
            print(f"[★ GLOBAL WINNER] New highest score: {avg_score:.2f} @ ({lat}, {lon})")

        # 2. Match 10m Cluster
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
                print(f"[*] Updated Cluster #{matched['id']} | Higher Avg: {avg_score:.2f} @ ({lat}, {lon})")
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
                "frames_merged": 1,
                "original_source": original_name
            })
            print(f"[+] New Waterlogged Zone #{new_id} Detected @ ({lat}, {lon}) | Avg: {avg_score:.2f}")
            return new_id

    def export_telemetry(self):
        """Writes unified municipal telemetry JSONs for each deduplicated incident."""
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
                "video_url": "image_batch_mode",
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
                    "speed_kmh": 0.0
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
                    "selection_avg_score": inc["best_avg_score"],
                    "source_image": inc.get("original_source", "")
                }),
                "notes": f"Representative incident photo retained with highest score across continuous {self.threshold_m}m patch"
            }

            json_path = os.path.join(DIR_TELEMETRY, inc["best_img_name"].replace(".jpg", ".json"))
            with open(json_path, "w") as jf:
                json.dump(telemetry, jf, indent=2)

        if self.global_best:
            with open(os.path.join(DIR_GLOBAL_BEST, "global_best_meta.json"), "w") as gf:
                json.dump(self.global_best, gf, indent=2)

# ======================= MAIN PIPELINE =======================
if not os.path.exists(MODEL_PATH):
    print(f"[!] Model not found at: {MODEL_PATH}")
    sys.exit(1)

# Search for all image formats including webp
supported_exts = ("*.jpg", "*.jpeg", "*.png", "*.bmp", "*.webp")
image_files = []
for ext in supported_exts:
    image_files.extend(glob.glob(os.path.join(INPUT_IMAGES_DIR, ext)))

if not image_files:
    print(f"[!] No images found in: {INPUT_IMAGES_DIR}")
    sys.exit(1)

print(f"[*] Found {len(image_files)} images to process. Loading model...")
model = YOLO(MODEL_PATH)
registry = WaterlogSpatialRegistry(threshold_m=CLUSTER_DISTANCE_THRESHOLD_M)

for idx, img_path in enumerate(sorted(image_files), start=1):
    # Robust loading: works for .webp, .png, .jpg without libwebp decoding errors
    try:
        with Image.open(img_path) as pil_img:
            frame = cv2.cvtColor(np.array(pil_img.convert("RGB")), cv2.COLOR_RGB2BGR)
    except Exception as e:
        print(f"[!] Could not load {img_path}: {e}")
        continue

    h, w, _ = frame.shape
    roi_top, roi_bottom = int(h * 0.30), int(h * 0.95)
    road_pixels = (roi_bottom - roi_top) * w

    results = model.predict(source=frame, conf=BASE_CONF_DETECTION, imgsz=IMG_SIZE, verbose=False)[0]

    full_mask = np.zeros((h, w), dtype=np.uint8)
    confidences = []

    if results.masks is not None and results.boxes is not None:
        boxes_conf = results.boxes.conf.cpu().numpy()
        for b_idx, mask_tensor in enumerate(results.masks.data):
            m = cv2.resize(mask_tensor.cpu().numpy().astype(np.uint8), (w, h), interpolation=cv2.INTER_NEAREST)
            full_mask = np.bitwise_or(full_mask, m)
            confidences.append(float(boxes_conf[b_idx]))

    # Restrict to road ROI
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

    # GPS coordinates: EXIF first, fallback to progression offset from laptop coordinates
    exif_coords = extract_exif_gps(img_path)
    if exif_coords:
        lat, lon = exif_coords
    else:
        offset = idx * 0.00008  # ~8-9 meters progression per image
        lat = round(laptop_lat + offset, 6)
        lon = round(laptop_lon + offset, 6)

    # Annotated HUD Frame
    annotated = frame.copy()
    annotated[road_mask == 1] = [255, 191, 0]
    cv2.putText(annotated, f"{severity} | Conf: {mean_conf:.2f} | Haz: {w_score} | Avg: {avg_score}",
                (25, 45), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 255, 255), 2)

    base_name = os.path.splitext(os.path.basename(img_path))[0]
    frame_id = f"img_{idx:04d}_{int(time.time())}"

    # FOLDER 1: Save every processed image
    cv2.imwrite(os.path.join(DIR_ALL_FRAMES, f"{frame_id}.jpg"), annotated)

    # FOLDER 2 & 3: Register for 10m spatial clustering & global best
    registry.register_frame(annotated, lat, lon, mean_conf, coverage, w_score, avg_score, severity, frame_id, base_name)

registry.export_telemetry()

print("\n=======================================================")
print(f" Total Images Processed          : {len(image_files)}")
print(f" Folder 1 (All Processed)        : {DIR_ALL_FRAMES}/")
print(f" Folder 2 (Patch Best - 10m)     : {DIR_PATCH_BEST}/ ({len(registry.incidents)} incidents)")
print(f" Folder 3 (Global Best Overall)  : {DIR_GLOBAL_BEST}/ (1 single winning image)")
print(f" Telemetry Folder                : {DIR_TELEMETRY}/")
print("=======================================================")