from pydantic import BaseModel
from datetime import datetime


class FaceEmbeddingResponse(BaseModel):
    id: int
    employee_id: int
    photo_url: str
    is_primary: bool
    created_at: datetime

    class Config:
        from_attributes = True


class FaceUploadResponse(BaseModel):
    id: int
    photo_url: str
    message: str
