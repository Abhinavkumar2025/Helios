from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class NotificationBase(BaseModel):
    title: str
    message: str
    category: str = "info"  # critical, warning, info
    link: Optional[str] = None


class NotificationCreate(NotificationBase):
    id: Optional[str] = None


class NotificationResponse(NotificationBase):
    id: str
    read: bool
    created_at: datetime

    class Config:
        from_attributes = True
