import enum
from sqlalchemy import Column, Integer, String, Date, DateTime, Float, Enum, ForeignKey, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db_base import Base


class AttendanceStatus(str, enum.Enum):
    HADIR = "hadir"
    TERLAMBAT = "terlambat"
    IZIN = "izin"
    SAKIT = "sakit"
    ALFA = "alfa"


class AttendanceLog(Base):
    __tablename__ = "attendance_logs"
    __table_args__ = (
        Index("ix_attendance_logs_tenant_date", "tenant_id", "date"),
        Index("ix_attendance_logs_tenant_employee_date", "tenant_id", "employee_id", "date"),
    )

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String(64), nullable=False, server_default="default", index=True)
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
