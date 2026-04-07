export type AttendanceStatus = 'hadir' | 'terlambat' | 'belum' | 'izin' | 'sakit' | 'alfa';

export interface FaceEnrollment {
  id: string;
  photoUrl: string;
  capturedAt: Date;
  isVerified: boolean;
}

export interface Employee {
  id: string;
  name: string;
  position: string;
  photoUrl?: string;
  isActive: boolean;
  joinDate: string;
  phone?: string;
  email?: string;
  faceEnrollments?: FaceEnrollment[];
}

export interface AttendanceRecord {
  id: string;
  employee: Employee;
  status: AttendanceStatus;
  timestamp?: Date;
  checkOut?: Date;
  confidence?: number;
  correctedBy?: string;
  correctedAt?: Date;
  notes?: string;
}

export interface AppConfig {
  villageName: string;
  officerName: string;
  logoUrl?: string;
  primaryColor?: string;
  checkInStart: string;
  checkInEnd: string;
  lateThreshold: string;
  workingDays: number[];
  minWorkHours: number;
}

export interface ActivityLog {
  id: string;
  action: 'add_employee' | 'edit_employee' | 'delete_employee' | 'correct_attendance' | 'change_settings';
  description: string;
  performedBy: string;
  timestamp: Date;
  details?: Record<string, unknown>;
}

export interface MonthlyRecap {
  employeeId: string;
  employeeName: string;
  position: string;
  hadir: number;
  terlambat: number;
  izin: number;
  sakit: number;
  alfa: number;
  totalDays: number;
}
