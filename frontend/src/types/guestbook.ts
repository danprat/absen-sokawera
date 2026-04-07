// Buku Tamu Types

export interface GuestBookEntry {
  id: number;
  name: string;
  institution: string;
  purpose: string;
  visitDate: Date;
  createdAt: Date;
}

export interface GuestBookFormData {
  name: string;
  institution: string;
  meeting_target_id: number | null;
  meeting_target_manual: string;
  purpose: string;
  visit_date: string; // YYYY-MM-DD format
}

export interface BackendGuestBookMeetingTarget {
  id: number;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface BackendGuestBookMeetingTargetListResponse {
  items: BackendGuestBookMeetingTarget[];
  total: number;
}

// Backend response types
export interface BackendGuestBookEntry {
  id: number;
  name: string;
  institution: string;
  meeting_target_id: number | null;
  meeting_target_name: string;
  purpose: string;
  visit_date: string;
  created_at: string;
}

export interface BackendGuestBookListResponse {
  items: BackendGuestBookEntry[];
  total: number;
  page: number;
  per_page: number;
}
