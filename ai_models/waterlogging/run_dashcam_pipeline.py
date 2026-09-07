import os
import sys
import time
import json
import urllib.request
import cv2
import numpy as np
from ultralytics import YOLO

# ---------------- CONFIGURATION ----------------
PHONE_IP = "10.1.83.49"
PHONE_PORT = "8080"

STREAM_URL = f"http://{PHONE_IP}:{PHONE_PORT}/video"
SENSORS_URL = f"http://{PHONE_IP}:{PHONE_PORT}/sensors.json"

TARGET_FPS = 5.0
SAMPLE_INTERVAL_SEC = 1.0 / TARGET_FPS  # 0.20 seconds per frame (5 FPS)

BASE_CONF_DETECTION = 0.35
MIN_WATERLOG_AREA_PX = 6000
IMG_SIZE = 640

MODEL_PATH = os.path.join("weights", "waterlog_best.pt")
OUTPUT_CLEAN_DIR = "dashcam_clean_outputs"
OUTPUT_TELEMETRY_DIR = "dashcam_telemetry"
# -----------------------------------------------

os.makedirs(OUTPUT_CLEAN_DIR, exist_ok=True)
os.makedirs(OUTPUT_TELEMETRY_DIR, exist_ok=True)

if not os.path.exists(MODEL_PATH):
    print(f"[!] Model weights not found at: {MODEL_PATH}")
    sys.exit(1)

print("[*] Loading YOLO model...")
model = YOLO(MODEL_PATH)
print("[+] Model loaded successfully.")

# Cache GPS so sensor polling does not throttle high-rate (5 FPS) inference
last_known_gps = {"lat": 16.5062, "lon": 80.6480, "speed_kmh": 25.0, "source": "FALLBACK_GPS"}
last_gps_fetch_time = 0.0

def fetch_phone_gps():
    global last_known_gps, last_gps_fetch_time
    now = time.time()
    # Refresh GPS at most once every 1.0s to avoid HTTP socket congestion
    if now - last_gps_fetch_time < 1.0:
        return last_known_gps

    try:
        req = urllib.request.Request(SENSORS_URL, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=0.3) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            gps_info = data.get("gps", {}).get("data", [])
            if gps_info:
                latest = gps_info[-1][1]
                last_known_gps = {
                    "lat": round(float(latest[0]), 6),
                    "lon": round(float(latest[1]), 6),
                    "speed_kmh": round(float(latest[3]) * 3.6, 1) if len(latest) > 3 and latest[3] else 25.0,
                    "source": "PHONE_HARDWARE_GPS"
                }
                last_gps_fetch_time = now
    except Exception:
        pass
    return last_known_gps

def evaluate_waterlog_hazard(road_coverage_pct, mean_conf):
    w_score = round(road_coverage_pct * mean_conf, 2)
    if w_score < 5.0 or road_coverage_pct < 3.0:
        return "CLEAR / DRY", "NORMAL", w_score, [0, 255, 0, 160], (0, 255, 0), False
    elif w_score < 20.0:
        return "MINOR ACCUMULATION", "LOW", w_score, [255, 255, 0, 180], (0, 255, 255), False
    elif w_score < 40.0:
        return "MODERATE WATERLOGGING", "MODERATE", w_score, [255, 140, 0, 210], (0, 165, 255), True
    else:
        return "CRITICAL HAZARD (FLOODED)", "CRITICAL", w_score, [230, 0, 0, 240], (0, 0, 255), True

def process_frame(frame, frame_idx):
    h, w, _ = frame.shape
    roi_top, roi_bottom = int(h * 0.25), int(h * 0.95)
    road_pixels = (roi_bottom - roi_top) * w

    t0 = time.perf_counter()
    results = model.predict(source=frame, conf=BASE_CONF_DETECTION, imgsz=IMG_SIZE, verbose=False)[0]
    latency_ms = (time.perf_counter() - t0) * 1000

    full_mask = np.zeros((h, w), dtype=np.uint8)
    confidence_scores = []

    if results.masks is not None and results.boxes is not None:
        boxes_conf = results.boxes.conf.cpu().numpy()
        for idx, mask_t in enumerate(results.masks.data):
            m = cv2.resize(mask_t.cpu().numpy().astype(np.uint8), (w, h), interpolation=cv2.INTER_NEAREST)
            if np.count_nonzero(m[roi_top:roi_bottom, :]) >= MIN_WATERLOG_AREA_PX:
                full_mask = np.bitwise_or(full_mask, m)
                confidence_scores.append(float(boxes_conf[idx]))

    road_mask = full_mask[roi_top:roi_bottom, :]
    water_px = np.count_nonzero(road_mask)
    road_coverage_pct = round((water_px / road_pixels) * 100.0 if road_pixels > 0 else 0.0, 2)
    mean_conf = round(float(np.mean(confidence_scores)), 3) if confidence_scores else 0.0

    title, alert_lvl, w_score, rgba, cv_col, alert = evaluate_waterlog_hazard(road_coverage_pct, mean_conf)
    gps_data = fetch_phone_gps()

    file_id = f"phone_frame_{int(time.time() * 1000)}"  # Milliseconds to ensure unique filenames at 5 FPS
    telemetry = {
        "frame": f"{file_id}.jpg",
        "frame_index": frame_idx,
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "severity": alert_lvl,
        "severity_title": title,
        "water_hazard_score": w_score,
        "road_water_coverage_pct": road_coverage_pct,
        "latency_ms": round(latency_ms, 2),
        "marker_rgba": rgba,
        "gps": gps_data,
        "metrics": {
            "road_water_coverage_pct": road_coverage_pct,
            "mean_confidence": mean_conf,
            "water_hazard_score": w_score
        },
        "classification": {"severity": alert_lvl, "severity_title": title, "needs_driver_alert": alert}
    }

    # Visual HUD Overlay
    overlay = frame.copy()
    overlay[full_mask == 1] = [255, 191, 0]
    annotated = cv2.addWeighted(overlay, 0.45, frame, 0.55, 0)
    cv2.line(annotated, (0, roi_top), (w, roi_top), (180, 180, 180), 1)
    cv2.line(annotated, (0, roi_bottom), (w, roi_bottom), (100, 100, 255), 1)
    cv2.rectangle(annotated, (10, 10), (620, 95), (20, 20, 20), -1)
    cv2.putText(annotated, f"Status: {title}", (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.65, cv_col, 2)
    cv2.putText(annotated, f"Water: {road_coverage_pct}% | Score: {w_score} | GPS: {gps_data['lat']}, {gps_data['lon']}",
                (20, 75), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1)

    cv2.imwrite(os.path.join(OUTPUT_CLEAN_DIR, f"{file_id}.jpg"), annotated)
    with open(os.path.join(OUTPUT_TELEMETRY_DIR, f"{file_id}.json"), "w") as jf:
        json.dump(telemetry, jf, indent=2)

    print(f"[+] Frame #{frame_idx:04d} @ 5 FPS | Score: {w_score:5.2f} ({alert_lvl}) | Latency: {latency_ms:.1f}ms")

# ----------------- RECONNECTING DAEMON LOOP -----------------
print(f"[*] Starting Persistent Dashcam Daemon @ {TARGET_FPS} FPS.")
print("--- CONTROLS ---")
print(" [S]     : Toggle 5 FPS Auto-Sampling (ON / OFF)")
print(" [SPACE] : Force Capture Single Frame Now")
print(" [Q]     : Quit Program Completely")

auto_mode = True
last_capture_time = 0.0
frame_idx = 0

while True:
    print(f"\n[*] Connecting to Phone Camera: {STREAM_URL} ...")
    cap = cv2.VideoCapture(STREAM_URL)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

    if not cap.isOpened():
        print("[!] Mobile server is offline. Waiting to reconnect...")
        time.sleep(2)
        continue

    print("[+] Phone Connected! Stream active.")

    while True:
        ret, frame = cap.read()
        
        if not ret or frame is None:
            print("[!] Phone stream dropped. Reconnecting...")
            cap.release()
            cv2.destroyAllWindows()
            time.sleep(1.5)
            break

        now = time.time()
        preview = frame.copy()

        if auto_mode:
            msg = f"AUTO 5-FPS STREAMING ACTIVE | [S] Pause"
            color = (0, 255, 0)
        else:
            msg = "PAUSED | [S] Resume (5 FPS) | [SPACE] Single Shot | [Q] Quit"
            color = (0, 165, 255)

        cv2.rectangle(preview, (10, 10), (760, 50), (20, 20, 20), -1)
        cv2.putText(preview, msg, (20, 38), cv2.FONT_HERSHEY_SIMPLEX, 0.55, color, 2)
        cv2.imshow("Phone Dashcam Viewfinder", preview)

        # 5 FPS Trigger (fires every 0.20s)
        if auto_mode and (now - last_capture_time >= SAMPLE_INTERVAL_SEC):
            last_capture_time = now
            frame_idx += 1
            process_frame(frame, frame_idx)

        key = cv2.waitKey(1) & 0xFF
        if key == ord('s') or key == ord('S'):
            auto_mode = not auto_mode
            last_capture_time = now
            print(f"[*] Auto-Capture toggled: {auto_mode}")
        elif key == 32:  # Spacebar manual frame
            frame_idx += 1
            process_frame(frame, frame_idx)
        elif key == ord('q') or key == ord('Q'):
            print("[*] Exiting program cleanly.")
            cap.release()
            cv2.destroyAllWindows()
            sys.exit(0)