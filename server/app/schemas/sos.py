from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from app.schemas.incident import IncidentResponse


class SOSCreate(BaseModel):
    incident_id: str
    bus_id: str
    severity: str = "high"


class SOSUpdate(BaseModel):
    status: Optional[str] = None
    dispatched_ambulance: Optional[bool] = None
    notified_police: Optional[bool] = None


class SOSResponse(BaseModel):
    id: str
    incident_id: str
    bus_id: str
    severity: str
    status: str
    dispatched_ambulance: bool
    notified_police: bool
    dispatch_time: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    incident: Optional[IncidentResponse] = None

    class Config:
        from_attributes = True
