from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from src.api.routers import maintenance
from src.api.routes import router
from src.config import get_settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    print(f"Starting {settings.app_name} in {settings.app_env} mode (LLM_MODE={settings.llm_mode})")
    yield
    print("Shutting down...")


app = FastAPI(
    title="MaintenanceOps Agent",
    description="Prototype mô phỏng v0.3: phân loại ticket vệ sinh/kỹ thuật, route cấp team, kiểm tra hồ sơ cho BQL",
    version="0.3.0",
    lifespan=lifespan,
)

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api/v1")
app.include_router(maintenance.router, prefix="/api/v1")


@app.get("/", include_in_schema=False)
async def root():
    return RedirectResponse(url="/docs")


@app.get("/health")
async def health():
    return {"status": "ok", "env": settings.app_env}
