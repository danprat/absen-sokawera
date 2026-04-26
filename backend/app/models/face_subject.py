from sqlalchemy import Boolean, Column, DateTime, Index, Integer, JSON, String, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db_base import Base


class FaceSubject(Base):
    __tablename__ = "face_subjects"
    __table_args__ = (
        UniqueConstraint("tenant_id", "external_subject_id", name="uq_face_subjects_tenant_external_id"),
        Index("ix_face_subjects_tenant_active", "tenant_id", "is_active"),
    )

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String(64), nullable=False, index=True)
    external_subject_id = Column(String(128), nullable=False, index=True)
    display_name = Column(String(200), nullable=False)
    subject_metadata = Column("metadata", JSON, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    face_templates = relationship("FaceTemplate", back_populates="subject", cascade="all, delete-orphan")
