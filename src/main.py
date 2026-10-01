import asyncio
import contextlib
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

from src.api import auth
from src.api.routers import maintenance
try:
    from src.api.routes import router
except (ImportError, ModuleNotFoundError):
    router = None
from src.config import get_settings

logger = logging.getLogger(__name__)


async def _maintenance_jobs() -> None:
    """CR-BPTN-02 §5: scan for due retries/escalations every `sla_config.job_interval_minutes`."""
    engine = maintenance.get_engine()
    interval = engine.catalog.sla_config.job_interval_minutes * 60
    while True:
        await asyncio.sleep(interval)
        try:
            # off the event loop: the job may call the LLM, and must not freeze every request meanwhile
            await asyncio.to_thread(engine.run_jobs)
        except Exception:  # one bad run must not stop the schedule
            logger.exception("MaintenanceOps job failed")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    print(f"Starting {settings.app_name} in {settings.app_env} mode (LLM_MODE={settings.llm_mode})")
    # Load the fixture now, not on the first request (with LLM_MODE=openai that is 12 model calls)
    await asyncio.to_thread(maintenance.get_engine)
    jobs = asyncio.create_task(_maintenance_jobs()) if settings.mo_jobs_enabled else None
    yield
    if jobs:
        jobs.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await jobs
    print("Shutting down...")


app = FastAPI(
    title="MaintenanceOps Agent",
    description="Prototype mô phỏng v0.5 candidate (CR-BPTN-02): phân loại ticket vệ sinh/kỹ thuật, chuyển phòng "
    "ban, trạng thái công khai cho cư dân, retry/leo thang, BQL nghiệm thu",
    version="0.5.0-candidate",
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

if router:
    app.include_router(router, prefix="/api/v1")
app.include_router(auth.router, prefix="/api/v1")
app.include_router(maintenance.router, prefix="/api/v1")
app.include_router(maintenance.resident_router, prefix="/api/v1")
app.include_router(maintenance.bql_router, prefix="/api/v1")

# Static prototype UI (Tailwind via CDN, no build step); it only calls the API above
app.mount("/ui", StaticFiles(directory=Path(__file__).parent / "web", html=True), name="ui")


@app.get("/", include_in_schema=False)
async def root():
    return RedirectResponse(url="/ui/")


@app.get("/health")
async def health():
    return {"status": "ok", "env": settings.app_env}
