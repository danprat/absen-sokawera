// Survey Kepuasan Types

// Rating levels
export type SatisfactionRating = 'sangat_puas' | 'puas' | 'cukup_puas' | 'tidak_puas' | 'sangat_tidak_puas';

export const SATISFACTION_LABELS: Record<SatisfactionRating, string> = {
  sangat_puas: 'Sangat Puas',
  puas: 'Puas',
  cukup_puas: 'Cukup Puas',
  tidak_puas: 'Tidak Puas',
  sangat_tidak_puas: 'Sangat Tidak Puas',
};

export const SATISFACTION_ICONS: Record<SatisfactionRating, string> = {
  sangat_puas: '😊',
  puas: '🙂',
  cukup_puas: '😐',
  tidak_puas: '☹️',
  sangat_tidak_puas: '😢',
};

export const SATISFACTION_COLORS: Record<SatisfactionRating, string> = {
  sangat_puas: 'bg-green-500',
  puas: 'bg-blue-500',
  cukup_puas: 'bg-yellow-500',
  tidak_puas: 'bg-orange-500',
  sangat_tidak_puas: 'bg-red-500',
};

// Color hex untuk SVG (karena SVG tidak support Tailwind classes)
export const SATISFACTION_COLOR_HEX: Record<SatisfactionRating, string> = {
  sangat_puas: '#22c55e',
  puas: '#3b82f6',
  cukup_puas: '#eab308',
  tidak_puas: '#f97316',
  sangat_tidak_puas: '#ef4444',
};

// Jenis Layanan
export interface ServiceType {
  id: number;
  name: string;
  is_active: boolean;
  created_at: string;
}

// Survey Question
export type QuestionType = 'rating' | 'text' | 'multiple_choice';

export interface SurveyQuestion {
  id: number;
  question_text: string;
  question_type: QuestionType;
  options?: string[]; // For multiple choice
  is_required: boolean;
  is_active: boolean;
  order: number;
  created_at: string;
}

// Survey Response
export interface SurveyResponse {
  id: number;
  service_type_id: number;
  service_type_name?: string;
  filled_by: 'sendiri' | 'diwakilkan';
  responses: Record<number, string | SatisfactionRating>; // question_id -> answer
  feedback?: string;
  submitted_at: string;
}

// Form data for submitting survey
export interface SurveyFormData {
  service_type_id: number;
  filled_by: 'sendiri' | 'diwakilkan';
  responses: Record<number, string | SatisfactionRating>;
  feedback?: string;
}

// Survey Statistics
export interface SurveyStats {
  total_responses: number;
  rating_distribution: Record<SatisfactionRating, number>;
  by_service_type: {
    service_type_id: number;
    service_type_name: string;
    total: number;
    rating_distribution: Record<SatisfactionRating, number>;
  }[];
  by_filled_by: {
    sendiri: number;
    diwakilkan: number;
  };
}

// Backend response types
export interface BackendServiceType {
  id: number;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface BackendSurveyQuestion {
  id: number;
  question_text: string;
  question_type: QuestionType;
  options: string[] | null;
  is_required: boolean;
  is_active: boolean;
  order: number;
  created_at: string;
}

export interface BackendSurveyResponse {
  id: number;
  service_type_id: number;
  service_type_name: string;
  filled_by: 'sendiri' | 'diwakilkan';
  responses: Record<number, string>;
  feedback: string | null;
  submitted_at: string;
}

export interface BackendSurveyResponseList {
  items: BackendSurveyResponse[];
  total: number;
  page: number;
  per_page: number;
}

export interface BackendSurveyStats {
  total_responses: number;
  rating_distribution: Record<string, number>;
  by_service_type: {
    service_type_id: number;
    service_type_name: string;
    total: number;
    rating_distribution: Record<string, number>;
  }[];
  by_filled_by: {
    sendiri: number;
    diwakilkan: number;
  };
}

// Per-Question Stats Types
export interface TextFeedbackItem {
  response_id: number;
  answer: string;
  service_type_name: string;
  submitted_at: string;
}

export interface QuestionStatistics {
  question_id: number;
  question_text: string;
  question_type: QuestionType;
  response_count: number;
  rating_distribution?: Record<SatisfactionRating, number>;
  text_responses?: TextFeedbackItem[];
}

export interface BackendQuestionStatsResponse {
  questions: QuestionStatistics[];
  total_responses: number;
}
