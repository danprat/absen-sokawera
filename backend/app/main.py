from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.config import get_settings
from app.db import Base, engine
from app.face import api as face_api

settings_config = get_settings()


# Rate limiter setup
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="Face Recognition Service",
    description="Tenant-scoped agnostic face recognition API",
    version="1.0.0"
)

# Add rate limiter to app state
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings_config.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Routes
API_PREFIX = "/api/v1"

app.include_router(face_api.router, prefix=API_PREFIX)


@app.on_event("startup")
def on_startup():
    if settings_config.AUTO_CREATE_SCHEMA:
        Base.metadata.create_all(bind=engine)


@app.get("/health")
def health_check():
    return {"status": "healthy"}


@app.get("/")
def root():
    return {
        "message": "Face Recognition Service API",
        "version": "1.0.0",
        "routes": ["/api/v1/subjects", "/api/v1/detect", "/api/v1/recognize", "/health"],
    }
