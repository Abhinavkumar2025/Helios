from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class BusBase(BaseModel):
    id: str = Field(..., example="BUS-101")
    route: str = Field(..., example="Airport Express")
    status: str = Field(default="online", example="online")
    speed: float = Field(default=0.0, example=42.5)
    lat: float = Field(..., example=17.4412)
    lng: float = Field(..., example=78.3921)
    battery: int = Field(default=95, example=95)
    driver_name: str = Field(default="Fleet Operator", example="K. Ramesh")
    jetson_status: str = Field(default="online", example="online")
    jetson_temp: float = Field(default=41.2, example=41.2)
    jetson_cpu: float = Field(default=32.0, example=32.0)
    front_cam_status: str = Field(default="online", example="online")
    rear_cam_status: str = Field(default="online", example="online")


class BusCreate(BusBase):
    pass


class BusUpdate(BaseModel):
    route: Optional[str] = None
    status: Optional[str] = None
    speed: Optional[float] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    battery: Optional[int] = None
    driver_name: Optional[str] = None
    jetson_status: Optional[str] = None
    jetson_temp: Optional[float] = None
    jetson_cpu: Optional[float] = None
    front_cam_status: Optional[str] = None
    rear_cam_status: Optional[str] = None


class GPSUpdate(BaseModel):
    bus_id: str
    lat: float
    lng: float
    speed: float = 0.0


class BusResponse(BusBase):
    last_seen: datetime

    class Config:
        from_attributes = True
