# Local MySQL XAMPP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menjalankan backend FastAPI ini di MySQL lokal XAMPP dengan schema baru yang bersih, konfigurasi environment yang jelas, dan admin awal yang siap dipakai.

**Architecture:** Backend sudah memakai SQLAlchemy + PyMySQL dan membaca `DATABASE_URL` dari settings, jadi implementasi fokus pada konfigurasi environment lokal dan bootstrap schema, bukan perubahan arsitektur database. Table creation tetap memakai `Base.metadata.create_all(...)` saat startup dan `setup_db.py` dipakai sebagai jalur bootstrap/verifikasi eksplisit untuk setup lokal pertama.

**Tech Stack:** FastAPI, SQLAlchemy 2.x, PyMySQL, Pydantic Settings, MySQL (XAMPP)

---

## File Structure

- Create: `backend/.env.example` — template environment lokal untuk MySQL XAMPP dan variabel runtime backend.
- Modify: `backend/README.md:23-51` — rapikan instruksi setup database lokal supaya cocok dengan `.env.example` dan flow `setup_db.py`.
- Modify: `backend/setup_db.py:35-40` — sinkronkan daftar tabel yang diverifikasi dengan model yang benar-benar terdaftar di app.
- Verify only: `backend/app/config.py:5-30` — pastikan fallback `DATABASE_URL` tetap ke MySQL XAMPP lokal.
- Verify only: `backend/app/main.py:69-71` — pastikan startup app tetap membuat table bila belum ada.
- Verify only: `backend/app/routers/auth.py:46-64` — pakai endpoint setup admin untuk admin awal setelah schema siap.

### Task 1: Tambah template environment lokal

**Files:**
- Create: `backend/.env.example`
- Verify: `backend/app/config.py:5-30`

- [ ] **Step 1: Write the failing test**

Karena repo ini belum punya test suite untuk config env, gunakan verifikasi file-based minimal: file template environment belum ada sehingga developer lokal tidak punya sumber konfigurasi standar.

```python
from pathlib import Path


def test_env_example_exists():
    assert Path("backend/.env.example").exists()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python - <<'PY'
from pathlib import Path
print(Path('backend/.env.example').exists())
PY`
Expected: output `False`

- [ ] **Step 3: Write minimal implementation**

Create `backend/.env.example` with:

```env
DATABASE_URL=mysql+pymysql://root:@localhost:3306/absen_desa
SECRET_KEY=change-this-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
DEBUG=True
FACE_RECOGNITION_ENABLED=False
FACE_RECOGNITION_URL=http://localhost:8001
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python - <<'PY'
from pathlib import Path
print(Path('backend/.env.example').exists())
print(Path('backend/.env.example').read_text())
PY`
Expected: output starts with `True` and shows the environment keys above.

- [ ] **Step 5: Commit**

```bash
git add backend/.env.example
git commit -m "chore: add local mysql environment template"
```

### Task 2: Sinkronkan instruksi setup backend untuk XAMPP lokal

**Files:**
- Modify: `backend/README.md:23-51`
- Create: `backend/.env.example`

- [ ] **Step 1: Write the failing test**

Verifikasi dokumentasi belum menyebut flow setup lokal yang konsisten antara `.env`, pembuatan database, bootstrap schema, dan setup admin.

```python
from pathlib import Path


def test_readme_mentions_local_mysql_bootstrap_flow():
    text = Path("backend/README.md").read_text()
    assert "cp .env.example .env" in text
    assert "python setup_db.py" in text
    assert "POST /api/v1/auth/setup" in text
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python - <<'PY'
from pathlib import Path
text = Path('backend/README.md').read_text()
for needle in ['cp .env.example .env', 'python setup_db.py', 'POST /api/v1/auth/setup']:
    print(needle, needle in text)
PY`
Expected: at least one line prints `False`

- [ ] **Step 3: Write minimal implementation**

Update `backend/README.md` setup section so it reads like this:

```md
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
python setup_db.py
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python - <<'PY'
from pathlib import Path
text = Path('backend/README.md').read_text()
for needle in ['cp .env.example .env', 'python setup_db.py', 'POST /api/v1/auth/setup']:
    print(needle, needle in text)
PY`
Expected: all lines print `True`

- [ ] **Step 5: Commit**

```bash
git add backend/README.md backend/.env.example
git commit -m "docs: document local xampp mysql setup"
```

### Task 3: Sinkronkan verifikasi schema di bootstrap script

**Files:**
- Modify: `backend/setup_db.py:35-40`
- Verify: `backend/app/models/`

- [ ] **Step 1: Write the failing test**

Saat ini `setup_db.py` memverifikasi hanya 7 table, padahal model di `backend/app/models/` juga memuat `daily_schedules`, `guestbooks`, dan `surveys`. Tulis test untuk memastikan expected table list sinkron dengan model inti yang ter-import.

```python
from app.models import (
    Admin, Employee, FaceEmbedding, AttendanceLog,
    WorkSettings, Holiday, AuditLog, DailySchedule,
    Guestbook, Survey,
)


def test_expected_tables_cover_registered_models():
    expected_tables = {
        'admins', 'employees', 'face_embeddings', 'attendance_logs',
        'work_settings', 'holidays', 'audit_logs', 'daily_schedules',
        'guestbooks', 'surveys'
    }
    assert expected_tables == {
        Admin.__tablename__, Employee.__tablename__, FaceEmbedding.__tablename__,
        AttendanceLog.__tablename__, WorkSettings.__tablename__, Holiday.__tablename__,
        AuditLog.__tablename__, DailySchedule.__tablename__, Guestbook.__tablename__,
        Survey.__tablename__,
    }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python - <<'PY'
from app.models import Admin, Employee, FaceEmbedding, AttendanceLog, WorkSettings, Holiday, AuditLog, DailySchedule, Guestbook, Survey
expected_tables = ['admins', 'employees', 'face_embeddings', 'attendance_logs', 'work_settings', 'holidays', 'audit_logs']
actual_tables = [Admin.__tablename__, Employee.__tablename__, FaceEmbedding.__tablename__, AttendanceLog.__tablename__, WorkSettings.__tablename__, Holiday.__tablename__, AuditLog.__tablename__, DailySchedule.__tablename__, Guestbook.__tablename__, Survey.__tablename__]
print('missing_from_expected', sorted(set(actual_tables) - set(expected_tables)))
PY`
Expected: output shows `daily_schedules`, `guestbooks`, and `surveys`

- [ ] **Step 3: Write minimal implementation**

Update `expected_tables` in `backend/setup_db.py` to:

```python
expected_tables = [
    'admins', 'employees', 'face_embeddings',
    'attendance_logs', 'work_settings', 'holidays',
    'audit_logs', 'daily_schedules', 'guestbooks',
    'surveys'
]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python - <<'PY'
from app.models import Admin, Employee, FaceEmbedding, AttendanceLog, WorkSettings, Holiday, AuditLog, DailySchedule, Guestbook, Survey
expected_tables = ['admins', 'employees', 'face_embeddings', 'attendance_logs', 'work_settings', 'holidays', 'audit_logs', 'daily_schedules', 'guestbooks', 'surveys']
actual_tables = [Admin.__tablename__, Employee.__tablename__, FaceEmbedding.__tablename__, AttendanceLog.__tablename__, WorkSettings.__tablename__, Holiday.__tablename__, AuditLog.__tablename__, DailySchedule.__tablename__, Guestbook.__tablename__, Survey.__tablename__]
print(sorted(expected_tables) == sorted(actual_tables))
PY`
Expected: output `True`

- [ ] **Step 5: Commit**

```bash
git add backend/setup_db.py
git commit -m "fix: align setup db verification with registered models"
```

### Task 4: Bootstrap schema lokal dan verifikasi koneksi XAMPP

**Files:**
- Verify only: `backend/.env`
- Verify only: `backend/setup_db.py`
- Verify only: `backend/app/main.py:69-71`

- [ ] **Step 1: Write the failing test**

Gunakan verifikasi runtime: tanpa `.env` lokal yang valid atau database `absen_desa`, koneksi harus gagal.

```python
def test_local_mysql_connection_is_ready():
    assert False, "replace after local DATABASE_URL and database are prepared"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python setup_db.py`
Expected: FAIL jika MySQL XAMPP belum running atau database `absen_desa` belum dibuat.

- [ ] **Step 3: Write minimal implementation**

Create local env file and database:

```bash
cd backend
cp .env.example .env
```

Lalu di phpMyAdmin atau MySQL CLI XAMPP jalankan:

```sql
CREATE DATABASE absen_desa CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Jika perlu via CLI XAMPP macOS:

```bash
/Applications/XAMPP/xamppfiles/bin/mysql -u root -e "CREATE DATABASE IF NOT EXISTS absen_desa CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python setup_db.py`
Expected:
- `✓ Database connection successful`
- `✓ All tables created successfully`
- `✓ All expected tables exist`

- [ ] **Step 5: Commit**

```bash
git add backend/.env
git commit -m "chore: configure local mysql development database"
```

### Task 5: Verifikasi startup app dan setup admin awal

**Files:**
- Verify only: `backend/app/main.py:69-71`
- Verify only: `backend/app/routers/auth.py:46-64`

- [ ] **Step 1: Write the failing test**

Gunakan verifikasi API runtime: sebelum server berjalan, endpoint health dan setup admin belum bisa diakses.

```python
def test_local_api_bootstrap_endpoints_are_reachable():
    assert False, "replace after uvicorn starts"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `curl http://localhost:8000/health`
Expected: connection refused jika server belum dijalankan.

- [ ] **Step 3: Write minimal implementation**

Start backend locally:

```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

Di terminal lain, buat admin awal:

```bash
curl -X POST http://localhost:8000/api/v1/auth/setup
```

Response expected:

```json
{"message":"Admin berhasil dibuat","username":"admin","password":"admin123"}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
curl http://localhost:8000/health
curl -X POST http://localhost:8000/api/v1/auth/setup
```

Expected:
- health returns `{"status":"healthy"}`
- setup admin returns success once, then `{"detail":"Admin sudah ada"}` on repeated call

- [ ] **Step 5: Commit**

```bash
git add backend/README.md backend/setup_db.py backend/.env.example backend/.env
git commit -m "feat: bootstrap local xampp mysql development setup"
```

## Self-Review

- **Spec coverage:** Plan mencakup konfigurasi `.env`, dokumentasi XAMPP lokal, sinkronisasi bootstrap schema, verifikasi koneksi database, dan setup admin awal.
- **Placeholder scan:** Tidak ada `TODO`/`TBD`; setiap task punya file, command, dan expected output konkret.
- **Type consistency:** Nama table konsisten dengan model yang digunakan di `app.models` dan flow setup memakai file yang memang ada di repo.

## Notes

- Repository root saat ini bukan git repository, jadi langkah commit di atas hanya berlaku jika nanti project dipindahkan ke repo git aktif.
- Jangan commit `backend/.env` bila repository nantinya mulai dilacak git; file itu masuk `.gitignore`.
