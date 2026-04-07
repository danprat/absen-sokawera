from sqlalchemy import Column, Integer, String, Time, Float, DateTime
from sqlalchemy.sql import func
from datetime import time
from app.database import Base


class WorkSettings(Base):
    __tablename__ = "work_settings"

    id = Column(Integer, primary_key=True, index=True)
    village_name = Column(String(200), nullable=False, default="Desa")
    officer_name = Column(String(200), nullable=True)
    logo_url = Column(String(500), nullable=True)
    background_url = Column(String(500), nullable=True)  # Background image for landing pages
    check_in_start = Column(Time, nullable=False, default=time(7, 0))
    check_in_end = Column(Time, nullable=False, default=time(8, 0))
    late_threshold_minutes = Column(Integer, nullable=False, default=15)
    check_out_start = Column(Time, nullable=False, default=time(16, 0))
    min_work_hours = Column(Float, nullable=False, default=8.0)
    face_similarity_threshold = Column(Float, nullable=False, default=0.5)  # 0.3-0.7, higher = stricter
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
