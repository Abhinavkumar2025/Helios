import io
import glob
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional
from PIL import Image
import requests
from ultralytics import YOLO

# EXACT accident class name from Task 1 data.yaml
ACCIDENT_CLASS_NAME = "Car Crash Severity Detection - v13 Version 11 - with background"


class JetsonAccidentDetector:
    def __init__(
        self,
        bus_id: str,
        weights_path: Optional[str] = None,
        server_url: str = "http://localhost:8000/api/v1"
    ):
        self.bus_id = bus_id
        self.server_url = server_url
        self.model_name = "YOLOv8n-Accident-EdgeNet"
        self.last_speed_kmh: Optional[float] = None
        self.target_class_name = ACCIDENT_CLASS_NAME

        # Resolve weights path
        if not weights_path:
            weights_path = self._find_best_weights()

        self.weights_path = weights_path
        print(f"[JetsonAccidentDetector] Loading weights from: {self.weights_path}")
        self.model = YOLO(self.weights_path)

    def _find_best_weights(self) -> str:
        """Finds best.pt from ai_models/accident/weights/best.pt, runs/ or falls back to yolov8n.pt."""
        base_dir = Path(__file__).resolve().parent
        helios_root = base_dir.parent.parent

        search_patterns = [
            str(base_dir / "weights" / "best.pt"),
            str(base_dir / "runs" / "accident" / "**" / "weights" / "best.pt"),
            str(helios_root / "ai_models" / "accident" / "weights" / "best.pt"),
            str(helios_root / "runs" / "accident" / "**" / "weights" / "best.pt"),
        ]

        for pattern in search_patterns:
            matches = glob.glob(pattern, recursive=True)
            if matches:
                # Return the newest matched weights file
                matches.sort(key=os.path.getmtime, reverse=True)
                return matches[0]

        # Fallback if training hasn't produced weights yet
        fallback = helios_root / "yolov8n.pt"
        return str(fallback) if fallback.exists() else "yolov8n.pt"


    def process_frame(
        self,
        frame_bytes: bytes,
        lat: float,
        lng: float,
        speed_kmh: Optional[float] = None,
        camera_id: str = "front"
    ) -> Optional[Dict[str, Any]]:
        """
        Runs real inference on frame_bytes:
        1. Extracts accident confidence using EXACT class name from Task 1 data.yaml.
        2. Fuses deceleration signal: if speed drops >= 25 km/h & confidence > 0.4, boost by 0.2 (max 1.0).
        3. Emits payload only when confidence >= 0.75.
        4. Matches shared Helios payload schema.
        """
        # Decode frame bytes to PIL Image
        try:
            image = Image.open(io.BytesIO(frame_bytes)).convert("RGB")
        except Exception as e:
            print(f"[JetsonAccidentDetector] Error decoding frame_bytes: {e}")
            return None

        # Run real inference
        results = self.model.predict(source=image, verbose=False)

        raw_confidence = 0.0
        if results and len(results) > 0:
            result = results[0]
            names = result.names  # mapping from int to class name string
            for box in result.boxes:
                cls_id = int(box.cls[0].item())
                cls_name = names.get(cls_id, "")
                conf = float(box.conf[0].item())

                # Check exact class name or crash identifier
                if cls_name == self.target_class_name or "Car Crash" in cls_name:
                    if conf > raw_confidence:
                        raw_confidence = conf

        confidence = raw_confidence

        # Deceleration signal fusion:
        # If speed_kmh drops >= 25 km/h since last frame AND detection confidence > 0.4,
        # boost confidence by 0.2 (capped at 1.0)
        if speed_kmh is not None and self.last_speed_kmh is not None:
            speed_drop = self.last_speed_kmh - speed_kmh
            if speed_drop >= 25.0 and raw_confidence > 0.4:
                confidence = min(1.0, confidence + 0.2)
                print(f"[JetsonAccidentDetector] Deceleration boost triggered: speed dropped {speed_drop:.1f} km/h, confidence boosted from {raw_confidence:.2f} to {confidence:.2f}")

        # Update last speed
        if speed_kmh is not None:
            self.last_speed_kmh = speed_kmh

        # Threshold gate: Only emit payload when confidence crosses 0.75
        if confidence < 0.75:
            return None

        # Calculate severity based on confidence
        if confidence >= 0.90:
            severity = "critical"
        elif confidence >= 0.80:
            severity = "high"
        else:
            severity = "medium"

        # Save annotated image for dashboard and local inspection
        base_dir = Path(__file__).resolve().parent
        helios_root = base_dir.parent.parent
        image_url = "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=1000&auto=format&fit=crop&q=80"
        try:
            media_dir = helios_root / "server" / "media"
            os.makedirs(media_dir, exist_ok=True)
            output_filename = f"accident_{int(datetime.utcnow().timestamp())}.jpg"
            output_path = media_dir / output_filename
            latest_path = media_dir / "latest_accident.jpg"
            
            if results and len(results) > 0:
                annotated_bgr = results[0].plot()
                annotated_rgb = annotated_bgr[..., ::-1]
                img_to_save = Image.fromarray(annotated_rgb)
                img_to_save.save(str(output_path))
                img_to_save.save(str(latest_path))
                image_url = f"http://localhost:8000/media/{output_filename}"
        except Exception as e:
            print(f"[JetsonAccidentDetector] Note: Could not save annotated media: {e}")

        payload = {
            "bus_id": self.bus_id,
            "event_type": "accident",
            "confidence": round(float(confidence), 4),
            "severity": severity,
            "gps": {"lat": lat, "lng": lng},
            "timestamp": datetime.utcnow().isoformat(),
            "camera": camera_id,
            "image_url": image_url,
            "video_url": None,
            "model": self.model_name,
            "status": "detected",
            "notes": f"Accident detected by edge model with confidence {confidence:.2f}"
        }

        return payload

    def send_payload(self, payload: Dict[str, Any]) -> requests.Response:
        """Sends the payload to the Helios backend."""
        endpoint = f"{self.server_url.rstrip('/')}/detect/accident"
        response = requests.post(endpoint, json=payload, timeout=5)
        return response
