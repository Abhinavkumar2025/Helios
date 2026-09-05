from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.models import AIModelStatusModel
from app.database.session import get_db
from app.schemas.model_status import ModelStatusResponse, ModelStatusUpdate

router = APIRouter(prefix="/models", tags=["models"])


@router.get("", response_model=List[ModelStatusResponse])
def list_models(db: Session = Depends(get_db)):
    return db.query(AIModelStatusModel).all()


@router.get("/{model_id}", response_model=ModelStatusResponse)
def get_model(model_id: str, db: Session = Depends(get_db)):
    m = db.query(AIModelStatusModel).filter(AIModelStatusModel.id == model_id).first()
    if not m:
        raise HTTPException(status_code=404, detail=f"Model {model_id} not found")
    return m


@router.patch("/{model_id}", response_model=ModelStatusResponse)
def update_model(model_id: str, payload: ModelStatusUpdate, db: Session = Depends(get_db)):
    m = db.query(AIModelStatusModel).filter(AIModelStatusModel.id == model_id).first()
    if not m:
        raise HTTPException(status_code=404, detail=f"Model {model_id} not found")

    if payload.status:
        m.status = payload.status
    if payload.latency_ms is not None:
        m.latency_ms = payload.latency_ms
    if payload.requests_count is not None:
        m.requests_count = payload.requests_count
    if payload.avg_confidence is not None:
        m.avg_confidence = payload.avg_confidence

    db.commit()
    db.refresh(m)
    return m
