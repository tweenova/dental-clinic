import os
from typing import Any, List, Optional
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Loads and holds configuration settings for the backend application.

    Values are read from environment variables or a local .env file, controlling settings
    like database connection addresses, allowed website origins, authentication, and file storage.
    """
    ENVIRONMENT: str = "development"
    DEBUG: bool = False
    APP_NAME: str = "Marlow Dental API"
    API_V1_PREFIX: str = "/api/v1"

    @field_validator("DEBUG", mode="before")
    @classmethod
    def parse_debug(cls, v: Any) -> bool:
        if isinstance(v, bool):
            return v
        if isinstance(v, (int, float)):
            return bool(v)
        if isinstance(v, str):
            normalized = v.strip().lower()
            if normalized in ("true", "1", "yes", "y", "t", "enable", "enabled", "on", "debug", "dev", "development"):
                return True
            return False
        return False

    ALLOWED_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"
    DATABASE_URL: str = "postgresql+asyncpg://user:password@localhost:5432/dentai_dev"
    APPOINTMENTS_RATE_LIMIT: str = "5/minute"

    # Authentication & Security
    JWT_SECRET_KEY: str = "dev-marlow-dental-insecure-secret-key-change-in-production-2026"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 7 * 24 * 60  # 7 days (10,080 minutes)
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7  # 7 days
    REFRESH_TOKEN_ROTATE_AFTER_MINUTES: int = 35  # 35 minutes rotation window
    REFRESH_COOKIE_NAME: str = "marlow_refresh_token"
    COOKIE_SECURE: bool = False
    COOKIE_SAMESITE: str = "lax"
    COOKIE_DOMAIN: Optional[str] = None
    LOGIN_RATE_LIMIT: str = "5/minute"
    REFRESH_RATE_LIMIT: str = "30/minute"
    CONCURRENCY_GRACE_PERIOD_SECONDS: int = 30

    # Storage & Attachments
    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_SIZE_BYTES: int = 5 * 1024 * 1024  # 5 MB
    ATTACHMENT_DIR: str = os.getenv(
        "ATTACHMENT_DIR",
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "storage", "attachments")),
    )
    ATTACHMENT_MAX_SIZE_BYTES: int = 15 * 1024 * 1024  # 15 MB

    # Messaging & Reminders Scheduler
    SCHEDULER_ENABLED: bool = False
    SCHEDULER_INTERVAL_SECONDS: int = 60

    # Clinical Depth Flags
    CLINICAL_DOCUMENTS_ENABLED: bool = True

    @model_validator(mode="after")
    def verify_production_safety(self) -> "Settings":
        if self.ENVIRONMENT.lower() == "production":
            insecure_markers = ["dev-marlow", "change-in-production", "secret", "default", "insecure"]
            if (
                not self.JWT_SECRET_KEY
                or len(self.JWT_SECRET_KEY) < 32
                or any(marker in self.JWT_SECRET_KEY.lower() for marker in ["change-in-production", "dev-marlow-dental"])
            ):
                raise ValueError(
                    "Production startup refused: JWT_SECRET_KEY is unset or using the default development secret."
                )
        return self

    @property
    def cors_origins(self) -> List[str]:
        """Converts the comma-separated string of allowed web addresses into a clean Python list."""
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
