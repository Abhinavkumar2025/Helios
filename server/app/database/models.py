from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String, Text
from app.database.session import Base


class BusModel(Base):
    __tablename__ = "buses"

    id = Column(String(50), primary_key=True, index=True)
    route = Column(String(100), nullable=False)
    status = Column(String(20), default="online")  # online, offline, warning
    speed = Column(Float, default=0.0)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    battery = Column(Integer, default=100)
    driver_name = Column(String(100), default="Fleet Operator")
    jetson_status = Column(String(20), default="online")
    jetson_temp = Column(Float, default=42.5)
    jetson_cpu = Column(Float, default=35.0)
    front_cam_status = Column(String(20), default="online")
    rear_cam_status = Column(String(20), default="online")
    last_seen = Column(DateTime, default=datetime.utcnow)


class IncidentModel(Base):
    __tablename__ = "incidents"

    id = Column(String(50), primary_key=True, index=True)
    bus_id = Column(String(50), index=True, nullable=False)
    event_type = Column(String(50), index=True, nullable=False)  # accident, pothole, waterlogging, road_sign, traffic
    confidence = Column(Float, nullable=False)
    severity = Column(String(20), default="medium")  # low, medium, high, critical
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    camera = Column(String(20), default="front")  # front, rear
    image_url = Column(Text, nullable=True)
    video_url = Column(String(255), nullable=True)
    model = Column(String(100), default="yolo-edge")
    status = Column(String(30), default="detected")  # detected, investigating, dispatched, resolved
    notes = Column(Text, nullable=True)
    metadata_json = Column(Text, nullable=True)


class SOSEventModel(Base):
    __tablename__ = "sos_events"

    id = Column(String(50), primary_key=True, index=True)
    incident_id = Column(String(50), index=True, nullable=False)
    bus_id = Column(String(50), index=True, nullable=False)
    severity = Column(String(20), default="high")
    status = Column(String(40), default="SENT")  # PENDING, SENT, AMBULANCE_DISPATCHED, POLICE_NOTIFIED, INVESTIGATING, RESOLVED
    dispatched_ambulance = Column(Boolean, default=False)
    notified_police = Column(Boolean, default=False)
    dispatch_time = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class GPSLogModel(Base):
    __tablename__ = "gps_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    bus_id = Column(String(50), index=True, nullable=False)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    speed = Column(Float, default=0.0)
    timestamp = Column(DateTime, default=datetime.utcnow)


class AIModelStatusModel(Base):
    __tablename__ = "model_status"

    id = Column(String(50), primary_key=True)
    name = Column(String(100), nullable=False)
    type = Column(String(50), nullable=False)  # pothole, accident, waterlogging, road_sign, traffic
    version = Column(String(50), nullable=False)
    status = Column(String(20), default="ONLINE")  # ONLINE, OFFLINE, TRAINING, DEGRADED
    latency_ms = Column(Integer, default=50)
    requests_count = Column(Integer, default=0)
    avg_confidence = Column(Float, default=0.90)
    last_heartbeat = Column(DateTime, default=datetime.utcnow)


class NotificationModel(Base):
    __tablename__ = "notifications"

    id = Column(String(50), primary_key=True)
    title = Column(String(150), nullable=False)
    message = Column(Text, nullable=False)
    category = Column(String(20), default="info")  # critical, warning, info
    link = Column(String(255), nullable=True)
    read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class TrafficStatModel(Base):
    __tablename__ = "traffic_stats"

    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    corridor = Column(String(100), nullable=False)
    cars = Column(Integer, default=0)
    bikes = Column(Integer, default=0)
    buses = Column(Integer, default=0)
    trucks = Column(Integer, default=0)
    pedestrians = Column(Integer, default=0)
    density_score = Column(Integer, default=50)  # 0 to 100
