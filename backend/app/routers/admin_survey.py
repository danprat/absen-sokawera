"""Admin Survey Router - Protected endpoints"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse, Response
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from typing import Optional
from datetime import date
import csv
import io
import hashlib

from app.database import get_db
from app.models.admin import Admin
from app.models.survey import ServiceType, SurveyQuestion, SurveyResponse
from app.schemas.survey import (
    ServiceTypeCreate,
    ServiceTypeUpdate,
    ServiceTypeResponse,
    ServiceTypeListResponse,
    SurveyQuestionCreate,
    SurveyQuestionUpdate,
    SurveyQuestionResponse,
    SurveyQuestionListResponse,
    ReorderQuestionsRequest,
    SurveyResponseDetail,
    SurveyResponseListResponse,
    SurveyStatsResponse,
    ServiceTypeStats,
    QuestionStatsResponse,
    QuestionStatistics,
    TextFeedbackItem,
    ComplaintFeedbackItem,
)
from app.utils.auth import get_current_admin, require_admin_role
from app.utils.audit import log_audit
from app.models.audit_log import AuditAction, EntityType
from app.utils.export_utils import generate_pdf, generate_excel, generate_csv
from app.utils.cache import cache, SURVEY_STATS_CACHE_KEY

router = APIRouter(prefix="/admin/survey", tags=["Admin - Survey"])


VALID_RATINGS = {"sangat_puas", "puas", "cukup_puas", "tidak_puas", "sangat_tidak_puas"}
LOW_RATINGS = {"tidak_puas", "sangat_tidak_puas"}
RATING_PRIORITY = {"sangat_puas": 5, "puas": 4, "cukup_puas": 3, "tidak_puas": 2, "sangat_tidak_puas": 1}


def extract_answer_value(answer):
    """Extract answer text from legacy string or structured survey answer."""
    if isinstance(answer, dict):
        value = answer.get("answer")
        return value.strip() if isinstance(value, str) else None
    return answer.strip() if isinstance(answer, str) else None


def extract_complaint_value(answer):
    """Extract complaint text from structured survey answer."""
    if not isinstance(answer, dict):
        return None

    value = answer.get("complaint")
    if isinstance(value, str):
        value = value.strip()
        return value or None
    return None


def invalidate_survey_stats_caches() -> None:
    """Remove cached survey statistics that depend on question definitions."""
    cache.invalidate_prefix(f"{SURVEY_STATS_CACHE_KEY}:questions:")


# ============ Service Types ============

@router.get("/service-types", response_model=ServiceTypeListResponse)
def list_service_types(
    include_inactive: bool = Query(False),
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin)
):
    """List all service types (admin only)"""
    query = db.query(ServiceType)
    
    if not include_inactive:
        query = query.filter(ServiceType.is_active == True)
    
    service_types = query.order_by(ServiceType.name).all()
    
    return ServiceTypeListResponse(
        items=service_types,
        total=len(service_types)
    )


@router.post("/service-types", response_model=ServiceTypeResponse, status_code=status.HTTP_201_CREATED)
def create_service_type(
    data: ServiceTypeCreate,
    db: Session = Depends(get_db),
    admin: Admin = Depends(require_admin_role)
):
    """Create a new service type"""
    # Check if name already exists
    existing = db.query(ServiceType).filter(ServiceType.name == data.name).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Service type with this name already exists"
        )
    
    service_type = ServiceType(name=data.name)
    db.add(service_type)
    db.commit()
    db.refresh(service_type)
    
    log_audit(
        db=db,
        action=AuditAction.CREATE,
        entity_type=EntityType.SERVICE_TYPE,
        entity_id=service_type.id,
        description=f"Created service type: {data.name}",
        performed_by=admin.username,
        details={"name": data.name}
    )
    
    return service_type


@router.patch("/service-types/{service_type_id}", response_model=ServiceTypeResponse)
def update_service_type(
    service_type_id: int,
    data: ServiceTypeUpdate,
    db: Session = Depends(get_db),
    admin: Admin = Depends(require_admin_role)
):
    """Update a service type"""
    service_type = db.query(ServiceType).filter(ServiceType.id == service_type_id).first()
    
    if not service_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service type not found"
        )
    
    update_data = data.model_dump(exclude_unset=True)
    
    # Check for duplicate name
    if "name" in update_data:
        existing = db.query(ServiceType)\
            .filter(ServiceType.name == update_data["name"], ServiceType.id != service_type_id)\
            .first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Service type with this name already exists"
            )
    
    for key, value in update_data.items():
        setattr(service_type, key, value)
    
    db.commit()
    db.refresh(service_type)
    
    log_audit(
        db=db,
        action=AuditAction.UPDATE,
        entity_type=EntityType.SERVICE_TYPE,
        entity_id=service_type_id,
        description=f"Updated service type: {service_type.name}",
        performed_by=admin.username,
        details=update_data
    )
    
    return service_type


@router.delete("/service-types/{service_type_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_service_type(
    service_type_id: int,
    db: Session = Depends(get_db),
    admin: Admin = Depends(require_admin_role)
):
    """Delete a service type"""
    service_type = db.query(ServiceType).filter(ServiceType.id == service_type_id).first()
    
    if not service_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service type not found"
        )
    
    # Check if there are responses using this service type
    response_count = db.query(SurveyResponse)\
        .filter(SurveyResponse.service_type_id == service_type_id)\
        .count()
    
    if response_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete service type with {response_count} responses. Deactivate it instead."
        )
    
    log_audit(
        db=db,
        action=AuditAction.DELETE,
        entity_type=EntityType.SERVICE_TYPE,
        entity_id=service_type_id,
        description=f"Deleted service type: {service_type.name}",
        performed_by=admin.username,
        details={"name": service_type.name}
    )
    
    db.delete(service_type)
    db.commit()
    return None


# ============ Survey Questions ============

@router.get("/questions", response_model=SurveyQuestionListResponse)
def list_questions(
    include_inactive: bool = Query(False),
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin)
):
    """List all survey questions"""
    query = db.query(SurveyQuestion)
    
    if not include_inactive:
        query = query.filter(SurveyQuestion.is_active == True)
    
    questions = query.order_by(SurveyQuestion.order, SurveyQuestion.id).all()
    
    return SurveyQuestionListResponse(
        items=questions,
        total=len(questions)
    )


@router.post("/questions", response_model=SurveyQuestionResponse, status_code=status.HTTP_201_CREATED)
def create_question(
    data: SurveyQuestionCreate,
    db: Session = Depends(get_db),
    admin: Admin = Depends(require_admin_role)
):
    """Create a new survey question"""
    # Get max order
    max_order = db.query(func.max(SurveyQuestion.order)).scalar() or 0
    
    question = SurveyQuestion(
        question_text=data.question_text,
        question_type=data.question_type,
        options=data.options,
        is_required=data.is_required,
        order=data.order if data.order > 0 else max_order + 1
    )
    db.add(question)
    db.commit()
    invalidate_survey_stats_caches()
    db.refresh(question)
    
    log_audit(
        db=db,
        action=AuditAction.CREATE,
        entity_type=EntityType.SURVEY_QUESTION,
        entity_id=question.id,
        description=f"Created survey question: {data.question_text[:50]}",
        performed_by=admin.username,
        details={"question_text": data.question_text}
    )
    
    return question


@router.patch("/questions/{question_id}", response_model=SurveyQuestionResponse)
def update_question(
    question_id: int,
    data: SurveyQuestionUpdate,
    db: Session = Depends(get_db),
    admin: Admin = Depends(require_admin_role)
):
    """Update a survey question"""
    question = db.query(SurveyQuestion).filter(SurveyQuestion.id == question_id).first()
    
    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question not found"
        )
    
    update_data = data.model_dump(exclude_unset=True)
    
    for key, value in update_data.items():
        setattr(question, key, value)

    db.commit()
    invalidate_survey_stats_caches()
    db.refresh(question)
    
    log_audit(
        db=db,
        action=AuditAction.UPDATE,
        entity_type=EntityType.SURVEY_QUESTION,
        entity_id=question_id,
        description=f"Updated survey question: {question.question_text[:50]}",
        performed_by=admin.username,
        details=update_data
    )
    
    return question


@router.post("/questions/reorder", status_code=status.HTTP_200_OK)
def reorder_questions(
    data: ReorderQuestionsRequest,
    db: Session = Depends(get_db),
    admin: Admin = Depends(require_admin_role)
):
    """Reorder survey questions"""
    for index, question_id in enumerate(data.question_ids):
        db.query(SurveyQuestion)\
            .filter(SurveyQuestion.id == question_id)\
            .update({"order": index + 1})

    db.commit()
    invalidate_survey_stats_caches()
    
    log_audit(
        db=db,
        action=AuditAction.REORDER,
        entity_type=EntityType.SURVEY_QUESTION,
        entity_id=None,
        description="Reordered survey questions",
        performed_by=admin.username,
        details={"new_order": data.question_ids}
    )
    
    return {"message": "Questions reordered successfully"}


@router.delete("/questions/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_question(
    question_id: int,
    db: Session = Depends(get_db),
    admin: Admin = Depends(require_admin_role)
):
    """Delete a survey question"""
    question = db.query(SurveyQuestion).filter(SurveyQuestion.id == question_id).first()
    
    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question not found"
        )
    
    log_audit(
        db=db,
        action=AuditAction.DELETE,
        entity_type=EntityType.SURVEY_QUESTION,
        entity_id=question_id,
        description=f"Deleted survey question: {question.question_text[:50]}",
        performed_by=admin.username,
        details={"question_text": question.question_text}
    )
    
    db.delete(question)
    db.commit()
    invalidate_survey_stats_caches()
    return None


# ============ Survey Responses ============

@router.get("/responses", response_model=SurveyResponseListResponse)
def list_responses(
    service_type_id: Optional[int] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin)
):
    """List survey responses with filters"""
    query = db.query(SurveyResponse).join(ServiceType)
    
    if service_type_id:
        query = query.filter(SurveyResponse.service_type_id == service_type_id)
    
    if start_date:
        query = query.filter(func.date(SurveyResponse.submitted_at) >= start_date)
    if end_date:
        query = query.filter(func.date(SurveyResponse.submitted_at) <= end_date)
    
    total = query.count()
    
    responses = query.order_by(desc(SurveyResponse.submitted_at))\
        .offset((page - 1) * per_page)\
        .limit(per_page)\
        .all()
    
    items = [
        SurveyResponseDetail(
            id=r.id,
            service_type_id=r.service_type_id,
            service_type_name=r.service_type.name,
            filled_by=r.filled_by,
            responses=r.responses,
            feedback=r.feedback,
            submitted_at=r.submitted_at
        )
        for r in responses
    ]
    
    return SurveyResponseListResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page
    )


@router.get("/stats", response_model=SurveyStatsResponse)
def get_survey_stats(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    service_type_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin)
):
    """Get survey statistics"""
    query = db.query(SurveyResponse).join(ServiceType)

    if start_date:
        query = query.filter(func.date(SurveyResponse.submitted_at) >= start_date)
    if end_date:
        query = query.filter(func.date(SurveyResponse.submitted_at) <= end_date)
    if service_type_id:
        query = query.filter(SurveyResponse.service_type_id == service_type_id)
    
    responses = query.all()
    total_responses = len(responses)
    
    # Calculate rating distribution (average rating per response)
    rating_distribution = {
        "sangat_puas": 0,
        "puas": 0,
        "cukup_puas": 0,
        "tidak_puas": 0,
        "sangat_tidak_puas": 0
    }
    
    by_filled_by = {"sendiri": 0, "diwakilkan": 0}
    by_service_type = {}
    
    for response in responses:
        # Count filled_by
        by_filled_by[response.filled_by.value] += 1

        # Count by service type
        st_id = response.service_type_id
        if st_id not in by_service_type:
            by_service_type[st_id] = {
                "name": response.service_type.name,
                "total": 0,
                "ratings": {"sangat_puas": 0, "puas": 0, "cukup_puas": 0, "tidak_puas": 0, "sangat_tidak_puas": 0}
            }
        by_service_type[st_id]["total"] += 1

        # Calculate average/dominant rating for this response
        valid_ratings = []
        for question_id, answer in response.responses.items():
            answer_value = extract_answer_value(answer)
            if answer_value in VALID_RATINGS:
                valid_ratings.append(answer_value)

        if valid_ratings:
            # Calculate average score and map back to rating
            avg_score = sum(RATING_PRIORITY[r] for r in valid_ratings) / len(valid_ratings)

            # Map average score to rating category
            if avg_score >= 4.5:
                dominant_rating = "sangat_puas"
            elif avg_score >= 3.5:
                dominant_rating = "puas"
            elif avg_score >= 2.5:
                dominant_rating = "cukup_puas"
            elif avg_score >= 1.5:
                dominant_rating = "tidak_puas"
            else:
                dominant_rating = "sangat_tidak_puas"
            
            rating_distribution[dominant_rating] += 1
            by_service_type[st_id]["ratings"][dominant_rating] += 1
    
    # Convert by_service_type to list
    service_type_stats = [
        ServiceTypeStats(
            service_type_id=st_id,
            service_type_name=data["name"],
            total=data["total"],
            rating_distribution=data["ratings"]
        )
        for st_id, data in by_service_type.items()
    ]
    
    return SurveyStatsResponse(
        total_responses=total_responses,
        rating_distribution=rating_distribution,
        by_service_type=service_type_stats,
        by_filled_by=by_filled_by
    )


@router.get("/stats/questions", response_model=QuestionStatsResponse)
def get_question_stats(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    service_type_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin)
):
    """Get per-question statistics with detailed breakdowns and text feedback"""
    # Generate cache key based on parameters
    cache_params = f"{start_date}:{end_date}:{service_type_id}"
    cache_key = f"{SURVEY_STATS_CACHE_KEY}:questions:{hashlib.md5(cache_params.encode()).hexdigest()}"
    
    # Check cache first (TTL 5 minutes)
    cached = cache.get(cache_key)
    if cached:
        return cached
    
    # Get all questions, including inactive ones, so historical stats remain visible
    questions = db.query(SurveyQuestion).order_by(SurveyQuestion.order, SurveyQuestion.id).all()
    
    # Get responses with filters
    query = db.query(SurveyResponse).join(ServiceType)
    
    if start_date:
        query = query.filter(func.date(SurveyResponse.submitted_at) >= start_date)
    if end_date:
        query = query.filter(func.date(SurveyResponse.submitted_at) <= end_date)
    if service_type_id:
        query = query.filter(SurveyResponse.service_type_id == service_type_id)
    
    responses = query.all()
    total_responses = len(responses)
    
    # Calculate stats for each question
    question_stats = []

    for question in questions:
        question_id_str = str(question.id)
        response_count = 0

        if question.question_type.value == "rating":
            # Rating question - aggregate distribution
            rating_distribution = {
                "sangat_puas": 0,
                "puas": 0,
                "cukup_puas": 0,
                "tidak_puas": 0,
                "sangat_tidak_puas": 0
            }
            complaint_responses = []

            for response in responses:
                if question_id_str in response.responses:
                    raw_answer = response.responses[question_id_str]
                    answer_value = extract_answer_value(raw_answer)
                    complaint_value = extract_complaint_value(raw_answer)

                    if answer_value in VALID_RATINGS:
                        rating_distribution[answer_value] += 1
                        response_count += 1

                        if complaint_value and answer_value in LOW_RATINGS:
                            complaint_responses.append(ComplaintFeedbackItem(
                                response_id=response.id,
                                complaint=complaint_value,
                                rating=answer_value,
                                service_type_name=response.service_type.name,
                                submitted_at=response.submitted_at
                            ))

            complaint_responses.sort(key=lambda x: x.submitted_at, reverse=True)

            question_stats.append(QuestionStatistics(
                question_id=question.id,
                question_text=question.question_text,
                question_type=question.question_type,
                response_count=response_count,
                rating_distribution=rating_distribution,
                text_responses=None,
                complaint_responses=complaint_responses
            ))
        else:
            # Text question - collect all text responses
            text_responses = []

            for response in responses:
                if question_id_str in response.responses:
                    raw_answer = response.responses[question_id_str]
                    answer_value = extract_answer_value(raw_answer)
                    if answer_value:
                        text_responses.append(TextFeedbackItem(
                            response_id=response.id,
                            answer=answer_value,
                            service_type_name=response.service_type.name,
                            submitted_at=response.submitted_at
                        ))
                        response_count += 1

            # Sort by date descending
            text_responses.sort(key=lambda x: x.submitted_at, reverse=True)

            question_stats.append(QuestionStatistics(
                question_id=question.id,
                question_text=question.question_text,
                question_type=question.question_type,
                response_count=response_count,
                rating_distribution=None,
                text_responses=text_responses,
                complaint_responses=None
            ))
    
    result = QuestionStatsResponse(
        questions=question_stats,
        total_responses=total_responses
    )
    
    # Cache for 5 minutes
    cache.set(cache_key, result, ttl_seconds=300)
    
    return result


@router.get("/export")
def export_survey_responses(
    service_type_id: Optional[int] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    format: str = Query("csv", pattern="^(csv|pdf|xlsx)$"),
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin)
):
    """Export survey responses to CSV, PDF, or Excel"""
    query = db.query(SurveyResponse).join(ServiceType)

    if service_type_id:
        query = query.filter(SurveyResponse.service_type_id == service_type_id)
    if start_date:
        query = query.filter(func.date(SurveyResponse.submitted_at) >= start_date)
    if end_date:
        query = query.filter(func.date(SurveyResponse.submitted_at) <= end_date)

    responses = query.order_by(desc(SurveyResponse.submitted_at)).all()

    # Get all questions for headers
    questions = db.query(SurveyQuestion).order_by(SurveyQuestion.order).all()

    # Prepare headers
    headers = ["ID", "Jenis Layanan", "Diisi Oleh", "Tanggal"]
    for q in questions:
        base_label = f"Q{q.id}: {q.question_text[:50]}"
        headers.append(f"{base_label} - Jawaban")
        if q.question_type.value == "rating":
            headers.append(f"{base_label} - Keluhan")
    headers.append("Feedback")

    # Prepare data as list of lists
    data = []
    for response in responses:
        row = [
            str(response.id),
            response.service_type.name,
            response.filled_by.value,
            response.submitted_at.strftime("%Y-%m-%d %H:%M:%S")
        ]
        # Add question responses
        for q in questions:
            raw_answer = response.responses.get(str(q.id), "")
            answer_value = extract_answer_value(raw_answer) or ""
            complaint_value = extract_complaint_value(raw_answer) or ""
            row.append(answer_value)
            if q.question_type.value == "rating":
                row.append(complaint_value)
        row.append(response.feedback or "")
        data.append(row)

    # Format subtitle with dates
    title = "LAPORAN SURVEY KEPUASAN"
    if start_date or end_date:
        start_str = start_date.strftime("%d/%m/%Y") if start_date else "awal"
        end_str = end_date.strftime("%d/%m/%Y") if end_date else "akhir"
        subtitle = f"Periode: {start_str} - {end_str}"
    else:
        subtitle = "Periode: Semua Data"

    # Log audit
    log_audit(
        db=db,
        action=AuditAction.EXPORT,
        entity_type=EntityType.SURVEY_RESPONSE,
        entity_id=None,
        description=f"Exported {len(responses)} survey responses to {format}",
        performed_by=admin.username,
        details={"format": format, "count": len(responses)}
    )

    # Generate and return based on format
    if format == "csv":
        csv_content = generate_csv(headers, data)
        return StreamingResponse(
            iter([csv_content]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=survey_responses.csv"}
        )

    elif format == "pdf":
        pdf_bytes = generate_pdf(
            title=title,
            subtitle=subtitle,
            headers=headers,
            data=data,
            logo_path=None,
            orientation="landscape"
        )
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=survey_responses.pdf"}
        )

    elif format == "xlsx":
        excel_bytes = generate_excel(
            title=title,
            subtitle=subtitle,
            headers=headers,
            data=data,
            sheet_name="Survey Responses"
        )
        return Response(
            content=excel_bytes,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=survey_responses.xlsx"}
        )
