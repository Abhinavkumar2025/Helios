"""
Helios Edge AI Integration - Road Signs & Infrastructure Detector Stub
Reference edge inference pipeline intended to run on NVIDIA Jetson Nano.
"""

from datetime import datetime
from typing import Any, Dict, Optional
import requests


class JetsonRoadSignDetector:
    def __init__(self, bus_id: str, server_url: str = "http://localhost:8000/api/v1"):
        self.bus_id = bus_id
        self.server_url = server_url
        self.model_name = "YOLOv8-TrafficAssets"

    def process_frame(
        self,
        frame_bytes: bytes,
        lat: float,
        lng: float,
        camera_id: str = "front",
    ) -> Optional[Dict[str, Any]]:
        payload = {
            "bus_id": self.bus_id,
            "event_type": "road_sign",
            "confidence": 0.95,
            "severity": "medium",
            "gps": {"lat": lat, "lng": lng},
            "timestamp": datetime.utcnow().isoformat(),
            "camera": camera_id,
            "image_url": "/media/detections/sign_sample.jpg",
            "model": self.model_name,
            "status": "detected",
            "notes": "Damaged / occluded Speed Limit 40 sign and faded zebra crossing marker.",
        }
        return payload

    def send_detection(self, payload: Dict[str, Any]) -> bool:
        try:
            url = f"{self.server_url}/detect/road-signs"
            resp = requests.post(url, json=payload, timeout=5)
            return resp.status_code in [200, 201]
        except Exception:
            return False
