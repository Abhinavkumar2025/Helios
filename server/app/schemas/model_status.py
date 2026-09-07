from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class ModelStatusResponse(BaseModel):
    id: str
    name: str
    type: str
    version: str
    status: str
    latency_ms: int
    requests_count: int
    avg_confidence: float
    last_heartbeat: datetime

    class Config:
        from_attributes = True


class ModelStatusUpdate(BaseModel):
    status: Optional[str] = None
    latency_ms: Optional[int] = None
    requests_count: Optional[int] = None
    avg_confidence: Optional[float] = None
