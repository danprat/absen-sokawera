from datetime import date
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import and_
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.database import get_db
from app.models.attendance import AttendanceLog
from app.models.employee import Employee
from app.schemas.attendance import AttendanceTodayItem, AttendanceTodayResponse
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
