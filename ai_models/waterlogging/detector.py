"""
Waterlogging detection module for Helios server integration.
Loads the trained YOLO-seg waterlogging model and provides a clean
detection interface for the FastAPI upload endpoint.
"""
import numpy as np
from pathlib import Path
from ultralytics import YOLO

MODEL_PATH = Path(__file__).parent / "weights" / "waterlog_best.pt"

IMG_SIZE = 640
CONF_THRESHOLD = 0.42
MIN_WATERLOG_AREA_PX = 8000

_model = None


def get_model():
    global _model
    if _model is None:
        if not MODEL_PATH.exists():
            raise FileNotFoundError(f"Waterlogging model weights not found: {MODEL_PATH}")
        _model = YOLO(str(MODEL_PATH))
    return _model


def evaluate_waterlog_hazard(road_coverage_pct: float, mean_conf: float):
    """Classify hazard level based on water coverage and model confidence."""
    w_score = round(road_coverage_pct * mean_conf, 2)
    if w_score < 5.0 or road_coverage_pct < 3.0:
        return "low", "CLEAR / DRY", w_score, False
    elif w_score < 20.0:
        return "medium", "MINOR ACCUMULATION", w_score, False
    elif w_score < 40.0:
        return "high", "MODERATE WATERLOGGING", w_score, True
    else:
        return "critical", "CRITICAL HAZARD (FLOODED)", w_score, True


def detect_waterlogging(image_np):
    """
    Run waterlogging segmentation on a numpy image (BGR or RGB).

    Parameters:
        image_np: numpy array of the image (H, W, C)

    Returns:
        dict with keys: detected, severity, severity_title, confidence,
        road_coverage_pct, water_hazard_score, needs_alert, mask_pixels
    """
    model = get_model()
    h, w = image_np.shape[:2]

    # Road region of interest (bottom 70% of frame, typical dashcam view)
    roi_top = int(h * 0.25)
    roi_bottom = int(h * 0.95)
    road_pixels = (roi_bottom - roi_top) * w

    results = model.predict(
        source=image_np,
        conf=CONF_THRESHOLD,
        imgsz=IMG_SIZE,
        verbose=False
    )
    result = results[0]

    import cv2
    full_mask = np.zeros((h, w), dtype=np.uint8)
    confidence_scores = []

    if result.masks is not None and result.boxes is not None:
        boxes_conf = result.boxes.conf.cpu().numpy()
        for idx, mask_t in enumerate(result.masks.data):
            m = cv2.resize(
                mask_t.cpu().numpy().astype(np.uint8),
                (w, h),
                interpolation=cv2.INTER_NEAREST,
            )
            if np.count_nonzero(m[roi_top:roi_bottom, :]) >= MIN_WATERLOG_AREA_PX:
                full_mask = np.bitwise_or(full_mask, m)
                confidence_scores.append(float(boxes_conf[idx]))

    road_mask = full_mask[roi_top:roi_bottom, :]
    water_px = int(np.count_nonzero(road_mask))
    road_coverage_pct = round((water_px / road_pixels) * 100.0 if road_pixels > 0 else 0.0, 2)
    mean_conf = round(float(np.mean(confidence_scores)), 4) if confidence_scores else 0.0

    severity, severity_title, w_score, needs_alert = evaluate_waterlog_hazard(
        road_coverage_pct, mean_conf
    )

    detected = road_coverage_pct > 3.0 and mean_conf > 0.0

    return {
        "detected": detected,
        "severity": severity,
        "severity_title": severity_title,
        "confidence": mean_conf,
        "road_coverage_pct": road_coverage_pct,
        "water_hazard_score": w_score,
        "needs_alert": needs_alert,
        "mask_pixels": water_px,
        "result": result,  # raw YOLO result for annotation
    }
