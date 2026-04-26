from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache
from typing import Optional
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit


SQLALCHEMY_UNSUPPORTED_DATABASE_OPTIONS = {"connection_limit", "pgbouncer"}


def normalize_database_url_for_sqlalchemy(database_url: str) -> str:
    if not database_url.startswith(("postgresql://", "postgresql+psycopg://", "postgresql+psycopg2://")):
        return database_url

    parts = urlsplit(database_url)
    query_items = [
        (key, value)
        for key, value in parse_qsl(parts.query, keep_blank_values=True)
        if key not in SQLALCHEMY_UNSUPPORTED_DATABASE_OPTIONS
    ]
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query_items), parts.fragment))


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "mysql+pymysql://root:@localhost:3306/absen_desa"
    DB_POOL_SIZE: int = 3
    DB_MAX_OVERFLOW: int = 2
    DB_POOL_TIMEOUT: int = 10
    DB_POOL_RECYCLE_SECONDS: int = 3600
    DEFAULT_TENANT_ID: str = "default"

    # JWT
    SECRET_KEY: str = "generated-secure-key-here"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours
    SUPABASE_JWT_SECRET: Optional[str] = None

    # App
    DEBUG: bool = True
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"
    AUTO_CREATE_SCHEMA: bool = True
    WORK_SETTINGS_CACHE_TTL_SECONDS: int = 300
    DAILY_SCHEDULE_CACHE_TTL_SECONDS: int = 1800
    HOLIDAY_CACHE_TTL_SECONDS: int = 1800
    PRELOAD_FACE_EMBEDDINGS: bool = True

    # Face Recognition
    FACE_RECOGNITION_ENABLED: bool = False
    FACE_RECOGNITION_URL: str = "http://localhost:8001"
    FACE_RECOGNITION_DEBUG_LOGS: bool = False
    FACE_SERVICE_URL: str = "http://localhost:8001"
    FACE_SERVICE_API_KEY: Optional[str] = None
    FACE_SERVICE_REQUIRE_API_KEY: bool = False
    FACE_SERVICE_JWT_AUDIENCE: str = "face-service"
    FACE_SERVICE_TIMEOUT_SECONDS: float = 10.0
    FACE_UPLOAD_ROOT: str = "uploads"
    FACE_UPLOAD_PUBLIC_PREFIX: str = "/uploads"

    # Supabase
    SUPABASE_URL: Optional[str] = None
    SUPABASE_ANON_KEY: Optional[str] = None
    SUPABASE_SERVICE_ROLE_KEY: Optional[str] = None
    SUPABASE_STORAGE_BRANDING_BUCKET: str = "branding-assets"
    SUPABASE_STORAGE_FACE_BUCKET: str = "face-originals"
    SUPABASE_STORAGE_ATTENDANCE_BUCKET: str = "attendance-captures"
    
    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    @property
    def sqlalchemy_database_url(self) -> str:
        return normalize_database_url_for_sqlalchemy(self.DATABASE_URL)
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


@lru_cache()
def get_settings() -> Settings:
    return Settings()
