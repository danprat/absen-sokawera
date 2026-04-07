"""Survey Router - Public endpoints"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional, List

from app.database import get_db
from app.models.survey import ServiceType, SurveyQuestion, SurveyResponse
from app.schemas.survey import (
    ServiceTypeResponse,
    SurveyQuestionResponse,
    SurveySubmit,
    SurveyResponseDetail,
)

router = APIRouter(prefix="/survey", tags=["Survey"])


@router.get("/service-types", response_model=List[ServiceTypeResponse])
def get_active_service_types(
    db: Session = Depends(get_db)
):
    """Get all active service types (public endpoint)"""
    service_types = db.query(ServiceType)\
        .filter(ServiceType.is_active == True)\
        .order_by(ServiceType.name)\
        .all()
    return service_types


@router.get("/questions", response_model=List[SurveyQuestionResponse])
def get_active_questions(
    db: Session = Depends(get_db)
):
    """Get all active survey questions (public endpoint)"""
    questions = db.query(SurveyQuestion)\
        .filter(SurveyQuestion.is_active == True)\
        .order_by(SurveyQuestion.order, SurveyQuestion.id)\
        .all()
    return questions


@router.post("", response_model=SurveyResponseDetail, status_code=status.HTTP_201_CREATED)
def submit_survey(
    data: SurveySubmit,
    db: Session = Depends(get_db)
):
    """Submit a survey response (public endpoint)"""
    # Verify service type exists and is active
    service_type = db.query(ServiceType)\
        .filter(ServiceType.id == data.service_type_id, ServiceType.is_active == True)\
        .first()
    
    if not service_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service type not found or inactive"
        )
    
    # Create survey response
    response = SurveyResponse(
        service_type_id=data.service_type_id,
        filled_by=data.filled_by,
        responses=data.responses,
        feedback=data.feedback
    )
    db.add(response)
    db.commit()
    db.refresh(response)
    
    return SurveyResponseDetail(
        id=response.id,
        service_type_id=response.service_type_id,
        service_type_name=service_type.name,
        filled_by=response.filled_by,
        responses=response.responses,
        feedback=response.feedback,
        submitted_at=response.submitted_at
    )
