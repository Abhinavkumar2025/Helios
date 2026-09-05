from fastapi import FastAPI

from app.routes.health import router as health_router

app = FastAPI(title="Helios API", version="0.1.0")
app.include_router(health_router)


@app.get("/")
def read_root() -> dict[str, str]:
    return {"name": "Helios API", "status": "ok"}