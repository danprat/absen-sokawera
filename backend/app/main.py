from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import os

from app.config import get_settings
from app.database import engine, Base
from app.routers import face_core

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

# Buat folder uploads
os.makedirs("uploads/faces", exist_ok=True)
os.makedirs("uploads/logos", exist_ok=True)
os.makedirs("uploads/backgrounds", exist_ok=True)

# Mount uploads folder (untuk foto wajah, logo, background)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# API Routes
API_PREFIX = "/api/v1"

app.include_router(face_core.router, prefix=API_PREFIX)


@app.on_event("startup")
def on_startup():
    if settings_config.AUTO_CREATE_SCHEMA:
        Base.metadata.create_all(bind=engine)


@app.get("/health")
def health_check():
    return {"status": "healthy"}


# ============================================
# FRONTEND SERVING (untuk production all-in-one)
# ============================================

# Path ke frontend dist (setelah build)
# Sesuaikan path ini dengan struktur folder di server
FRONTEND_PATH = "../frontend_dist"

# Mount static assets (CSS, JS, images) jika folder frontend ada
if os.path.exists(FRONTEND_PATH):
    # Serve /assets untuk CSS, JS, dll
    assets_path = os.path.join(FRONTEND_PATH, "assets")
    if os.path.exists(assets_path):
        app.mount("/assets", StaticFiles(directory=assets_path), name="assets")

    # Catch-all route untuk SPA (harus paling akhir!)
    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        """
        Serve frontend untuk semua route yang tidak match dengan API.
        Ini untuk support client-side routing (React Router).
        """
        # Skip jika request ke API atau uploads (sudah di-handle di atas)
        if full_path.startswith("api/") or full_path.startswith("uploads/"):
            # Biarkan FastAPI return 404
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Not Found")

        # Coba serve file langsung jika ada (untuk file statis selain assets)
        file_path = os.path.join(FRONTEND_PATH, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)

        # Default: serve index.html untuk SPA routing
        index_path = os.path.join(FRONTEND_PATH, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)

        # Jika index.html tidak ada
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Frontend not found")
else:
    # Jika folder frontend tidak ada (development mode)
    @app.get("/")
    def root():
        return {
            "message": "Face Recognition Service API",
            "version": "1.0.0",
            "routes": ["/api/v1/subjects", "/api/v1/detect", "/api/v1/recognize", "/health"]
        }
