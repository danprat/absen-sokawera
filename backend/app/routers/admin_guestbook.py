"""Admin Guest Book Router - Protected endpoints"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse, Response
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional
from datetime import date
import csv
import io

from app.database import get_db
from app.models.admin import Admin
from app.models.guestbook import GuestBookEntry, GuestBookMeetingTarget
from app.schemas.guestbook import (
    GuestBookListResponse,
    GuestBookResponse,
    GuestBookMeetingTargetCreate,
    GuestBookMeetingTargetUpdate,
    GuestBookMeetingTargetResponse,
    GuestBookMeetingTargetListResponse,
)
from app.utils.auth import get_current_admin, require_admin_role
from app.utils.audit import log_audit
from app.models.audit_log import AuditAction, EntityType
from app.utils.export_utils import generate_pdf, generate_excel, generate_csv

router = APIRouter(prefix="/admin/guest-book", tags=["Admin - Guest Book"])


@router.get("/meeting-targets", response_model=GuestBookMeetingTargetListResponse)
def list_meeting_targets(
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin)
):
    items = db.query(GuestBookMeetingTarget).order_by(GuestBookMeetingTarget.name.asc()).all()
    return GuestBookMeetingTargetListResponse(items=items, total=len(items))


@router.post("/meeting-targets", response_model=GuestBookMeetingTargetResponse, status_code=status.HTTP_201_CREATED)
def create_meeting_target(
    data: GuestBookMeetingTargetCreate,
    db: Session = Depends(get_db),
    admin: Admin = Depends(require_admin_role)
):
    existing = db.query(GuestBookMeetingTarget).filter(GuestBookMeetingTarget.name == data.name.strip()).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tujuan ketemu sudah ada")

    target = GuestBookMeetingTarget(name=data.name.strip())
    db.add(target)
    db.commit()
    db.refresh(target)

    log_audit(
        db=db,
        action=AuditAction.CREATE,
        entity_type=EntityType.GUESTBOOK,
        entity_id=target.id,
        description=f"Created guest book meeting target: {target.name}",
        performed_by=admin.username,
        details={"name": target.name}
    )
    return target


@router.patch("/meeting-targets/{target_id}", response_model=GuestBookMeetingTargetResponse)
def update_meeting_target(
    target_id: int,
    data: GuestBookMeetingTargetUpdate,
    db: Session = Depends(get_db),
    admin: Admin = Depends(require_admin_role)
):
    target = db.query(GuestBookMeetingTarget).filter(GuestBookMeetingTarget.id == target_id).first()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tujuan ketemu tidak ditemukan")

    if data.name is not None:
        existing = db.query(GuestBookMeetingTarget).filter(GuestBookMeetingTarget.name == data.name.strip(), GuestBookMeetingTarget.id != target_id).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tujuan ketemu sudah ada")
        target.name = data.name.strip()

    if data.is_active is not None:
        target.is_active = data.is_active

    db.commit()
    db.refresh(target)

    log_audit(
        db=db,
        action=AuditAction.UPDATE,
        entity_type=EntityType.GUESTBOOK,
        entity_id=target.id,
        description=f"Updated guest book meeting target: {target.name}",
        performed_by=admin.username,
        details={"name": target.name, "is_active": target.is_active}
    )
    return target


@router.delete("/meeting-targets/{target_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_meeting_target(
    target_id: int,
    db: Session = Depends(get_db),
    admin: Admin = Depends(require_admin_role)
):
    target = db.query(GuestBookMeetingTarget).filter(GuestBookMeetingTarget.id == target_id).first()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tujuan ketemu tidak ditemukan")

    is_used = db.query(GuestBookEntry).filter(GuestBookEntry.meeting_target_id == target_id).first()
    if is_used:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tujuan ketemu sudah dipakai, nonaktifkan saja")

    log_audit(
        db=db,
        action=AuditAction.DELETE,
        entity_type=EntityType.GUESTBOOK,
        entity_id=target.id,
        description=f"Deleted guest book meeting target: {target.name}",
        performed_by=admin.username,
        details={"name": target.name}
    )

    db.delete(target)
    db.commit()
    return None


@router.get("", response_model=GuestBookListResponse)
def list_guest_book_entries(
    search: Optional[str] = Query(None, description="Search by name or institution"),
    start_date: Optional[date] = Query(None, description="Filter by start date"),
    end_date: Optional[date] = Query(None, description="Filter by end date"),
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin)
):
    """List guest book entries with optional filters (admin only)"""
    query = db.query(GuestBookEntry)
    
    # Apply search filter
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (GuestBookEntry.name.ilike(search_term)) |
            (GuestBookEntry.institution.ilike(search_term)) |
            (GuestBookEntry.meeting_target_name.ilike(search_term))
        )
    
    # Apply date filters
    if start_date:
        query = query.filter(GuestBookEntry.visit_date >= start_date)
    if end_date:
        query = query.filter(GuestBookEntry.visit_date <= end_date)
    
    # Get total count
    total = query.count()
    
    # Apply pagination and ordering
    entries = query.order_by(desc(GuestBookEntry.created_at))\
        .offset((page - 1) * per_page)\
        .limit(per_page)\
        .all()
    
    return GuestBookListResponse(
        items=entries,
        total=total,
        page=page,
        per_page=per_page
    )


@router.get("/export")
def export_guest_book(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    format: str = Query("csv", pattern="^(csv|pdf|xlsx)$"),
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin)
):
    """Export guest book entries to CSV, PDF, or Excel"""
    query = db.query(GuestBookEntry)

    if start_date:
        query = query.filter(GuestBookEntry.visit_date >= start_date)
    if end_date:
        query = query.filter(GuestBookEntry.visit_date <= end_date)

    entries = query.order_by(desc(GuestBookEntry.created_at)).all()

    # Define headers
    headers = ["No", "Nama", "Instansi", "Tujuan Ketemu", "Keperluan", "Tanggal Kunjungan", "Waktu"]

    # Prepare data as list of lists
    data = []
    for idx, entry in enumerate(entries, start=1):
        data.append([
            idx,
            entry.name,
            entry.institution,
            entry.meeting_target_name,
            entry.purpose,
            entry.visit_date.strftime("%d/%m/%Y"),
            entry.created_at.strftime("%H:%M")
        ])

    # Prepare title and subtitle
    title = "BUKU TAMU"
    if start_date and end_date:
        subtitle = f"Periode: {start_date.strftime('%d/%m/%Y')} - {end_date.strftime('%d/%m/%Y')}"
    elif start_date:
        subtitle = f"Periode: {start_date.strftime('%d/%m/%Y')} - Sekarang"
    elif end_date:
        subtitle = f"Periode: Awal - {end_date.strftime('%d/%m/%Y')}"
    else:
        subtitle = "Semua Data"

    # Generate export based on format
    if format == "csv":
        content = generate_csv(headers, data)
        media_type = "text/csv"
        filename = "buku_tamu.csv"
        response = StreamingResponse(
            iter([content]),
            media_type=media_type,
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    elif format == "pdf":
        content = generate_pdf(
            title=title,
            subtitle=subtitle,
            headers=headers,
            data=data,
            logo_path=None,
            orientation="portrait"
        )
        media_type = "application/pdf"
        filename = "buku_tamu.pdf"
        response = Response(
            content=content,
            media_type=media_type,
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    elif format == "xlsx":
        content = generate_excel(
            title=title,
            subtitle=subtitle,
            headers=headers,
            data=data,
            sheet_name="Buku Tamu"
        )
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = "buku_tamu.xlsx"
        response = Response(
            content=content,
            media_type=media_type,
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

    # Log audit
    log_audit(
        db=db,
        action=AuditAction.EXPORT,
        entity_type=EntityType.GUESTBOOK,
        entity_id=None,
        description=f"Exported {len(entries)} guest book entries to {format}",
        performed_by=admin.username,
        details={"format": format, "count": len(entries)}
    )

    return response


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_guest_book_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    admin: Admin = Depends(require_admin_role)
):
    """Delete a guest book entry (admin only)"""
    entry = db.query(GuestBookEntry).filter(GuestBookEntry.id == entry_id).first()
    
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Guest book entry not found"
        )
    
    # Log audit before deletion
    log_audit(
        db=db,
        action=AuditAction.DELETE,
        entity_type=EntityType.GUESTBOOK,
        entity_id=entry_id,
        description=f"Deleted guest book entry: {entry.name}",
        performed_by=admin.username,
        details={"name": entry.name, "institution": entry.institution}
    )
    
    db.delete(entry)
    db.commit()
    return None
