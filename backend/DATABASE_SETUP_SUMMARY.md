# Database Setup Summary - Sistem Absensi Desa

## Status: ✅ COMPLETED SUCCESSFULLY

Setup dilakukan pada: **2025-12-16 12:19 WIB**

---

## 1. Database Creation

**Database:** `absen_desa`
- **Engine:** MySQL via XAMPP
- **Character Set:** utf8mb4
- **Collation:** utf8mb4_unicode_ci
- **Connection String:** `mysql+pymysql://root:@localhost:3306/absen_desa`

---

## 2. Tables Created

Semua 7 tables berhasil dibuat dengan struktur lengkap:

| No | Table Name | Rows | Size | Status |
|----|------------|------|------|--------|
| 1 | `admins` | 1 | 48 KB | ✅ |
| 2 | `employees` | 0 | 48 KB | ✅ |
| 3 | `face_embeddings` | 0 | 64 KB | ✅ |
| 4 | `attendance_logs` | 0 | 80 KB | ✅ |
| 5 | `work_settings` | 0 | 32 KB | ✅ |
| 6 | `holidays` | 0 | 48 KB | ✅ |
| 7 | `audit_logs` | 0 | 48 KB | ✅ |

---

## 3. Table Structures

### 3.1 admins
- `id` (PK, auto_increment)
- `username` (unique, varchar(50))
- `password_hash` (varchar(255))
- `name` (varchar(100))
- `created_at`, `updated_at` (datetime)

### 3.2 employees
- `id` (PK, auto_increment)
- `nip` (unique, varchar(50), nullable)
- `name`, `position` (varchar(100))
- `phone`, `email`, `photo_url` (nullable)
- `is_active` (boolean)
- `created_at`, `updated_at` (datetime)

### 3.3 face_embeddings
- `id` (PK, auto_increment)
- `employee_id` (FK to employees)
- `embedding` (blob)
- `photo_url` (varchar(500))
- `is_primary` (boolean)
- `created_at` (datetime)

### 3.4 attendance_logs
- `id` (PK, auto_increment)
- `employee_id` (FK to employees)
- `date` (date, indexed)
- `check_in_at`, `check_out_at` (datetime, nullable)
- `status` (enum: HADIR, TERLAMBAT, IZIN, SAKIT, ALFA)
- `confidence_score` (float, nullable)
- `corrected_by`, `correction_notes` (nullable)
- `created_at`, `updated_at` (datetime)

### 3.5 work_settings
- `id` (PK, auto_increment)
- `village_name` (varchar(200))
- `officer_name`, `logo_url` (nullable)
- `check_in_start`, `check_in_end`, `check_out_start` (time)
- `late_threshold_minutes` (int)
- `min_work_hours` (float)
- `updated_at` (datetime)

### 3.6 holidays
- `id` (PK, auto_increment)
- `date` (date, unique)
- `name` (varchar(200))
- `created_at` (datetime)

### 3.7 audit_logs
- `id` (PK, auto_increment)
- `action` (enum: CREATE, UPDATE, DELETE, CORRECT)
- `entity_type` (enum: EMPLOYEE, ATTENDANCE, SETTINGS, HOLIDAY)
- `entity_id` (int, nullable)
- `description` (varchar(500))
- `performed_by` (varchar(100))
- `details` (json/longtext, nullable)
- `created_at` (datetime, indexed)

---

## 4. Admin Account

✅ **Admin default berhasil dibuat:**

| Field | Value |
|-------|-------|
| ID | 1 |
| Username | `admin` |
| Password | `admin123` |
| Name | Administrator |
| Created At | 2025-12-16 12:19:21 |

⚠️ **PENTING:** Segera ganti password default setelah login pertama!

---

## 5. Configuration Files

### 5.1 `.env` File
File `.env` sudah dibuat di `/backend/.env` dengan konfigurasi:
- Database URL: `mysql+pymysql://root:@localhost:3306/absen_desa`
- JWT Settings: SECRET_KEY (ganti di production!)
- CORS Origins: localhost:5173, localhost:3000
- Face Recognition: Disabled (untuk development)

### 5.2 Python Dependencies
Semua dependencies berhasil diinstall:
- FastAPI 0.109.2
- SQLAlchemy 2.0.25
- PyMySQL 1.1.0
- Alembic 1.13.1
- Passlib + Bcrypt (4.1.3 untuk kompatibilitas Python 3.9)
- Dan lainnya sesuai `requirements.txt`

---

## 6. Compatibility Fixes

### 6.1 Python 3.9 Type Hints
Fixed union type syntax untuk kompatibilitas Python 3.9:
- `str | None` → `Optional[str]`
- `list[Model]` → `List[Model]`
- `tuple[A | None, B]` → `Tuple[Optional[A], B]`

Files yang diperbaiki:
- All schema files (`app/schemas/*.py`)
- Service files (`app/services/*.py`)
- Utility files (`app/utils/*.py`)
- Router files (`app/routers/*.py`)

### 6.2 Bcrypt Version
Downgrade bcrypt dari 5.0.0 ke 4.1.3 untuk kompatibilitas dengan passlib.

---

## 7. Database Connection Test

✅ **Connection successful:**
```
Database connection: ✓ OK
Tables creation: ✓ OK
Admin setup: ✓ OK
```

---

## 8. Next Steps

### 8.1 Start Development Server
```bash
cd /Users/danypratmanto/Documents/GitHub/ABSEN-DESA/backend
uvicorn app.main:app --reload
```

### 8.2 Access API Documentation
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
- Health Check: http://localhost:8000/health

### 8.3 Login Admin
**Endpoint:** `POST /api/v1/auth/login`
```json
{
  "username": "admin",
  "password": "admin123"
}
```

### 8.4 Setup Work Settings
Create default work settings via admin panel:
- Village name
- Check-in times (default: 06:00 - 12:00)
- Late threshold (default: 15 minutes)
- Minimum work hours (default: 7.5 hours)

### 8.5 Add Employees
Start adding employees via `POST /api/v1/employees`

---

## 9. Database Maintenance

### 9.1 Backup Database
```bash
/Applications/XAMPP/xamppfiles/bin/mysqldump -u root absen_desa > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 9.2 Restore Database
```bash
/Applications/XAMPP/xamppfiles/bin/mysql -u root absen_desa < backup_file.sql
```

### 9.3 View Tables
```bash
/Applications/XAMPP/xamppfiles/bin/mysql -u root absen_desa -e "SHOW TABLES;"
```

---

## 10. Security Notes

🔒 **Before Production:**
1. Change `SECRET_KEY` in `.env` to a strong random key
2. Change admin password from default `admin123`
3. Enable HTTPS/SSL
4. Set `DEBUG=false` in `.env`
5. Update CORS origins to production domains
6. Enable face recognition service
7. Set up regular database backups
8. Review and secure MySQL user permissions

---

## Summary

✅ Database `absen_desa` created successfully  
✅ All 7 tables created with proper schema  
✅ Admin account setup completed  
✅ Database connection verified  
✅ Python 3.9 compatibility fixed  
✅ All dependencies installed  
✅ Ready for development!

**Status:** System ready untuk development dan testing lokal.
