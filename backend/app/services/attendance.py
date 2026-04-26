from typing import Optional, Tuple
from datetime import datetime, date, time, timedelta
from zoneinfo import ZoneInfo
from sqlalchemy.orm import Session
from sqlalchemy import and_
from app.config import get_settings
from app.models.employee import Employee
from app.models.attendance import AttendanceLog, AttendanceStatus
from app.models.holiday import Holiday
from app.models.work_settings import WorkSettings
from app.models.daily_schedule import DailyWorkSchedule
from app.utils.cache import (
    cache,
    SETTINGS_CACHE_KEY,
    DAILY_SCHEDULE_CACHE_KEY,
    HOLIDAY_CACHE_KEY_PREFIX,
)

settings = get_settings()
JAKARTA_TZ = ZoneInfo("Asia/Jakarta")


def jakarta_now() -> datetime:
    return datetime.now(JAKARTA_TZ).replace(tzinfo=None)


def jakarta_today() -> date:
    return jakarta_now().date()


class AttendanceService:
    def get_work_settings(self, db: Session) -> WorkSettings:
        # Check cache first
        cached = cache.get(SETTINGS_CACHE_KEY)
        if cached:
            return cached

        work_settings = db.query(WorkSettings).first()
        if not work_settings:
            work_settings = WorkSettings()
            db.add(work_settings)
            db.commit()
            db.refresh(work_settings)

        cache.set(SETTINGS_CACHE_KEY, work_settings, ttl_seconds=settings.WORK_SETTINGS_CACHE_TTL_SECONDS)
        return work_settings

    def get_daily_schedule_cache_key(self, day_of_week: int) -> str:
        return f"{DAILY_SCHEDULE_CACHE_KEY}:{day_of_week}"

    def get_holiday_cache_key(self, check_date: date) -> str:
        return f"{HOLIDAY_CACHE_KEY_PREFIX}:{check_date.isoformat()}"

    def is_holiday(self, db: Session, check_date: date) -> bool:
        """Check if the given date is a holiday (excluding holidays marked as is_excluded)."""
        holiday_cache_key = self.get_holiday_cache_key(check_date)
        cached = cache.get(holiday_cache_key)
        if cached is not None:
            return cached

        holiday = db.query(Holiday).filter(
            Holiday.date == check_date,
            Holiday.is_excluded == False
        ).first()
        result = holiday is not None
        cache.set(holiday_cache_key, result, ttl_seconds=settings.HOLIDAY_CACHE_TTL_SECONDS)
        return result

    def is_workday(self, db: Session, check_date: date) -> bool:
        """Check if the given date is a workday based on DailyWorkSchedule."""
        day_of_week = check_date.weekday()  # 0=Monday, 6=Sunday
        schedule = self.get_daily_schedule(db, check_date)

        # If no schedule exists, default to weekday logic (Mon-Fri = workday)
        if not schedule:
            return day_of_week < 5

        return schedule.is_workday

    def get_daily_schedule(self, db: Session, check_date: date) -> Optional[DailyWorkSchedule]:
        """Get the work schedule for a specific date."""
        day_of_week = check_date.weekday()
        cache_key = self.get_daily_schedule_cache_key(day_of_week)
        
        # Check cache first
        cached = cache.get(cache_key)
        if cached is not None:
            return cached if cached != "NONE" else None
        
        schedule = db.query(DailyWorkSchedule).filter(
            DailyWorkSchedule.day_of_week == day_of_week
        ).first()
        
        # Cache result (use "NONE" string to cache None values)
        cache.set(cache_key, schedule if schedule else "NONE", ttl_seconds=settings.DAILY_SCHEDULE_CACHE_TTL_SECONDS)
        return schedule
    
    def get_effective_schedule(self, db: Session, check_date: date) -> dict:
        """Get effective work schedule for a date (daily schedule or fallback to global settings)."""
        daily_schedule = self.get_daily_schedule(db, check_date)

        if daily_schedule:
            return {
                "check_in_start": daily_schedule.check_in_start,
                "check_in_end": daily_schedule.check_in_end,
                "check_out_start": daily_schedule.check_out_start,
            }

        # Fallback to global settings
        settings = self.get_work_settings(db)
        return {
            "check_in_start": settings.check_in_start,
            "check_in_end": settings.check_in_end,
            "check_out_start": settings.check_out_start,
        }

    def get_attendance_mode(self, current_time: time, schedule: dict, has_checked_in: bool = False) -> Optional[str]:
        check_in_start = schedule["check_in_start"]
        check_in_end = schedule["check_in_end"]
        check_out_start = schedule["check_out_start"]
        # Set check_out_end to 23:59:59 (end of day)
        check_out_end = time(23, 59, 59)

        # If already checked in, allow checkout anytime
        if has_checked_in:
            return "CHECK_OUT"

        # For check-in: only during check-in window
        if check_in_start <= current_time < check_in_end:
            return "CHECK_IN"
        # For late check-in: allow until check_out_start (with late status)
        elif check_in_end <= current_time < check_out_start:
            return "CHECK_IN"
        # After check_out_start: only checkout allowed
        elif check_out_start <= current_time <= check_out_end:
            return "CHECK_OUT"
        return None
    
    def get_today_attendance(self, db: Session, employee_id: int) -> Optional[AttendanceLog]:
        today = jakarta_today()
        return db.query(AttendanceLog).filter(
            and_(
                AttendanceLog.employee_id == employee_id,
                AttendanceLog.date == today
            )
        ).first()

    def get_attendance_status(self, attendance: Optional[AttendanceLog]) -> str:
        """Determine attendance status: belum_absen, sudah_check_in, sudah_lengkap."""
        if not attendance or not attendance.check_in_at:
            return "belum_absen"
        elif attendance.check_in_at and not attendance.check_out_at:
            return "sudah_check_in"
        else:  # Both check_in_at and check_out_at exist
            return "sudah_lengkap"
    
    def process_attendance(
        self,
        db: Session,
        employee: Employee,
        confidence_score: float
    ) -> Tuple[Optional[AttendanceLog], str]:
        now = jakarta_now()
        today = now.date()
        current_time = now.time()

        if not self.is_workday(db, today):
            return None, "Hari ini bukan hari kerja"

        if self.is_holiday(db, today):
            return None, "Hari ini adalah hari libur"

        # Use daily schedule instead of global settings
        schedule = self.get_effective_schedule(db, today)
        settings = self.get_work_settings(db)  # Still needed for late_threshold_minutes
        attendance = self.get_today_attendance(db, employee.id)

        # Check if employee has already checked in
        has_checked_in = attendance is not None and attendance.check_in_at is not None

        mode = self.get_attendance_mode(current_time, schedule, has_checked_in)
        if mode is None:
            return None, f"Di luar jam absensi ({schedule['check_in_start'].strftime('%H:%M')}-{time(23, 59).strftime('%H:%M')})"
        
        if mode == "CHECK_IN":
            if attendance and attendance.check_in_at:
                return attendance, f"Sudah absen masuk pukul {attendance.check_in_at.strftime('%H:%M')}"

            late_threshold = datetime.combine(
                today,
                schedule["check_in_end"]
            ) + timedelta(minutes=settings.late_threshold_minutes)
            
            if now <= late_threshold:
                status = AttendanceStatus.HADIR
            else:
                status = AttendanceStatus.TERLAMBAT
            
            if attendance:
                attendance.check_in_at = now
                attendance.status = status
                attendance.confidence_score = confidence_score
            else:
                attendance = AttendanceLog(
                    employee_id=employee.id,
                    date=today,
                    check_in_at=now,
                    status=status,
                    confidence_score=confidence_score
                )
                db.add(attendance)
            
            db.commit()
            db.refresh(attendance)
            
            greeting = f"Selamat datang, {employee.name}"
            if status == AttendanceStatus.TERLAMBAT:
                greeting += " (Terlambat)"
            
            return attendance, greeting
        
        else:
            if not attendance or not attendance.check_in_at:
                return None, "Belum absen masuk hari ini"
            
            if attendance.check_out_at:
                return attendance, f"Sudah absen pulang pukul {attendance.check_out_at.strftime('%H:%M')}"
            
            # Check if 3 minutes have passed since check-in
            time_diff = now - attendance.check_in_at
            if time_diff.total_seconds() < 180:  # 180 seconds = 3 minutes
                minutes_left = 3 - int(time_diff.total_seconds() / 60)
                return None, f"Anda baru saja check-in. Harap tunggu {minutes_left} menit lagi untuk check-out."
            
            attendance.check_out_at = now
            db.commit()
            db.refresh(attendance)
            
            return attendance, f"Sampai jumpa besok, {employee.name}"
    
    def mark_absent_employees(self, db: Session):
        today = jakarta_today()

        if not self.is_workday(db, today) or self.is_holiday(db, today):
            return
        
        employees = db.query(Employee).filter(Employee.is_active == True).all()
        
        for emp in employees:
            attendance = self.get_today_attendance(db, emp.id)
            if not attendance:
                attendance = AttendanceLog(
                    employee_id=emp.id,
                    date=today,
                    status=AttendanceStatus.ALFA
                )
                db.add(attendance)
        
        db.commit()


attendance_service = AttendanceService()
