from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, LargeBinary, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db_base import Base


class FaceTemplate(Base):
    __tablename__ = "face_templates"
    __table_args__ = (
        Index("ix_face_templates_tenant_subject", "tenant_id", "subject_id"),
        Index("ix_face_templates_embedding_version", "embedding_version", "model_name"),
    )

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String(64), nullable=False, index=True)
    subject_id = Column(Integer, ForeignKey("face_subjects.id"), nullable=False, index=True)
    embedding = Column(LargeBinary, nullable=False)
    photo_url = Column(String(500), nullable=False)
    model_name = Column(String(100), nullable=False, server_default="face_recognition")
    embedding_version = Column(String(32), nullable=False, server_default="v1")
    is_primary = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    subject = relationship("FaceSubject", back_populates="face_templates")
