from typing import Optional, List
from datetime import time, datetime
import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.admin import Admin
from app.models.work_settings import WorkSettings
from app.models.holiday import Holiday
from app.models.daily_schedule import DailyWorkSchedule, DEFAULT_SCHEDULES
from app.models.audit_log import AuditAction, EntityType
from app.schemas.settings import (
    WorkSettingsResponse,
    WorkSettingsUpdate,
    DailyScheduleResponse,
    DailyScheduleBatchUpdate
)
from app.schemas.holiday import HolidayCreate, HolidayResponse, HolidayListResponse, HolidaySyncResponse
from app.utils.auth import get_current_admin, require_admin_role
from app.utils.audit import log_audit
from app.services.holiday_service import sync_holidays_from_api
from app.utils.cache import (
    cache,
    DAILY_SCHEDULE_CACHE_KEY,
    PUBLIC_SETTINGS_CACHE_KEY,
    SETTINGS_CACHE_KEY,
)

router = APIRouter(prefix="/admin/settings", tags=["Settings"])


def invalidate_settings_related_caches() -> None:
    cache.invalidate(SETTINGS_CACHE_KEY)
    cache.invalidate_prefix(f"{PUBLIC_SETTINGS_CACHE_KEY}:")


def invalidate_schedule_related_caches() -> None:
    cache.invalidate_prefix(f"{DAILY_SCHEDULE_CACHE_KEY}:")
    cache.invalidate_prefix(f"{PUBLIC_SETTINGS_CACHE_KEY}:")


@router.get("", response_model=WorkSettingsResponse)
def get_settings(
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin)
):
    # Check cache first
    cached = cache.get(SETTINGS_CACHE_KEY)
    if cached:
        return cached
    
    settings = db.query(WorkSettings).first()
    if not settings:
        settings = WorkSettings()
        db.add(settings)
        db.commit()
        db.refresh(settings)
    
    # Cache for 60 seconds
    cache.set(SETTINGS_CACHE_KEY, settings, ttl_seconds=60)
    return settings


@router.patch("", response_model=WorkSettingsResponse)
def update_settings(
    data: WorkSettingsUpdate,
    db: Session = Depends(get_db),
    admin: Admin = Depends(require_admin_role)
):
    settings = db.query(WorkSettings).first()
    if not settings:
        settings = WorkSettings()
        db.add(settings)

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(settings, field, value)

    db.commit()
    db.refresh(settings)

    # Convert time objects to strings for JSON serialization in audit log
    audit_details = {}
    for key, value in update_data.items():
        if isinstance(value, time):
            audit_details[key] = value.strftime("%H:%M:%S")
        else:
            audit_details[key] = value

    log_audit(
        db=db,
        action=AuditAction.UPDATE,
        entity_type=EntityType.SETTINGS,
        entity_id=settings.id,
        description="Mengupdate pengaturan kantor",
        performed_by=admin.name,
        details=audit_details
    )

    invalidate_settings_related_caches()

    return settings


@router.post("/logo", response_model=dict)
async def upload_logo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: Admin = Depends(require_admin_role)
):
    """Upload village logo"""
    # Validate file type
    allowed_types = ["image/jpeg", "image/jpg", "image/png", "image/gif"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File harus berupa gambar (jpg, png, atau gif)"
        )

    # Read file data
    image_data = await file.read()

    # Create uploads/logos directory if not exists
    upload_dir = "uploads/logos"
    os.makedirs(upload_dir, exist_ok=True)

    # Generate unique filename
    ext = file.filename.split(".")[-1] if file.filename else "jpg"
    filename = f"{uuid.uuid4()}.{ext}"
    filepath = os.path.join(upload_dir, filename)

    # Get current settings to delete old logo if exists
    settings = db.query(WorkSettings).first()
    if not settings:
        settings = WorkSettings()
        db.add(settings)

    # Delete old logo file if exists
    if settings.logo_url:
        old_filepath = settings.logo_url.lstrip("/")
        if os.path.exists(old_filepath):
            try:
                os.remove(old_filepath)
            except Exception:
                pass  # Continue even if deletion fails

    # Save new file
    with open(filepath, "wb") as f:
        f.write(image_data)

    # Update logo_url in database
    logo_url = f"/uploads/logos/{filename}"
    settings.logo_url = logo_url
    db.commit()
    invalidate_settings_related_caches()
    db.refresh(settings)

    # Log audit
    log_audit(
        db=db,
        action=AuditAction.UPDATE,
        entity_type=EntityType.SETTINGS,
        entity_id=settings.id,
        description="Mengupload logo desa",
        performed_by=admin.name,
        details={"logo_url": logo_url}
    )

    return {
        "message": "Logo berhasil diupload",
        "logo_url": logo_url
    }


@router.delete("/logo", status_code=status.HTTP_200_OK)
def delete_logo(
    db: Session = Depends(get_db),
    admin: Admin = Depends(require_admin_role)
):
    """Delete village logo"""
    settings = db.query(WorkSettings).first()
    if not settings or not settings.logo_url:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Logo tidak ditemukan"
        )

    # Delete file from disk
    filepath = settings.logo_url.lstrip("/")
    if os.path.exists(filepath):
        try:
            os.remove(filepath)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Gagal menghapus file logo: {str(e)}"
            )

    # Set logo_url to null
    old_logo_url = settings.logo_url
    settings.logo_url = None
    db.commit()
    invalidate_settings_related_caches()

    # Log audit
    log_audit(
        db=db,
        action=AuditAction.DELETE,
        entity_type=EntityType.SETTINGS,
        entity_id=settings.id,
        description="Menghapus logo desa",
        performed_by=admin.name,
        details={"old_logo_url": old_logo_url}
    )

    return {"message": "Logo berhasil dihapus"}


@router.post("/background", response_model=dict)
async def upload_background(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: Admin = Depends(require_admin_role)
):
    """Upload background image for landing pages"""
    # Validate file type
    allowed_types = ["image/jpeg", "image/jpg", "image/png"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File harus berupa gambar (jpg atau png)"
        )

    # Read file data
    image_data = await file.read()

    # Check file size (max 5MB)
    if len(image_data) > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ukuran file maksimal 5MB"
        )

    # Create uploads/backgrounds directory if not exists
    upload_dir = "uploads/backgrounds"
    os.makedirs(upload_dir, exist_ok=True)

    # Generate unique filename
    ext = file.filename.split(".")[-1] if file.filename else "jpg"
    filename = f"{uuid.uuid4()}.{ext}"
    filepath = os.path.join(upload_dir, filename)

    # Get current settings to delete old background if exists
    settings = db.query(WorkSettings).first()
    if not settings:
        settings = WorkSettings()
        db.add(settings)

    # Delete old background file if exists
    if settings.background_url:
        old_filepath = settings.background_url.lstrip("/")
        if os.path.exists(old_filepath):
            try:
                os.remove(old_filepath)
            except Exception:
                pass  # Continue even if deletion fails

    # Save new file
    with open(filepath, "wb") as f:
        f.write(image_data)

    # Update background_url in database
    background_url = f"/uploads/backgrounds/{filename}"
    settings.background_url = background_url
    db.commit()
    invalidate_settings_related_caches()
    db.refresh(settings)

    # Log audit
    log_audit(
        db=db,
        action=AuditAction.UPDATE,
        entity_type=EntityType.SETTINGS,
        entity_id=settings.id,
        description="Mengupload background halaman utama",
        performed_by=admin.name,
        details={"background_url": background_url}
    )

    return {
        "message": "Background berhasil diupload",
        "background_url": background_url
    }


@router.delete("/background", status_code=status.HTTP_200_OK)
def delete_background(
    db: Session = Depends(get_db),
    admin: Admin = Depends(require_admin_role)
):
    """Delete background image"""
    settings = db.query(WorkSettings).first()
    if not settings or not settings.background_url:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Background tidak ditemukan"
        )

    # Delete file from disk
    filepath = settings.background_url.lstrip("/")
    if os.path.exists(filepath):
        try:
            os.remove(filepath)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Gagal menghapus file background: {str(e)}"
            )

    # Set background_url to null
    old_background_url = settings.background_url
    settings.background_url = None
    db.commit()
    invalidate_settings_related_caches()

    # Log audit
    log_audit(
        db=db,
        action=AuditAction.DELETE,
        entity_type=EntityType.SETTINGS,
        entity_id=settings.id,
        description="Menghapus background halaman utama",
        performed_by=admin.name,
        details={"old_background_url": old_background_url}
    )

    return {"message": "Background berhasil dihapus"}


@router.get("/holidays", response_model=HolidayListResponse)
def list_holidays(
    year: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin)
):
    query = db.query(Holiday).filter(Holiday.is_excluded == False)
    
    if year:
        from sqlalchemy import extract
        query = query.filter(extract('year', Holiday.date) == year)
    
    holidays = query.order_by(Holiday.date).all()
    
    return HolidayListResponse(items=holidays, total=len(holidays))


@router.post("/holidays", response_model=HolidayResponse, status_code=status.HTTP_201_CREATED)
def create_holiday(
    data: HolidayCreate,
    db: Session = Depends(get_db),
    admin: Admin = Depends(require_admin_role)
):
    existing = db.query(Holiday).filter(Holiday.date == data.date).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tanggal ini sudah terdaftar sebagai hari libur"
        )
    
    holiday = Holiday(**data.model_dump())
    db.add(holiday)
    db.commit()
    db.refresh(holiday)
    
    log_audit(
        db=db,
        action=AuditAction.CREATE,
        entity_type=EntityType.HOLIDAY,
        entity_id=holiday.id,
        description=f"Menambahkan hari libur: {holiday.name} ({holiday.date})",
        performed_by=admin.name
    )
    
    return holiday


@router.delete("/holidays/{holiday_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_holiday(
    holiday_id: int,
    db: Session = Depends(get_db),
    admin: Admin = Depends(require_admin_role)
):
    holiday = db.query(Holiday).filter(Holiday.id == holiday_id).first()
    if not holiday:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Hari libur tidak ditemukan"
        )
    
    log_audit(
        db=db,
        action=AuditAction.DELETE,
        entity_type=EntityType.HOLIDAY,
        entity_id=holiday.id,
        description=f"Menghapus hari libur: {holiday.name} ({holiday.date})",
        performed_by=admin.name
    )

    # Untuk libur dari API, tandai sebagai excluded agar tidak muncul lagi saat sync
    # Untuk libur manual, hapus langsung dari database
    if holiday.is_auto:
        holiday.is_excluded = True
        db.commit()
    else:
        db.delete(holiday)
        db.commit()


@router.post("/holidays/sync", response_model=HolidaySyncResponse)
async def sync_holidays(
    year: Optional[int] = Query(default=None, description="Tahun untuk sync, default tahun ini"),
    db: Session = Depends(get_db),
    admin: Admin = Depends(require_admin_role)
):
    """Sync hari libur dari dayoff-API eksternal."""
    try:
        target_year = year or datetime.now().year
        stats = await sync_holidays_from_api(db, target_year)
        
        log_audit(
            db=db,
            action=AuditAction.CREATE,
            entity_type=EntityType.HOLIDAY,
            entity_id=None,
            description=f"Sync hari libur dari API: {stats['added']} ditambahkan, {stats['updated']} diperbarui",
            performed_by=admin.name,
            details=stats
        )
        
        return HolidaySyncResponse(
            added=stats["added"],
            updated=stats["updated"],
            skipped=stats["skipped"],
            message=f"Berhasil sync {stats['added']} hari libur baru, {stats['updated']} diperbarui"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal sync dari API: {str(e)}"
        )


@router.get("/holidays/excluded", response_model=HolidayListResponse)
def list_excluded_holidays(
    year: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin)
):
    """List holidays that have been excluded (deleted by admin)."""
    query = db.query(Holiday).filter(Holiday.is_excluded == True)
    
    if year:
        from sqlalchemy import extract
        query = query.filter(extract('year', Holiday.date) == year)
    
    holidays = query.order_by(Holiday.date).all()
    
    return HolidayListResponse(items=holidays, total=len(holidays))


@router.post("/holidays/{holiday_id}/restore", response_model=HolidayResponse)
def restore_holiday(
    holiday_id: int,
    db: Session = Depends(get_db),
    admin: Admin = Depends(require_admin_role)
):
    """Restore a previously excluded holiday."""
    holiday = db.query(Holiday).filter(Holiday.id == holiday_id).first()
    if not holiday:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Hari libur tidak ditemukan"
        )
    
    if not holiday.is_excluded:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Hari libur ini tidak dalam status dihapus"
        )
    
    holiday.is_excluded = False
    db.commit()
    db.refresh(holiday)
    
    log_audit(
        db=db,
        action=AuditAction.UPDATE,
        entity_type=EntityType.HOLIDAY,
        entity_id=holiday.id,
        description=f"Mengembalikan hari libur: {holiday.name} ({holiday.date})",
        performed_by=admin.name
    )
    
    return holiday


@router.get("/schedules", response_model=List[DailyScheduleResponse])
def list_schedules(
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin)
):
    """List all 7 day schedules"""
    schedules = db.query(DailyWorkSchedule).order_by(DailyWorkSchedule.day_of_week).all()

    # Initialize default schedules if table is empty
    if not schedules:
        for schedule_data in DEFAULT_SCHEDULES:
            schedule = DailyWorkSchedule(**schedule_data)
            db.add(schedule)

        db.commit()
        schedules = db.query(DailyWorkSchedule).order_by(DailyWorkSchedule.day_of_week).all()

    return schedules


@router.patch("/schedules", response_model=List[DailyScheduleResponse])
def update_schedules(
    data: DailyScheduleBatchUpdate,
    db: Session = Depends(get_db),
    admin: Admin = Depends(require_admin_role)
):
    """Update schedules (batch update)"""
    # Validate that we have exactly 7 schedules with unique day_of_week values
    if len(data.schedules) != 7:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Harus menyertakan 7 jadwal (Senin sampai Minggu)"
        )

    day_of_weeks = [s.day_of_week for s in data.schedules]
    if len(set(day_of_weeks)) != 7 or not all(d in range(7) for d in day_of_weeks):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Jadwal harus mencakup semua hari (0-6) tanpa duplikat"
        )

    # Get or create all schedules
    existing_schedules = {s.day_of_week: s for s in db.query(DailyWorkSchedule).all()}

    # Initialize if empty
    if not existing_schedules:
        for schedule_data in DEFAULT_SCHEDULES:
            schedule = DailyWorkSchedule(**schedule_data)
            db.add(schedule)
        db.commit()
        existing_schedules = {s.day_of_week: s for s in db.query(DailyWorkSchedule).all()}

    # Update each schedule
    updated_schedules = []
    audit_details = []

    for schedule_update in data.schedules:
        schedule = existing_schedules.get(schedule_update.day_of_week)

        if schedule:
            # Update existing
            schedule.is_workday = schedule_update.is_workday
            schedule.check_in_start = schedule_update.check_in_start
            schedule.check_in_end = schedule_update.check_in_end
            schedule.check_out_start = schedule_update.check_out_start
            updated_schedules.append(schedule)

            # Prepare audit details
            audit_details.append({
                "day_of_week": schedule_update.day_of_week,
                "is_workday": schedule_update.is_workday,
                "check_in_start": schedule_update.check_in_start.strftime("%H:%M:%S"),
                "check_in_end": schedule_update.check_in_end.strftime("%H:%M:%S"),
                "check_out_start": schedule_update.check_out_start.strftime("%H:%M:%S")
            })

    db.commit()
    invalidate_schedule_related_caches()

    # Log audit for batch update
    log_audit(
        db=db,
        action=AuditAction.UPDATE,
        entity_type=EntityType.DAILY_SCHEDULE,
        entity_id=None,  # Batch update, no single ID
        description="Mengupdate jadwal kerja harian (batch)",
        performed_by=admin.name,
        details={"schedules": audit_details}
    )

    # Return all schedules ordered by day_of_week
    return db.query(DailyWorkSchedule).order_by(DailyWorkSchedule.day_of_week).all()
