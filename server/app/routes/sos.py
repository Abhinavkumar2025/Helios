import random
from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.models import IncidentModel, SOSEventModel
from app.database.session import get_db
from app.routes.incidents import model_to_response
from app.schemas.sos import SOSCreate, SOSResponse, SOSUpdate
from app.websocket.manager import manager

router = APIRouter(prefix="/sos", tags=["sos"])


def build_sos_response(sos: SOSEventModel, db: Session) -> SOSResponse:
    inc = db.query(IncidentModel).filter(IncidentModel.id == sos.incident_id).first()
    inc_resp = model_to_response(inc) if inc else None
    return SOSResponse(
        id=sos.id,
        incident_id=sos.incident_id,
        bus_id=sos.bus_id,
        severity=sos.severity,
        status=sos.status,
        dispatched_ambulance=sos.dispatched_ambulance,
        notified_police=sos.notified_police,
        dispatch_time=sos.dispatch_time,
        created_at=sos.created_at,
        updated_at=sos.updated_at,
        incident=inc_resp,
    )


@router.get("/history", response_model=List[SOSResponse])
def get_sos_history(db: Session = Depends(get_db)):
    events = db.query(SOSEventModel).order_by(SOSEventModel.created_at.desc()).all()
    return [build_sos_response(e, db) for e in events]


@router.post("/send", response_model=SOSResponse, status_code=201)
async def send_sos(payload: SOSCreate, db: Session = Depends(get_db)):
    sos = SOSEventModel(
        id=f"SOS-{random.randint(600, 9999)}",
        incident_id=payload.incident_id,
        bus_id=payload.bus_id,
        severity=payload.severity,
        status="SENT",
        dispatched_ambulance=False,
        notified_police=False,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(sos)
    db.commit()
    db.refresh(sos)

    resp = build_sos_response(sos, db)
    await manager.broadcast("sos_created", resp.dict())
    return resp


@router.patch("/{sos_id}", response_model=SOSResponse)
async def update_sos(sos_id: str, payload: SOSUpdate, db: Session = Depends(get_db)):
    sos = db.query(SOSEventModel).filter(SOSEventModel.id == sos_id).first()
    if not sos:
        raise HTTPException(status_code=404, detail=f"SOS event {sos_id} not found")

    if payload.status:
        sos.status = payload.status
        if payload.status == "AMBULANCE_DISPATCHED":
            sos.dispatched_ambulance = True
            sos.dispatch_time = datetime.utcnow()
        elif payload.status == "POLICE_NOTIFIED":
            sos.notified_police = True
        elif payload.status == "RESOLVED":
            # Also resolve linked incident
            inc = db.query(IncidentModel).filter(IncidentModel.id == sos.incident_id).first()
            if inc:
                inc.status = "resolved"

    if payload.dispatched_ambulance is not None:
        sos.dispatched_ambulance = payload.dispatched_ambulance
        if payload.dispatched_ambulance:
            sos.dispatch_time = datetime.utcnow()
    if payload.notified_police is not None:
        sos.notified_police = payload.notified_police

    sos.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(sos)

    resp = build_sos_response(sos, db)
    await manager.broadcast("sos_updated", resp.dict())
    return resp


@router.delete("/{sos_id}")
async def delete_sos(sos_id: str, db: Session = Depends(get_db)):
    sos = db.query(SOSEventModel).filter(SOSEventModel.id == sos_id).first()
    if not sos:
        sos = db.query(SOSEventModel).filter(SOSEventModel.incident_id == sos_id).first()
    if not sos:
        raise HTTPException(status_code=404, detail=f"SOS event {sos_id} not found")

    actual_sos_id = sos.id
    incident_id = sos.incident_id

    db.delete(sos)

    # If linked incident exists, delete it too and any matching SOS events
    if incident_id:
        other_sos = (
            db.query(SOSEventModel)
            .filter(SOSEventModel.incident_id == incident_id, SOSEventModel.id != actual_sos_id)
            .all()
        )
        for s in other_sos:
            db.delete(s)

        inc = db.query(IncidentModel).filter(IncidentModel.id == incident_id).first()
        if inc:
            db.delete(inc)
            await manager.broadcast("incident_deleted", {"id": incident_id})

    db.commit()

    await manager.broadcast("sos_deleted", {"id": actual_sos_id, "incident_id": incident_id})
    return {"status": "success", "message": f"SOS event {actual_sos_id} deleted", "id": actual_sos_id}

