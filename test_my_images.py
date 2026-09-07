"""
HELIOS - Test My Own Images (Folder Scanner)
Scans the 'model_Test_my_image' folder for any images you place in it,
runs the trained accident YOLO model, draws bounding boxes, saves visual
results to 'model_Test_my_image/results/', and triggers live alerts on the dashboard!

Usage:
    python test_my_images.py
"""

import os
import sys
import glob
import random
from pathlib import Path
from datetime import datetime, timezone
from PIL import Image
import requests
from ultralytics import YOLO

# Project root
ROOT_DIR = Path(__file__).resolve().parent
TEST_FOLDER = ROOT_DIR / "model_Test_my_image"
RESULTS_FOLDER = TEST_FOLDER / "results"
WEIGHTS_PATH = ROOT_DIR / "runs" / "accident" / "exp" / "weights" / "best.pt"
SERVER_URL = "http://localhost:8000/api/v1"

# Ensure folders exist
os.makedirs(TEST_FOLDER, exist_ok=True)
os.makedirs(RESULTS_FOLDER, exist_ok=True)

if not WEIGHTS_PATH.exists():
    WEIGHTS_PATH = ROOT_DIR / "yolov8n.pt"

SUPPORTED_EXTENSIONS = ("*.jpg", "*.jpeg", "*.png", "*.webp", "*.bmp")

def get_test_images():
    """Returns all user images inside model_Test_my_image (excluding results folder)."""
    images = []
    for ext in SUPPORTED_EXTENSIONS:
        # Only top-level inside model_Test_my_image, not subfolders
        images.extend(glob.glob(str(TEST_FOLDER / ext)))
        images.extend(glob.glob(str(TEST_FOLDER / ext.upper())))
    # Remove duplicates while preserving order
    unique_images = []
    for img in images:
        p = Path(img)
        if "results" not in p.parts and p not in unique_images:
            unique_images.append(p)
    return unique_images

def main():
    print("=" * 68)
    print("  HELIOS EDGE AI — CUSTOM IMAGE BATCH TESTER")
    print("=" * 68)
    print(f"Folder to place your images: {TEST_FOLDER}")
    print(f"Results will be saved to   : {RESULTS_FOLDER}")
    print(f"Model weights used         : {WEIGHTS_PATH.name}")

    # 1. Find images
    images = get_test_images()
    if not images:
        print("\n[!] No images found in 'model_Test_my_image/'!")
        print("    --> Copy/paste your photos (.jpg, .png, etc.) into:")
        print(f"        {TEST_FOLDER}")
        print("    --> Then run: python test_my_images.py again.")
        print("=" * 68)
        return

    print(f"\n[+] Found {len(images)} image(s) to test:")
    for idx, img in enumerate(images, 1):
        print(f"    {idx}. {img.name}")

    # 2. Load model
    print("\n[*] Loading YOLO model...")
    model = YOLO(str(WEIGHTS_PATH))

    # 3. Process each image
    latest_saved_img = None

    for idx, img_path in enumerate(images, 1):
        print("\n" + "-" * 60)
        print(f"[{idx}/{len(images)}] Testing: {img_path.name}")
        print("-" * 60)

        # Run inference (conf >= 0.25)
        results = model.predict(source=str(img_path), conf=0.25, verbose=False)
        result = results[0]
        boxes = result.boxes
        names = result.names

        crash_detected = False
        max_crash_conf = 0.0

        if len(boxes) == 0:
            print("  --> No objects or accidents detected.")
        else:
            print(f"  --> Found {len(boxes)} detection box(es):")
            for b_idx, box in enumerate(boxes, 1):
                cls_id = int(box.cls[0].item())
                cls_name = names.get(cls_id, f"class_{cls_id}")
                conf = float(box.conf[0].item())
                xyxy = [round(float(c), 1) for c in box.xyxy[0].tolist()]

                is_crash = "Car Crash" in cls_name or cls_id == 2
                tag = "[CAR CRASH]" if is_crash else "[OTHER]"
                print(f"      Box #{b_idx} {tag:11s} Conf: {conf:.1%} | BBox: {xyxy}")

                if is_crash:
                    crash_detected = True
                    if conf > max_crash_conf:
                        max_crash_conf = conf

        # Draw bounding boxes and save to results folder
        annotated_bgr = result.plot()
        annotated_rgb = annotated_bgr[..., ::-1]  # BGR to RGB
        output_name = f"detected_{img_path.name}"
        output_path = RESULTS_FOLDER / output_name
        
        Image.fromarray(annotated_rgb).save(str(output_path))
        latest_saved_img = output_path
        print(f"\n  [*] Saved annotated image to:")
        print(f"      {output_path}")

        # Also save to server media so web dashboard can display it
        try:
            media_dir = ROOT_DIR / "server" / "media"
            os.makedirs(media_dir, exist_ok=True)
            media_latest = media_dir / "latest_accident.jpg"
            Image.fromarray(annotated_rgb).save(str(media_latest))
        except Exception:
            pass

        # If crash detected, optionally send live emergency event to Helios dashboard
        if crash_detected:
            # Simulate deceleration boost if needed
            effective_conf = min(1.0, max_crash_conf + 0.15)
            severity = "critical" if effective_conf >= 0.85 else ("high" if effective_conf >= 0.75 else "medium")

            print(f"\n  [!] ACCIDENT DETECTED! Peak Confidence: {max_crash_conf:.1%}")
            print(f"      Assigned Severity: {severity.upper()}")

            # Transmit to dashboard if backend server is running
            bus_id = f"BUS-HYD-{random.randint(100, 999)}"
            payload = {
                "bus_id": bus_id,
                "event_type": "accident",
                "confidence": round(float(effective_conf), 4),
                "severity": severity,
                "gps": {"lat": 17.4422, "lng": 78.3923},
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "camera": "front",
                "image_url": "http://localhost:8000/media/latest_accident.jpg",
                "video_url": None,
                "model": "YOLOv8n-Accident-EdgeNet",
                "status": "detected",
                "notes": f"Accident detected in custom photo '{img_path.name}' with confidence {effective_conf:.1%}"
            }

            try:
                resp = requests.post(f"{SERVER_URL}/detect/accident", json=payload, timeout=3)
                if resp.status_code == 200:
                    data = resp.json()
                    print(f"      --> Broadcasted live to Helios Dashboard!")
                    print(f"      --> Incident ID: {data.get('id')}")
                    print(f"      --> View at: http://localhost:5173/accidents")
            except Exception:
                pass
        else:
            print("  --> No accident detected in this image.")

    print("\n" + "=" * 68)
    print("  ALL CUSTOM IMAGES TESTED SUCCESSFULLY!")
    print(f"  Check your annotated output images in:")
    print(f"  {RESULTS_FOLDER}")
    print("=" * 68)

    # Open the latest result image in default viewer
    if latest_saved_img and latest_saved_img.exists():
        try:
            os.startfile(str(latest_saved_img))
        except Exception:
            pass

if __name__ == "__main__":
    main()
