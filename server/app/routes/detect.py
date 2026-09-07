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

        # All classes in this dedicated accident detection model represent crash detections
        is_crash = True
        crash_detected = True
        if conf > max_conf:
            max_conf = conf

        clean_label = ACCIDENT_CLASS_NAMES.get(cls_id, names.get(cls_id, "Vehicle Crash"))

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

