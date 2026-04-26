from dataclasses import dataclass
from hashlib import sha256
from typing import Optional

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models.face_client import FaceClient


def hash_face_app_key(api_key: str) -> str:
    return sha256(api_key.encode("utf-8")).hexdigest()


@dataclass(frozen=True)
class FaceClientContext:
    id: int
    tenant_id: str
    name: str


def ensure_default_face_client(db: Session, api_key: str) -> FaceClient:
    settings = get_settings()
    key_hash = hash_face_app_key(api_key)
    existing = db.query(FaceClient).filter(FaceClient.api_key_hash == key_hash).first()
    if existing:
        return existing

    client = FaceClient(
        tenant_id=settings.DEFAULT_TENANT_ID,
        name="Default Face Client",
        api_key_hash=key_hash,
        is_active=True,
    )
    db.add(client)
    db.commit()
    db.refresh(client)
    return client


def get_current_face_client(
    x_face_app_key: Optional[str] = Header(default=None),
    x_face_service_key: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
) -> FaceClientContext:
    api_key = x_face_app_key or x_face_service_key
    if not api_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing face app key")

    key_hash = hash_face_app_key(api_key)
    client = db.query(FaceClient).filter(
        FaceClient.api_key_hash == key_hash,
        FaceClient.is_active == True,
    ).first()

    settings = get_settings()
    if not client and settings.FACE_SERVICE_API_KEY and api_key == settings.FACE_SERVICE_API_KEY:
        client = ensure_default_face_client(db, api_key)

    if not client:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid face app key")

    return FaceClientContext(id=client.id, tenant_id=client.tenant_id, name=client.name)
