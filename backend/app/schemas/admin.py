from typing import Optional, List
from pydantic import BaseModel, field_validator
from datetime import datetime


class AdminBase(BaseModel):
    username: str
    name: str
    role: str = 'admin'


class AdminCreate(BaseModel):
    username: str
    name: str
    password: str
    role: str = 'admin'

    @field_validator('username')
    @classmethod
    def validate_username(cls, v):
        if len(v) < 3:
            raise ValueError('Username minimal 3 karakter')
        return v

    @field_validator('password')
    @classmethod
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password minimal 8 karakter')
        return v

    @field_validator('role')
    @classmethod
    def validate_role(cls, v):
        if v not in ['admin', 'kepala_desa']:
            raise ValueError('Role harus admin atau kepala_desa')
        return v


class AdminUpdate(BaseModel):
    username: Optional[str] = None
    name: Optional[str] = None
    role: Optional[str] = None

    @field_validator('username')
    @classmethod
    def validate_username(cls, v):
        if v and len(v) < 3:
            raise ValueError('Username minimal 3 karakter')
        return v

    @field_validator('role')
    @classmethod
    def validate_role(cls, v):
        if v and v not in ['admin', 'kepala_desa']:
            raise ValueError('Role harus admin atau kepala_desa')
        return v


class AdminResponse(BaseModel):
    id: int
    username: str
    name: str
    role: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AdminListResponse(BaseModel):
    items: List[AdminResponse]
    total: int
