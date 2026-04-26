from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class FaceSubjectCreate(BaseModel):
    external_subject_id: str
    display_name: str
    metadata: Optional[dict[str, Any]] = None


class FaceSubjectUpdate(BaseModel):
    display_name: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None
    is_active: Optional[bool] = None


class FaceSubjectResponse(BaseModel):
    id: int
    tenant_id: str
    external_subject_id: str
    display_name: str
    metadata: Optional[dict[str, Any]] = Field(
        default=None,
        validation_alias="subject_metadata",
        serialization_alias="metadata",
    )
    is_active: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
        populate_by_name = True


class FaceTemplateResponse(BaseModel):
    id: int
    tenant_id: str
    subject_id: int
    photo_url: str
    is_primary: bool
    model_name: str
    embedding_version: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class FaceTemplateUploadResponse(BaseModel):
    id: int
    subject_id: int
    photo_url: str
    message: str


class FaceCountItem(BaseModel):
    external_subject_id: str
    subject_id: int
    face_count: int


class FaceCountListResponse(BaseModel):
    items: list[FaceCountItem]


class FaceDetectResponse(BaseModel):
    detected: bool


class FaceRecognizeResponse(BaseModel):
    matched: bool
    confidence: float
    subject: Optional[FaceSubjectResponse] = None
    face_id: Optional[int] = None
    message: str
