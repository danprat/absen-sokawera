from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.database import get_db
from app.models.admin import Admin
from app.models.employee import Employee
from app.models.audit_log import AuditAction, EntityType
from app.schemas.employee import (
    EmployeeCreate, EmployeeUpdate, EmployeeResponse, EmployeeListResponse
)
from app.utils.auth import get_current_admin, require_admin_role
from app.utils.audit import log_audit

router = APIRouter(prefix="/employees", tags=["Employees"])


@router.get("", response_model=EmployeeListResponse)
def list_employees(
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    is_active: Optional[bool] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(Employee)
    
    if is_active is not None:
        query = query.filter(Employee.is_active == is_active)
    
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            or_(
                Employee.name.ilike(search_filter),
                Employee.nik.ilike(search_filter),
                Employee.position.ilike(search_filter)
            )
        )
    
    total = query.count()
    items = query.order_by(Employee.name).offset((page - 1) * page_size).limit(page_size).all()
    
    return EmployeeListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size
    )


@router.post("", response_model=EmployeeResponse, status_code=status.HTTP_201_CREATED)
def create_employee(
    data: EmployeeCreate,
    db: Session = Depends(get_db),
    admin: Admin = Depends(require_admin_role)
):
    if data.nik:
        existing = db.query(Employee).filter(Employee.nik == data.nik).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="NIK sudah digunakan"
            )
    
    employee = Employee(**data.model_dump())
    db.add(employee)
    db.commit()
    db.refresh(employee)
    
    log_audit(
        db=db,
        action=AuditAction.CREATE,
        entity_type=EntityType.EMPLOYEE,
        entity_id=employee.id,
        description=f"Menambahkan pegawai: {employee.name}",
        performed_by=admin.name
    )
    
    return employee


@router.get("/{employee_id}", response_model=EmployeeResponse)
def get_employee(
    employee_id: int,
    db: Session = Depends(get_db)
):
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pegawai tidak ditemukan"
        )
    return employee


@router.patch("/{employee_id}", response_model=EmployeeResponse)
def update_employee(
    employee_id: int,
    data: EmployeeUpdate,
    db: Session = Depends(get_db),
    admin: Admin = Depends(require_admin_role)
):
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pegawai tidak ditemukan"
        )
    
    if data.nik and data.nik != employee.nik:
        existing = db.query(Employee).filter(Employee.nik == data.nik).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="NIK sudah digunakan"
            )
    
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(employee, field, value)
    
    db.commit()
    db.refresh(employee)
    
    log_audit(
        db=db,
        action=AuditAction.UPDATE,
        entity_type=EntityType.EMPLOYEE,
        entity_id=employee.id,
        description=f"Mengupdate pegawai: {employee.name}",
        performed_by=admin.name,
        details=update_data
    )
    
    return employee


@router.delete("/{employee_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    admin: Admin = Depends(require_admin_role)
):
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pegawai tidak ditemukan"
        )
    
    employee.is_active = False
    db.commit()
    
    log_audit(
        db=db,
        action=AuditAction.DELETE,
        entity_type=EntityType.EMPLOYEE,
        entity_id=employee.id,
        description=f"Menonaktifkan pegawai: {employee.name}",
        performed_by=admin.name
    )
