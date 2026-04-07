"""Guest Book Schemas"""
from typing import Optional, List
from pydantic import BaseModel, Field, model_validator, field_validator
from datetime import date, datetime


class GuestBookMeetingTargetCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)


class GuestBookMeetingTargetUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    is_active: Optional[bool] = None


class GuestBookMeetingTargetResponse(BaseModel):
    id: int
    name: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class GuestBookMeetingTargetListResponse(BaseModel):
    items: List[GuestBookMeetingTargetResponse]
    total: int


class GuestBookCreate(BaseModel):
    """Schema for creating a guest book entry"""
    name: str = Field(..., min_length=1, max_length=100)
    institution: str = Field(..., min_length=1, max_length=200)
    meeting_target_id: Optional[int] = None
    meeting_target_manual: Optional[str] = Field(None, min_length=1, max_length=200)
    purpose: str = Field(..., min_length=1)
    visit_date: date

    @field_validator('meeting_target_manual', mode='before')
    @classmethod
    def empty_manual_to_none(cls, value):
        if isinstance(value, str) and not value.strip():
            return None
        return value

    @model_validator(mode='after')
    def validate_meeting_target(self):
        if self.meeting_target_id is None and not self.meeting_target_manual:
            raise ValueError('Pilih tujuan ketemu atau isi manual')
        return self


class GuestBookResponse(BaseModel):
    """Schema for guest book entry response"""
    id: int
    name: str
    institution: str
    meeting_target_id: Optional[int] = None
    meeting_target_name: str
    purpose: str
    visit_date: date
    created_at: datetime

    class Config:
        from_attributes = True


class GuestBookListResponse(BaseModel):
    """Schema for paginated guest book list"""
    items: List[GuestBookResponse]
    total: int
    page: int
    per_page: int
