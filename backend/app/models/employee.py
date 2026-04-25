from sqlalchemy import Column, Integer, String, Boolean, DateTime, Index, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db_base import Base


class Employee(Base):
    __tablename__ = "employees"
    __table_args__ = (
        UniqueConstraint("tenant_id", "external_employee_id", name="uq_employees_tenant_external_id"),
        Index("ix_employees_tenant_active", "tenant_id", "is_active"),
    )

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String(64), nullable=False, server_default="default", index=True)
    external_employee_id = Column(String(128), nullable=True, index=True)
    nik = Column(String(20), unique=True, nullable=True, index=True)  # NIK (16 digit)
    name = Column(String(100), nullable=False)
    position = Column(String(100), nullable=False)
    phone = Column(String(20), nullable=True)
    address = Column(String(500), nullable=True)  # Alamat rumah
    photo_url = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    face_embeddings = relationship("FaceEmbedding", back_populates="employee", cascade="all, delete-orphan")
    attendance_logs = relationship("AttendanceLog", back_populates="employee")

    @property
    def face_count(self):
        return len(self.face_embeddings)
