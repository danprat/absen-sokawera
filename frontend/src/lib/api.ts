import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { createFaceOperationUrl } from './faceOrchestratorRoutes.mjs';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://aysyhhzfmigjsryaoizu.supabase.co/functions/v1/app-api';
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '';
export const FACE_ORCHESTRATOR_URL = import.meta.env.VITE_FACE_ORCHESTRATOR_URL || `${API_BASE_URL}/api/v1`;

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

const TOKEN_KEY = 'access_token';
const MAX_TRANSIENT_RETRIES = 2;

type RetryableRequestConfig = InternalAxiosRequestConfig & {
  _retryCount?: number;
};

const getAccessToken = (): string | null => localStorage.getItem(TOKEN_KEY);

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const isTransientApiError = (error: AxiosError): boolean => {
  return (
    error.code === 'ERR_NETWORK' ||
    error.code === 'ECONNABORTED' ||
    error.response?.status === 503
  );
};

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetryableRequestConfig | undefined;

    if (config && isTransientApiError(error)) {
      config._retryCount = config._retryCount || 0;

      if (config._retryCount < MAX_TRANSIENT_RETRIES) {
        config._retryCount += 1;
        await wait(300 * config._retryCount);
        return apiClient.request(config);
      }
    }

    if (error.response?.status === 401) {
      // Only redirect if NOT checking auth status (/me endpoint)
      // and NOT already on login page
      const isCheckingAuth = error.config?.url?.includes('/auth/me');
      const isLoginPage = window.location.pathname.includes('/login');

      if (!isCheckingAuth && !isLoginPage) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Backend response types (matching actual backend schemas)
export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  role: string;
}

// Backend Employee response
export interface BackendEmployee {
  id: number;
  nik: string | null;  // NIK (Nomor Induk Kependudukan)
  name: string;
  position: string;
  phone: string | null;
  address: string | null;  // Alamat rumah
  photo_url: string | null;
  is_active: boolean;
  face_count: number;
  created_at: string;
  updated_at: string;
}

// Backend attendance today item
export interface BackendAttendanceTodayItem {
  id: number;
  employee_id: number;
  employee_name: string;
  employee_position: string;
  employee_photo: string | null;
  check_in_at: string | null;
  check_out_at: string | null;
  status: 'hadir' | 'terlambat' | 'izin' | 'sakit' | 'alfa';
}

export interface BackendAttendanceTodayResponse {
  items: BackendAttendanceTodayItem[];
  total: number;
}

// Backend recognize response
export interface BackendRecognizeResponse {
  employee: {
    id: number;
    name: string;
    position: string;
    photo: string | null;
  };
  attendance: {
    id: number;
    status: string;
    check_in_at: string | null;
    check_out_at: string | null;
  } | null;  // Optional: null when just recognizing face
  message: string;
  confidence: number;
  attendance_status?: 'belum_absen' | 'sudah_check_in' | 'sudah_lengkap';
}

// Backend employee list response
export interface BackendEmployeeListResponse {
  items: BackendEmployee[];
  total: number;
  page: number;
  page_size: number;
}

// Backend work settings
export interface BackendWorkSettings {
  id: number;
  village_name: string;
  officer_name: string | null;
  logo_url: string | null;
  background_url: string | null;
  check_in_start: string;
  check_in_end: string;
  late_threshold_minutes: number;
  check_out_start: string;
  min_work_hours: number;
  face_similarity_threshold: number;
  updated_at: string;
}

// Backend daily schedule
export interface BackendDailySchedule {
  id: number;
  day_of_week: number;  // 0=Monday, 6=Sunday
  is_workday: boolean;
  check_in_start: string;
  check_in_end: string;
  check_out_start: string;
  updated_at: string;
}

// Backend holiday
export interface BackendHoliday {
  id: number;
  date: string;
  name: string;
  is_auto: boolean;
  is_cuti: boolean;
  created_at: string;
}

export interface BackendHolidaySyncResponse {
  added: number;
  updated: number;
  skipped: number;
  message: string;
}

export interface BackendHolidayListResponse {
  items: BackendHoliday[];
  total: number;
}

// Backend audit log
export interface BackendAuditLog {
  id: number;
  action: string;
  entity_type: string;
  entity_id: number | null;
  description: string;
  performed_by: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface BackendAuditLogListResponse {
  items: BackendAuditLog[];
  total: number;
  page: number;
  page_size: number;
}

// Backend admin management
export interface BackendAdmin {
  id: number;
  username: string;
  name: string;
  role: 'admin' | 'kepala_desa';
  created_at: string;
  updated_at: string;
}

export interface BackendAdminListResponse {
  items: BackendAdmin[];
  total: number;
}

export interface BackendAdminCreate {
  username: string;
  name: string;
  password: string;
  role: 'admin' | 'kepala_desa';
}

export interface BackendAdminUpdate {
  username?: string;
  name?: string;
  role?: 'admin' | 'kepala_desa';
}

// Backend monthly report
export interface BackendMonthlyReportItem {
  employee_id: number;
  employee_name: string;
  employee_nik: string | null;  // NIK (Nomor Induk Kependudukan)
  employee_position: string;
  total_days: number;
  present_days: number;
  late_days: number;
  absent_days: number;
  leave_days: number;
  sick_days: number;
  checkout_days: number;
  attendance_percentage: number;
}

export interface BackendMonthlyReportResponse {
  month: number;
  year: number;
  items: BackendMonthlyReportItem[];
  total_employees: number;
}

// Backend attendance admin today
export interface BackendAttendanceSummary {
  total_employees: number;
  present: number;
  late: number;
  absent: number;
  on_leave: number;
  sick: number;
}

export interface BackendAttendanceTodayAdminResponse {
  items: BackendAttendanceTodayItem[];
  summary: BackendAttendanceSummary;
}

// Face embedding types
export interface BackendFaceEmbedding {
  id: number;
  employee_id: number;
  photo_url: string;
  is_primary: boolean;
  created_at: string;
}

export interface BackendFaceUploadResponse {
  id: number;
  photo_url: string;
  message: string;
}

// Public settings types
export interface PublicTodaySchedule {
  is_workday: boolean;
  check_in_start: string;
  check_in_end: string;
  check_out_start: string;
}

export interface PublicSettingsResponse {
  village_name: string;
  officer_name: string | null;
  logo_url: string | null;
  background_url: string | null;
  today_schedule: PublicTodaySchedule | null;
}

export const api = {
  auth: {
    login: async (credentials: LoginRequest): Promise<LoginResponse> => {
      const formData = new URLSearchParams();
      formData.append('username', credentials.username);
      formData.append('password', credentials.password);

      const response = await apiClient.post<LoginResponse>('/api/v1/auth/login', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      return response.data;
    },

    setup: async (): Promise<{ message: string; username: string; password: string }> => {
      const response = await apiClient.post('/api/v1/auth/setup');
      return response.data;
    },

    logout: async (): Promise<{ message: string }> => {
      const response = await apiClient.post<{ message: string }>('/api/v1/auth/logout');
      return response.data;
    },

    getCurrentUser: async (): Promise<{ username: string; role: string; name: string }> => {
      const response = await apiClient.get<{ username: string; role: string; name: string }>('/api/v1/auth/me');
      return response.data;
    },

    changePassword: async (data: { current_password: string; new_password: string; confirm_password: string }): Promise<{ message: string }> => {
      const response = await apiClient.patch('/api/v1/auth/change-password', data);
      return response.data;
    },
  },

  employees: {
    list: async (params?: { search?: string; page?: number; page_size?: number; is_active?: boolean }): Promise<BackendEmployeeListResponse> => {
      const response = await apiClient.get<BackendEmployeeListResponse>('/api/v1/employees', { params });
      return response.data;
    },

    get: async (id: number): Promise<BackendEmployee> => {
      const response = await apiClient.get<BackendEmployee>(`/api/v1/employees/${id}`);
      return response.data;
    },

    create: async (data: { name: string; position: string; nik?: string; phone?: string; address?: string }): Promise<BackendEmployee> => {
      const response = await apiClient.post<BackendEmployee>('/api/v1/employees', data);
      return response.data;
    },

    update: async (id: number, data: Partial<{ name: string; position: string; nik: string; phone: string; address: string; is_active: boolean }>): Promise<BackendEmployee> => {
      const response = await apiClient.patch<BackendEmployee>(`/api/v1/employees/${id}`, data);
      return response.data;
    },

    delete: async (id: number): Promise<void> => {
      await apiClient.delete(`/api/v1/employees/${id}`);
    },

    // Face enrollment
    face: {
      list: async (employeeId: number): Promise<BackendFaceEmbedding[]> => {
      const response = await apiClient.get<BackendFaceEmbedding[]>(
        createFaceOperationUrl(FACE_ORCHESTRATOR_URL, `/employees/${employeeId}/face`)
      );
        return response.data;
      },

      upload: async (employeeId: number, file: File): Promise<BackendFaceUploadResponse> => {
        const formData = new FormData();
        formData.append('file', file);

        const response = await apiClient.post<BackendFaceUploadResponse>(
          createFaceOperationUrl(FACE_ORCHESTRATOR_URL, `/employees/${employeeId}/face`),
          formData,
          { headers: { 'Content-Type': 'multipart/form-data' } }
        );
        return response.data;
      },

      delete: async (employeeId: number, faceId: number): Promise<void> => {
        await apiClient.delete(createFaceOperationUrl(FACE_ORCHESTRATOR_URL, `/employees/${employeeId}/face/${faceId}`));
      },
    },
  },

  public: {
    settings: async (): Promise<PublicSettingsResponse> => {
      const response = await apiClient.get<PublicSettingsResponse>('/api/v1/public/settings');
      return response.data;
    },
  },

  attendance: {
    recognize: async (imageFile?: File, imageBase64?: string): Promise<BackendRecognizeResponse> => {
      const formData = new FormData();

      if (imageFile) {
        formData.append('file', imageFile);
      } else if (imageBase64) {
        formData.append('image_base64', imageBase64);
      } else {
        throw new Error('Either imageFile or imageBase64 must be provided');
      }

      const response = await apiClient.post<BackendRecognizeResponse>(
        createFaceOperationUrl(FACE_ORCHESTRATOR_URL, '/attendance/recognize'),
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      return response.data;
    },

    confirm: async (employeeId: number, confidence: number): Promise<BackendRecognizeResponse> => {
      const formData = new FormData();
      formData.append('employee_id', employeeId.toString());
      formData.append('confidence', confidence.toString());

      const response = await apiClient.post<BackendRecognizeResponse>(
        createFaceOperationUrl(FACE_ORCHESTRATOR_URL, '/attendance/confirm'),
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      return response.data;
    },

    today: async (): Promise<BackendAttendanceTodayResponse> => {
      const response = await apiClient.get<BackendAttendanceTodayResponse>('/api/v1/attendance/today');
      return response.data;
    },
  },

  admin: {
    attendance: {
      list: async (params?: { employee_id?: number; start_date?: string; end_date?: string; status?: string; page?: number; page_size?: number }) => {
        const response = await apiClient.get('/api/v1/admin/attendance', { params });
        return response.data;
      },

      correct: async (id: number, data: { status?: string; check_in_at?: string; check_out_at?: string; correction_notes?: string }) => {
        const response = await apiClient.patch(`/api/v1/admin/attendance/${id}`, data);
        return response.data;
      },

      today: async (): Promise<BackendAttendanceTodayAdminResponse> => {
        const response = await apiClient.get<BackendAttendanceTodayAdminResponse>('/api/v1/admin/attendance/today');
        return response.data;
      },
    },

    reports: {
      monthly: async (params: { month: number; year: number }): Promise<BackendMonthlyReportResponse> => {
        const response = await apiClient.get<BackendMonthlyReportResponse>('/api/v1/admin/reports/monthly', { params });
        return response.data;
      },

      export: async (params: { month: number; year: number; format?: 'csv' | 'pdf' | 'xlsx' }): Promise<Blob> => {
        const response = await apiClient.get('/api/v1/admin/reports/export', {
          params,
          responseType: 'blob',
        });
        return response.data;
      },
    },

    settings: {
      get: async (): Promise<BackendWorkSettings> => {
        const response = await apiClient.get<BackendWorkSettings>('/api/v1/admin/settings');
        return response.data;
      },

      update: async (data: Partial<{
        village_name: string;
        officer_name: string;
        logo_url: string;
        check_in_start: string;
        check_in_end: string;
        late_threshold_minutes: number;
        check_out_start: string;
        min_work_hours: number;
        face_similarity_threshold: number;
      }>): Promise<BackendWorkSettings> => {
        const response = await apiClient.patch<BackendWorkSettings>('/api/v1/admin/settings', data);
        return response.data;
      },

      uploadLogo: async (file: File): Promise<{ message: string; logo_url: string }> => {
        const formData = new FormData();
        formData.append('file', file);
        const response = await apiClient.post('/api/v1/admin/settings/logo', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        return response.data;
      },

      deleteLogo: async (): Promise<{ message: string }> => {
        const response = await apiClient.delete('/api/v1/admin/settings/logo');
        return response.data;
      },

      uploadBackground: async (file: File): Promise<{ message: string; background_url: string }> => {
        const formData = new FormData();
        formData.append('file', file);
        const response = await apiClient.post('/api/v1/admin/settings/background', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        return response.data;
      },

      deleteBackground: async (): Promise<{ message: string }> => {
        const response = await apiClient.delete('/api/v1/admin/settings/background');
        return response.data;
      },

      holidays: {
        list: async (params?: { year?: number }): Promise<BackendHolidayListResponse> => {
          const response = await apiClient.get<BackendHolidayListResponse>('/api/v1/admin/settings/holidays', { params });
          return response.data;
        },

        listExcluded: async (params?: { year?: number }): Promise<BackendHolidayListResponse> => {
          const response = await apiClient.get<BackendHolidayListResponse>('/api/v1/admin/settings/holidays/excluded', { params });
          return response.data;
        },

        create: async (data: { date: string; name: string }): Promise<BackendHoliday> => {
          const response = await apiClient.post<BackendHoliday>('/api/v1/admin/settings/holidays', data);
          return response.data;
        },

        delete: async (id: number): Promise<void> => {
          await apiClient.delete(`/api/v1/admin/settings/holidays/${id}`);
        },

        restore: async (id: number): Promise<BackendHoliday> => {
          const response = await apiClient.post<BackendHoliday>(`/api/v1/admin/settings/holidays/${id}/restore`);
          return response.data;
        },

        sync: async (year?: number): Promise<BackendHolidaySyncResponse> => {
          const response = await apiClient.post<BackendHolidaySyncResponse>('/api/v1/admin/settings/holidays/sync', null, { params: { year } });
          return response.data;
        },
      },

      schedules: {
        list: async (): Promise<BackendDailySchedule[]> => {
          const response = await apiClient.get<BackendDailySchedule[]>('/api/v1/admin/settings/schedules');
          return response.data;
        },

        update: async (schedules: Array<{
          day_of_week: number;
          is_workday: boolean;
          check_in_start: string;
          check_in_end: string;
          check_out_start: string;
        }>): Promise<BackendDailySchedule[]> => {
          const response = await apiClient.patch<BackendDailySchedule[]>('/api/v1/admin/settings/schedules', { schedules });
          return response.data;
        },
      },
    },

    auditLogs: {
      list: async (params?: {
        action?: string;
        entity_type?: string;
        search?: string;
        start_date?: string;
        end_date?: string;
        page?: number;
        page_size?: number
      }): Promise<BackendAuditLogListResponse> => {
        const response = await apiClient.get<BackendAuditLogListResponse>('/api/v1/admin/audit-logs', { params });
        return response.data;
      },
    },

    admins: {
      list: async (): Promise<BackendAdminListResponse> => {
        const response = await apiClient.get<BackendAdminListResponse>('/api/v1/admin/admins');
        return response.data;
      },

      create: async (data: BackendAdminCreate): Promise<BackendAdmin> => {
        const response = await apiClient.post<BackendAdmin>('/api/v1/admin/admins', data);
        return response.data;
      },

      update: async (id: number, data: BackendAdminUpdate): Promise<BackendAdmin> => {
        const response = await apiClient.patch<BackendAdmin>(`/api/v1/admin/admins/${id}`, data);
        return response.data;
      },

      delete: async (id: number): Promise<void> => {
        await apiClient.delete(`/api/v1/admin/admins/${id}`);
      },
    },

    guestBook: {
      list: async (params?: {
        start_date?: string;
        end_date?: string;
        search?: string;
        page?: number;
        per_page?: number;
      }): Promise<BackendGuestBookListResponse> => {
        const response = await apiClient.get<BackendGuestBookListResponse>('/api/v1/admin/guest-book', { params });
        return response.data;
      },

      meetingTargets: {
        list: async (): Promise<BackendGuestBookMeetingTarget[]> => {
          const response = await apiClient.get<BackendGuestBookMeetingTargetListResponse>('/api/v1/admin/guest-book/meeting-targets');
          return response.data.items;
        },

        create: async (data: { name: string }): Promise<BackendGuestBookMeetingTarget> => {
          const response = await apiClient.post<BackendGuestBookMeetingTarget>('/api/v1/admin/guest-book/meeting-targets', data);
          return response.data;
        },

        update: async (id: number, data: { name?: string; is_active?: boolean }): Promise<BackendGuestBookMeetingTarget> => {
          const response = await apiClient.patch<BackendGuestBookMeetingTarget>(`/api/v1/admin/guest-book/meeting-targets/${id}`, data);
          return response.data;
        },

        delete: async (id: number): Promise<void> => {
          await apiClient.delete(`/api/v1/admin/guest-book/meeting-targets/${id}`);
        },
      },

      export: async (params?: {
        start_date?: string;
        end_date?: string;
        format?: 'csv' | 'pdf' | 'xlsx';
      }): Promise<Blob> => {
        const response = await apiClient.get('/api/v1/admin/guest-book/export', {
          params,
          responseType: 'blob',
        });
        return response.data;
      },

      delete: async (id: number): Promise<void> => {
        await apiClient.delete(`/api/v1/admin/guest-book/${id}`);
      },
    },

    survey: {
      // Service Types Management
      serviceTypes: {
        list: async (includeInactive?: boolean): Promise<BackendServiceType[]> => {
          const response = await apiClient.get<{ items: BackendServiceType[]; total: number }>('/api/v1/admin/survey/service-types', {
            params: { include_inactive: includeInactive },
          });
          return response.data.items;
        },

        create: async (data: { name: string }): Promise<BackendServiceType> => {
          const response = await apiClient.post<BackendServiceType>('/api/v1/admin/survey/service-types', data);
          return response.data;
        },

        update: async (id: number, data: { name?: string; is_active?: boolean }): Promise<BackendServiceType> => {
          const response = await apiClient.patch<BackendServiceType>(`/api/v1/admin/survey/service-types/${id}`, data);
          return response.data;
        },

        delete: async (id: number): Promise<void> => {
          await apiClient.delete(`/api/v1/admin/survey/service-types/${id}`);
        },
      },

      // Survey Questions Management
      questions: {
        list: async (includeInactive?: boolean): Promise<BackendSurveyQuestion[]> => {
          const response = await apiClient.get<{ items: BackendSurveyQuestion[]; total: number }>('/api/v1/admin/survey/questions', {
            params: { include_inactive: includeInactive },
          });
          return response.data.items;
        },

        create: async (data: {
          question_text: string;
          question_type: 'rating' | 'text' | 'multiple_choice';
          options?: string[];
          is_required?: boolean;
        }): Promise<BackendSurveyQuestion> => {
          const response = await apiClient.post<BackendSurveyQuestion>('/api/v1/admin/survey/questions', data);
          return response.data;
        },

        update: async (id: number, data: {
          question_text?: string;
          options?: string[];
          is_required?: boolean;
          is_active?: boolean;
          order?: number;
        }): Promise<BackendSurveyQuestion> => {
          const response = await apiClient.patch<BackendSurveyQuestion>(`/api/v1/admin/survey/questions/${id}`, data);
          return response.data;
        },

        reorder: async (questionIds: number[]): Promise<void> => {
          await apiClient.post('/api/v1/admin/survey/questions/reorder', { question_ids: questionIds });
        },

        delete: async (id: number): Promise<void> => {
          await apiClient.delete(`/api/v1/admin/survey/questions/${id}`);
        },
      },

      // Survey Responses
      responses: {
        list: async (params?: {
          service_type_id?: number;
          start_date?: string;
          end_date?: string;
          page?: number;
          per_page?: number;
        }): Promise<BackendSurveyResponseList> => {
          const response = await apiClient.get<BackendSurveyResponseList>('/api/v1/admin/survey/responses', { params });
          return response.data;
        },

        stats: async (params?: {
          start_date?: string;
          end_date?: string;
          service_type_id?: number;
        }): Promise<BackendSurveyStats> => {
          const response = await apiClient.get<BackendSurveyStats>('/api/v1/admin/survey/stats', { params });
          return response.data;
        },

        questionStats: async (params?: {
          start_date?: string;
          end_date?: string;
          service_type_id?: number;
        }): Promise<BackendQuestionStatsResponse> => {
          const response = await apiClient.get<BackendQuestionStatsResponse>('/api/v1/admin/survey/stats/questions', { params });
          return response.data;
        },

        export: async (params?: {
          start_date?: string;
          end_date?: string;
          service_type_id?: number;
          format?: 'csv' | 'pdf' | 'xlsx';
        }): Promise<Blob> => {
          const response = await apiClient.get('/api/v1/admin/survey/export', {
            params,
            responseType: 'blob',
          });
          return response.data;
        },
      },
    },
  },

  // Public Guest Book endpoint
  guestBook: {
    getMeetingTargets: async (): Promise<BackendGuestBookMeetingTarget[]> => {
      const response = await apiClient.get<BackendGuestBookMeetingTargetListResponse>('/api/v1/guestbook/meeting-targets');
      return response.data.items;
    },

    submit: async (data: {
      name: string;
      institution: string;
      meeting_target_id: number | null;
      meeting_target_manual: string;
      purpose: string;
      visit_date: string;
    }): Promise<{ message: string; id: number }> => {
      const response = await apiClient.post<{ message: string; id: number }>('/api/v1/guestbook', data);
      return response.data;
    },
  },

  // Public Survey endpoints
  survey: {
    getServiceTypes: async (): Promise<BackendServiceType[]> => {
      const response = await apiClient.get<BackendServiceType[]>('/api/v1/survey/service-types');
      return response.data;
    },

    getQuestions: async (): Promise<BackendSurveyQuestion[]> => {
      const response = await apiClient.get<BackendSurveyQuestion[]>('/api/v1/survey/questions');
      return response.data;
    },

    submit: async (data: {
      service_type_id: number;
      filled_by: 'sendiri' | 'diwakilkan';
      responses: Record<number, SurveyQuestionResponse>;
      feedback?: string;
    }): Promise<{ message: string; id: number }> => {
      const response = await apiClient.post<{ message: string; id: number }>('/api/v1/survey', data);
      return response.data;
    },
  },
};

// Import types for API
import type { BackendGuestBookListResponse, BackendGuestBookMeetingTarget, BackendGuestBookMeetingTargetListResponse } from '@/types/guestbook';
import type { BackendServiceType, BackendSurveyQuestion, BackendSurveyResponseList, BackendSurveyStats, BackendQuestionStatsResponse, SurveyQuestionResponse } from '@/types/survey';

export default api;
