"""Survey Router - Public endpoints"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.survey import ServiceType, SurveyQuestion, SurveyResponse
from app.schemas.survey import (
    ServiceTypeResponse,
    SurveyQuestionResponse,
    SurveySubmit,
    SurveySubmitResponse,
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


@router.post("", response_model=SurveySubmitResponse, status_code=status.HTTP_201_CREATED)
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

    active_questions = db.query(SurveyQuestion)\
        .filter(SurveyQuestion.is_active == True)\
        .all()
    questions_by_id = {str(question.id): question for question in active_questions}

    unknown_question_ids = [question_id for question_id in data.responses if question_id not in questions_by_id]
    if unknown_question_ids:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unknown question ids: {', '.join(sorted(unknown_question_ids))}"
        )

    normalized_responses = {}
    valid_rating_answers = {
        "sangat_puas",
        "puas",
        "cukup_puas",
        "tidak_puas",
        "sangat_tidak_puas",
    }
    low_rating_answers = {"tidak_puas", "sangat_tidak_puas"}

    for question_id, question in questions_by_id.items():
        submitted_answer = data.responses.get(question_id)

        if submitted_answer is None:
            if question.is_required:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Question {question_id} is required"
                )
            continue

        if isinstance(submitted_answer, str):
            answer = submitted_answer.strip()
            complaint = None
        else:
            answer = submitted_answer.answer.strip()
            complaint = submitted_answer.complaint

        if not answer:
            if question.is_required:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Question {question_id} is required"
                )
            continue

        question_type = question.question_type.value

        if question_type == "rating":
            if answer not in valid_rating_answers:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Question {question_id} has an invalid rating answer"
                )
        elif question_type == "multiple_choice":
            if not question.options:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Question {question_id} is misconfigured: multiple choice options are missing"
                )
            if answer not in question.options:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Question {question_id} has an invalid multiple choice answer"
                )
        elif question_type == "text":
            pass

        normalized_answer = {"answer": answer}

        if question_type == "rating" and answer in low_rating_answers:
            if not complaint:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Question {question_id} requires a complaint for low ratings"
                )
            normalized_answer["complaint"] = complaint

        normalized_responses[question_id] = normalized_answer

    # Create survey response
    response = SurveyResponse(
        service_type_id=data.service_type_id,
        filled_by=data.filled_by,
        responses=normalized_responses,
        feedback=data.feedback
    )
    db.add(response)
    db.commit()
    db.refresh(response)

    return SurveySubmitResponse(
        id=response.id,
        service_type_id=response.service_type_id,
        service_type_name=service_type.name,
        filled_by=response.filled_by,
        responses=response.responses,
        feedback=response.feedback,
        submitted_at=response.submitted_at
    )
