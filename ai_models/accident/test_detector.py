"""
Helios Accident Detector Live Verification Script
Simulates a Jetson edge device running real inference with best.pt
and posting the detection event to the Helios Central Command.
"""
import glob
import os
import random
import sys
from pathlib import Path

# Add project root to sys.path
root_dir = Path(__file__).resolve().parent.parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from ai_models.accident.detector_stub import JetsonAccidentDetector

def main():
    print("=" * 65)
    print("  HELIOS EDGE AI — ACCIDENT DETECTOR LIVE VERIFICATION")
    print("=" * 65)

    # 1. Initialize Detector with best.pt
    bus_id = f"BUS-HYD-{random.randint(100, 999)}"
    detector = JetsonAccidentDetector(bus_id=bus_id, server_url="http://localhost:8000/api/v1")
    print(f"[1] Initialized Jetson detector for bus: {bus_id}")
    print(f"    Loaded model: {detector.model_name}")
    print(f"    Weights file: {detector.weights_path}")

    # 2. Check if a custom image path was provided via command line
    test_image_path = None
    if len(sys.argv) > 1 and not sys.argv[1].startswith("-"):
        custom_path = Path(sys.argv[1])
        if custom_path.is_file():
            test_image_path = str(custom_path.resolve())
            print(f"\n[2] Loaded user custom image: {test_image_path}")
        else:
            print(f"\n[!] Error: Specified image file not found: {custom_path}")
            return

    # Check model_Test_my_image folder first if no CLI argument provided
    if not test_image_path:
        my_images_folder = root_dir / "model_Test_my_image"
        custom_imgs = [
            f for ext in ("*.jpg", "*.jpeg", "*.png", "*.webp", "*.bmp")
            for f in glob.glob(str(my_images_folder / ext))
            if "results" not in Path(f).parts
        ]
        if custom_imgs:
            test_image_path = custom_imgs[0]
            print(f"\n[2] Loaded image from 'model_Test_my_image/': {os.path.basename(test_image_path)}")
            print(f"    (Total {len(custom_imgs)} image(s) in folder. Run 'python test_my_images.py' to test all).")

    # Fallback to validation dataset if no image path provided
    if not test_image_path:
        valid_images = glob.glob(str(root_dir / "ai_models" / "accident" / "valid" / "images" / "*.jpg"))
        if not valid_images:
            print("[!] No validation images found.")
            return

        target_pattern = "images_146_jpg"
        for img in valid_images:
            if target_pattern in img:
                test_image_path = img
                break
        if not test_image_path:
            test_image_path = valid_images[0]
        print(f"\n[2] No custom image found. Using default sample: {os.path.basename(test_image_path)}")
        print("    Tip: Drop your photos in 'model_Test_my_image/' and run 'python test_my_images.py'!")

    with open(test_image_path, "rb") as f:
        frame_bytes = f.read()

    # 3. Simulate sudden braking (drop from 65 km/h to 15 km/h -> 50 km/h deceleration)
    print("\n[3] Simulating vehicle telemetry:")
    print("    Prior speed: 65.0 km/h")
    print("    Current speed: 15.0 km/h (Sudden Brake: drop >= 25 km/h)")
    detector.last_speed_kmh = 65.0

    # 4. Process frame (Real YOLO inference + Deceleration boost + Gating)
    payload = detector.process_frame(
        frame_bytes=frame_bytes,
        lat=17.4422,
        lng=78.3923,
        speed_kmh=15.0,
        camera_id="front"
    )

    # Save local copy of annotated result for easy viewing
    result_img = root_dir / "server" / "media" / "latest_accident.jpg"
    if result_img.exists():
        import shutil
        local_output = root_dir / "accident_result.jpg"
        shutil.copyfile(result_img, local_output)
        print(f"\n[*] Annotated result with bounding boxes saved to: {local_output.name}")

    if not payload:
        print("\n[!] Frame did not cross confidence threshold 0.75 (No severe crash detected).")
        return

    print("\n[4] Accident Confirmed! Generated Payload:")
    for k, v in payload.items():
        print(f"    {k}: {v}")

    # 5. Send to Helios backend server
    print("\n[5] Transmitting to Central Command (POST /api/v1/detect/accident)...")
    try:
        resp = detector.send_payload(payload)
        if resp.status_code == 200:
            data = resp.json()
            print(f"    SUCCESS: HTTP 200 OK")
            print(f"    Incident Ref ID : {data.get('id')}")
            print(f"    Status          : {data.get('status')}")
            print(f"    Broadcasted to  : ws://localhost:8000/ws/events")
            print("\n>>> Open http://localhost:5173/accidents in your browser to see the live emergency alert!")
        else:
            print(f"    Error: HTTP {resp.status_code} - {resp.text}")
    except Exception as e:
        print(f"    Connection error (is server running?): {e}")

    print("=" * 65)

if __name__ == "__main__":
    main()
