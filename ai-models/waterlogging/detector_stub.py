"""
Helios Edge AI Integration - Waterlogging Detector Stub
Reference edge inference pipeline intended to run on NVIDIA Jetson Nano.
"""

from datetime import datetime
from typing import Any, Dict, Optional
import requests


class JetsonWaterloggingDetector:
    def __init__(self, bus_id: str, server_url: str = "http://localhost:8000/api/v1"):
        self.bus_id = bus_id
        self.server_url = server_url
        self.model_name = "Helios-WaterSeg-v1"

    def process_frame(
        self,
        frame_bytes: bytes,
        lat: float,
        lng: float,
        camera_id: str = "front",
    ) -> Optional[Dict[str, Any]]:
        payload = {
            "bus_id": self.bus_id,
            "event_type": "waterlogging",
            "confidence": 0.92,
            "severity": "high",
            "gps": {"lat": lat, "lng": lng},
            "timestamp": datetime.utcnow().isoformat(),
            "camera": camera_id,
            "image_url": "/media/detections/waterlog_sample.jpg",
            "model": self.model_name,
            "status": "detected",
            "notes": "Standing water across 2 traffic lanes, estimated depth 15cm.",
            "metadata_json": '{"depth_cm": 15, "lanes_affected": 2}'
        }
        return payload

    def send_detection(self, payload: Dict[str, Any]) -> bool:
        try:
            url = f"{self.server_url}/detect/waterlogging"
            resp = requests.post(url, json=payload, timeout=5)
            return resp.status_code in [200, 201]
        except Exception:
            return False
