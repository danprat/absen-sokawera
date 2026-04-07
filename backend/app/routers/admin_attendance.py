from typing import Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_
from app.database import get_db
from app.models.admin import Admin
from app.models.employee import Employee
from app.models.attendance import AttendanceLog, AttendanceStatus
from app.models.audit_log import AuditAction, EntityType
from app.schemas.attendance import (
    AttendanceLogResponse, AttendanceListResponse,
    AttendanceCorrectionRequest, AttendanceTodayItem,
    AttendanceSummary, AttendanceTodayAdminResponse
)
from app.utils.auth import get_current_admin, require_admin_role
from app.utils.audit import log_audit

router = APIRouter(prefix="/admin/attendance", tags=["Attendance - Admin"])


@router.get("", response_model=AttendanceListResponse)
def list_attendance(
    employee_id: Optional[int] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    status_filter: Optional[AttendanceStatus] = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin)
):
    query = db.query(AttendanceLog).options(
        joinedload(AttendanceLog.employee)
    ).join(Employee)
    
    if employee_id:
        query = query.filter(AttendanceLog.employee_id == employee_id)
    
    if start_date:
        query = query.filter(AttendanceLog.date >= start_date)
    
    if end_date:
        query = query.filter(AttendanceLog.date <= end_date)
    
    if status_filter:
        query = query.filter(AttendanceLog.status == status_filter)
    
    total = query.count()
    items = query.order_by(
        AttendanceLog.date.desc(),
        AttendanceLog.check_in_at.desc()
    ).offset((page - 1) * page_size).limit(page_size).all()
    
    result_items = []
    for att in items:
        result_items.append(AttendanceLogResponse(
            id=att.id,
            employee_id=att.employee_id,
            employee_name=att.employee.name,
            date=att.date,
            check_in_at=att.check_in_at,
            check_out_at=att.check_out_at,
            status=att.status,
            confidence_score=att.confidence_score,
            corrected_by=att.corrected_by,
            correction_notes=att.correction_notes,
            created_at=att.created_at,
            updated_at=att.updated_at
        ))
    
    return AttendanceListResponse(
        items=result_items,
        total=total,
        page=page,
        page_size=page_size
    )


@router.patch("/{attendance_id}", response_model=AttendanceLogResponse)
def correct_attendance(
    attendance_id: int,
    data: AttendanceCorrectionRequest,
    db: Session = Depends(get_db),
    admin: Admin = Depends(require_admin_role)
):
    attendance = db.query(AttendanceLog).filter(AttendanceLog.id == attendance_id).first()
    if not attendance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Data absensi tidak ditemukan"
        )
    
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(attendance, field, value)
    
    attendance.corrected_by = admin.name
    
    db.commit()
    db.refresh(attendance)
    
    log_audit(
        db=db,
        action=AuditAction.CORRECT,
        entity_type=EntityType.ATTENDANCE,
        entity_id=attendance.id,
        description=f"Koreksi absensi {attendance.employee.name} tanggal {attendance.date}",
        performed_by=admin.name,
        details=update_data
    )
    
    return AttendanceLogResponse(
        id=attendance.id,
        employee_id=attendance.employee_id,
        employee_name=attendance.employee.name,
        date=attendance.date,
        check_in_at=attendance.check_in_at,
        check_out_at=attendance.check_out_at,
        status=attendance.status,
        confidence_score=attendance.confidence_score,
        corrected_by=attendance.corrected_by,
        correction_notes=attendance.correction_notes,
        created_at=attendance.created_at,
        updated_at=attendance.updated_at
    )


@router.get("/today", response_model=AttendanceTodayAdminResponse)
def get_today_attendance_admin(
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin)
):
    today = date.today()
    
    total_employees = db.query(Employee).filter(Employee.is_active == True).count()
    
    attendances = db.query(AttendanceLog).options(
        joinedload(AttendanceLog.employee)
    ).join(Employee).filter(
        and_(
            AttendanceLog.date == today,
            Employee.is_active == True
        )
    ).all()
    
    present = sum(1 for a in attendances if a.status == AttendanceStatus.HADIR)
    late = sum(1 for a in attendances if a.status == AttendanceStatus.TERLAMBAT)
    absent = sum(1 for a in attendances if a.status == AttendanceStatus.ALFA)
    on_leave = sum(1 for a in attendances if a.status == AttendanceStatus.IZIN)
    sick = sum(1 for a in attendances if a.status == AttendanceStatus.SAKIT)
    
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
    
    return AttendanceTodayAdminResponse(
        items=items,
        summary=AttendanceSummary(
            total_employees=total_employees,
            present=present,
            late=late,
            absent=absent,
            on_leave=on_leave,
            sick=sick
        )
    )
