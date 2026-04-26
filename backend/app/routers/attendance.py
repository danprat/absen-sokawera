import base64
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Request
from sqlalchemy.orm import Session
from sqlalchemy import and_
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.database import get_db
from app.models.attendance import AttendanceLog
from app.models.employee import Employee
from app.schemas.attendance import AttendanceRecognizeResponse, AttendanceTodayItem, AttendanceTodayResponse
from app.services.face_recognition import face_recognition_service
from app.services.attendance import attendance_service
from app.utils.face_service_auth import require_face_service_key
from app.utils.cache import (
    cache,
    SETTINGS_CACHE_KEY,
    DAILY_SCHEDULE_CACHE_KEY,
    HOLIDAY_CACHE_KEY_PREFIX,
)

router = APIRouter(prefix="/attendance", tags=["Attendance - Tablet"])
limiter = Limiter(key_func=get_remote_address)


def invalidate_attendance_related_caches() -> None:
    cache.invalidate(SETTINGS_CACHE_KEY)
    cache.invalidate_prefix(f"{DAILY_SCHEDULE_CACHE_KEY}:")
    cache.invalidate_prefix(f"{HOLIDAY_CACHE_KEY_PREFIX}:")


@router.post("/cache/invalidate")
def invalidate_attendance_cache(
    _: None = Depends(require_face_service_key),
):
    """Internal hook for Edge Functions after settings/schedule/holiday changes."""
    invalidate_attendance_related_caches()
    return {"message": "Cache absensi berhasil dihapus"}


@router.post("/recognize", response_model=AttendanceRecognizeResponse)
@limiter.limit("2/second")
async def recognize_face_only(
    request: Request,
    file: UploadFile = File(None),
    image_base64: str = Form(None),
    _: None = Depends(require_face_service_key),
    db: Session = Depends(get_db)
):
    """Recognize face WITHOUT saving attendance - requires user confirmation"""
    if file:
        image_data = await file.read()
    elif image_base64:
        try:
            if "," in image_base64:
                image_base64 = image_base64.split(",")[1]
            image_data = base64.b64decode(image_base64)
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Format base64 tidak valid"
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Gambar diperlukan (file atau base64)"
        )

    # Get face recognition threshold from settings
    settings = attendance_service.get_work_settings(db)
    threshold = getattr(settings, 'face_similarity_threshold', 0.5)
    
    # find_matching_employee already detects face internally, skip redundant detect_face call
    employee, confidence = face_recognition_service.find_matching_employee(
        image_data, db, threshold=threshold
    )

    if not employee:
        # Check if it's because no face was detected or no match
        if not face_recognition_service.enabled:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Wajah tidak dikenali"
            )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Wajah tidak terdeteksi atau tidak dikenali"
        )

    # Check current attendance status
    existing_attendance = attendance_service.get_today_attendance(db, employee.id)
    attendance_status = attendance_service.get_attendance_status(existing_attendance)

    # Face service is intentionally domain-agnostic. Workday, holiday, and
    # attendance mode checks belong to the calling application.
    return AttendanceRecognizeResponse(
        employee={
            "id": employee.id,
            "name": employee.name,
            "position": employee.position,
            "photo": employee.photo_url
        },
        attendance=None,  # No attendance saved yet
        message="Wajah dikenali",
        confidence=round(confidence * 100, 1),
        attendance_status=attendance_status
    )


@router.post("/confirm")
def confirm_attendance(
    employee_id: int = Form(...),
    confidence: float = Form(...),
    _: None = Depends(require_face_service_key),
    db: Session = Depends(get_db)
):
    """Confirm and save attendance after user clicks 'Hadir' or 'Pulang' button"""
    employee = db.query(Employee).filter(Employee.id == employee_id).first()

    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee tidak ditemukan"
        )

    attendance, message = attendance_service.process_attendance(db, employee, confidence / 100)

    if not attendance:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=message
        )

    # Get updated attendance status after processing
    attendance_status = attendance_service.get_attendance_status(attendance)

    return AttendanceRecognizeResponse(
        employee={
            "id": employee.id,
            "name": employee.name,
            "position": employee.position,
            "photo": employee.photo_url
        },
        attendance={
            "id": attendance.id,
            "status": attendance.status.value,
            "check_in_at": attendance.check_in_at.isoformat() if attendance.check_in_at else None,
            "check_out_at": attendance.check_out_at.isoformat() if attendance.check_out_at else None
        },
        message=message,
        confidence=round(confidence, 1),
        attendance_status=attendance_status
    )


@router.get("/today", response_model=AttendanceTodayResponse)
def get_today_attendance(db: Session = Depends(get_db)):
    today = date.today()
    
    attendances = db.query(AttendanceLog).join(Employee).filter(
        and_(
            AttendanceLog.date == today,
            Employee.is_active == True
        )
    ).order_by(AttendanceLog.check_in_at.desc()).all()
    
    items = []
    for att in attendances:
        items.append(AttendanceTodayItem(
            id=att.id,
            employee_id=att.employee_id,
            employee_name=att.employee.name,
            employee_position=att.employee.position,
            employee_photo=att.employee.photo_url,
            check_in_at=att.check_in_at,
            check_out_at=att.check_out_at,
            status=att.status
        ))
    
    return AttendanceTodayResponse(items=items, total=len(items))
