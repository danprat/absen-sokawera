from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.admin import Admin
from app.models.audit_log import AuditAction, EntityType
from app.schemas.admin import AdminCreate, AdminUpdate, AdminResponse, AdminListResponse
from app.utils.auth import get_current_admin, require_admin_role, get_password_hash
from app.utils.audit import log_audit

router = APIRouter(prefix="/admin/admins", tags=["Admin Management"])


@router.get("", response_model=AdminListResponse)
def list_admins(
    current_admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """List all admin accounts. Accessible by all authenticated admins."""
    admins = db.query(Admin).order_by(Admin.created_at.desc()).all()
    return AdminListResponse(items=admins, total=len(admins))


@router.post("", response_model=AdminResponse, status_code=status.HTTP_201_CREATED)
def create_admin(
    data: AdminCreate,
    admin: Admin = Depends(require_admin_role),
    db: Session = Depends(get_db)
):
    """Create a new admin account. Only accessible by full admins."""
    # Check username uniqueness
    existing = db.query(Admin).filter(Admin.username == data.username).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username sudah digunakan"
        )

    # Create new admin
    new_admin = Admin(
        username=data.username,
        name=data.name,
        password_hash=get_password_hash(data.password),
        role=data.role
    )
    db.add(new_admin)
    db.commit()
    db.refresh(new_admin)

    # Log audit
    log_audit(
        db=db,
        action=AuditAction.CREATE,
        entity_type=EntityType.ADMIN,
        entity_id=new_admin.id,
        description=f"Membuat akun admin baru: {new_admin.username} (role: {new_admin.role})",
        performed_by=admin.username
    )

    return new_admin


@router.patch("/{admin_id}", response_model=AdminResponse)
def update_admin(
    admin_id: int,
    data: AdminUpdate,
    current_admin: Admin = Depends(require_admin_role),
    db: Session = Depends(get_db)
):
    """Update admin account (username, name, or role). Only accessible by full admins."""
    target_admin = db.query(Admin).filter(Admin.id == admin_id).first()
    if not target_admin:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Admin tidak ditemukan"
        )

    # Check username uniqueness if changing
    if data.username and data.username != target_admin.username:
        existing = db.query(Admin).filter(Admin.username == data.username).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username sudah digunakan"
            )

    # Update fields
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(target_admin, field, value)

    db.commit()
    db.refresh(target_admin)

    # Log audit
    log_audit(
        db=db,
        action=AuditAction.UPDATE,
        entity_type=EntityType.ADMIN,
        entity_id=target_admin.id,
        description=f"Mengupdate admin: {target_admin.username}",
        performed_by=current_admin.username,
        details=update_data
    )

    return target_admin


@router.delete("/{admin_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_admin(
    admin_id: int,
    current_admin: Admin = Depends(require_admin_role),
    db: Session = Depends(get_db)
):
    """Delete admin account. Only accessible by full admins. Cannot delete self."""
    # Prevent self-deletion
    if admin_id == current_admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tidak dapat menghapus akun sendiri"
        )

    target_admin = db.query(Admin).filter(Admin.id == admin_id).first()
    if not target_admin:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Admin tidak ditemukan"
        )

    # Log before deletion
    log_audit(
        db=db,
        action=AuditAction.DELETE,
        entity_type=EntityType.ADMIN,
        entity_id=target_admin.id,
        description=f"Menghapus admin: {target_admin.username} (role: {target_admin.role})",
        performed_by=current_admin.username
    )

    # Hard delete
    db.delete(target_admin)
    db.commit()

    return None
