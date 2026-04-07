"""Public endpoints that don't require authentication."""
from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.database import get_db
from app.models.work_settings import WorkSettings
from app.models.daily_schedule import DailyWorkSchedule
from app.utils.cache import cache, PUBLIC_SETTINGS_CACHE_KEY


router = APIRouter(prefix="/public", tags=["Public"])


class TodayScheduleResponse(BaseModel):
    is_workday: bool
    check_in_start: str
    check_in_end: str
    check_out_start: str


class PublicSettingsResponse(BaseModel):
    village_name: str
    officer_name: Optional[str]
    logo_url: Optional[str]
    background_url: Optional[str]
    today_schedule: Optional[TodayScheduleResponse]


@router.get("/settings", response_model=PublicSettingsResponse)
def get_public_settings(db: Session = Depends(get_db)):
    """Get public settings without authentication - for attendance page."""
    today = datetime.now()
    day_of_week = today.weekday()
    cache_key = f"{PUBLIC_SETTINGS_CACHE_KEY}:{day_of_week}"
    
    # Check cache first
    cached = cache.get(cache_key)
    if cached:
        return cached

    # Get work settings from DB
    settings = db.query(WorkSettings).first()
    if not settings:
        settings = WorkSettings()
        db.add(settings)
        db.commit()
        db.refresh(settings)

    # Get today's schedule
    schedule = db.query(DailyWorkSchedule).filter(
        DailyWorkSchedule.day_of_week == day_of_week
    ).first()

    today_schedule = None
    if schedule:
        today_schedule = TodayScheduleResponse(
            is_workday=schedule.is_workday,
            check_in_start=schedule.check_in_start.strftime("%H:%M"),
            check_in_end=schedule.check_in_end.strftime("%H:%M"),
            check_out_start=schedule.check_out_start.strftime("%H:%M")
        )
    else:
        today_schedule = TodayScheduleResponse(
            is_workday=day_of_week not in [5, 6],
            check_in_start=settings.check_in_start.strftime("%H:%M"),
            check_in_end=settings.check_in_end.strftime("%H:%M"),
            check_out_start=settings.check_out_start.strftime("%H:%M")
        )

    response = PublicSettingsResponse(
        village_name=settings.village_name,
        officer_name=settings.officer_name,
        logo_url=settings.logo_url,
        background_url=settings.background_url,
        today_schedule=today_schedule
    )
    
    # Cache for 60 seconds
    cache.set(cache_key, response, ttl_seconds=60)
    
    return response
