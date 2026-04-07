from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime
from app.models.audit_log import AuditAction, EntityType


class AuditLogResponse(BaseModel):
    id: int
    action: AuditAction
    entity_type: EntityType
    entity_id: Optional[int]
    description: str
    performed_by: str
    details: Optional[dict]
    created_at: datetime

    class Config:
        from_attributes = True


class AuditLogListResponse(BaseModel):
    items: List[AuditLogResponse]
    total: int
    page: int
    page_size: int
