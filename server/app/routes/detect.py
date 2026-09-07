import io
import os
import random
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from PIL import Image
from sqlalchemy.orm import Session
from ultralytics import YOLO

from app.database.session import get_db
from app.routes.incidents import create_incident
from app.schemas.incident import IncidentCreate, IncidentResponse
from app.websocket.manager import manager

router = APIRouter(prefix="/detect", tags=["detection"])

# Cached YOLO model instance
_model_instance = None

ACCIDENT_CLASS_NAMES = {
    0: "Traffic Collision",
    1: "Moderate Vehicle Crash",
    2: "Severe Vehicle Crash",
    3: "Vehicle Collision Damage",
    4: "High-Impact Collision",
}


def get_yolo_model():
    global _model_instance
    if _model_instance is None:
        helios_root = Path(__file__).resolve().parents[3]
        weights = helios_root / "ai_models" / "accident" / "weights" / "best.pt"
        if not weights.exists():
            weights = helios_root / "ai_models" / "accident" / "runs" / "accident" / "exp" / "weights" / "best.pt"
        if not weights.exists():
            weights = helios_root / "runs" / "accident" / "exp" / "weights" / "best.pt"
        if not weights.exists():
            weights = helios_root / "yolov8n.pt"
        _model_instance = YOLO(str(weights))
        try:
            _model_instance.model.names = ACCIDENT_CLASS_NAMES
        except Exception:
            pass
    return _model_instance



@router.post("/pothole", response_model=IncidentResponse)
async def detect_pothole(payload: IncidentCreate, db: Session = Depends(get_db)):
    payload.event_type = "pothole"
    if not payload.model:
        payload.model = "pothole-yolo"
    return await create_incident(payload, db)


@router.post("/accident", response_model=IncidentResponse)
async def detect_accident(payload: IncidentCreate, db: Session = Depends(get_db)):
    payload.event_type = "accident"
    if not payload.model:
        payload.model = "accident-edgenet"
    incident_resp = await create_incident(payload, db)
    await manager.broadcast("detection", incident_resp.dict())
    await manager.broadcast("accident", incident_resp.dict())
    return incident_resp


@router.post("/waterlogging", response_model=IncidentResponse)
async def detect_waterlogging(payload: IncidentCreate, db: Session = Depends(get_db)):
    payload.event_type = "waterlogging"
    if not payload.model:
        payload.model = "waterlog-seg"
    return await create_incident(payload, db)


@router.post("/road-signs", response_model=IncidentResponse)
async def detect_road_signs(payload: IncidentCreate, db: Session = Depends(get_db)):
    payload.event_type = "road_sign"
    if not payload.model:
        payload.model = "roadsign-yolo"
    return await create_incident(payload, db)


@router.post("/traffic", response_model=IncidentResponse)
async def detect_traffic(payload: IncidentCreate, db: Session = Depends(get_db)):
    payload.event_type = "traffic"
    if not payload.model:
        payload.model = "traffic-flow"
    return await create_incident(payload, db)


@router.post("/upload")
async def upload_and_detect(
    file: UploadFile = File(...),
    bus_id: Optional[str] = Form(None),
    event_type: Optional[str] = Form("accident"),
    confidence_boost: Optional[float] = Form(0.15),
    force_alert: Optional[bool] = Form(False),
    db: Session = Depends(get_db),
):
    """
    Accepts an uploaded image file from the web dashboard, executes YOLO
    inference with trained weights, plots the bounding boxes, saves media,
    creates the incident + SOS event, and broadcasts it over WebSockets.
    """
    try:
        content = await file.read()
        image = Image.open(io.BytesIO(content)).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image file: {e}")

    start_time = time.time()
    model = get_yolo_model()
    results = model.predict(source=image, conf=0.25, verbose=False)
    latency_ms = round((time.time() - start_time) * 1000, 1)

    result = results[0]
    boxes = result.boxes
    names = result.names

    crash_detected = False
    max_conf = 0.0
    detected_boxes: List[Dict[str, Any]] = []

    for box in boxes:
        cls_id = int(box.cls[0].item())
        conf = float(box.conf[0].item())
        xyxy = [round(float(c), 1) for c in box.xyxy[0].tolist()]
        # Roboflow export artifact classes (comments/watermarks)
        cls_name = names.get(cls_id, "")
        if "roboflow" in cls_name.lower() or "collaborate" in cls_name.lower() or "exported" in cls_name.lower():
            continue

        # All valid detections in this dedicated accident model represent crash events
        is_crash = True
        crash_detected = True
        if conf > max_conf:
            max_conf = conf

        clean_label = ACCIDENT_CLASS_NAMES.get(cls_id, "Traffic Collision")

        detected_boxes.append({
            "class_id": cls_id,
            "class_name": clean_label,
            "is_crash": is_crash,
            "confidence": round(conf, 4),
            "bbox": xyxy,
        })

    # Save annotated media
    helios_root = Path(__file__).resolve().parents[3]
    media_dir = helios_root / "server" / "media"
    os.makedirs(media_dir, exist_ok=True)

    timestamp = int(time.time())
    output_filename = f"accident_{timestamp}.jpg"
    output_path = media_dir / output_filename
    latest_path = media_dir / "latest_accident.jpg"

    annotated_bgr = result.plot()
    annotated_rgb = annotated_bgr[..., ::-1]
    annotated_img = Image.fromarray(annotated_rgb)
    annotated_img.save(str(output_path))
    annotated_img.save(str(latest_path))

    # Also save to model_Test_my_image/results/
    try:
        user_results_dir = helios_root / "model_Test_my_image" / "results"
        os.makedirs(user_results_dir, exist_ok=True)
        safe_fname = file.filename or f"upload_{timestamp}.jpg"
        annotated_img.save(str(user_results_dir / f"detected_{safe_fname}"))
    except Exception:
        pass

    image_url = f"http://localhost:8000/media/{output_filename}"

    # Calculate boosted confidence & severity
    effective_conf = max_conf
    if crash_detected and confidence_boost:
        effective_conf = min(1.0, max_conf + confidence_boost)

    if effective_conf >= 0.85:
        severity = "critical"
    elif effective_conf >= 0.75:
        severity = "high"
    elif effective_conf >= 0.50:
        severity = "medium"
    else:
        severity = "low"

    incident_response = None
    target_bus = bus_id or f"BUS-HYD-{random.randint(100, 999)}"

    # If accident confirmed or user forces alert, create incident in DB & broadcast
    if crash_detected or force_alert:
        payload = IncidentCreate(
            bus_id=target_bus,
            event_type="accident",
            confidence=round(effective_conf, 4),
            severity=severity if crash_detected else "medium",
            gps={"lat": 17.4422, "lng": 78.3923},
            camera="front",
            image_url=image_url,
            model="YOLOv8n-Accident-EdgeNet",
            status="detected",
            notes=f"Edge AI detected accident in uploaded image '{file.filename}' (Confidence: {effective_conf:.1%})",
        )
        incident_response = await create_incident(payload, db)
        await manager.broadcast("detection", incident_response.dict())
        await manager.broadcast("accident", incident_response.dict())

    return {
        "success": True,
        "detected": crash_detected,
        "confidence": round(effective_conf, 4),
        "raw_confidence": round(max_conf, 4),
        "severity": severity,
        "latency_ms": latency_ms,
        "boxes": detected_boxes,
        "image_url": image_url,
        "bus_id": target_bus,
        "incident": incident_response.dict() if incident_response else None,
        "message": (
            f"Collision detected with {effective_conf:.1%} confidence! Incident ref created."
            if crash_detected
            else "No accident detected in this image (no crash bounding boxes found)."
        ),
    }

# ─────────────────────────────────────────────────────────
#  POTHOLE MODEL – Real YOLOv8 Inference on Uploaded Image
# ─────────────────────────────────────────────────────────

_pothole_model = None


def get_pothole_model():
    global _pothole_model
    if _pothole_model is None:
        helios_root = Path(__file__).resolve().parents[3]
        weights = helios_root / "ai_models" / "pothole" / "weights" / "best.pt"
        if not weights.exists():
            raise FileNotFoundError(f"Pothole model weights not found: {weights}")
        _pothole_model = YOLO(str(weights))
    return _pothole_model


@router.post("/pothole/upload")
async def upload_and_detect_pothole(
    file: UploadFile = File(...),
    bus_id: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    """
    Upload an image for AI pothole detection using the trained YOLOv8 pothole
    model. Runs real inference, saves annotated output, creates a DB incident,
    and broadcasts via WebSocket.
    """
    try:
        content = await file.read()
        image = Image.open(io.BytesIO(content)).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image file: {e}")

    start_time = time.time()
    model = get_pothole_model()
    results = model.predict(source=image, imgsz=640, conf=0.25, verbose=False)
    latency_ms = round((time.time() - start_time) * 1000, 1)

    result = results[0]
    boxes = result.boxes

    pothole_detected = False
    max_conf = 0.0
    detected_boxes: List[Dict[str, Any]] = []

    if boxes is not None:
        for box in boxes:
            cls_id = int(box.cls[0].item())
            conf = float(box.conf[0].item())
            xyxy = [round(float(c), 1) for c in box.xyxy[0].tolist()]

            pothole_detected = True
            if conf > max_conf:
                max_conf = conf

            detected_boxes.append({
                "class_id": cls_id,
                "class_name": "pothole",
                "confidence": round(conf, 4),
                "bbox": xyxy,
            })

    # Save annotated media
    helios_root = Path(__file__).resolve().parents[3]
    media_dir = helios_root / "server" / "media"
    os.makedirs(media_dir, exist_ok=True)

    timestamp = int(time.time())
    output_filename = f"pothole_{timestamp}.jpg"
    output_path = media_dir / output_filename

    annotated_bgr = result.plot()
    annotated_rgb = annotated_bgr[..., ::-1]
    annotated_img = Image.fromarray(annotated_rgb)
    annotated_img.save(str(output_path))

    image_url = f"http://localhost:8000/media/{output_filename}"

    # Severity from confidence
    if max_conf >= 0.90:
        severity = "critical"
    elif max_conf >= 0.75:
        severity = "high"
    elif max_conf >= 0.50:
        severity = "medium"
    else:
        severity = "low"

    incident_response = None
    target_bus = bus_id or f"BUS-HYD-{random.randint(100, 999)}"

    if pothole_detected:
        payload = IncidentCreate(
            bus_id=target_bus,
            event_type="pothole",
            confidence=round(max_conf, 4),
            severity=severity,
            gps={"lat": 17.4430, "lng": 78.3850},
            camera="front",
            image_url=image_url,
            model="pothole-yolo-v8",
            status="detected",
            notes=f"Pothole detected in uploaded image '{file.filename}' "
                  f"(Confidence: {max_conf:.1%})",
        )
        incident_response = await create_incident(payload, db)
        await manager.broadcast("incident_created", incident_response.dict())

    return {
        "success": True,
        "detected": pothole_detected,
        "confidence": round(max_conf, 4),
        "severity": severity,
        "latency_ms": latency_ms,
        "boxes": detected_boxes,
        "image_url": image_url,
        "bus_id": target_bus,
        "incident": incident_response.dict() if incident_response else None,
        "message": (
            f"Pothole detected with {max_conf:.1%} confidence! Incident created."
            if pothole_detected
            else "No pothole detected in this image."
        ),
    }


# ──────────────────────────────────────────────────────────────────
#  WATERLOGGING MODEL – Real YOLO-Seg Inference on Uploaded Image
# ──────────────────────────────────────────────────────────────────

_waterlog_model = None


def get_waterlog_model():
    global _waterlog_model
    if _waterlog_model is None:
        helios_root = Path(__file__).resolve().parents[3]
        weights = helios_root / "ai_models" / "waterlogging" / "weights" / "waterlog_best.pt"
        if not weights.exists():
            raise FileNotFoundError(f"Waterlogging model weights not found: {weights}")
        _waterlog_model = YOLO(str(weights))
    return _waterlog_model


def _evaluate_waterlog_hazard(road_coverage_pct: float, mean_conf: float):
    """Classify waterlogging hazard level based on coverage and confidence."""
    w_score = round(road_coverage_pct * mean_conf, 2)
    if w_score < 5.0 or road_coverage_pct < 3.0:
        return "low", "CLEAR / DRY", w_score, False
    elif w_score < 20.0:
        return "medium", "MINOR ACCUMULATION", w_score, False
    elif w_score < 40.0:
        return "high", "MODERATE WATERLOGGING", w_score, True
    else:
        return "critical", "CRITICAL HAZARD (FLOODED)", w_score, True


@router.post("/waterlogging/upload")
async def upload_and_detect_waterlogging(
    file: UploadFile = File(...),
    bus_id: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    """
    Upload an image for AI waterlogging detection using the trained YOLO-Seg
    model. Processes segmentation masks to calculate road water coverage,
    hazard score, and severity. Creates incident and broadcasts via WebSocket.
    """
    import numpy as np
    import cv2

    try:
        content = await file.read()
        image = Image.open(io.BytesIO(content)).convert("RGB")
        image_np = np.array(image)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image file: {e}")

    start_time = time.time()
    model = get_waterlog_model()

    h, w_img = image_np.shape[:2]
    roi_top = int(h * 0.25)
    roi_bottom = int(h * 0.95)
    road_pixels = (roi_bottom - roi_top) * w_img

    results = model.predict(source=image_np, conf=0.42, imgsz=640, verbose=False)
    latency_ms = round((time.time() - start_time) * 1000, 1)

    result = results[0]

    full_mask = np.zeros((h, w_img), dtype=np.uint8)
    confidence_scores = []
    min_area_px = 8000

    if result.masks is not None and result.boxes is not None:
        boxes_conf = result.boxes.conf.cpu().numpy()
        for idx, mask_t in enumerate(result.masks.data):
            m = cv2.resize(
                mask_t.cpu().numpy().astype(np.uint8),
                (w_img, h),
                interpolation=cv2.INTER_NEAREST,
            )
            if np.count_nonzero(m[roi_top:roi_bottom, :]) >= min_area_px:
                full_mask = np.bitwise_or(full_mask, m)
                confidence_scores.append(float(boxes_conf[idx]))

    road_mask = full_mask[roi_top:roi_bottom, :]
    water_px = int(np.count_nonzero(road_mask))
    road_coverage_pct = round(
        (water_px / road_pixels) * 100.0 if road_pixels > 0 else 0.0, 2
    )
    mean_conf = round(float(np.mean(confidence_scores)), 4) if confidence_scores else 0.0

    severity, severity_title, w_score, needs_alert = _evaluate_waterlog_hazard(
        road_coverage_pct, mean_conf
    )
    waterlog_detected = road_coverage_pct > 3.0 and mean_conf > 0.0

    # Save annotated media
    helios_root = Path(__file__).resolve().parents[3]
    media_dir = helios_root / "server" / "media"
    os.makedirs(media_dir, exist_ok=True)

    timestamp = int(time.time())
    output_filename = f"waterlog_{timestamp}.jpg"
    output_path = media_dir / output_filename

    # Overlay water mask on image in green
    overlay = image_np.copy()
    overlay[full_mask == 1] = [34, 197, 94]  # Green waterlogging overlay (RGB)
    annotated = cv2.addWeighted(overlay, 0.45, image_np, 0.55, 0)
    annotated_img = Image.fromarray(annotated)
    annotated_img.save(str(output_path))

    image_url = f"http://localhost:8000/media/{output_filename}"

    incident_response = None
    target_bus = bus_id or f"BUS-HYD-{random.randint(100, 999)}"

    if waterlog_detected:
        payload = IncidentCreate(
            bus_id=target_bus,
            event_type="waterlogging",
            confidence=round(mean_conf, 4),
            severity=severity,
            gps={"lat": 17.4450, "lng": 78.3880},
            camera="front",
            image_url=image_url,
            model="waterlog-yolo-seg",
            status="detected",
            notes=f"Waterlogging detected: {severity_title}. "
                  f"Road coverage: {road_coverage_pct}%, "
                  f"Hazard score: {w_score}",
        )
        incident_response = await create_incident(payload, db)
        await manager.broadcast("incident_created", incident_response.dict())

    return {
        "success": True,
        "detected": waterlog_detected,
        "confidence": round(mean_conf, 4),
        "severity": severity,
        "severity_title": severity_title,
        "road_coverage_pct": road_coverage_pct,
        "water_hazard_score": w_score,
        "needs_alert": needs_alert,
        "latency_ms": latency_ms,
        "image_url": image_url,
        "bus_id": target_bus,
        "incident": incident_response.dict() if incident_response else None,
        "message": (
            f"Waterlogging detected: {severity_title} "
            f"(Coverage: {road_coverage_pct}%, Score: {w_score})"
            if waterlog_detected
            else "No significant waterlogging detected in this image."
        ),
    }


# ──────────────────────────────────────────────────────────────────────
#  VEHICLE / TRAFFIC MODEL – Real YOLO Inference + Density Computation
# ──────────────────────────────────────────────────────────────────────

_traffic_model = None

VEHICLE_CLASSES = {1: "bicycle", 2: "car", 3: "motorcycle", 5: "bus", 7: "truck"}
VEHICLE_PCU_WEIGHTS = {1: 0.5, 2: 1.0, 3: 0.5, 5: 3.5, 7: 3.0}


def get_traffic_model():
    global _traffic_model
    if _traffic_model is None:
        helios_root = Path(__file__).resolve().parents[3]
        weights = helios_root / "ai_models" / "vehicle_detection" / "weights" / "yolo26n.pt"
        if not weights.exists():
            weights = helios_root / "ai_models" / "vehicle_detection" / "yolo26n.pt"
        if not weights.exists():
            raise FileNotFoundError(f"Traffic model weights not found: {weights}")
        _traffic_model = YOLO(str(weights))
    return _traffic_model


def _compute_traffic_density(detections, img_shape, road_length_m=65.0, lanes=2):
    """Calibrated non-linear density engine from vehicle_detection model."""
    import numpy as np

    if not detections:
        return 0.0, 0.0, "Low (Free Flow)"

    img_h, img_w = img_shape[:2]
    total_img_area = float(img_h * img_w)

    detected_classes = [d["class_id"] for d in detections]
    total_pcu = sum(VEHICLE_PCU_WEIGHTS.get(c, 1.0) for c in detected_classes)
    n_vehicles = len(detections)

    total_vehicle_pixel_area = sum(d["area"] for d in detections)
    occupancy_ratio = min(1.0, total_vehicle_pixel_area / (total_img_area * 0.75))

    jam_buffer_m = 7.0
    nominal_pcu_cap = (road_length_m / jam_buffer_m) * lanes
    load_ratio = total_pcu / nominal_pcu_cap

    y_coords = [d["bbox"][1] for d in detections]
    vertical_span = (max(y_coords) - min(y_coords)) / float(img_h) if y_coords else 0

    stress_index = (0.55 * occupancy_ratio) + (0.45 * min(1.6, load_ratio))
    if vertical_span > 0.45 and n_vehicles >= 10:
        stress_index += 0.12

    if stress_index < 0.40:
        density_pct = (stress_index / 0.40) * 38.0
    elif stress_index < 0.75:
        density_pct = 38.0 + ((stress_index - 0.40) / 0.35) * 34.0
    else:
        excess = stress_index - 0.75
        saturation_curve = 1.0 - np.exp(-1.8 * excess)
        density_pct = 78.0 + (saturation_curve * 19.5)

    density_pct = min(98.5, max(5.0, density_pct))

    if density_pct < 40.0:
        status = "Low (Free Flow)"
    elif density_pct < 75.0:
        status = "Moderate"
    else:
        status = "Heavy (Congestion)"

    return round(float(density_pct), 2), round(float(total_pcu), 1), status


@router.post("/traffic/upload")
async def upload_and_detect_traffic(
    file: UploadFile = File(...),
    bus_id: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    """
    Upload an image for AI vehicle detection and traffic density analysis
    using the trained YOLO model. Counts vehicles by class, computes PCU
    and congestion density, creates incident, and broadcasts via WebSocket.
    """
    try:
        content = await file.read()
        image = Image.open(io.BytesIO(content)).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image file: {e}")

    start_time = time.time()
    model = get_traffic_model()
    results = model.predict(
        source=image,
        classes=list(VEHICLE_PCU_WEIGHTS.keys()),
        conf=0.30,
        iou=0.45,
        imgsz=1024,
        verbose=False,
    )
    latency_ms = round((time.time() - start_time) * 1000, 1)

    result = results[0]
    boxes = result.boxes

    detected_vehicles: List[Dict[str, Any]] = []
    breakdown = {name: 0 for name in VEHICLE_CLASSES.values()}

    if boxes is not None:
        for box in boxes:
            cls_id = int(box.cls[0].item())
            conf = float(box.conf[0].item())
            xyxy = [round(float(c), 1) for c in box.xyxy[0].tolist()]
            w = xyxy[2] - xyxy[0]
            h = xyxy[3] - xyxy[1]
            area = w * h

            cls_name = VEHICLE_CLASSES.get(cls_id, "vehicle")
            if cls_name in breakdown:
                breakdown[cls_name] += 1

            detected_vehicles.append({
                "class_id": cls_id,
                "class_name": cls_name,
                "confidence": round(conf, 4),
                "bbox": xyxy,
                "area": round(area, 1),
            })

    import numpy as np
    img_shape = (np.array(image).shape[0], np.array(image).shape[1])
    density_pct, total_pcu, congestion_status = _compute_traffic_density(
        detected_vehicles, img_shape
    )

    # Save annotated media
    helios_root = Path(__file__).resolve().parents[3]
    media_dir = helios_root / "server" / "media"
    os.makedirs(media_dir, exist_ok=True)

    timestamp = int(time.time())
    output_filename = f"traffic_{timestamp}.jpg"
    output_path = media_dir / output_filename

    annotated_bgr = result.plot()
    annotated_rgb = annotated_bgr[..., ::-1]
    annotated_img = Image.fromarray(annotated_rgb)
    annotated_img.save(str(output_path))

    image_url = f"http://localhost:8000/media/{output_filename}"

    # Severity based on density
    if density_pct >= 75:
        severity = "critical"
    elif density_pct >= 50:
        severity = "high"
    elif density_pct >= 30:
        severity = "medium"
    else:
        severity = "low"

    incident_response = None
    target_bus = bus_id or f"BUS-HYD-{random.randint(100, 999)}"
    n_vehicles = len(detected_vehicles)

    if n_vehicles > 0:
        payload = IncidentCreate(
            bus_id=target_bus,
            event_type="traffic",
            confidence=round(density_pct / 100.0, 4),
            severity=severity,
            gps={"lat": 17.4435, "lng": 78.3860},
            camera="front",
            image_url=image_url,
            model="traffic-yolo-density",
            status="detected",
            notes=f"Traffic analysis: {congestion_status}. "
                  f"{n_vehicles} vehicles detected, {total_pcu} PCU, "
                  f"Density: {density_pct}%",
        )
        incident_response = await create_incident(payload, db)
        await manager.broadcast("incident_created", incident_response.dict())

    return {
        "success": True,
        "vehicles_detected": n_vehicles,
        "density_pct": density_pct,
        "total_pcu": total_pcu,
        "congestion_status": congestion_status,
        "severity": severity,
        "breakdown": breakdown,
        "latency_ms": latency_ms,
        "boxes": detected_vehicles,
        "image_url": image_url,
        "bus_id": target_bus,
        "incident": incident_response.dict() if incident_response else None,
        "message": (
            f"Traffic analysis complete: {congestion_status} "
            f"({n_vehicles} vehicles, {density_pct}% density)"
        ),
    }
