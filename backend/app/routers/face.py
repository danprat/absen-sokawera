import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.admin import Admin
from app.models.employee import Employee
from app.models.face_embedding import FaceEmbedding
from app.schemas.face import FaceEmbeddingResponse, FaceUploadResponse
from app.utils.auth import get_current_admin, require_admin_role
from app.services.face_recognition import face_recognition_service
from app.config import get_settings
from app.utils.face_service_auth import require_face_service_key

router = APIRouter(prefix="/employees", tags=["Face Enrollment"])
settings = get_settings()

UPLOAD_DIR = "uploads/faces"


def refresh_face_embedding_cache(service, db: Session) -> None:
    service.invalidate_cache()
    if service.enabled:
        service.refresh_embedding_cache(db)


@router.post("/{employee_id}/face", response_model=FaceUploadResponse)
async def upload_face(
    employee_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: None = Depends(require_face_service_key),
    admin: Admin = Depends(require_admin_role)
):
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pegawai tidak ditemukan"
        )
    
    if not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File harus berupa gambar"
        )
    
    image_data = await file.read()
    
    if not face_recognition_service.detect_face(image_data):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Wajah tidak terdeteksi dalam gambar"
        )
    
    # Use HOG for enrollment on small CPU VPS deployments. CNN enrollment is too
    # heavy for the hosted face service and can fail before an embedding is made.
    embedding = face_recognition_service.generate_embedding(
        image_data,
        use_cnn=False,
        num_jitters=1,
    )

    if embedding is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Embedding wajah gagal dibuat. Coba gunakan foto wajah yang lebih jelas."
        )

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    
    ext = file.filename.split(".")[-1] if file.filename else "jpg"
    filename = f"{uuid.uuid4()}.{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    
    with open(filepath, "wb") as f:
        f.write(image_data)
    
    existing_count = db.query(FaceEmbedding).filter(
        FaceEmbedding.employee_id == employee_id
    ).count()
    
    face_embedding = FaceEmbedding(
        tenant_id=employee.tenant_id or settings.DEFAULT_TENANT_ID,
        employee_id=employee_id,
        embedding=embedding,
        photo_url=f"/uploads/faces/{filename}",
        is_primary=existing_count == 0
    )
    db.add(face_embedding)
    db.commit()
    db.refresh(face_embedding)
    
    refresh_face_embedding_cache(face_recognition_service, db)
    
    return FaceUploadResponse(
        id=face_embedding.id,
        photo_url=face_embedding.photo_url,
        message="Foto wajah berhasil disimpan"
    )


@router.get("/{employee_id}/face", response_model=list[FaceEmbeddingResponse])
def list_faces(
    employee_id: int,
    _: None = Depends(require_face_service_key),
    db: Session = Depends(get_db)
):
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pegawai tidak ditemukan"
        )
    
    return db.query(FaceEmbedding).filter(
        FaceEmbedding.employee_id == employee_id
    ).order_by(FaceEmbedding.created_at.desc()).all()


@router.delete("/{employee_id}/face/{face_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_face(
    employee_id: int,
    face_id: int,
    db: Session = Depends(get_db),
    _: None = Depends(require_face_service_key),
    admin: Admin = Depends(require_admin_role)
):
    face = db.query(FaceEmbedding).filter(
        FaceEmbedding.id == face_id,
        FaceEmbedding.employee_id == employee_id
    ).first()
    
    if not face:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Foto tidak ditemukan"
        )
    
    if face.photo_url and os.path.exists(face.photo_url.lstrip("/")):
        os.remove(face.photo_url.lstrip("/"))
    
    db.delete(face)
    db.commit()
    
    refresh_face_embedding_cache(face_recognition_service, db)
