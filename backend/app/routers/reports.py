import csv
import io
from datetime import date
from calendar import monthrange
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse, Response
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from app.database import get_db
from app.models.admin import Admin
from app.models.employee import Employee
from app.models.attendance import AttendanceLog, AttendanceStatus
from app.schemas.report import MonthlyReportItem, MonthlyReportResponse
from app.utils.auth import get_current_admin
from app.utils.export_utils import generate_pdf, generate_excel, generate_csv

router = APIRouter(prefix="/admin/reports", tags=["Reports"])


@router.get("/monthly", response_model=MonthlyReportResponse)
def get_monthly_report(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2020, le=2100),
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin)
):
    start_date = date(year, month, 1)
    _, last_day = monthrange(year, month)
    end_date = date(year, month, last_day)
    
    employees = db.query(Employee).filter(Employee.is_active == True).all()
    
    items = []
    for emp in employees:
        attendances = db.query(AttendanceLog).filter(
            and_(
                AttendanceLog.employee_id == emp.id,
                AttendanceLog.date >= start_date,
                AttendanceLog.date <= end_date
            )
        ).all()
        
        present = sum(1 for a in attendances if a.status == AttendanceStatus.HADIR)
        late = sum(1 for a in attendances if a.status == AttendanceStatus.TERLAMBAT)
        absent = sum(1 for a in attendances if a.status == AttendanceStatus.ALFA)
        leave = sum(1 for a in attendances if a.status == AttendanceStatus.IZIN)
        sick = sum(1 for a in attendances if a.status == AttendanceStatus.SAKIT)
        checkout = sum(1 for a in attendances if a.check_out_at is not None)

        total_days = len(attendances)
        attendance_pct = ((present + late) / total_days * 100) if total_days > 0 else 0

        items.append(MonthlyReportItem(
            employee_id=emp.id,
            employee_name=emp.name,
            employee_nik=emp.nik,
            employee_position=emp.position,
            total_days=total_days,
            present_days=present,
            late_days=late,
            absent_days=absent,
            leave_days=leave,
            sick_days=sick,
            checkout_days=checkout,
            attendance_percentage=round(attendance_pct, 2)
        ))
    
    return MonthlyReportResponse(
        month=month,
        year=year,
        items=items,
        total_employees=len(employees)
    )


@router.get("/export")
def export_attendance(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2020, le=2100),
    format: str = Query("csv", pattern="^(csv|pdf|xlsx)$"),
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin)
):
    start_date = date(year, month, 1)
    _, last_day = monthrange(year, month)
    end_date = date(year, month, last_day)

    employees = db.query(Employee).filter(Employee.is_active == True).all()

    # Indonesian month names
    month_names = {
        1: "Januari", 2: "Februari", 3: "Maret", 4: "April",
        5: "Mei", 6: "Juni", 7: "Juli", 8: "Agustus",
        9: "September", 10: "Oktober", 11: "November", 12: "Desember"
    }

    # Headers
    headers = ["NIP", "Nama", "Jabatan", "Hadir", "Terlambat", "Alfa", "Izin", "Sakit", "Checkout", "Total Hari", "Persentase"]

    # Prepare data as list of lists
    data = []
    for emp in employees:
        attendances = db.query(AttendanceLog).filter(
            and_(
                AttendanceLog.employee_id == emp.id,
                AttendanceLog.date >= start_date,
                AttendanceLog.date <= end_date
            )
        ).all()

        present = sum(1 for a in attendances if a.status == AttendanceStatus.HADIR)
        late = sum(1 for a in attendances if a.status == AttendanceStatus.TERLAMBAT)
        absent = sum(1 for a in attendances if a.status == AttendanceStatus.ALFA)
        leave = sum(1 for a in attendances if a.status == AttendanceStatus.IZIN)
        sick = sum(1 for a in attendances if a.status == AttendanceStatus.SAKIT)
        checkout = sum(1 for a in attendances if a.check_out_at is not None)

        total_days = len(attendances)
        attendance_pct = ((present + late) / total_days * 100) if total_days > 0 else 0

        data.append([
            emp.nip or "-",
            emp.name,
            emp.position,
            present,
            late,
            absent,
            leave,
            sick,
            checkout,
            total_days,
            f"{attendance_pct:.2f}%"
        ])

    # Title and subtitle
    title = "REKAP ABSENSI PEGAWAI"
    subtitle = f"Periode: {month_names[month]} {year}"

    # Generate file based on format
    if format == "csv":
        csv_content = generate_csv(headers, data)
        return StreamingResponse(
            iter([csv_content]),
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=rekap_absensi_{year}_{month:02d}.csv"
            }
        )
    elif format == "pdf":
        pdf_bytes = generate_pdf(title, subtitle, headers, data, logo_path=None, orientation="landscape")
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=rekap_absensi_{year}_{month:02d}.pdf"
            }
        )
    elif format == "xlsx":
        excel_bytes = generate_excel(title, subtitle, headers, data, sheet_name="Rekap Absensi")
        return Response(
            content=excel_bytes,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f"attachment; filename=rekap_absensi_{year}_{month:02d}.xlsx"
            }
        )
