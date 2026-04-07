from typing import Optional
from sqlalchemy.orm import Session
from app.models.audit_log import AuditLog, AuditAction, EntityType


def log_audit(
    db: Session,
    action: AuditAction,
    entity_type: EntityType,
    entity_id: Optional[int],
    description: str,
    performed_by: str,
    details: Optional[dict] = None
):
    audit_log = AuditLog(
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        description=description,
        performed_by=performed_by,
        details=details
    )
    db.add(audit_log)
    db.commit()
    return audit_log
