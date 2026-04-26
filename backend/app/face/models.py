from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, JSON, LargeBinary, String, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db import Base


class FaceClient(Base):
    __tablename__ = "face_clients"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String(64), nullable=False, unique=True, index=True)
    name = Column(String(200), nullable=False)
    api_key_hash = Column(String(64), nullable=False, unique=True, index=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


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
