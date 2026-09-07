import asyncio
import logging
import random
from datetime import datetime
from sqlalchemy.orm import Session
from app.database.models import (
    BusModel,
    GPSLogModel,
    IncidentModel,
    NotificationModel,
    SOSEventModel,
    TrafficStatModel,
)
from app.database.session import SessionLocal
from app.websocket.manager import manager

logger = logging.getLogger("helios.simulator")

SIMULATOR_RUNNING = True
SIMULATION_TASK = None


async def run_simulation_loop():
    """Background loop that periodically moves buses and updates telemetry."""
    logger.info("Helios Mock Simulation Engine started.")
    tick_counter = 0

    while True:
        try:
            if SIMULATOR_RUNNING:
                db: Session = SessionLocal()
                try:
                    tick_counter += 1
                    # 1. Update online buses positions and telemetry
                    online_buses = db.query(BusModel).filter(BusModel.status == "online").all()
                    updated_buses_data = []

                    for bus in online_buses:
                        # Subtle drift along corridor
                        lat_delta = (random.random() - 0.49) * 0.0006
                        lng_delta = (random.random() - 0.49) * 0.0006

                        bus.lat = round(bus.lat + lat_delta, 5)
                        bus.lng = round(bus.lng + lng_delta, 5)
                        bus.speed = round(max(15.0, min(55.0, bus.speed + random.uniform(-2.0, 2.0))), 1)
                        bus.jetson_temp = round(max(38.0, min(48.0, bus.jetson_temp + random.uniform(-0.3, 0.3))), 1)
                        bus.jetson_cpu = round(max(20.0, min(65.0, bus.jetson_cpu + random.uniform(-1.5, 1.5))), 1)
                        bus.last_seen = datetime.utcnow()

                        # Log GPS history occasionally
                        if tick_counter % 5 == 0:
                            db.add(GPSLogModel(
                                bus_id=bus.id,
                                lat=bus.lat,
                                lng=bus.lng,
                                speed=bus.speed,
                                timestamp=bus.last_seen
                            ))

                        updated_buses_data.append({
                            "id": bus.id,
                            "lat": bus.lat,
                            "lng": bus.lng,
                            "speed": bus.speed,
                            "status": bus.status,
                            "jetson_temp": bus.jetson_temp,
                            "jetson_cpu": bus.jetson_cpu,
                            "last_seen": bus.last_seen.isoformat(),
                        })

                    db.commit()

                    # Broadcast GPS update packet to all dashboard clients
                    if updated_buses_data:
                        await manager.broadcast("gps_updated", updated_buses_data)

                    # Occasionally (every ~45s) simulate a mild road anomaly detection (pothole or traffic update)
                    if tick_counter % 15 == 0 and len(online_buses) > 0:
                        chosen_bus = random.choice(online_buses)
                        new_pothole_id = f"INC-{random.randint(10000, 99999)}"
                        pothole_inc = IncidentModel(
                            id=new_pothole_id,
                            bus_id=chosen_bus.id,
                            event_type="pothole",
                            confidence=round(random.uniform(0.91, 0.97), 2),
                            severity="medium",
                            lat=chosen_bus.lat,
                            lng=chosen_bus.lng,
                            timestamp=datetime.utcnow(),
                            camera="front",
                            image_url="https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=600&auto=format&fit=crop&q=80",
                            model="pothole-yolo",
                            status="detected",
                            notes="Real-time road surface depression detected by bus dashcam."
                        )
                        db.add(pothole_inc)
                        db.commit()

                        await manager.broadcast("incident_created", {
                            "id": pothole_inc.id,
                            "bus_id": pothole_inc.bus_id,
                            "event_type": pothole_inc.event_type,
                            "confidence": pothole_inc.confidence,
                            "severity": pothole_inc.severity,
                            "gps": {"lat": pothole_inc.lat, "lng": pothole_inc.lng},
                            "timestamp": pothole_inc.timestamp.isoformat(),
                            "camera": pothole_inc.camera,
                            "image_url": pothole_inc.image_url,
                            "model": pothole_inc.model,
                            "status": pothole_inc.status,
                            "notes": pothole_inc.notes
                        })

                except Exception as e:
                    db.rollback()
                    logger.error(f"Error in simulation loop iteration: {e}")
                finally:
                    db.close()

            await asyncio.sleep(3)
        except asyncio.CancelledError:
            logger.info("Simulation loop cancelled.")
            break
        except Exception as e:
            logger.error(f"Unexpected error in simulation loop: {e}")
            await asyncio.sleep(3)


async def trigger_simulated_accident(db: Session, target_bus_id: str = "BUS-1042"):
    """Creates a high-urgency accident event and broadcasts immediately."""
    # Find or use target bus
    bus = db.query(BusModel).filter(BusModel.id == target_bus_id).first()
    if not bus:
        # Pick any online bus or create BUS-1042
        bus = db.query(BusModel).filter(BusModel.status == "online").first()
        if not bus:
            bus = BusModel(
                id=target_bus_id,
                route="Route 1042: Hitec City - Airport Express",
                status="warning",
                speed=0.0,
                lat=17.4412,
                lng=78.3921,
                battery=88,
                driver_name="A. Kumar",
                jetson_status="online",
                jetson_temp=44.2,
                jetson_cpu=48.0,
                last_seen=datetime.utcnow()
            )
            db.add(bus)
            db.commit()

    bus.status = "warning"
    bus.speed = 0.0
    db.commit()

    incident_id = f"INC-{random.randint(600, 999)}"
    accident_incident = IncidentModel(
        id=incident_id,
        bus_id=bus.id,
        event_type="accident",
        confidence=0.97,
        severity="high",
        lat=bus.lat,
        lng=bus.lng,
        timestamp=datetime.utcnow(),
        camera="front",
        image_url="https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=600&auto=format&fit=crop&q=80",
        video_url="/media/simulated_accident_clip.mp4",
        model="accident-edgenet",
        status="detected",
        notes="URGENT: High-impact side collision detected by front camera. Vehicle velocity dropped abruptly to 0."
    )
    db.add(accident_incident)

    sos_id = f"SOS-{random.randint(500, 999)}"
    sos_event = SOSEventModel(
        id=sos_id,
        incident_id=incident_id,
        bus_id=bus.id,
        severity="high",
        status="SENT",
        dispatched_ambulance=False,
        notified_police=False,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.add(sos_event)

    notif_id = f"NOTIF-{random.randint(500, 999)}"
    notif = NotificationModel(
        id=notif_id,
        title=f"CRITICAL: Accident Detected on {bus.id}",
        message=f"Collision detected at coordinates {bus.lat}, {bus.lng}. Confidence: 97%. SOS Status: SENT.",
        category="critical",
        link="/accidents",
        read=False,
        created_at=datetime.utcnow()
    )
    db.add(notif)
    db.commit()

    # Broadcast via WebSockets
    incident_data = {
        "id": accident_incident.id,
        "bus_id": accident_incident.bus_id,
        "event_type": "accident",
        "confidence": accident_incident.confidence,
        "severity": accident_incident.severity,
        "gps": {"lat": accident_incident.lat, "lng": accident_incident.lng},
        "timestamp": accident_incident.timestamp.isoformat(),
        "camera": accident_incident.camera,
        "image_url": accident_incident.image_url,
        "video_url": accident_incident.video_url,
        "model": accident_incident.model,
        "status": accident_incident.status,
        "notes": accident_incident.notes,
    }

    sos_data = {
        "id": sos_event.id,
        "incident_id": sos_event.incident_id,
        "bus_id": sos_event.bus_id,
        "severity": sos_event.severity,
        "status": sos_event.status,
        "dispatched_ambulance": sos_event.dispatched_ambulance,
        "notified_police": sos_event.notified_police,
        "created_at": sos_event.created_at.isoformat(),
        "updated_at": sos_event.updated_at.isoformat(),
        "incident": incident_data
    }

    await manager.broadcast("incident_created", incident_data)
    await manager.broadcast("sos_created", sos_data)
    await manager.broadcast("bus_updated", {
        "id": bus.id,
        "status": bus.status,
        "speed": bus.speed,
        "lat": bus.lat,
        "lng": bus.lng
    })
    await manager.broadcast("notification_created", {
        "id": notif.id,
        "title": notif.title,
        "message": notif.message,
        "category": notif.category,
        "link": notif.link,
        "read": notif.read,
        "created_at": notif.created_at.isoformat()
    })

    return {"incident": incident_data, "sos": sos_data}


async def trigger_simulated_pothole(db: Session):
    online_bus = db.query(BusModel).filter(BusModel.status == "online").first()
    lat = online_bus.lat if online_bus else 17.4430
    lng = online_bus.lng if online_bus else 78.3850
    bus_id = online_bus.id if online_bus else "BUS-102"

    incident_id = f"INC-{random.randint(600, 999)}"
    inc = IncidentModel(
        id=incident_id,
        bus_id=bus_id,
        event_type="pothole",
        confidence=round(random.uniform(0.92, 0.98), 2),
        severity="high",
        lat=lat,
        lng=lng,
        timestamp=datetime.utcnow(),
        camera="front",
        image_url="https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=600&auto=format&fit=crop&q=80",
        model="pothole-yolo",
        status="detected",
        notes="Severe surface fracture and crater with 8cm depth detected on driving line."
    )
    db.add(inc)

    notif = NotificationModel(
        id=f"NOTIF-{random.randint(500, 999)}",
        title=f"Critical Pothole Detected on {bus_id}",
        message=f"High-severity crater flagged at {lat}, {lng}. Recommended road maintenance alert generated.",
        category="warning",
        link="/potholes",
        read=False,
        created_at=datetime.utcnow()
    )
    db.add(notif)
    db.commit()

    data = {
        "id": inc.id,
        "bus_id": inc.bus_id,
        "event_type": "pothole",
        "confidence": inc.confidence,
        "severity": inc.severity,
        "gps": {"lat": inc.lat, "lng": inc.lng},
        "timestamp": inc.timestamp.isoformat(),
        "camera": inc.camera,
        "image_url": inc.image_url,
        "model": inc.model,
        "status": inc.status,
        "notes": inc.notes
    }
    await manager.broadcast("incident_created", data)
    return data


async def trigger_simulated_waterlogging(db: Session):
    online_bus = db.query(BusModel).filter(BusModel.status == "online").first()
    lat = online_bus.lat if online_bus else 17.4450
    lng = online_bus.lng if online_bus else 78.3880
    bus_id = online_bus.id if online_bus else "BUS-105"

    incident_id = f"INC-{random.randint(600, 999)}"
    inc = IncidentModel(
        id=incident_id,
        bus_id=bus_id,
        event_type="waterlogging",
        confidence=0.94,
        severity="critical",
        lat=lat,
        lng=lng,
        timestamp=datetime.utcnow(),
        camera="front",
        image_url="https://images.unsplash.com/photo-1547683905-f686c993aae5?w=600&auto=format&fit=crop&q=80",
        model="waterlog-seg",
        status="detected",
        notes="High water accumulation (>18cm). Lane blockage imminent. Traffic diversion recommended.",
        metadata_json='{"depth_cm": 18, "road_blocked": true}'
    )
    db.add(inc)

    notif = NotificationModel(
        id=f"NOTIF-{random.randint(500, 999)}",
        title="Critical Waterlogging Alert",
        message=f"Severe flooding (18cm depth) reported by {bus_id}. Road clearance dispatch initiated.",
        category="critical",
        link="/waterlogging",
        read=False,
        created_at=datetime.utcnow()
    )
    db.add(notif)
    db.commit()

    data = {
        "id": inc.id,
        "bus_id": inc.bus_id,
        "event_type": "waterlogging",
        "confidence": inc.confidence,
        "severity": inc.severity,
        "gps": {"lat": inc.lat, "lng": inc.lng},
        "timestamp": inc.timestamp.isoformat(),
        "camera": inc.camera,
        "image_url": inc.image_url,
        "model": inc.model,
        "status": inc.status,
        "notes": inc.notes,
        "metadata_json": inc.metadata_json
    }
    await manager.broadcast("incident_created", data)
    return data


# async def trigger_simulated_bus_offline(db: Session):
#     bus = db.query(BusModel).filter(BusModel.status == "online").first()
#     if bus:
#         bus.status = "offline"
#         bus.jetson_status = "offline"
#         bus.speed = 0.0
#         db.commit()

#         await manager.broadcast("bus_updated", {
#             "id": bus.id,
#             "status": "offline",
#             "jetson_status": "offline",
#             "speed": 0.0
#         })

#         notif = NotificationModel(
#             id=f"NOTIF-{random.randint(500, 999)}",
#             title=f"Bus Telemetry Lost: {bus.id}",
#             message=f"Jetson Nano edge node on {bus.id} went offline. Camera streams suspended.",
#             category="warning",
#             link="/buses",
#             read=False,
#             created_at=datetime.utcnow()
#         )
#         db.add(notif)
#         db.commit()

#         await manager.broadcast("notification_created", {
#             "id": notif.id,
#             "title": notif.title,
#             "message": notif.message,
#             "category": notif.category,
#             "link": notif.link,
#             "read": notif.read,
#             "created_at": notif.created_at.isoformat()
#         })

#         return {"bus_id": bus.id, "status": "offline"}
#     return {"message": "No online bus found to toggle"}
