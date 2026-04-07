"""Survey Schemas"""
from typing import Optional, List, Dict
from pydantic import BaseModel, Field
from datetime import datetime
from enum import Enum


class FilledByType(str, Enum):
    sendiri = "sendiri"
    diwakilkan = "diwakilkan"


class QuestionType(str, Enum):
    rating = "rating"
    text = "text"
    multiple_choice = "multiple_choice"


# ============ Service Type Schemas ============

class ServiceTypeCreate(BaseModel):
    """Schema for creating a service type"""
    name: str = Field(..., min_length=1, max_length=200)


class ServiceTypeUpdate(BaseModel):
    """Schema for updating a service type"""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    is_active: Optional[bool] = None


class ServiceTypeResponse(BaseModel):
    """Schema for service type response"""
    id: int
    name: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ServiceTypeListResponse(BaseModel):
    """Schema for service type list"""
    items: List[ServiceTypeResponse]
    total: int


# ============ Survey Question Schemas ============

class SurveyQuestionCreate(BaseModel):
    """Schema for creating a survey question"""
    question_text: str = Field(..., min_length=1)
    question_type: QuestionType = QuestionType.rating
    options: Optional[List[str]] = None
    is_required: bool = True
    order: int = 0


class SurveyQuestionUpdate(BaseModel):
    """Schema for updating a survey question"""
    question_text: Optional[str] = Field(None, min_length=1)
    question_type: Optional[QuestionType] = None
    options: Optional[List[str]] = None
    is_required: Optional[bool] = None
    is_active: Optional[bool] = None
    order: Optional[int] = None


class SurveyQuestionResponse(BaseModel):
    """Schema for survey question response"""
    id: int
    question_text: str
    question_type: QuestionType
    options: Optional[List[str]] = None
    is_required: bool
    is_active: bool
    order: int
    created_at: datetime

    class Config:
        from_attributes = True


class SurveyQuestionListResponse(BaseModel):
    """Schema for survey question list"""
    items: List[SurveyQuestionResponse]
    total: int


class ReorderQuestionsRequest(BaseModel):
    """Schema for reordering questions"""
    question_ids: List[int]


# ============ Survey Response Schemas ============

class SurveySubmit(BaseModel):
    """Schema for submitting a survey response"""
    service_type_id: int
    filled_by: FilledByType
    responses: Dict[str, str]  # {question_id: answer}
    feedback: Optional[str] = None


class SurveyResponseDetail(BaseModel):
    """Schema for survey response detail"""
    id: int
    service_type_id: int
    service_type_name: str
    filled_by: FilledByType
    responses: Dict[str, str]
    feedback: Optional[str] = None
    submitted_at: datetime

    class Config:
        from_attributes = True


class SurveyResponseListResponse(BaseModel):
    """Schema for paginated survey response list"""
    items: List[SurveyResponseDetail]
    total: int
    page: int
    per_page: int


# ============ Survey Stats Schema ============

class ServiceTypeStats(BaseModel):
    """Stats for a service type"""
    service_type_id: int
    service_type_name: str
    total: int
    rating_distribution: Dict[str, int]


class SurveyStatsResponse(BaseModel):
    """Schema for survey statistics"""
    total_responses: int
    rating_distribution: Dict[str, int]
    by_service_type: List[ServiceTypeStats]
    by_filled_by: Dict[str, int]


# ============ Per-Question Stats Schema ============

class TextFeedbackItem(BaseModel):
    """Schema for individual text feedback"""
    response_id: int
    answer: str
    service_type_name: str
    submitted_at: datetime


class QuestionStatistics(BaseModel):
    """Schema for per-question statistics"""
    question_id: int
    question_text: str
    question_type: QuestionType
    response_count: int
    rating_distribution: Optional[Dict[str, int]] = None  # For rating questions
    text_responses: Optional[List[TextFeedbackItem]] = None  # For text questions


class QuestionStatsResponse(BaseModel):
    """Schema for all question statistics"""
    questions: List[QuestionStatistics]
    total_responses: int
