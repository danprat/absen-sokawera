import { Employee, AttendanceRecord, AppConfig, ActivityLog, MonthlyRecap } from '@/types/attendance';

export const appConfig: AppConfig = {
  villageName: 'Desa Sukamaju',
  officerName: 'Pak Budi Santoso',
  checkInStart: '07:00',
  checkInEnd: '08:00',
  lateThreshold: '08:00',
  workingDays: [1, 2, 3, 4, 5], // Monday to Friday
  minWorkHours: 8,
};

export const employees: Employee[] = [
  { id: '1', name: 'Ahmad Wijaya', position: 'Kepala Desa', isActive: true, joinDate: '2020-01-15', phone: '081234567890', email: 'ahmad@desa.id' },
  { id: '2', name: 'Siti Nurhaliza', position: 'Sekretaris Desa', isActive: true, joinDate: '2019-03-20', phone: '081234567891', email: 'siti@desa.id' },
  { id: '3', name: 'Bambang Sutrisno', position: 'Kaur Keuangan', isActive: true, joinDate: '2018-06-10', phone: '081234567892', email: 'bambang@desa.id' },
  { id: '4', name: 'Dewi Lestari', position: 'Kaur Umum', isActive: true, joinDate: '2021-02-01', phone: '081234567893', email: 'dewi@desa.id' },
  { id: '5', name: 'Eko Prasetyo', position: 'Kasi Pemerintahan', isActive: true, joinDate: '2017-09-15', phone: '081234567894', email: 'eko@desa.id' },
  { id: '6', name: 'Fitri Handayani', position: 'Kasi Kesejahteraan', isActive: true, joinDate: '2020-07-20', phone: '081234567895', email: 'fitri@desa.id' },
  { id: '7', name: 'Gunawan Hidayat', position: 'Kasi Pelayanan', isActive: true, joinDate: '2019-11-05', phone: '081234567896', email: 'gunawan@desa.id' },
  { id: '8', name: 'Hesti Rahayu', position: 'Staf Administrasi', isActive: true, joinDate: '2022-01-10', phone: '081234567897', email: 'hesti@desa.id' },
  { id: '9', name: 'Irwan Setiawan', position: 'Staf Keuangan', isActive: false, joinDate: '2018-04-01', phone: '081234567898', email: 'irwan@desa.id' },
  { id: '10', name: 'Joko Widodo', position: 'Staf Umum', isActive: true, joinDate: '2023-03-15', phone: '081234567899', email: 'joko@desa.id' },
];

export const initialAttendanceRecords: AttendanceRecord[] = [
  {
    id: '1',
    employee: employees[0],
    status: 'hadir',
    timestamp: new Date(new Date().setHours(7, 15, 0)),
    checkOut: new Date(new Date().setHours(16, 30, 0)),
    confidence: 98.5,
  },
  {
    id: '2',
    employee: employees[1],
    status: 'hadir',
    timestamp: new Date(new Date().setHours(7, 30, 0)),
    checkOut: new Date(new Date().setHours(16, 15, 0)),
    confidence: 97.2,
  },
  {
    id: '3',
    employee: employees[2],
    status: 'terlambat',
    timestamp: new Date(new Date().setHours(8, 25, 0)),
    confidence: 96.8,
  },
  {
    id: '4',
    employee: employees[3],
    status: 'hadir',
    timestamp: new Date(new Date().setHours(7, 45, 0)),
    confidence: 99.1,
  },
  {
    id: '5',
    employee: employees[4],
    status: 'belum',
  },
  {
    id: '6',
    employee: employees[5],
    status: 'izin',
    notes: 'Keperluan keluarga',
  },
  {
    id: '7',
    employee: employees[6],
    status: 'terlambat',
    timestamp: new Date(new Date().setHours(8, 45, 0)),
    confidence: 95.3,
  },
  {
    id: '8',
    employee: employees[7],
    status: 'belum',
  },
  {
    id: '9',
    employee: employees[9],
    status: 'sakit',
    notes: 'Demam',
  },
];

export const activityLogs: ActivityLog[] = [
  {
    id: '1',
    action: 'correct_attendance',
    description: 'Koreksi absensi Eko Prasetyo dari "Belum" menjadi "Izin"',
    performedBy: 'Pak Budi Santoso',
    timestamp: new Date(Date.now() - 3600000),
  },
  {
    id: '2',
    action: 'add_employee',
    description: 'Menambahkan pegawai baru: Joko Widodo',
    performedBy: 'Pak Budi Santoso',
    timestamp: new Date(Date.now() - 86400000),
  },
  {
    id: '3',
    action: 'edit_employee',
    description: 'Mengubah status Irwan Setiawan menjadi nonaktif',
    performedBy: 'Pak Budi Santoso',
    timestamp: new Date(Date.now() - 172800000),
  },
  {
    id: '4',
    action: 'change_settings',
    description: 'Mengubah toleransi terlambat dari 08:00 menjadi 08:15',
    performedBy: 'Pak Budi Santoso',
    timestamp: new Date(Date.now() - 259200000),
  },
];

export const monthlyRecaps: MonthlyRecap[] = employees.filter(e => e.isActive).map(emp => ({
  employeeId: emp.id,
  employeeName: emp.name,
  position: emp.position,
  hadir: Math.floor(Math.random() * 5) + 17,
  terlambat: Math.floor(Math.random() * 3),
  izin: Math.floor(Math.random() * 2),
  sakit: Math.floor(Math.random() * 2),
  alfa: Math.floor(Math.random() * 2),
  totalDays: 22,
}));

// Historical attendance data for charts
export const weeklyAttendanceData = [
  { day: 'Sen', hadir: 8, terlambat: 1, tidakHadir: 1 },
  { day: 'Sel', hadir: 7, terlambat: 2, tidakHadir: 1 },
  { day: 'Rab', hadir: 9, terlambat: 1, tidakHadir: 0 },
  { day: 'Kam', hadir: 6, terlambat: 2, tidakHadir: 2 },
  { day: 'Jum', hadir: 8, terlambat: 1, tidakHadir: 1 },
];

export const monthlyAttendanceData = [
  { week: 'Minggu 1', hadir: 85, terlambat: 10, tidakHadir: 5 },
  { week: 'Minggu 2', hadir: 88, terlambat: 8, tidakHadir: 4 },
  { week: 'Minggu 3', hadir: 82, terlambat: 12, tidakHadir: 6 },
  { week: 'Minggu 4', hadir: 90, terlambat: 6, tidakHadir: 4 },
];
