# Frontend-Backend Integration Guide

## 📋 Overview

Frontend React telah terintegrasi dengan Backend FastAPI untuk sistem absensi desa.

## 🗂️ File yang Dibuat/Diubah

### File Baru
1. **`src/lib/api.ts`** - API client dengan axios + JWT handling
2. **`src/hooks/useAuth.tsx`** - Auth context + protected routes
3. **`src/hooks/useEmployees.tsx`** - Custom hook untuk manage employees
4. **`src/hooks/useAttendance.tsx`** - Custom hook untuk manage attendance
5. **`src/pages/Login.tsx`** - Halaman login admin
6. **`.env`** - Environment variables untuk API URL
7. **`.env.example`** - Template environment variables

### File yang Dimodifikasi
1. **`src/App.tsx`** - Menambahkan AuthProvider, route /login, dan protected routes
2. **`src/pages/Index.tsx`** - Fetch attendance dari API
3. **`src/components/CameraView.tsx`** - Kirim foto ke API untuk face recognition
4. **`src/components/admin/AdminLayout.tsx`** - Tambah tombol logout
5. **`package.json`** - Tambah dependency axios

## 🔧 Setup & Konfigurasi

### 1. Install Dependencies
```bash
cd tap-to-attend
npm install
```

### 2. Konfigurasi Environment Variables
File `.env` sudah dibuat dengan default:
```env
VITE_API_BASE_URL=http://localhost:8000
```

Jika backend berjalan di port/host lain, edit `.env`:
```env
VITE_API_BASE_URL=http://192.168.1.100:8000
```

### 3. Pastikan Backend Running
```bash
cd ../backend
# Aktifkan virtual environment dan jalankan
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 4. Jalankan Frontend
```bash
cd tap-to-attend
npm run dev
```

Frontend akan berjalan di: http://localhost:5173

## 🔐 Authentication Flow

### Login Admin
1. Buka http://localhost:5173/login
2. Masukkan kredensial admin (sesuai dengan backend)
3. JWT token disimpan di localStorage
4. Redirect ke /admin dashboard

### Protected Routes
Semua route `/admin/*` dilindungi oleh `ProtectedRoute`:
- Jika tidak authenticated → redirect ke /login
- Jika authenticated → tampilkan content
- JWT token otomatis ditambahkan ke setiap API request

### Logout
- Klik tombol "Keluar" di sidebar admin
- Token dihapus dari localStorage
- Redirect ke /login

## 📡 API Integration

### Public Endpoints (No Auth Required)

#### 1. Face Recognition & Attendance
**Endpoint:** `POST /api/v1/attendance/recognize`

**Usage di CameraView.tsx:**
```typescript
import { api } from '@/lib/api';

// Capture image from video
const imageBase64 = captureImageAsBase64();

// Send to API
const result = await api.attendance.recognize(undefined, imageBase64);

// result contains:
// - employee_id
// - employee_name
// - position
// - status (hadir/terlambat)
// - confidence
```

#### 2. Get Today's Attendance (Public)
**Endpoint:** `GET /api/v1/attendance/today`

**Usage di Index.tsx:**
```typescript
const data = await api.attendance.today();
setRecords(data);
```

### Admin Endpoints (Auth Required)

#### 1. Employee Management

**List Employees:**
```typescript
import { useEmployees } from '@/hooks/useEmployees';

const { employees, loading, createEmployee, updateEmployee, deleteEmployee } = useEmployees();
```

**Create Employee:**
```typescript
await createEmployee({
  name: 'John Doe',
  position: 'Staff',
  phone: '081234567890',
  email: 'john@example.com',
  join_date: '2024-01-15'
});
```

**Update Employee:**
```typescript
await updateEmployee(employeeId, {
  name: 'Updated Name',
  is_active: true
});
```

**Delete Employee:**
```typescript
await deleteEmployee(employeeId);
```

#### 2. Attendance Management

**List All Attendance:**
```typescript
import { useAttendance } from '@/hooks/useAttendance';

const { records, loading, correctAttendance } = useAttendance();
```

**Correct Attendance:**
```typescript
await correctAttendance(attendanceId, {
  status: 'izin',
  notes: 'Sakit'
});
```

**Get Today's Attendance (Admin):**
```typescript
import { useTodayAttendance } from '@/hooks/useAttendance';

const { records, summary, loading } = useTodayAttendance();
// summary contains: total, hadir, terlambat, izin, sakit, alfa
```

#### 3. Reports

**Monthly Report:**
```typescript
const data = await api.admin.reports.monthly({
  month: 12,
  year: 2024
});
```

**Export CSV:**
```typescript
const blob = await api.admin.reports.export({
  start_date: '2024-01-01',
  end_date: '2024-12-31'
});

// Download file
const url = window.URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'attendance-report.csv';
a.click();
```

#### 4. Settings

**Get Settings:**
```typescript
const config = await api.admin.settings.get();
```

**Update Settings:**
```typescript
await api.admin.settings.update({
  village_name: 'Desa Sukamaju',
  late_threshold: '08:00',
  working_days: [1, 2, 3, 4, 5]
});
```

**Manage Holidays:**
```typescript
// List holidays
const holidays = await api.admin.settings.holidays.list();

// Add holiday
await api.admin.settings.holidays.create({
  date: '2024-12-25',
  description: 'Natal'
});

// Delete holiday
await api.admin.settings.holidays.delete(holidayId);
```

#### 5. Audit Logs

**Get Audit Logs:**
```typescript
const logs = await api.admin.auditLogs.list();
```

## 🧪 Testing Integration

### 1. Test Public Attendance Page
```bash
# Terminal 1: Backend
cd backend
uvicorn app.main:app --reload

# Terminal 2: Frontend
cd tap-to-attend
npm run dev
```

1. Buka http://localhost:5173
2. Kamera akan meminta izin akses
3. Arahkan wajah ke kamera
4. Sistem akan auto-capture dan kirim ke backend
5. Jika wajah dikenali, tampil dialog konfirmasi
6. Konfirmasi untuk absen
7. Check tab "Daftar Hadir" untuk melihat data dari API

### 2. Test Admin Login & Dashboard
1. Buka http://localhost:5173/login
2. Login dengan kredensial admin backend
3. Verify redirect ke /admin dashboard
4. Check semua halaman admin (pegawai, absensi, riwayat, dll)
5. Test logout

### 3. Test Protected Routes
1. Buka http://localhost:5173/admin (tanpa login)
2. Verify redirect ke /login
3. Login
4. Verify bisa akses /admin

## 🔍 Debugging Tips

### Check API Calls in Browser DevTools
1. Buka DevTools (F12)
2. Tab Network
3. Filter: XHR
4. Lihat request/response untuk setiap API call

### Check Auth Token
```javascript
// Di browser console
localStorage.getItem('auth_token')
```

### Check API Base URL
```javascript
// Di browser console
console.log(import.meta.env.VITE_API_BASE_URL)
```

### Common Issues

**Issue: API call gagal dengan CORS error**
- Pastikan backend CORS sudah configure untuk `http://localhost:5173`
- Check backend logs

**Issue: 401 Unauthorized**
- Token expired atau invalid
- Logout dan login ulang
- Check token di localStorage

**Issue: Face recognition gagal**
- Check backend logs untuk error detail
- Pastikan face encodings sudah disetup di backend
- Check image quality dari kamera

## 📝 Migration dari Mock Data ke API

### Untuk Admin Pages yang Masih Pakai Mock Data

Contoh migrasi AdminPegawai.tsx:

**Sebelum (Mock Data):**
```typescript
import { employees as initialEmployees } from '@/data/mockData';
const [employees, setEmployees] = useState(initialEmployees);
```

**Sesudah (API):**
```typescript
import { useEmployees } from '@/hooks/useEmployees';

const { employees, loading, createEmployee, updateEmployee, deleteEmployee } = useEmployees();

// Tampilkan loading state
if (loading) return <div>Loading...</div>;

// Gunakan fungsi dari hook
await createEmployee(data);
await updateEmployee(id, data);
await deleteEmployee(id);
```

### Admin Pages yang Perlu Dimigrasi

1. **AdminPegawai.tsx** - Gunakan `useEmployees()`
2. **AdminAbsensi.tsx** - Gunakan `useTodayAttendance()`
3. **AdminRiwayat.tsx** - Gunakan `useAttendance()` atau `api.admin.reports.monthly()`
4. **AdminPengaturan.tsx** - Gunakan `api.admin.settings.*`
5. **AdminLog.tsx** - Gunakan `api.admin.auditLogs.list()`
6. **AdminDashboard.tsx** - Kombinasi dari beberapa API calls

## 🚀 Build untuk Production

```bash
# Build production
npm run build

# Preview build
npm run preview

# Build output di folder: dist/
```

Deploy `dist/` folder ke hosting (Vercel, Netlify, dll)

Jangan lupa update `VITE_API_BASE_URL` untuk production:
```env
VITE_API_BASE_URL=https://api.your-domain.com
```

## 📚 Additional Resources

- **API Documentation:** Check backend `/docs` endpoint (http://localhost:8000/docs)
- **TypeScript Types:** Defined in `src/types/attendance.ts`
- **API Client:** `src/lib/api.ts` - All endpoints documented with JSDoc
- **Auth Hook:** `src/hooks/useAuth.tsx` - Auth context usage
- **Custom Hooks:** `src/hooks/useEmployees.tsx`, `src/hooks/useAttendance.tsx`

## 🎯 Next Steps

1. Migrate remaining admin pages dari mock data ke API
2. Add error boundaries untuk better error handling
3. Add loading skeletons untuk better UX
4. Add retry logic untuk failed API calls
5. Add offline mode dengan service workers
6. Add real-time updates dengan WebSockets (opsional)

---

**Integration completed by:** Dany Pratmanto  
**Date:** 2024-12-16
