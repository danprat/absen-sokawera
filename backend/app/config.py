from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "mysql+pymysql://root:@localhost:3306/absen_desa"
    DB_POOL_SIZE: int = 3
    DB_MAX_OVERFLOW: int = 2
    DB_POOL_TIMEOUT: int = 10

    # JWT
    SECRET_KEY: str = "generated-secure-key-here"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours

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
    
    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


@lru_cache()
def get_settings() -> Settings:
    return Settings()
