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

router = APIRouter(prefix="/employees", tags=["Face Enrollment"])

UPLOAD_DIR = "uploads/faces"


@router.post("/{employee_id}/face", response_model=FaceUploadResponse)
async def upload_face(
    employee_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
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
    
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    
    ext = file.filename.split(".")[-1] if file.filename else "jpg"
    filename = f"{uuid.uuid4()}.{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    
    with open(filepath, "wb") as f:
        f.write(image_data)
    
    # Use CNN model and num_jitters=5 for registration (more accurate embeddings)
    embedding = face_recognition_service.generate_embedding(
        image_data, 
        use_cnn=True,      # Better face detection for registration
        num_jitters=5      # More stable embeddings
    )
    
    existing_count = db.query(FaceEmbedding).filter(
        FaceEmbedding.employee_id == employee_id
    ).count()
    
    face_embedding = FaceEmbedding(
        employee_id=employee_id,
        embedding=embedding,
        photo_url=f"/uploads/faces/{filename}",
        is_primary=existing_count == 0
    )
    db.add(face_embedding)
    db.commit()
    db.refresh(face_embedding)
    
    # Invalidate cache after adding new face
    face_recognition_service.invalidate_cache()
    
    return FaceUploadResponse(
        id=face_embedding.id,
        photo_url=face_embedding.photo_url,
        message="Foto wajah berhasil disimpan"
    )


@router.get("/{employee_id}/face", response_model=list[FaceEmbeddingResponse])
def list_faces(
    employee_id: int,
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
    
    # Invalidate cache after deleting face
    face_recognition_service.invalidate_cache()
