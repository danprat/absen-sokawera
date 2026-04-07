import enum
from sqlalchemy import Column, Integer, String, Date, DateTime, Float, Enum, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class AttendanceStatus(str, enum.Enum):
    HADIR = "hadir"
    TERLAMBAT = "terlambat"
    IZIN = "izin"
    SAKIT = "sakit"
    ALFA = "alfa"


class AttendanceLog(Base):
    __tablename__ = "attendance_logs"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    check_in_at = Column(DateTime, nullable=True)
    check_out_at = Column(DateTime, nullable=True)
    status = Column(Enum(AttendanceStatus), nullable=False, default=AttendanceStatus.HADIR)
    confidence_score = Column(Float, nullable=True)
    corrected_by = Column(String(100), nullable=True)
    correction_notes = Column(String(500), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    employee = relationship("Employee", back_populates="attendance_logs")
