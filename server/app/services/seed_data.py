import random
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.database.models import (
    AIModelStatusModel,
    BusModel,
    IncidentModel,
    NotificationModel,
    SOSEventModel,
    TrafficStatModel,
)

# Realistic Hyderabad Coordinates bounding box
# Center around Hitec City / Gachibowli / Madhapur
BASE_ROUTES = [
    {"id": "BUS-101", "route": "Route 101: Airport Express (RGIA - Hitec City)", "driver": "K. Ramesh"},
    {"id": "BUS-102", "route": "Route 102: Cyberabad Tech Loop (Mindspace - Wipro Circle)", "driver": "M. Srinivas"},
    {"id": "BUS-103", "route": "Route 103: Gachibowli Stadium - Mehdipatnam", "driver": "P. Venkat"},
    {"id": "BUS-104", "route": "Route 104: Secunderabad Station - Financial District", "driver": "A. Joseph"},
    {"id": "BUS-105", "route": "Route 105: Jubilee Hills Checkpost - Kondapur RTA", "driver": "T. Naresh"},
    {"id": "BUS-106", "route": "Route 106: Dilsukhnagar - Hitec City Metro Feeder", "driver": "S. Rajesh"},
    {"id": "BUS-107", "route": "Route 107: Kukatpally Housing Board - Gachibowli ORR", "driver": "V. Suresh"},
    {"id": "BUS-108", "route": "Route 108: Begumpet Airport - Madhapur Inorbit", "driver": "B. Pradeep"},
    {"id": "BUS-109", "route": "Route 109: Banjara Hills Road 12 - Waverock SEZ", "driver": "G. Ravi"},
    {"id": "BUS-110", "route": "Route 110: Ameerpet Metro - DLF Cybercity", "driver": "D. Manoj"},
    {"id": "BUS-111", "route": "Route 111: Miyapur Allwyn X Roads - Bio Diversity Park", "driver": "L. Anand"},
    {"id": "BUS-112", "route": "Route 112: Charminar Old City - Hitec City Express", "driver": "M. Imran"},
    {"id": "BUS-113", "route": "Route 113: Uppal Stadium - Gachibowli Cable Bridge", "driver": "C. Satish"},
    {"id": "BUS-114", "route": "Route 114: Nanakramguda Circle - Lingampally Station", "driver": "K. Harish"},
    {"id": "BUS-115", "route": "Route 115: Raidurg Metro - Kokapet Neopolis", "driver": "E. Mahesh"},
    {"id": "BUS-116", "route": "Route 116: Kothaguda Junction - T-Hub Knowledge City", "driver": "J. Naveen"},
    {"id": "BUS-117", "route": "Route 117: Shaikpet Flyover - Knowledge City Link", "driver": "R. Prakash"},
    {"id": "BUS-118", "route": "Route 118: Khajaguda Lake Road - Outer Ring Road", "driver": "H. Sunil"},
    {"id": "BUS-119", "route": "Route 119: Depot 4 Standby / Fast Charging", "driver": "Depot Reserve"},
    {"id": "BUS-120", "route": "Route 120: Maintenance Bay - Diagnostics Routine", "driver": "Tech Service"},
]

CORRIDORS = [
    "Hitec City Cyber Towers Junction",
    "Gachibowli ORR Junction",
    "Madhapur 100 Feet Road",
    "Financial District Main Spine",
    "Durgam Cheruvu Cable Bridge",
    "Kondapur RTA Crossroad",
    "Mehdipatnam PVNR Expressway",
    "Begumpet Main Flyover",
]


def seed_database(db: Session):
    # Check if already seeded
    if db.query(BusModel).count() > 0:
        return

    # 1. Seed 20 Buses
    base_lat = 17.4400
    base_lng = 78.3800
    for idx, b in enumerate(BASE_ROUTES):
        is_online = idx < 18
        lat_offset = (random.random() - 0.5) * 0.08
        lng_offset = (random.random() - 0.5) * 0.08

        bus = BusModel(
            id=b["id"],
            route=b["route"],
            status="online" if is_online else "offline",
            speed=round(random.uniform(22.0, 48.0), 1) if is_online else 0.0,
            lat=round(base_lat + lat_offset, 5),
            lng=round(base_lng + lng_offset, 5),
            battery=random.randint(65, 99) if is_online else random.randint(20, 40),
            driver_name=b["driver"],
            jetson_status="online" if is_online else "offline",
            jetson_temp=round(random.uniform(39.0, 47.0), 1) if is_online else 28.0,
            jetson_cpu=round(random.uniform(25.0, 52.0), 1) if is_online else 0.0,
            front_cam_status="online" if is_online else "offline",
            rear_cam_status="online" if is_online else "offline",
            last_seen=datetime.utcnow() - timedelta(seconds=random.randint(2, 45) if is_online else 1200)
        )
        db.add(bus)

    # 2. Seed AI Models Status
    models_data = [
        {
            "id": "pothole-yolo",
            "name": "Pothole Detection",
            "type": "pothole",
            "version": "YOLO11-Custom-RoadHazard",
            "status": "ONLINE",
            "latency_ms": 78,
            "requests_count": 14250,
            "avg_confidence": 0.94,
        },
        {
            "id": "accident-edgenet",
            "name": "Accident Detection",
            "type": "accident",
            "version": "YOLO-Accident-EdgeNet",
            "status": "ONLINE",
            "latency_ms": 62,
            "requests_count": 9180,
            "avg_confidence": 0.97,
        },
        {
            "id": "waterlog-seg",
            "name": "Waterlogging Detection",
            "type": "waterlogging",
            "version": "Helios-WaterSeg-v1",
            "status": "ONLINE",
            "latency_ms": 112,
            "requests_count": 4820,
            "avg_confidence": 0.91,
        },
        {
            "id": "roadsign-yolo",
            "name": "Road Sign & Lane Detection",
            "type": "road_sign",
            "version": "YOLOv8-TrafficAssets",
            "status": "ONLINE",
            "latency_ms": 54,
            "requests_count": 21340,
            "avg_confidence": 0.95,
        },
        {
            "id": "traffic-flow",
            "name": "Traffic Flow & Vehicle Counter",
            "type": "traffic",
            "version": "YOLO11-FlowNet",
            "status": "ONLINE",
            "latency_ms": 46,
            "requests_count": 38900,
            "avg_confidence": 0.96,
        },
    ]

    for m in models_data:
        db.add(AIModelStatusModel(
            id=m["id"],
            name=m["name"],
            type=m["type"],
            version=m["version"],
            status=m["status"],
            latency_ms=m["latency_ms"],
            requests_count=m["requests_count"],
            avg_confidence=m["avg_confidence"],
            last_heartbeat=datetime.utcnow()
        ))

    # 3. Seed 50+ Incidents across types
    event_templates = [
        {
            "type": "pothole",
            "severities": ["medium", "high", "critical"],
            "model": "pothole-yolo",
            "image": "https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=600&auto=format&fit=crop&q=80",
            "notes": "Deep asphalt depression with loose aggregate detected in center lane."
        },
        {
            "type": "waterlogging",
            "severities": ["medium", "high", "critical"],
            "model": "waterlog-seg",
            "image": "https://images.unsplash.com/photo-1547683905-f686c993aae5?w=600&auto=format&fit=crop&q=80",
            "notes": "Water accumulation depth approx 14cm covering 2 curb lanes."
        },
        {
            "type": "road_sign",
            "severities": ["low", "medium"],
            "model": "roadsign-yolo",
            "image": "https://images.unsplash.com/photo-1584897093602-40761fbeff57?w=700&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MzB8fHR3aXN0ZWQlMjByb2FkJTIwc2lnbnN8ZW58MHx8MHx8fDA%3D",
            "notes": "Faded pedestrian zebra crossing with visibility below 30%."
        },
        {
            "type": "traffic",
            "severities": ["medium", "high"],
            "model": "traffic-flow",
            "image": "https://images.unsplash.com/photo-1506521781263-d8422e82f27a?w=600&auto=format&fit=crop&q=80",
            "notes": "Bottleneck congestion detected: average vehicle clearance speed < 8 km/h."
        },
        {
            "type": "accident",
            "severities": ["high", "critical"],
            "model": "accident-edgenet",
            "image": "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=600&auto=format&fit=crop&q=80",
            "notes": "Multi-vehicle side collision detected at intersection. Airbags deployed."
        }
    ]

    incidents_list = []
    statuses = ["detected", "investigating", "dispatched", "resolved"]

    # Generate 55 realistic incidents
    for i in range(1, 56):
        tpl = random.choice(event_templates)
        bus_id = f"BUS-{random.randint(101, 118)}"
        created_minutes_ago = random.randint(5, 720)
        t_stamp = datetime.utcnow() - timedelta(minutes=created_minutes_ago)
        sev = random.choice(tpl["severities"])
        status = random.choice(statuses)

        # Force a couple recent accidents to be 'detected' or 'dispatched'
        if tpl["type"] == "accident" and i > 45:
            status = "dispatched"
            sev = "high"

        lat_off = (random.random() - 0.5) * 0.09
        lng_off = (random.random() - 0.5) * 0.09

        inc = IncidentModel(
            id=f"INC-{i:03d}",
            bus_id=bus_id,
            event_type=tpl["type"],
            confidence=round(random.uniform(0.88, 0.98), 2),
            severity=sev,
            lat=round(base_lat + lat_off, 5),
            lng=round(base_lng + lng_off, 5),
            timestamp=t_stamp,
            camera="front" if random.random() > 0.3 else "rear",
            image_url=tpl["image"],
            video_url=None,
            model=tpl["model"],
            status=status,
            notes=tpl["notes"],
            metadata_json='{"depth_cm": 12, "detected_boxes": 3}' if tpl["type"] == "waterlogging" else None
        )
        db.add(inc)
        incidents_list.append(inc)

    # 4. Seed SOS events for high-priority accidents
    sos_count = 1
    for inc in incidents_list:
        if inc.event_type == "accident":
            sos = SOSEventModel(
                id=f"SOS-{sos_count:03d}",
                incident_id=inc.id,
                bus_id=inc.bus_id,
                severity=inc.severity,
                status="AMBULANCE_DISPATCHED" if inc.status == "dispatched" else ("RESOLVED" if inc.status == "resolved" else "SENT"),
                dispatched_ambulance=inc.status in ["dispatched", "resolved"],
                notified_police=inc.status in ["dispatched", "resolved"],
                dispatch_time=inc.timestamp + timedelta(minutes=2) if inc.status in ["dispatched", "resolved"] else None,
                created_at=inc.timestamp,
                updated_at=inc.timestamp + timedelta(minutes=5)
            )
            db.add(sos)
            sos_count += 1

    # 5. Seed Notifications
    notifs = [
        {
            "id": "NOTIF-001",
            "title": "Emergency SOS Alert Dispatched",
            "message": "Critical accident detected by BUS-104 near Madhapur Junction. Ambulance unit dispatched.",
            "category": "critical",
            "link": "/accidents",
            "read": False,
            "time_offset": 8
        },
        {
            "id": "NOTIF-002",
            "title": "Waterlogging Alert on Flyover",
            "message": "Heavy water accumulation (>15cm) reported by BUS-102 at Mindspace Underpass.",
            "category": "warning",
            "link": "/waterlogging",
            "read": False,
            "time_offset": 25
        },
        {
            "id": "NOTIF-003",
            "title": "Jetson Device Telemetry Normal",
            "message": "All 18 active bus AI edge nodes reporting nominal thermals (avg 42.1°C).",
            "category": "info",
            "link": "/ai-models",
            "read": True,
            "time_offset": 45
        },
        {
            "id": "NOTIF-004",
            "title": "Severe Pothole Cluster Flagged",
            "message": "Multiple pothole alerts registered on Outer Ring Road Service Lane.",
            "category": "warning",
            "link": "/potholes",
            "read": True,
            "time_offset": 80
        },
    ]

    for n in notifs:
        db.add(NotificationModel(
            id=n["id"],
            title=n["title"],
            message=n["message"],
            category=n["category"],
            link=n["link"],
            read=n["read"],
            created_at=datetime.utcnow() - timedelta(minutes=n["time_offset"])
        ))

    # 6. Seed Traffic statistics for corridors
    for corridor in CORRIDORS:
        db.add(TrafficStatModel(
            timestamp=datetime.utcnow() - timedelta(minutes=random.randint(1, 15)),
            corridor=corridor,
            cars=random.randint(180, 520),
            bikes=random.randint(220, 680),
            buses=random.randint(25, 60),
            trucks=random.randint(15, 45),
            pedestrians=random.randint(40, 160),
            density_score=random.randint(45, 92)
        ))

    db.commit()
