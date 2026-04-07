"""Survey Models"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Enum, JSON, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum


class FilledByType(str, enum.Enum):
    """Enum for who filled the survey"""
    sendiri = "sendiri"
    diwakilkan = "diwakilkan"


class QuestionType(str, enum.Enum):
    """Enum for question types"""
    rating = "rating"
    text = "text"
    multiple_choice = "multiple_choice"


class ServiceType(Base):
    """Model for service types"""
    __tablename__ = "service_types"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False, unique=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    survey_responses = relationship("SurveyResponse", back_populates="service_type")


class SurveyQuestion(Base):
    """Model for survey questions"""
    __tablename__ = "survey_questions"

    id = Column(Integer, primary_key=True, index=True)
    question_text = Column(Text, nullable=False)
    question_type = Column(Enum(QuestionType), default=QuestionType.rating, nullable=False)
    options = Column(JSON, nullable=True)  # For multiple choice questions
    is_required = Column(Boolean, default=True, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    order = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)


class SurveyResponse(Base):
    """Model for survey responses"""
    __tablename__ = "survey_responses"

    id = Column(Integer, primary_key=True, index=True)
    service_type_id = Column(Integer, ForeignKey("service_types.id"), nullable=False)
    filled_by = Column(Enum(FilledByType), nullable=False)
    responses = Column(JSON, nullable=False)  # {question_id: answer}
    feedback = Column(Text, nullable=True)
    submitted_at = Column(DateTime, server_default=func.now(), nullable=False)

    # Relationships
    service_type = relationship("ServiceType", back_populates="survey_responses")
