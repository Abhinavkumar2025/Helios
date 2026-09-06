"""
Helios Detection Router (backend/routers/detect.py)
Exposes endpoints for detector modules to report real-time detections:
- POST /api/v1/detect/accident
- WS /ws/events
"""
import sys
from pathlib import Path

# Ensure server package is in sys.path
server_dir = Path(__file__).resolve().parent.parent.parent / "server"
if str(server_dir) not in sys.path:
    sys.path.insert(0, str(server_dir))

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
# pyrefly: ignore [missing-import]
from app.database.session import get_db
# pyrefly: ignore [missing-import]
from app.routes.incidents import create_incident
# pyrefly: ignore [missing-import]
from app.schemas.incident import IncidentCreate, IncidentResponse
# pyrefly: ignore [missing-import]
from app.websocket.manager import manager

router = APIRouter(tags=["detection"])


@router.post("/accident", response_model=IncidentResponse)
@router.post("/api/v1/detect/accident", response_model=IncidentResponse)
async def detect_accident(payload: IncidentCreate, db: Session = Depends(get_db)):
    """
    Accepts real-time accident detection payload from Jetson edge device.
    Stores in SQLite, creates SOS alarm, and broadcasts over WebSocket.
    """
    payload.event_type = "accident"
    if not payload.model:
        payload.model = "YOLO-Accident-EdgeNet"
    incident_resp = await create_incident(payload, db)
    # Also broadcast generic detection / accident event
    await manager.broadcast("detection", incident_resp.dict())
    await manager.broadcast("accident", incident_resp.dict())
    return incident_resp


@router.websocket("/ws/events")
async def websocket_events_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint broadcasting all incoming detection events.
    """
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Handle heartbeat ping/pong
            if "ping" in data.lower():
                await websocket.send_text('{"type": "pong"}')
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)
