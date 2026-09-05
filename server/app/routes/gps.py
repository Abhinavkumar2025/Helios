from datetime import datetime
from typing import Dict, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.models import BusModel, GPSLogModel
from app.database.session import get_db
from app.schemas.bus import GPSUpdate
from app.websocket.manager import manager

router = APIRouter(prefix="/gps", tags=["gps"])


@router.post("/update")
async def update_gps(payload: GPSUpdate, db: Session = Depends(get_db)):
    bus = db.query(BusModel).filter(BusModel.id == payload.bus_id).first()
    if not bus:
        raise HTTPException(status_code=404, detail=f"Bus {payload.bus_id} not found")

    bus.lat = payload.lat
    bus.lng = payload.lng
    bus.speed = payload.speed
    bus.last_seen = datetime.utcnow()

    log = GPSLogModel(
        bus_id=bus.id,
        lat=payload.lat,
        lng=payload.lng,
        speed=payload.speed,
        timestamp=bus.last_seen
    )
    db.add(log)
    db.commit()

    broadcast_payload = [{
        "id": bus.id,
        "lat": bus.lat,
        "lng": bus.lng,
        "speed": bus.speed,
        "status": bus.status,
        "last_seen": bus.last_seen.isoformat()
    }]
    await manager.broadcast("gps_updated", broadcast_payload)

    return {"status": "ok", "bus_id": bus.id, "lat": bus.lat, "lng": bus.lng}


@router.get("/live")
def get_live_gps(db: Session = Depends(get_db)):
    buses = db.query(BusModel).all()
    return [
        {
            "id": b.id,
            "route": b.route,
            "status": b.status,
            "speed": b.speed,
            "lat": b.lat,
            "lng": b.lng,
            "battery": b.battery,
            "last_seen": b.last_seen.isoformat() if b.last_seen else None
        }
        for b in buses
    ]
