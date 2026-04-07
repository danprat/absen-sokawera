"""Guest Book Router - Public endpoints"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional
from datetime import date

from app.database import get_db
from app.models.guestbook import GuestBookEntry, GuestBookMeetingTarget
from app.schemas.guestbook import (
    GuestBookCreate,
    GuestBookResponse,
    GuestBookListResponse,
    GuestBookMeetingTargetListResponse,
)

router = APIRouter(prefix="/guestbook", tags=["Guest Book"])


@router.get("/meeting-targets", response_model=GuestBookMeetingTargetListResponse)
def list_public_meeting_targets(db: Session = Depends(get_db)):
    items = db.query(GuestBookMeetingTarget).filter(GuestBookMeetingTarget.is_active == True).order_by(GuestBookMeetingTarget.name.asc()).all()
    return GuestBookMeetingTargetListResponse(items=items, total=len(items))


@router.post("", response_model=GuestBookResponse, status_code=status.HTTP_201_CREATED)
def create_guest_book_entry(
    data: GuestBookCreate,
    db: Session = Depends(get_db)
):
    """Create a new guest book entry (public endpoint)"""
    meeting_target = None
    meeting_target_name = data.meeting_target_manual.strip() if data.meeting_target_manual else None

    if data.meeting_target_id is not None:
        meeting_target = db.query(GuestBookMeetingTarget).filter(GuestBookMeetingTarget.id == data.meeting_target_id).first()
        if not meeting_target or not meeting_target.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tujuan ketemu tidak valid atau tidak aktif"
            )
        meeting_target_name = meeting_target.name

    entry = GuestBookEntry(
        name=data.name,
        institution=data.institution,
        meeting_target_id=meeting_target.id if meeting_target else None,
        meeting_target_name=meeting_target_name,
        purpose=data.purpose,
        visit_date=data.visit_date
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.get("", response_model=GuestBookListResponse)
def list_guest_book_entries(
    search: Optional[str] = Query(None, description="Search by name or institution"),
    start_date: Optional[date] = Query(None, description="Filter by start date"),
    end_date: Optional[date] = Query(None, description="Filter by end date"),
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """List guest book entries with optional filters"""
    query = db.query(GuestBookEntry)
    
    # Apply search filter
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (GuestBookEntry.name.ilike(search_term)) |
            (GuestBookEntry.institution.ilike(search_term))
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


@router.get("/{entry_id}", response_model=GuestBookResponse)
def get_guest_book_entry(
    entry_id: int,
    db: Session = Depends(get_db)
):
    """Get a specific guest book entry"""
    entry = db.query(GuestBookEntry).filter(GuestBookEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Guest book entry not found"
        )
    return entry
