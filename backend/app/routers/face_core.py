import base64
import os
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.face_subject import FaceSubject
from app.models.face_template import FaceTemplate
from app.schemas.face_core import (
    FaceDetectResponse,
    FaceRecognizeResponse,
    FaceSubjectCreate,
    FaceSubjectResponse,
    FaceSubjectUpdate,
    FaceTemplateResponse,
    FaceTemplateUploadResponse,
)
from app.services.face_recognition import face_recognition_service
from app.utils.face_app_auth import FaceClientContext, get_current_face_client


router = APIRouter(prefix="", tags=["Face Core"])
UPLOAD_DIR = "uploads/faces"


async def read_image_payload(file: Optional[UploadFile] = None, image_base64: Optional[str] = None) -> bytes:
    if file:
        return await file.read()
    if image_base64:
        try:
            if "," in image_base64:
                image_base64 = image_base64.split(",", 1)[1]
            return base64.b64decode(image_base64)
        except Exception:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Format base64 tidak valid")
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Gambar diperlukan")


def get_subject_or_404(db: Session, subject_id: int, tenant_id: str) -> FaceSubject:
    subject = db.query(FaceSubject).filter(
        FaceSubject.id == subject_id,
        FaceSubject.tenant_id == tenant_id,
    ).first()
    if not subject:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subject tidak ditemukan")
    return subject


def save_template_photo(image_data: bytes, tenant_id: str, filename: Optional[str]) -> str:
    ext = filename.split(".")[-1] if filename and "." in filename else "jpg"
    safe_tenant = "".join(ch for ch in tenant_id if ch.isalnum() or ch in ("-", "_")) or "default"
    folder = os.path.join(UPLOAD_DIR, safe_tenant)
    os.makedirs(folder, exist_ok=True)
    stored_name = f"{uuid.uuid4()}.{ext}"
    filepath = os.path.join(folder, stored_name)
    with open(filepath, "wb") as f:
        f.write(image_data)
    return f"/uploads/faces/{safe_tenant}/{stored_name}"


@router.post("/subjects", response_model=FaceSubjectResponse, status_code=status.HTTP_201_CREATED)
def create_subject(
    payload: FaceSubjectCreate,
    db: Session = Depends(get_db),
    client: FaceClientContext = Depends(get_current_face_client),
):
    existing = db.query(FaceSubject).filter(
        FaceSubject.tenant_id == client.tenant_id,
        FaceSubject.external_subject_id == payload.external_subject_id,
    ).first()
    if existing:
        existing.display_name = payload.display_name
        existing.subject_metadata = payload.metadata
        existing.is_active = True
        db.commit()
        db.refresh(existing)
        return existing

    subject = FaceSubject(
        tenant_id=client.tenant_id,
        external_subject_id=payload.external_subject_id,
        display_name=payload.display_name,
        subject_metadata=payload.metadata,
    )
    db.add(subject)
    db.commit()
    db.refresh(subject)
    return subject


@router.get("/subjects", response_model=list[FaceSubjectResponse])
def list_subjects(
    external_subject_id: Optional[str] = None,
    db: Session = Depends(get_db),
    client: FaceClientContext = Depends(get_current_face_client),
):
    query = db.query(FaceSubject).filter(FaceSubject.tenant_id == client.tenant_id)
    if external_subject_id:
        query = query.filter(FaceSubject.external_subject_id == external_subject_id)
    return query.order_by(FaceSubject.display_name).all()


@router.patch("/subjects/{subject_id}", response_model=FaceSubjectResponse)
def update_subject(
    subject_id: int,
    payload: FaceSubjectUpdate,
    db: Session = Depends(get_db),
    client: FaceClientContext = Depends(get_current_face_client),
):
    subject = get_subject_or_404(db, subject_id, client.tenant_id)
    if payload.display_name is not None:
        subject.display_name = payload.display_name
    if payload.metadata is not None:
        subject.subject_metadata = payload.metadata
    if payload.is_active is not None:
        subject.is_active = payload.is_active
    db.commit()
    db.refresh(subject)
    face_recognition_service.invalidate_template_cache(client.tenant_id)
    return subject


@router.post("/subjects/{subject_id}/faces", response_model=FaceTemplateUploadResponse)
async def upload_subject_face(
    subject_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    client: FaceClientContext = Depends(get_current_face_client),
):
    subject = get_subject_or_404(db, subject_id, client.tenant_id)
    if file.content_type and not file.content_type.startswith("image/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File harus berupa gambar")

    image_data = await file.read()
    if not face_recognition_service.detect_face(image_data):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Wajah tidak terdeteksi dalam gambar")

    embedding = face_recognition_service.generate_embedding(image_data, use_cnn=False, num_jitters=1)
    if embedding is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Embedding wajah gagal dibuat. Coba gunakan foto wajah yang lebih jelas.",
        )

    existing_count = db.query(FaceTemplate).filter(
        FaceTemplate.tenant_id == client.tenant_id,
        FaceTemplate.subject_id == subject.id,
    ).count()
    template = FaceTemplate(
        tenant_id=client.tenant_id,
        subject_id=subject.id,
        embedding=embedding,
        photo_url=save_template_photo(image_data, client.tenant_id, file.filename),
        is_primary=existing_count == 0,
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    face_recognition_service.invalidate_template_cache(client.tenant_id)
    return FaceTemplateUploadResponse(
        id=template.id,
        subject_id=subject.id,
        photo_url=template.photo_url,
        message="Foto wajah berhasil disimpan",
    )


@router.get("/subjects/{subject_id}/faces", response_model=list[FaceTemplateResponse])
def list_subject_faces(
    subject_id: int,
    db: Session = Depends(get_db),
    client: FaceClientContext = Depends(get_current_face_client),
):
    subject = get_subject_or_404(db, subject_id, client.tenant_id)
    return db.query(FaceTemplate).filter(
        FaceTemplate.tenant_id == client.tenant_id,
        FaceTemplate.subject_id == subject.id,
    ).order_by(FaceTemplate.created_at.desc()).all()


@router.delete("/faces/{face_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_face_template(
    face_id: int,
    db: Session = Depends(get_db),
    client: FaceClientContext = Depends(get_current_face_client),
):
    template = db.query(FaceTemplate).filter(
        FaceTemplate.id == face_id,
        FaceTemplate.tenant_id == client.tenant_id,
    ).first()
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Foto tidak ditemukan")
    if template.photo_url and os.path.exists(template.photo_url.lstrip("/")):
        os.remove(template.photo_url.lstrip("/"))
    db.delete(template)
    db.commit()
    face_recognition_service.invalidate_template_cache(client.tenant_id)
    return None


@router.post("/detect", response_model=FaceDetectResponse)
async def detect_face(
    file: UploadFile = File(None),
    image_base64: str = Form(None),
    client: FaceClientContext = Depends(get_current_face_client),
):
    del client
    image_data = await read_image_payload(file, image_base64)
    return FaceDetectResponse(detected=face_recognition_service.detect_face(image_data))


@router.post("/recognize", response_model=FaceRecognizeResponse)
async def recognize_subject(
    file: UploadFile = File(None),
    image_base64: str = Form(None),
    db: Session = Depends(get_db),
    client: FaceClientContext = Depends(get_current_face_client),
):
    image_data = await read_image_payload(file, image_base64)
    subject, confidence, face_id = face_recognition_service.find_matching_subject(
        image_data,
        db,
        tenant_id=client.tenant_id,
        threshold=0.5,
    )

    if not subject:
        return FaceRecognizeResponse(
            matched=False,
            confidence=round(confidence * 100, 1),
            subject=None,
            face_id=None,
            message="Wajah tidak dikenali",
        )

    return FaceRecognizeResponse(
        matched=True,
        confidence=round(confidence * 100, 1),
        subject=subject,
        face_id=face_id,
        message="Wajah dikenali",
    )
