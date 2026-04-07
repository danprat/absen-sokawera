# Backend - Sistem Absensi Desa

FastAPI backend untuk sistem absensi pegawai desa berbasis face recognition.

## Setup

### 1. Buat Virtual Environment

```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # Linux/Mac
# atau
venv\Scripts\activate  # Windows
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Setup Database

Pastikan MySQL (XAMPP) sudah berjalan, lalu buat database:

```sql
CREATE DATABASE absen_desa CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 4. Konfigurasi Environment

```bash
cp .env.example .env
# Jika MySQL XAMPP default, DATABASE_URL bisa dibiarkan:
# mysql+pymysql://root:@localhost:3306/absen_desa
```

### 5. Buat Schema Database

```bash
python3 setup_db.py
```

### 6. Jalankan Server

```bash
uvicorn app.main:app --reload --port 8000
```

### 7. Setup Admin

Akses endpoint untuk membuat admin pertama:
```bash
curl -X POST http://localhost:8000/api/v1/auth/setup
```

Atau gunakan endpoint `POST /api/v1/auth/setup` dari Swagger/curl.

Default credentials: `admin` / `admin123`

## API Documentation

Setelah server berjalan, akses:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Endpoints

| Group | Endpoint | Method | Auth |
|-------|----------|--------|------|
| Auth | `/api/v1/auth/login` | POST | No |
| Employees | `/api/v1/employees` | GET, POST | Yes* |
| Employees | `/api/v1/employees/{id}` | GET, PATCH, DELETE | Yes* |
| Face | `/api/v1/employees/{id}/face` | GET, POST, DELETE | Yes |
| Attendance | `/api/v1/attendance/recognize` | POST | No |
| Attendance | `/api/v1/attendance/today` | GET | No |
| Admin | `/api/v1/admin/attendance` | GET, PATCH | Yes |
| Reports | `/api/v1/admin/reports/monthly` | GET | Yes |
| Reports | `/api/v1/admin/reports/export` | GET | Yes |
| Settings | `/api/v1/admin/settings` | GET, PATCH | Yes |
| Holidays | `/api/v1/admin/settings/holidays` | GET, POST, DELETE | Yes |
| Audit | `/api/v1/admin/audit-logs` | GET | Yes |

*GET employees tidak butuh auth untuk tablet display
