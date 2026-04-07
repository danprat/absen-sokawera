from typing import Optional, List
from pydantic import BaseModel
from datetime import date, datetime
from app.models.attendance import AttendanceStatus


class AttendanceRecognizeResponse(BaseModel):
    employee: dict
    attendance: Optional[dict]  # Optional: None when just recognizing, filled after confirmation
    message: str
    confidence: float
    attendance_status: Optional[str] = None  # "belum_absen", "sudah_check_in", "sudah_lengkap"


class AttendanceTodayItem(BaseModel):
    id: int
    employee_id: int
    employee_name: str
    employee_position: str
    employee_photo: Optional[str]
    check_in_at: Optional[datetime]
    check_out_at: Optional[datetime]
    status: AttendanceStatus

    class Config:
        from_attributes = True


class AttendanceTodayResponse(BaseModel):
    items: List[AttendanceTodayItem]
    total: int


class AttendanceLogResponse(BaseModel):
    id: int
    employee_id: int
    employee_name: str
    date: date
    check_in_at: Optional[datetime]
    check_out_at: Optional[datetime]
    status: AttendanceStatus
    confidence_score: Optional[float]
    corrected_by: Optional[str]
    correction_notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AttendanceListResponse(BaseModel):
    items: List[AttendanceLogResponse]
    total: int
    page: int
    page_size: int


class AttendanceCorrectionRequest(BaseModel):
    status: Optional[AttendanceStatus] = None
    check_in_at: Optional[datetime] = None
    check_out_at: Optional[datetime] = None
    correction_notes: Optional[str] = None


class AttendanceSummary(BaseModel):
    total_employees: int
    present: int
    late: int
    absent: int
    on_leave: int
    sick: int


class AttendanceTodayAdminResponse(BaseModel):
    items: List[AttendanceTodayItem]
    summary: AttendanceSummary
