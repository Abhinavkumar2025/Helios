from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database.models import NotificationModel
from app.database.session import get_db
from app.schemas.notification import NotificationResponse

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=List[NotificationResponse])
def get_notifications(
    category: Optional[str] = Query(None, description="Filter: critical, warning, info"),
    unread_only: bool = Query(False),
    db: Session = Depends(get_db)
):
    query = db.query(NotificationModel)
    if category and category.lower() != "all":
        query = query.filter(NotificationModel.category == category.lower())
    if unread_only:
        query = query.filter(NotificationModel.read == False)
    return query.order_by(NotificationModel.created_at.desc()).limit(50).all()


@router.patch("/{notif_id}/read", response_model=NotificationResponse)
def mark_notification_read(notif_id: str, db: Session = Depends(get_db)):
    notif = db.query(NotificationModel).filter(NotificationModel.id == notif_id).first()
    if not notif:
        raise HTTPException(status_code=404, detail=f"Notification {notif_id} not found")
    notif.read = True
    db.commit()
    db.refresh(notif)
    return notif


@router.post("/read-all")
def mark_all_read(db: Session = Depends(get_db)):
    db.query(NotificationModel).filter(NotificationModel.read == False).update({"read": True})
    db.commit()
    return {"status": "ok", "message": "All notifications marked as read"}
