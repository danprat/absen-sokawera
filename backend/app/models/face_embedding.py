from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, LargeBinary, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db_base import Base


class FaceEmbedding(Base):
    __tablename__ = "face_embeddings"
    __table_args__ = (
        Index("ix_face_embeddings_tenant_employee", "tenant_id", "employee_id"),
        Index("ix_face_embeddings_embedding_version", "embedding_version", "model_name"),
    )

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String(64), nullable=False, server_default="default", index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False, index=True)
    embedding = Column(LargeBinary, nullable=False)  # 128 float vector as bytes during bridge mode
    photo_url = Column(String(500), nullable=False)
    is_primary = Column(Boolean, default=False, nullable=False)
    embedding_version = Column(String(32), nullable=False, server_default="v1")
    model_name = Column(String(100), nullable=False, server_default="face_recognition")
    created_at = Column(DateTime, server_default=func.now())

    employee = relationship("Employee", back_populates="face_embeddings")
