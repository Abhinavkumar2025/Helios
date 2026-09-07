import json
import cv2
from pathlib import Path
from detector import detect_potholes

# Configuration
INPUT_VIDEO = "test_media/vd1.mp4"
OUTPUT_DIR = Path("runs/pothole_video_output")
IMG_OUTPUT_DIR = OUTPUT_DIR / "annotated_frames"
BEST_IMAGE_DIR = OUTPUT_DIR / "best_global_image"
JSON_OUTPUT_DIR = OUTPUT_DIR / "json_responses"
TARGET_FPS = 4

# Setup directories
IMG_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
BEST_IMAGE_DIR.mkdir(parents=True, exist_ok=True)
JSON_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

cap = cv2.VideoCapture(INPUT_VIDEO)
if not cap.isOpened():
    raise FileNotFoundError(f"Could not open input video at {INPUT_VIDEO}")

orig_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
frame_interval = max(1, int(round(orig_fps / TARGET_FPS)))

width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
output_video_path = str(OUTPUT_DIR / "final_output.mp4")
fourcc = cv2.VideoWriter_fourcc(*"mp4v")
out = cv2.VideoWriter(output_video_path, fourcc, TARGET_FPS, (width, height))

frame_idx = 0
saved_count = 0
best_frame = None
best_frame_record = None
max_potholes = -1
all_session_telemetry = []

print(f"Processing video {INPUT_VIDEO} at target {TARGET_FPS} FPS (sampling every {frame_interval} frames)...")

while cap.isOpened():
    ret, frame = cap.read()
    if not ret:
        break

    # Segregate frames at 4 FPS
    if frame_idx % frame_interval == 0:
        timestamp_sec = round(frame_idx / orig_fps, 2)
        detections = detect_potholes(frame)
        num_detections = len(detections)

        annotated_frame = frame.copy()
        for d in detections:
            x1, y1, x2, y2 = map(int, d["bbox"])
            conf = d["confidence"]
            cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), (0, 0, 255), 2)
            cv2.putText(
                annotated_frame,
                f"pothole {conf:.2f}",
                (x1, y1 - 8),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                (0, 0, 255),
                2,
            )

        # Save annotated frame
        frame_filename = f"frame_{saved_count:04d}.jpg"
        annotated_image_path = str(IMG_OUTPUT_DIR / frame_filename)
        cv2.imwrite(annotated_image_path, annotated_frame)

        # Build frame telemetry record
        frame_record = {
            "frame_index": frame_idx,
            "saved_sequence": saved_count,
            "timestamp_seconds": timestamp_sec,
            "pothole_count": num_detections,
            "annotated_image_path": annotated_image_path,
            "detections": detections
        }
        all_session_telemetry.append(frame_record)

        # Save individual JSON response per frame
        json_filename = JSON_OUTPUT_DIR / f"frame_{saved_count:04d}.json"
        with open(json_filename, "w") as jf:
            json.dump(frame_record, jf, indent=4)

        # Track best global image (frame with highest pothole count)
        if num_detections > max_potholes:
            max_potholes = num_detections
            best_frame = annotated_frame.copy()
            best_frame_record = frame_record

        # Write to final output video
        out.write(annotated_frame)
        saved_count += 1

    frame_idx += 1

cap.release()
out.release()

# Save summary session JSON containing all frames telemetry
with open(OUTPUT_DIR / "session_summary.json", "w") as sf:
    json.dump(all_session_telemetry, sf, indent=4)

# Save best global image and its corresponding JSON response if found
if best_frame is not None:
    cv2.imwrite(str(BEST_IMAGE_DIR / "best_global.jpg"), best_frame)
    with open(BEST_IMAGE_DIR / "peak_pothole_incident.json", "w") as bf:
        json.dump(best_frame_record, bf, indent=4)

print(f"Processing complete!")
print(f" - Annotated frames saved to: {IMG_OUTPUT_DIR}")
print(f" - Best global image & JSON saved to: {BEST_IMAGE_DIR}")
print(f" - JSON response folder saved to: {JSON_OUTPUT_DIR}")
print(f" - Output video saved to: {output_video_path}")