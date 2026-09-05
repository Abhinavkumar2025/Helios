from typing import Dict, List, Optional
from pydantic import BaseModel


class SummaryStats(BaseModel):
    active_buses: int
    total_buses: int
    accidents_today: int
    potholes_detected: int
    waterlogging_alerts: int
    traffic_events: int
    sos_alerts: int


class CategoryCount(BaseModel):
    category: str
    count: int


class SeverityCount(BaseModel):
    severity: str
    count: int


class DailyTrend(BaseModel):
    date: str
    accidents: int
    potholes: int
    waterlogging: int
    traffic: int


class TrafficStatItem(BaseModel):
    timestamp: str
    corridor: str
    cars: int
    bikes: int
    buses: int
    trucks: int
    pedestrians: int
    density_score: int


class AnalyticsSummaryResponse(BaseModel):
    summary: SummaryStats
    by_category: List[CategoryCount]
    by_severity: List[SeverityCount]
    daily_trends: List[DailyTrend]
    top_affected_corridors: List[Dict[str, int | str]]


class TrafficAnalyticsResponse(BaseModel):
    live_counts: Dict[str, int]
    hourly_flow: List[Dict[str, int | str]]
    corridor_breakdown: List[TrafficStatItem]
