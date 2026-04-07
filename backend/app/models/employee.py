from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
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

