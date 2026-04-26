import base64
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.face.models import FaceSubject
from app.face.models import FaceTemplate
from app.face.schemas import (
    FaceDetectResponse,
    FaceRecognizeResponse,
    FaceSubjectCreate,
    FaceSubjectResponse,
    FaceSubjectUpdate,
    FaceTemplateResponse,
    FaceTemplateUploadResponse,
)
from app.face.recognition import face_recognition_service
from app.face.storage import (
    SupabaseStorageError,
    SupabaseStorageNotConfigured,
    delete_object_reference,
    display_url_for_reference,
    guess_content_type,
    upload_object,
)
from app.face.auth import FaceClientContext, get_current_face_client


router = APIRouter(prefix="", tags=["Face Core"])


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


def _safe_path_part(value: str, fallback: str = "default") -> str:
    return "".join(ch for ch in value if ch.isalnum() or ch in ("-", "_")) or fallback


def build_face_object_path(tenant_id: str, subject_id: int, filename: Optional[str]) -> str:
    ext = filename.split(".")[-1].lower() if filename and "." in filename else "jpg"
    if not ext.isalnum():
        ext = "jpg"
    safe_tenant = _safe_path_part(tenant_id)
    return f"{safe_tenant}/subjects/{subject_id}/faces/{uuid.uuid4()}.{ext}"


async def save_template_photo(
    image_data: bytes,
    tenant_id: str,
    subject_id: int,
    filename: Optional[str],
    content_type: Optional[str],
):
    settings = get_settings()
    object_path = build_face_object_path(tenant_id, subject_id, filename)
    return await upload_object(
        settings.SUPABASE_STORAGE_FACE_BUCKET,
        object_path,
        image_data,
        content_type or guess_content_type(filename),
    )


async def template_response(template: FaceTemplate) -> FaceTemplateResponse:
    return FaceTemplateResponse.model_validate(template).model_copy(
        update={"photo_url": await display_url_for_reference(template.photo_url)}
    )


def storage_http_error(operation: str, error: SupabaseStorageError) -> HTTPException:
    if isinstance(error, SupabaseStorageNotConfigured):
        return HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase Storage belum dikonfigurasi untuk face service",
        )
    return HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail=f"Gagal {operation} foto wajah di Supabase Storage",
    )


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
    try:
        stored_photo = await save_template_photo(
            image_data,
            client.tenant_id,
            subject.id,
            file.filename,
            file.content_type,
        )
    except SupabaseStorageError as error:
        raise storage_http_error("menyimpan", error)

    template = FaceTemplate(
        tenant_id=client.tenant_id,
        subject_id=subject.id,
        embedding=embedding,
        photo_url=stored_photo.reference,
        is_primary=existing_count == 0,
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    face_recognition_service.invalidate_template_cache(client.tenant_id)
    return FaceTemplateUploadResponse(
        id=template.id,
        subject_id=subject.id,
        photo_url=stored_photo.signed_url,
        message="Foto wajah berhasil disimpan",
    )


@router.get("/subjects/{subject_id}/faces", response_model=list[FaceTemplateResponse])
async def list_subject_faces(
    subject_id: int,
    db: Session = Depends(get_db),
    client: FaceClientContext = Depends(get_current_face_client),
):
    subject = get_subject_or_404(db, subject_id, client.tenant_id)
    templates = db.query(FaceTemplate).filter(
        FaceTemplate.tenant_id == client.tenant_id,
        FaceTemplate.subject_id == subject.id,
    ).order_by(FaceTemplate.created_at.desc()).all()
    try:
        return [await template_response(template) for template in templates]
    except SupabaseStorageError as error:
        raise storage_http_error("membaca", error)


@router.delete("/faces/{face_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_face_template(
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
    try:
        await delete_object_reference(template.photo_url)
    except SupabaseStorageError as error:
        raise storage_http_error("menghapus", error)
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
