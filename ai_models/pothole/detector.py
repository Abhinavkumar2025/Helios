from pathlib import Path
from ultralytics import YOLO


MODEL_PATH = Path(__file__).parent / "best.pt"

IMG_SIZE = 640
CONF_THRESHOLD = 0.25


# Load model once when this module is imported
model = YOLO(str(MODEL_PATH))


def detect_potholes(image):
    """
    Detect potholes in an image.

    Parameters:
        image: PIL Image, numpy array, or supported image input

    Returns:
        List of detected potholes
    """

    results = model.predict(
        source=image,
        imgsz=IMG_SIZE,
        conf=CONF_THRESHOLD,
        verbose=False
    )

    result = results[0]

    detections = []

    if result.boxes is None:
        return detections

    for box in result.boxes:

        xyxy = box.xyxy[0].cpu().numpy().tolist()
        confidence = float(box.conf[0].cpu().item())

        detections.append({
            "class": "pothole",
            "confidence": confidence,
            "bbox": xyxy
        })

    return detections