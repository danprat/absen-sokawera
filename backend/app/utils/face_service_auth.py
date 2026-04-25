from typing import Optional

from fastapi import Header, HTTPException, status

from app.config import get_settings


def require_face_service_key(
    x_face_service_key: Optional[str] = Header(default=None),
) -> None:
    settings = get_settings()
    if not settings.FACE_SERVICE_REQUIRE_API_KEY:
        return None

    if not settings.FACE_SERVICE_API_KEY or x_face_service_key != settings.FACE_SERVICE_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid face service key",
        )

    return None
