from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class GPSPoint(BaseModel):
    lat: float = Field(..., example=17.4422)
    lng: float = Field(..., example=78.3923)


class IncidentBase(BaseModel):
    bus_id: str = Field(..., example="BUS-205")
    event_type: str = Field(..., example="pothole")
    confidence: float = Field(..., example=0.96)
    severity: str = Field(default="medium", example="medium")
    gps: GPSPoint
    camera: str = Field(default="front", example="front")
    image_url: Optional[str] = Field(default="/media/detections/pothole_sample.jpg")
    video_url: Optional[str] = Field(default=None)
    model: str = Field(default="pothole-yolo", example="pothole-yolo")
    status: str = Field(default="detected", example="detected")
    notes: Optional[str] = None
    metadata_json: Optional[str] = None


class IncidentCreate(IncidentBase):
    id: Optional[str] = None
    timestamp: Optional[datetime] = None


class IncidentUpdate(BaseModel):
    status: Optional[str] = None
    severity: Optional[str] = None
    notes: Optional[str] = None


class IncidentResponse(BaseModel):
    id: str
    bus_id: str
    event_type: str
    confidence: float
    severity: str
    gps: GPSPoint
    timestamp: datetime
    camera: str
    image_url: Optional[str] = None
    video_url: Optional[str] = None
    model: str
    status: str
    notes: Optional[str] = None
    metadata_json: Optional[str] = None

    class Config:
        from_attributes = True
