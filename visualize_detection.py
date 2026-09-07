"""
HELIOS - Visual Accident Detection Inspector
Runs YOLOv8 model inference on any image and displays detection bounding boxes.

Usage:
    python visualize_detection.py
    python visualize_detection.py "path/to/any_image.jpg"
"""

import os
import sys
from pathlib import Path
from PIL import Image
from ultralytics import YOLO

# Project root
ROOT_DIR = Path(__file__).resolve().parent
WEIGHTS_PATH = ROOT_DIR / "ai_models" / "accident" / "weights" / "best.pt"
if not WEIGHTS_PATH.exists():
    WEIGHTS_PATH = ROOT_DIR / "ai_models" / "accident" / "runs" / "accident" / "exp" / "weights" / "best.pt"
if not WEIGHTS_PATH.exists():
    WEIGHTS_PATH = ROOT_DIR / "runs" / "accident" / "exp" / "weights" / "best.pt"
if not WEIGHTS_PATH.exists():
    WEIGHTS_PATH = ROOT_DIR / "yolov8n.pt"


def main():
    print("=" * 65)
    print("  HELIOS - VISUAL ACCIDENT DETECTION INSPECTOR")
    print("=" * 65)

    # 1. Determine image source
    if len(sys.argv) > 1 and not sys.argv[1].startswith("-"):
        image_path = Path(sys.argv[1]).resolve()
        if not image_path.exists():
            print(f"[!] File not found: {image_path}")
            return
    else:
        # Default to a verified car accident test image
        default_img = ROOT_DIR / "ai_models" / "accident" / "valid" / "images" / "images_146_jpg.rf.502eedbb5b68c5be64755efb79e1a366.jpg"
        if not default_img.exists():
            default_img = ROOT_DIR / "ai_models" / "accident" / "train" / "images" / "images_150_jpg.rf.67192f0fd5272420da2b4bfc3431b581.jpg"
        image_path = default_img

    print(f"[1] Target Image : {image_path.name}")
    print(f"[2] Model Weights: {WEIGHTS_PATH}")

    # 2. Load YOLO Model
    print("\n[*] Loading YOLOv8 model...")
    model = YOLO(str(WEIGHTS_PATH))

    # 3. Predict on image
    print(f"[*] Running inference on {image_path.name}...")
    results = model.predict(
        source=str(image_path),
        conf=0.25,  # show detections with >= 25% confidence
        verbose=False
    )

    result = results[0]
    boxes = result.boxes
    names = result.names

    print(f"\n[3] Detection Results ({len(boxes)} boxes found):")
    crash_detected = False
    max_conf = 0.0

    for i, box in enumerate(boxes):
        cls_id = int(box.cls[0].item())
        cls_name = names.get(cls_id, f"class_{cls_id}")
        conf = float(box.conf[0].item())
        xyxy = [round(float(c), 1) for c in box.xyxy[0].tolist()]

        is_crash = "Car Crash" in cls_name or cls_id == 2
        tag = "[CRASH]" if is_crash else "[OTHER]"
        
        print(f"    Box #{i+1} {tag}: Conf={conf:.1%} | Bounding Box [x1, y1, x2, y2]={xyxy}")
        if is_crash:
            crash_detected = True
            if conf > max_conf:
                max_conf = conf

    # 4. Save visual result with drawn bounding boxes
    annotated_bgr = result.plot()
    annotated_rgb = annotated_bgr[..., ::-1]  # Convert BGR to RGB
    
    # Save to project root and server media folder
    output_local = ROOT_DIR / "detected_preview.jpg"
    media_output = ROOT_DIR / "server" / "media" / "latest_accident.jpg"
    
    Image.fromarray(annotated_rgb).save(str(output_local))
    os.makedirs(media_output.parent, exist_ok=True)
    Image.fromarray(annotated_rgb).save(str(media_output))

    print(f"\n[4] Visual Output Saved:")
    print(f"    --> Local image  : {output_local.resolve()}")
    print(f"    --> Dashboard URL: http://localhost:8000/media/latest_accident.jpg")

    if crash_detected:
        print(f"\n>>> ACCIDENT CONFIRMED with peak confidence {max_conf:.1%}!")
    else:
        print("\n>>> No accident detected in this image (or confidence < 25%).")

    # 5. Open image automatically on Windows
    try:
        os.startfile(str(output_local))
        print("    (Opened preview image in your default image viewer)")
    except Exception:
        pass

    print("=" * 65)

if __name__ == "__main__":
    main()
