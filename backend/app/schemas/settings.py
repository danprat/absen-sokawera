from typing import Optional, List
from pydantic import BaseModel, Field
from datetime import time, datetime


class WorkSettingsResponse(BaseModel):
    id: int
    village_name: str
    officer_name: Optional[str]
    logo_url: Optional[str]
    background_url: Optional[str]
    check_in_start: time
    check_in_end: time
    late_threshold_minutes: int
    check_out_start: time
    min_work_hours: float
    face_similarity_threshold: float
    updated_at: datetime

    class Config:
        from_attributes = True


class WorkSettingsUpdate(BaseModel):
    village_name: Optional[str] = None
    officer_name: Optional[str] = None
    logo_url: Optional[str] = None
    background_url: Optional[str] = None
    check_in_start: Optional[time] = None
    check_in_end: Optional[time] = None
    late_threshold_minutes: Optional[int] = None
    check_out_start: Optional[time] = None
    min_work_hours: Optional[float] = None
    face_similarity_threshold: Optional[float] = Field(None, ge=0.3, le=0.7)


class DailyScheduleResponse(BaseModel):
    id: int
    day_of_week: int
    is_workday: bool
    check_in_start: time
    check_in_end: time
    check_out_start: time
    updated_at: datetime

    class Config:
        from_attributes = True


class DailyScheduleUpdate(BaseModel):
    day_of_week: int = Field(..., ge=0, le=6, description="0=Monday, 1=Tuesday, ..., 6=Sunday")
    is_workday: bool
    check_in_start: time
    check_in_end: time
    check_out_start: time


class DailyScheduleBatchUpdate(BaseModel):
    schedules: List[DailyScheduleUpdate]
