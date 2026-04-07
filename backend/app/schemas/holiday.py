from typing import List, Optional
from pydantic import BaseModel
from datetime import date, datetime


class HolidayBase(BaseModel):
    date: date
    name: str


class HolidayCreate(HolidayBase):
    pass


class HolidayResponse(HolidayBase):
    id: int
    is_auto: bool = False
    is_cuti: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


class HolidayListResponse(BaseModel):
    items: List[HolidayResponse]
    total: int


class HolidaySyncResponse(BaseModel):
    added: int
    updated: int
    skipped: int
    message: str
