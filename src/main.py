from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.responses import RedirectResponse
from sqlmodel import Session

from src.api.routers import catalog, escalations, jobs, maintenance, metrics, tickets, work_orders
from src.api.routes import router
from src.config import get_settings
from src.db import get_engine, init_db
from src.services.seed import seed_if_empty


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    print(f"Starting {settings.app_name} in {settings.app_env} mode (LLM_MODE={settings.llm_mode})")
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    engine = get_engine()
    init_db(engine)
    if settings.seed_on_startup:
        with Session(engine) as session:
            if seed_if_empty(session):
                print("Seeded demo data (locations, shifts, playbooks)")
    yield
    print("Shutting down...")


app = FastAPI(
    title="AI20K Agent",
    description="AI Agent built with LangGraph",
    version="1.0.0",
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
for module in (tickets, work_orders, escalations, jobs, metrics, catalog, maintenance):
    app.include_router(module.router, prefix="/api/v1")


def _mark_binary(node):
    # FastAPI marks uploads with contentMediaType only; Swagger UI needs format: binary to show a file picker
    if isinstance(node, dict):
        if node.get("contentMediaType") == "application/octet-stream":
            node["format"] = "binary"
        for value in node.values():
            _mark_binary(value)
    elif isinstance(node, list):
        for value in node:
            _mark_binary(value)


def custom_openapi():
    if app.openapi_schema is None:
        schema = get_openapi(
            title=app.title, version=app.version, description=app.description, routes=app.routes
        )
        _mark_binary(schema)
        app.openapi_schema = schema
    return app.openapi_schema


app.openapi = custom_openapi


@app.get("/", include_in_schema=False)
async def root():
    return RedirectResponse(url="/docs")


@app.get("/health")
async def health():
    return {"status": "ok", "env": settings.app_env}
