from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.routes.incidents import create_incident
from app.schemas.incident import IncidentCreate, IncidentResponse

router = APIRouter(prefix="/detect", tags=["detection"])


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
    return await create_incident(payload, db)


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
