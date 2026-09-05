import json
import logging
from datetime import datetime
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.websocket.manager import manager

logger = logging.getLogger("helios.ws")
router = APIRouter(tags=["websocket"])


@router.websocket("/ws/events")
async def websocket_events_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        # Send initial handshake packet
        await websocket.send_text(json.dumps({
            "type": "connection_established",
            "data": {
                "server_time": datetime.utcnow().isoformat(),
                "system": "HELIOS Central Command Center",
                "version": "1.0.0",
                "status": "ready"
            }
        }))

        while True:
            # Keep receiving client heartbeats or messages
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                if msg.get("type") == "ping":
                    await websocket.send_text(json.dumps({
                        "type": "pong",
                        "data": {"timestamp": datetime.utcnow().isoformat()}
                    }))
            except json.JSONDecodeError:
                pass

    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)
