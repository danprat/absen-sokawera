from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.admin import Admin
from app.models.audit_log import AuditAction, EntityType
from app.schemas.auth import LoginRequest, TokenResponse, ChangePasswordRequest
from app.utils.auth import verify_password, create_access_token, get_password_hash, get_current_admin
from app.utils.audit import log_audit
from app.config import get_settings

router = APIRouter(prefix="/auth", tags=["Authentication"])
settings = get_settings()


@router.post("/login", response_model=TokenResponse)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    admin = db.query(Admin).filter(Admin.username == form_data.username).first()
    
    if not admin:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Username atau password salah",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not verify_password(form_data.password, admin.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Username atau password salah",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = create_access_token(
        data={"sub": admin.username, "admin_id": admin.id, "role": admin.role},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    return TokenResponse(access_token=access_token, role=admin.role)


@router.get("/me", response_model=dict)
def get_me(current_admin: Admin = Depends(get_current_admin)):
    return {
        "username": current_admin.username,
        "role": current_admin.role,
        "name": current_admin.name,
    }


@router.post("/logout", response_model=dict)
def logout():
    return {"message": "Logout berhasil"}


@router.post("/setup", response_model=dict)
def setup_admin(db: Session = Depends(get_db)):
    """Setup initial admin account. Only works if no admin exists."""
    existing = db.query(Admin).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admin sudah ada"
        )

    admin = Admin(
        username="admin",
        password_hash=get_password_hash("admin123"),
        name="Administrator"
    )
    db.add(admin)
    db.commit()

    return {"message": "Admin berhasil dibuat", "username": "admin", "password": "admin123"}


@router.patch("/change-password", response_model=dict)
def change_password(
    request: ChangePasswordRequest,
    current_admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Change admin password. Requires authentication."""
    # Verify current password
    if not verify_password(request.current_password, current_admin.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password lama tidak benar"
        )

    # Update password
    current_admin.password_hash = get_password_hash(request.new_password)
    db.commit()

    # Log audit action
    log_audit(
        db=db,
        action=AuditAction.UPDATE,
        entity_type=EntityType.ADMIN,
        entity_id=current_admin.id,
        description=f"Password changed for admin: {current_admin.username}",
        performed_by=current_admin.username
    )

    return {"message": "Password berhasil diubah"}
