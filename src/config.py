from functools import lru_cache
from typing import Literal

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # App
    app_name: str = "AI20K Agent"
    app_env: Literal["development", "production", "test"] = "development"
    app_port: int = Field(default=8000, ge=1, le=65535)
    app_host: str = "0.0.0.0"
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    cors_origins: str = "http://localhost:3000,http://localhost:5173,http://localhost:8000,http://127.0.0.1:8000"

    # LLM
    openai_api_key: str = ""
    # OpenAI-compatible endpoint, e.g. https://openrouter.ai/api/v1 (empty = api.openai.com)
    openai_base_url: str = ""
    model_name: str = "gpt-4o-mini"
    llm_temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    # mock: rule-based extraction, deterministic, no API key needed (dev/test)
    llm_mode: Literal["openai", "mock"] = "mock"

    # MaintenanceOps: run the retry/escalation job inside the API process (CR-BPTN-02 §5)
    mo_jobs_enabled: bool = True
    # Accept X-Actor-Id instead of a login token (tests/scripts only; never enable in production)
    mo_allow_actor_header: bool = False
    # Resident and department photos (the folder is mounted as a volume in docker-compose)
    mo_upload_dir: str = "./data/uploads/maintenance"

    # MaintenanceOps persistence (plan 01)
    mo_store: Literal["memory", "postgres"] = "memory"
    mo_seed_on_empty: bool = True
    mo_allow_reset: bool = False
    mo_photo_store: Literal["local", "supabase"] = "local"
    supabase_url: str = ""
    supabase_service_role_key: SecretStr = SecretStr("")
    supabase_storage_bucket: str = "maintenance-photos"

    # MaintenanceOps reasoning agent (plan 06). It runs only with LLM_MODE=openai and a key; otherwise the rules decide.
    # The agent always calls the model with temperature=0 (llm_temperature does not apply to it).
    mo_agent_enabled: bool = True
    mo_agent_timeout_seconds: float = Field(default=25.0, gt=0, le=120)
    mo_agent_max_output_tokens: int = Field(default=2500, ge=500, le=8000)
    mo_agent_json_mode: Literal["json_object", "prompt_only"] = "json_object"

    # Database
    database_url: str = "postgresql+psycopg2://p151:p151@localhost:5432/p151"

    # Vector Store
    chroma_persist_dir: str = "./data/chroma"


@lru_cache
def get_settings() -> Settings:
    return Settings()
