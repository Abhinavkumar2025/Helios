from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.services import simulator

router = APIRouter(prefix="/mock", tags=["mock-simulation"])


@router.post("/accident")
async def mock_accident(bus_id: str = "BUS-1042", db: Session = Depends(get_db)):
    result = await simulator.trigger_simulated_accident(db, target_bus_id=bus_id)
    return {"status": "ok", "message": f"Accident simulated on {bus_id}", "data": result}


@router.post("/pothole")
async def mock_pothole(db: Session = Depends(get_db)):
    result = await simulator.trigger_simulated_pothole(db)
    return {"status": "ok", "message": "Pothole simulated", "data": result}


@router.post("/waterlogging")
async def mock_waterlogging(db: Session = Depends(get_db)):
    result = await simulator.trigger_simulated_waterlogging(db)
    return {"status": "ok", "message": "Waterlogging simulated", "data": result}


@router.post("/bus-offline")
async def mock_bus_offline(db: Session = Depends(get_db)):
    result = await simulator.trigger_simulated_bus_offline(db)
    return {"status": "ok", "message": "Bus offline simulated", "data": result}


@router.post("/toggle-simulator")
def toggle_simulator():
    simulator.SIMULATOR_RUNNING = not simulator.SIMULATOR_RUNNING
    return {
        "status": "ok",
        "running": simulator.SIMULATOR_RUNNING,
        "message": f"Simulator {'resumed' if simulator.SIMULATOR_RUNNING else 'paused'}",
    }


@router.get("/status")
def get_mock_status():
    return {
        "mock_mode": True,
        "simulator_running": simulator.SIMULATOR_RUNNING,
    }
