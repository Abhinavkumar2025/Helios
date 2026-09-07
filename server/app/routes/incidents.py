import random
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database.models import IncidentModel, NotificationModel, SOSEventModel
from app.database.session import get_db
from app.schemas.incident import IncidentCreate, IncidentResponse, IncidentUpdate
from app.websocket.manager import manager

router = APIRouter(prefix="/incidents", tags=["incidents"])


def model_to_response(inc: IncidentModel) -> IncidentResponse:
    return IncidentResponse(
        id=inc.id,
        bus_id=inc.bus_id,
        event_type=inc.event_type,
        confidence=inc.confidence,
        severity=inc.severity,
        gps={"lat": inc.lat, "lng": inc.lng},
        timestamp=inc.timestamp,
        camera=inc.camera,
        image_url=inc.image_url,
        video_url=inc.video_url,
        model=inc.model,
        status=inc.status,
        notes=inc.notes,
        metadata_json=inc.metadata_json,
    )


@router.get("", response_model=List[IncidentResponse])
def list_incidents(
    event_type: Optional[str] = Query(None, description="Filter by event type"),
    severity: Optional[str] = Query(None, description="Filter by severity"),
    status: Optional[str] = Query(None, description="Filter by status"),
    bus_id: Optional[str] = Query(None, description="Filter by bus ID"),
    search: Optional[str] = Query(None, description="Search by ID or bus or notes"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    query = db.query(IncidentModel)

    if event_type and event_type.lower() != "all":
        query = query.filter(IncidentModel.event_type == event_type.lower())
    if severity and severity.lower() != "all":
        query = query.filter(IncidentModel.severity == severity.lower())
    if status and status.lower() != "all":
        query = query.filter(IncidentModel.status == status.lower())
    if bus_id:
        query = query.filter(IncidentModel.bus_id == bus_id)
    if search:
        search_fmt = f"%{search}%"
        query = query.filter(
            (IncidentModel.id.ilike(search_fmt))
            | (IncidentModel.bus_id.ilike(search_fmt))
            | (IncidentModel.notes.ilike(search_fmt))
        )

    incidents = query.order_by(IncidentModel.timestamp.desc()).offset(offset).limit(limit).all()
    return [model_to_response(i) for i in incidents]


@router.get("/{incident_id}", response_model=IncidentResponse)
def get_incident(incident_id: str, db: Session = Depends(get_db)):
    inc = db.query(IncidentModel).filter(IncidentModel.id == incident_id).first()
    if not inc:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")
    return model_to_response(inc)


@router.post("", response_model=IncidentResponse, status_code=201)
async def create_incident(payload: IncidentCreate, db: Session = Depends(get_db)):
    incident_id = payload.id or f"INC-{random.randint(700, 9999)}"
    ts = payload.timestamp or datetime.utcnow()

    incident = IncidentModel(
        id=incident_id,
        bus_id=payload.bus_id,
        event_type=payload.event_type.lower(),
        confidence=payload.confidence,
        severity=payload.severity.lower(),
        lat=payload.gps.lat,
        lng=payload.gps.lng,
        timestamp=ts,
        camera=payload.camera,
        image_url=payload.image_url or "https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=600&auto=format&fit=crop&q=80",
        video_url=payload.video_url,
        model=payload.model,
        status=payload.status or "detected",
        notes=payload.notes,
        metadata_json=payload.metadata_json,
    )
    db.add(incident)
    db.commit()
    db.refresh(incident)

    response_data = model_to_response(incident)

    # Broadcast WebSocket event
    await manager.broadcast("incident_created", response_data.dict())

    # If it is an accident, automatically register an SOS event
    if incident.event_type == "accident":
        sos = SOSEventModel(
            id=f"SOS-{random.randint(600, 9999)}",
            incident_id=incident.id,
            bus_id=incident.bus_id,
            severity=incident.severity,
            status="SENT",
            dispatched_ambulance=False,
            notified_police=False,
            created_at=ts,
            updated_at=ts,
        )
        db.add(sos)

        notif = NotificationModel(
            id=f"NOTIF-{random.randint(600, 9999)}",
            title=f"CRITICAL: Accident Flagged on {incident.bus_id}",
            message=f"Collision detected with {int(incident.confidence * 100)}% confidence. Emergency SOS status: SENT.",
            category="critical",
            link="/accidents",
            read=False,
            created_at=ts,
        )
        db.add(notif)
        db.commit()

        await manager.broadcast("sos_created", {
            "id": sos.id,
            "incident_id": sos.incident_id,
            "bus_id": sos.bus_id,
            "severity": sos.severity,
            "status": sos.status,
            "dispatched_ambulance": sos.dispatched_ambulance,
            "notified_police": sos.notified_police,
            "created_at": sos.created_at.isoformat(),
            "updated_at": sos.updated_at.isoformat(),
            "incident": response_data.dict()
        })
        await manager.broadcast("notification_created", {
            "id": notif.id,
            "title": notif.title,
            "message": notif.message,
            "category": notif.category,
            "link": notif.link,
            "read": notif.read,
            "created_at": notif.created_at.isoformat()
        })

    return response_data


@router.patch("/{incident_id}", response_model=IncidentResponse)
async def update_incident(incident_id: str, payload: IncidentUpdate, db: Session = Depends(get_db)):
    inc = db.query(IncidentModel).filter(IncidentModel.id == incident_id).first()
    if not inc:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")

    if payload.status:
        inc.status = payload.status.lower()
    if payload.severity:
        inc.severity = payload.severity.lower()
    if payload.notes:
        inc.notes = payload.notes

    db.commit()
    db.refresh(inc)

    response_data = model_to_response(inc)
    await manager.broadcast("incident_updated", response_data.dict())

    # If linked to an SOS event and status is resolved, sync SOS status
    if inc.event_type == "accident":
        sos = db.query(SOSEventModel).filter(SOSEventModel.incident_id == inc.id).first()
        if sos:
            if inc.status == "resolved":
                sos.status = "RESOLVED"
            elif inc.status == "investigating":
                sos.status = "INVESTIGATING"
            db.commit()
            await manager.broadcast("sos_updated", {
                "id": sos.id,
                "incident_id": sos.incident_id,
                "status": sos.status,
                "updated_at": datetime.utcnow().isoformat()
            })

    return response_data
