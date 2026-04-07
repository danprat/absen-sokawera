import enum
from sqlalchemy import Column, Integer, String, DateTime, Enum, JSON
from sqlalchemy.sql import func
from app.database import Base


class AuditAction(str, enum.Enum):
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    CORRECT = "correct"
    REORDER = "reorder"
    EXPORT = "export"


class EntityType(str, enum.Enum):
    EMPLOYEE = "employee"
    ATTENDANCE = "attendance"
    SETTINGS = "settings"
    HOLIDAY = "holiday"
    DAILY_SCHEDULE = "daily_schedule"
    ADMIN = "admin"
    SERVICE_TYPE = "service_type"
    SURVEY_QUESTION = "survey_question"
    SURVEY_RESPONSE = "survey_response"
    GUESTBOOK = "guestbook"


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    action = Column(Enum(AuditAction), nullable=False)
    entity_type = Column(Enum(EntityType), nullable=False)
    entity_id = Column(Integer, nullable=True)
    description = Column(String(500), nullable=False)
    performed_by = Column(String(100), nullable=False)
    details = Column(JSON, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), index=True)
