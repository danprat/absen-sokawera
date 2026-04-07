from sqlalchemy import Column, Integer, String, Date, DateTime, Boolean
from sqlalchemy.sql import func
from app.database import Base


class Holiday(Base):
    __tablename__ = "holidays"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, unique=True, nullable=False, index=True)
    name = Column(String(200), nullable=False)
    is_auto = Column(Boolean, default=False)  # True = dari API, False = manual
    is_cuti = Column(Boolean, default=False)  # Status cuti bersama dari API
    is_excluded = Column(Boolean, default=False)  # True = dihapus user, tidak muncul saat sync
    created_at = Column(DateTime, server_default=func.now())

