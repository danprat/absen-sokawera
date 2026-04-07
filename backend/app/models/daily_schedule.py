from sqlalchemy import Column, Integer, Boolean, Time, DateTime
from sqlalchemy.sql import func
from datetime import time
from app.database import Base


class DailyWorkSchedule(Base):
    """Work schedule for each day of the week."""
    __tablename__ = "daily_work_schedules"

    id = Column(Integer, primary_key=True, index=True)
    day_of_week = Column(Integer, nullable=False, unique=True)  # 0=Monday, 6=Sunday
    is_workday = Column(Boolean, nullable=False, default=True)
    check_in_start = Column(Time, nullable=False, default=time(7, 0))
    check_in_end = Column(Time, nullable=False, default=time(8, 0))
    check_out_start = Column(Time, nullable=False, default=time(16, 0))
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


# Default schedules
DEFAULT_SCHEDULES = [
    {"day_of_week": 0, "is_workday": True, "check_in_start": time(7, 0), "check_in_end": time(8, 0), "check_out_start": time(16, 0)},  # Monday
    {"day_of_week": 1, "is_workday": True, "check_in_start": time(7, 0), "check_in_end": time(8, 0), "check_out_start": time(16, 0)},  # Tuesday
    {"day_of_week": 2, "is_workday": True, "check_in_start": time(7, 0), "check_in_end": time(8, 0), "check_out_start": time(16, 0)},  # Wednesday
    {"day_of_week": 3, "is_workday": True, "check_in_start": time(7, 0), "check_in_end": time(8, 0), "check_out_start": time(16, 0)},  # Thursday
    {"day_of_week": 4, "is_workday": True, "check_in_start": time(7, 0), "check_in_end": time(8, 0), "check_out_start": time(11, 30)},  # Friday
    {"day_of_week": 5, "is_workday": False, "check_in_start": time(7, 0), "check_in_end": time(8, 0), "check_out_start": time(16, 0)},  # Saturday
    {"day_of_week": 6, "is_workday": False, "check_in_start": time(7, 0), "check_in_end": time(8, 0), "check_out_start": time(16, 0)},  # Sunday
]
