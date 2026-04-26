"""Guest Book Model"""
from sqlalchemy import Column, Integer, String, Date, DateTime, Text, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db_base import Base


class GuestBookMeetingTarget(Base):
    """Model for admin-managed guest meeting targets"""
    __tablename__ = "guest_book_meeting_targets"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False, unique=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    guest_book_entries = relationship("GuestBookEntry", back_populates="meeting_target")


class GuestBookEntry(Base):
    """Model for guest book entries"""
    __tablename__ = "guest_book_entries"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    institution = Column(String(200), nullable=False)
    meeting_target_id = Column(Integer, ForeignKey("guest_book_meeting_targets.id"), nullable=True)
    meeting_target_name = Column(String(200), nullable=False)
    purpose = Column(Text, nullable=False)
    visit_date = Column(Date, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    meeting_target = relationship("GuestBookMeetingTarget", back_populates="guest_book_entries")
