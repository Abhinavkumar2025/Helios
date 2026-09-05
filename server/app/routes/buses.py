from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database.models import BusModel
from app.database.session import get_db
from app.schemas.bus import BusCreate, BusResponse, BusUpdate
from app.websocket.manager import manager

router = APIRouter(prefix="/buses", tags=["buses"])


@router.get("", response_model=List[BusResponse])
def get_buses(
    status: Optional[str] = Query(None, description="Filter by status: online, offline, warning"),
    search: Optional[str] = Query(None, description="Search by bus ID or route"),
    db: Session = Depends(get_db)
):
    query = db.query(BusModel)
    if status and status.lower() != "all":
        query = query.filter(BusModel.status == status.lower())
    if search:
        search_fmt = f"%{search}%"
        query = query.filter(
            (BusModel.id.ilike(search_fmt)) | (BusModel.route.ilike(search_fmt))
        )
    return query.all()


@router.get("/{bus_id}", response_model=BusResponse)
def get_bus_detail(bus_id: str, db: Session = Depends(get_db)):
    bus = db.query(BusModel).filter(BusModel.id == bus_id).first()
    if not bus:
        raise HTTPException(status_code=404, detail=f"Bus with ID {bus_id} not found")
    return bus


@router.post("", response_model=BusResponse, status_code=201)
async def create_bus(payload: BusCreate, db: Session = Depends(get_db)):
    existing = db.query(BusModel).filter(BusModel.id == payload.id).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Bus with ID {payload.id} already exists")

    bus = BusModel(**payload.dict())
    db.add(bus)
    db.commit()
    db.refresh(bus)

    await manager.broadcast("bus_created", {
        "id": bus.id,
        "route": bus.route,
        "status": bus.status,
        "speed": bus.speed,
        "lat": bus.lat,
        "lng": bus.lng
    })
    return bus


@router.patch("/{bus_id}", response_model=BusResponse)
async def update_bus(bus_id: str, payload: BusUpdate, db: Session = Depends(get_db)):
    bus = db.query(BusModel).filter(BusModel.id == bus_id).first()
    if not bus:
        raise HTTPException(status_code=404, detail=f"Bus with ID {bus_id} not found")

    update_data = payload.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(bus, key, value)

    db.commit()
    db.refresh(bus)

    await manager.broadcast("bus_updated", {
        "id": bus.id,
        "route": bus.route,
        "status": bus.status,
        "speed": bus.speed,
        "lat": bus.lat,
        "lng": bus.lng,
        "battery": bus.battery,
        "jetson_status": bus.jetson_status
    })
    return bus
