import asyncio
import contextlib
import logging
import os
import re
from contextlib import asynccontextmanager
from pathlib import Path

import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from starlette.responses import StreamingResponse

from src.api import auth, photos
from src.api.routers import maintenance

try:
    from src.api.routes import router
except (ImportError, ModuleNotFoundError):
    router = None
from src.config import get_settings
from src.maintenance.store.base import StorePermissionError, StoreUnavailableError

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
    print(
        f"Starting {settings.app_name} in {settings.app_env} mode (LLM_MODE={settings.llm_mode}, "
        f"MO_STORE={settings.mo_store}, MO_PHOTO_STORE={settings.mo_photo_store})"
    )
    # Fail fast (uvicorn exits 3) on a bad photo-store config, DB URL or schema revision; never wipes data
    await asyncio.to_thread(photos.check_photo_store)
    # Seed the fixture now if the store is empty, not on the first request (LLM_MODE=openai: 12 model calls)
    await asyncio.to_thread(maintenance.get_engine)
    jobs = asyncio.create_task(_maintenance_jobs()) if settings.mo_jobs_enabled else None
    yield
    global _portal_client
    if _portal_client and not _portal_client.is_closed:
        await _portal_client.aclose()
    if jobs:
        jobs.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await jobs
    print("Shutting down...")


app = FastAPI(
    title="MaintenanceOps Agent",
    description="Prototype mô phỏng v0.6 candidate (CR-BPTN-03): phân loại ticket vệ sinh/kỹ thuật, tầng an toàn, "
    "mức ưu tiên, chuyển phòng ban, trạng thái công khai cho cư dân, retry/leo thang, BQL nghiệm thu",
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


def _store_error_handler(status_code: int):
    """Store errors on routes that do not go through `_call` (reads, reset, auth): same body shape as HTTPException."""

    async def handler(request: Request, exc: StoreUnavailableError | StorePermissionError) -> JSONResponse:
        return JSONResponse(status_code=status_code, content={"detail": {"code": exc.code, "message": exc.message}})

    return handler


app.add_exception_handler(StoreUnavailableError, _store_error_handler(503))
app.add_exception_handler(StorePermissionError, _store_error_handler(403))

if router:
    app.include_router(router, prefix="/api/v1")
app.include_router(auth.router, prefix="/api/v1")
app.include_router(maintenance.router, prefix="/api/v1")
app.include_router(maintenance.resident_router, prefix="/api/v1")
app.include_router(maintenance.bql_router, prefix="/api/v1")

# Static prototype UI (Tailwind via CDN, no build step); it only calls the API above
app.mount("/ui", StaticFiles(directory=Path(__file__).parent / "web", html=True), name="ui")


PORTAL_URL = os.getenv("PORTAL_URL")
_portal_client: httpx.AsyncClient | None = None


def _get_portal_client() -> httpx.AsyncClient:
    global _portal_client
    if _portal_client is None or _portal_client.is_closed:
        _portal_client = httpx.AsyncClient(base_url=PORTAL_URL, timeout=60.0, follow_redirects=False)
    return _portal_client


async def _proxy_to_portal(request: Request, path: str):
    client = _get_portal_client()
    url = f"{PORTAL_URL}/{path}" if path else f"{PORTAL_URL}/"
    if request.url.query:
        url += f"?{request.url.query}"

    excluded_req_headers = {"host", "content-length", "accept-encoding"}
    req_headers = {
        k: v for k, v in request.headers.items()
        if k.lower() not in excluded_req_headers
    }
    req_headers["host"] = request.headers.get("host", "localhost:8000")

    body = await request.body()
    try:
        req = client.build_request(
            method=request.method,
            url=url,
            headers=req_headers,
            content=body,
        )
        res = await client.send(req, stream=True)
    except (httpx.ConnectError, httpx.ConnectTimeout):
        if not path or path == "/":
            return RedirectResponse(url="/ui/")
        return JSONResponse(status_code=503, content={"detail": "Portal service is unavailable"})

    response_headers = []
    for k, v in res.headers.raw:
        k_lower = k.lower()
        if k_lower in (b"content-encoding", b"content-length", b"transfer-encoding"):
            continue
        if k_lower == b"location":
            loc = v.decode("latin1")
            loc = re.sub(r"^https?://(?:portal:3000|localhost:3000)", "", loc)
            response_headers.append((k, loc.encode("latin1")))
        else:
            response_headers.append((k, v))

    response = StreamingResponse(
        res.aiter_bytes(),
        status_code=res.status_code,
        background=res.aclose,
    )
    response.raw_headers = response_headers
    return response


@app.get("/", include_in_schema=False)
async def root(request: Request):
    if PORTAL_URL:
        return await _proxy_to_portal(request, "")
    return RedirectResponse(url="/ui/")


@app.get("/health")
async def health():
    return {"status": "ok", "env": settings.app_env}


@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"], include_in_schema=False)
async def portal_fallback(request: Request, path: str):
    if PORTAL_URL:
        return await _proxy_to_portal(request, path)
    return JSONResponse(status_code=404, content={"detail": "Not found"})

