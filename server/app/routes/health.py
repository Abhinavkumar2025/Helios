from fastapi import APIRouter

router = APIRouter(prefix="/health", tags=["health"])


@router.get("")
def health_check() -> dict[str, str]:
    return {
        "status": "ok",
        "system": "HELIOS Central Command Server",
        "version": "1.0.0",
        "environment": "local-simulated",
        "tagline": "Intelligent Mobility. Safer Cities."
    }