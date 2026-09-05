# HELIOS Edge AI Model Integration

This directory defines the edge abstraction layer for the AI / Computer Vision models deployed onto **NVIDIA Jetson Nano** units installed inside electric city buses.

## Architecture

```
[Dashcam Feed (Front/Rear)]
           │
           ▼
[NVIDIA Jetson Nano Edge Hardware]
  ├── Frame Ingestion (GStreamer / OpenCV)
  ├── Edge Inference (TensorRT / ONNX / YOLOv8 / YOLO11)
  └── Standard Event Serialization
           │
           │ HTTP POST (over 4G/5G mobile link)
           ▼
[Helios Central Backend: /api/v1/incidents or /api/v1/detect/*]
           │
           ▼
[Real-time WebSocket & Command Center Dashboard]
```

## Standard Event JSON Contract

Regardless of internal model architecture (YOLO, custom CNN, motion flow), all edge devices submit structured JSON matching this schema:

```json
{
  "bus_id": "BUS-1042",
  "event_type": "accident",
  "confidence": 0.97,
  "severity": "high",
  "gps": {
    "lat": 17.4412,
    "lng": 78.3921
  },
  "timestamp": "2026-09-05T09:18:21Z",
  "camera": "front",
  "image_url": "/media/frame123.jpg",
  "video_url": "/media/clip123.mp4",
  "model": "accident-edgenet",
  "status": "detected",
  "notes": "Severe impact collision detected"
}
```

## Module Directory

- `accident/`: Vehicle collision, rollover, and emergency impact detection.
- `pothole/`: Surface cracks, asphalt craters, and pavement depression detection.
- `waterlogging/`: Standing water, flooded underpasses, and monsoon puddle segmentation.
- `roadsigns/`: Zebra crossing degradation, damaged speed signs, and divider violations.
