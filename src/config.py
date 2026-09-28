from functools import lru_cache
from typing import Literal

from pydantic import Field
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
    cors_origins: str = "http://localhost:3000"

    # LLM
    openai_api_key: str = ""
    # OpenAI-compatible endpoint, e.g. https://openrouter.ai/api/v1 (empty = api.openai.com)
    openai_base_url: str = ""
    model_name: str = "gpt-4o-mini"
    llm_temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    # mock: rule-based extraction, deterministic, no API key needed (dev/test)
    llm_mode: Literal["openai", "mock"] = "mock"

    # Database
    database_url: str = "postgresql+psycopg2://p151:p151@localhost:5432/p151"

    # Zalo Bot (notify technicians)
    zalo_bot_token: str = ""
    zalo_webhook_secret: str = ""
    zalo_tech_chat_id: str = ""

    # Maintenance ops
    upload_dir: str = "./data/uploads"
    max_upload_mb: int = Field(default=10, ge=1)
    seed_on_startup: bool = True
    # Escalate to BQL after this many failed evidence checks on one work order
    max_check_failures: int = Field(default=2, ge=1)

    # Vector Store
    chroma_persist_dir: str = "./data/chroma"


@lru_cache
def get_settings() -> Settings:
    return Settings()
