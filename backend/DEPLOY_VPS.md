# Panduan Deploy Backend ke VPS ARM + CloudPanel

Dokumentasi ini fokus pada **deployment backend API** ke VPS, dengan asumsi berikut:

- repository project **sudah ada di VPS**
- kamu **sudah berada di root directory project**
- folder `backend/` **sudah tersedia**
- frontend di-hosting terpisah, misalnya di Cloudflare Pages, Vercel, atau Netlify

Panduan ini **bukan** alur clone/upload project dari nol. Fokusnya adalah menyiapkan backend yang sudah ada agar jalan stabil di VPS menggunakan Python, systemd, dan reverse proxy CloudPanel/Nginx.

---

## 1. Prasyarat

Sebelum mulai, pastikan:

| Kebutuhan | Detail |
|---|---|
| VPS | Ubuntu 22.04 LTS ARM64 direkomendasikan |
| Akses | Bisa login SSH ke VPS |
| Project | Sudah ada di VPS dan kamu sudah berada di root project |
| Folder backend | `backend/` sudah tersedia |
| Domain/Subdomain | Misalnya `api.desamu.id` sudah diarahkan ke IP VPS |
| CloudPanel | Sudah terpasang dan site/domain backend sudah disiapkan |
| Database | MySQL sudah tersedia di CloudPanel atau di VPS |

Contoh struktur directory yang diasumsikan:

```bash
/home/absen-api/htdocs/api.desamu.id/
├── backend/
├── frontend/
└── docs/
```

Verifikasi posisi kerja kamu sekarang:

```bash
pwd
ls -la
```

Contoh output `pwd`:

```bash
/home/absen-api/htdocs/api.desamu.id
```

Di bawah ini, contoh path akan memakai root project berikut:

```bash
/home/absen-api/htdocs/api.desamu.id
```

Kalau path milikmu berbeda, ganti sesuai hasil `pwd` di servermu.

---

## 2. Install dependency sistem di VPS

Jalankan dari VPS untuk menyiapkan Python dan dependency build:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3.11 python3.11-venv python3.11-dev python3-pip build-essential git curl wget
```

Verifikasi:

```bash
python3.11 --version
pip3 --version
```

Catatan:

- Jika nanti mengaktifkan face recognition berbasis `dlib`, proses install dependency bisa lebih berat di ARM.
- Jika belum butuh face recognition service terpisah, aman gunakan `FACE_RECOGNITION_ENABLED=False`.

---

## 3. Verifikasi atau buat database MySQL di CloudPanel

Karena backend project-nya sudah ada, langkah ini fokus untuk **memastikan kredensial database yang dipakai backend sudah tersedia**. Jika database dan user MySQL sudah pernah dibuat, cukup verifikasi nilainya lalu samakan dengan `DATABASE_URL` di `backend/.env`.

Jika database belum dibuat, buat dulu dari CloudPanel:

1. Buka menu **Databases**
2. Klik **Add Database**
3. Isi misalnya:
   - **Database Name:** `absen_desa`
   - **Username:** `absen_user`
   - **Password:** buat password kuat
4. Simpan

Catat informasi koneksinya:

```text
Host     : 127.0.0.1
Port     : 3306
Database : absen_desa
Username : absen_user
Password : password-yang-kamu-buat
```

Kalau ingin membuat via CLI MySQL:

```bash
sudo mysql -u root -p
```

Lalu di prompt MySQL:

```sql
CREATE DATABASE absen_desa CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'absen_user'@'localhost' IDENTIFIED BY 'PASSWORD_KUAT_KAMU';
GRANT ALL PRIVILEGES ON absen_desa.* TO 'absen_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

---

## 4. Konfigurasi environment backend

Karena kamu sudah berada di root project, masuk ke folder `backend/` lalu buat file `.env`.

```bash
cd backend
cp .env.example .env
nano .env
```

Backend membaca environment dari file `backend/.env`.

Isi `.env` untuk production kurang lebih seperti ini:

```env
DATABASE_URL=mysql+pymysql://absen_user:PASSWORD_KUAT_KAMU@127.0.0.1:3306/absen_desa
SECRET_KEY=GANTI_DENGAN_STRING_ACAK_MINIMAL_32_KARAKTER
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
CORS_ORIGINS=https://absen-desa.pages.dev,https://absen.desamu.id
DEBUG=False
AUTO_CREATE_SCHEMA=True
PRELOAD_FACE_EMBEDDINGS=False
FACE_RECOGNITION_ENABLED=False
FACE_RECOGNITION_URL=http://localhost:8001
```

Catatan penting:

- `SECRET_KEY` wajib diganti dengan string acak yang panjang.
- `DEBUG` harus `False` di production.
- `CORS_ORIGINS` diisi domain frontend yang benar, dipisahkan koma, **tanpa slash `/` di akhir URL**.
- Nilai `CORS_ORIGINS` di `.env.example` adalah default local development; ganti ke domain production milikmu.
- `AUTO_CREATE_SCHEMA=True` membuat backend menjalankan `create_all()` saat startup. Ini cocok untuk setup sederhana, tetapi kalau kamu ingin kontrol schema lebih ketat via migrasi, kamu bisa set `AUTO_CREATE_SCHEMA=False` lalu andalkan Alembic.
- `PRELOAD_FACE_EMBEDDINGS=False` aman dipakai jika face recognition belum diaktifkan.
- Jika frontend hanya satu domain, cukup isi satu URL.

Untuk generate `SECRET_KEY`:

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

---

## 5. Buat virtual environment dan install dependency

Masih dari folder `backend/`:

```bash
python3.11 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

Verifikasi install:

```bash
python --version
python -m uvicorn --version
python -c "import fastapi; print('FastAPI OK')"
```

Jika semua sukses, virtualenv backend siap dipakai.

---

## 6. Siapkan schema database

Masih dari folder `backend/` dengan virtualenv aktif:

```bash
python setup_db.py
```

Output sukses umumnya akan menampilkan:

```text
Database Setup for Sistem Absensi Desa
Step 1: Testing database connection...
✓ Database connection successful
Step 2: Creating tables...
✓ All tables created successfully
Step 3: Verifying tables...
✓ All expected tables exist
Database setup completed successfully!
```

Repo ini saat ini masih mendukung bootstrap schema lewat startup backend dan `setup_db.py`. Saat `AUTO_CREATE_SCHEMA=True`, backend juga akan menjalankan `create_all()` ketika start.

Jika deployment kamu memang memakai migrasi Alembic, jalankan juga:

```bash
alembic upgrade head
alembic current
```

Praktiknya:

- `python setup_db.py` adalah jalur utama untuk bootstrap dan verifikasi tabel utama pada setup sederhana.
- `AUTO_CREATE_SCHEMA=True` membantu memastikan schema dasar dibuat saat backend start.
- `alembic upgrade head` dijalankan jika ada migrasi schema yang memang perlu diterapkan.

---

## 7. Smoke test backend sebelum dijadikan service

Sebelum membuat systemd service, pastikan backend bisa menyala manual dulu.

Masih di folder `backend/` dengan virtualenv aktif:

```bash
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Lalu di terminal lain, cek:

```bash
curl http://127.0.0.1:8000/health
```

Respons yang diharapkan:

```json
{"status":"healthy"}
```

Cek juga schema OpenAPI:

```bash
curl http://127.0.0.1:8000/openapi.json
```

Dan bila perlu buka:

- `http://127.0.0.1:8000/docs`
- `http://127.0.0.1:8000/redoc`

Jika semua normal, hentikan server manual dengan `Ctrl+C` lalu lanjut ke systemd service.

---

## 8. Buat systemd service untuk backend

Agar backend otomatis jalan saat VPS restart, buat service systemd.

Keluar dari virtualenv dulu jika masih aktif:

```bash
deactivate
```

Buat file service sebagai root:

```bash
sudo nano /etc/systemd/system/absen-api.service
```

Isi file dengan contoh berikut:

```ini
[Unit]
Description=Sistem Absensi Desa - FastAPI Backend
After=network.target mysql.service
Wants=mysql.service

[Service]
User=absen-api
Group=absen-api
WorkingDirectory=/home/absen-api/htdocs/api.desamu.id/backend
EnvironmentFile=/home/absen-api/htdocs/api.desamu.id/backend/.env
ExecStart=/home/absen-api/htdocs/api.desamu.id/backend/venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --log-level info
Restart=always
RestartSec=5
StandardOutput=append:/var/log/absen-api/access.log
StandardError=append:/var/log/absen-api/error.log

[Install]
WantedBy=multi-user.target
```

Sesuaikan bagian berikut dengan servermu:

- `User` dan `Group`: user site CloudPanel yang memiliki project
- `WorkingDirectory`: path absolut ke folder `backend/`
- `EnvironmentFile`: path absolut ke `.env`
- `ExecStart`: path absolut ke Python di `venv`

Catatan penting:

- Untuk deployment kecil ini, gunakan **satu proses Uvicorn** saja.
- Tidak perlu menambahkan `--workers`; satu proses cukup dan menghindari duplikasi cache in-memory.

Buat directory log dan aktifkan servicenya:

```bash
sudo mkdir -p /var/log/absen-api
sudo chown absen-api:absen-api /var/log/absen-api
sudo systemctl daemon-reload
sudo systemctl enable absen-api
sudo systemctl start absen-api
sudo systemctl status absen-api
```

Cek log jika ada masalah:

```bash
sudo journalctl -u absen-api -f
sudo tail -f /var/log/absen-api/error.log
```

---

## 9. Konfigurasi reverse proxy di CloudPanel

Setelah backend jalan di `127.0.0.1:8000`, arahkan domain publik ke service tersebut melalui Nginx/CloudPanel.

Asumsinya site/domain backend di CloudPanel **sudah ada**. Yang perlu diatur adalah vhost/reverse proxy-nya.

Masuk ke:

1. **Sites**
2. **Manage** pada domain backend, misalnya `api.desamu.id`
3. Tab **Vhost**
4. Ganti konfigurasi menjadi seperti ini:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name api.desamu.id;

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api.desamu.id;

    ssl_certificate /etc/nginx/ssl-certificates/api.desamu.id.crt;
    ssl_certificate_key /etc/nginx/ssl-certificates/api.desamu.id.key;

    client_max_body_size 20M;

    location /uploads/ {
        alias /home/absen-api/htdocs/api.desamu.id/backend/uploads/;
        expires 7d;
        add_header Cache-Control "public, immutable";
    }

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 120s;
        proxy_connect_timeout 10s;
        proxy_send_timeout 30s;
    }
}
```

Sesuaikan:

- `server_name`
- path `alias` untuk folder `backend/uploads/`
- nama domain sertifikat SSL

Catatan:

- Backend ini sudah me-mount `/uploads` sendiri dari FastAPI.
- Blok `location /uploads/` di Nginx di atas bersifat **opsional** jika kamu ingin file upload dilayani langsung oleh Nginx.
- Jika tidak memakai alias itu, upload tetap bisa berjalan selama request diteruskan ke backend.

Jika versi CloudPanel kamu punya menu **Reverse Proxy**, kamu tetap bisa mengarahkannya ke `http://127.0.0.1:8000`, tetapi konfigurasi `Vhost` di atas lebih lengkap jika kamu juga ingin Nginx melayani `/uploads/` secara langsung.

---

## 10. Aktifkan SSL

Di CloudPanel:

1. Masuk ke **Sites**
2. Pilih **Manage** untuk domain backend
3. Buka tab **SSL/TLS**
4. Klik **Actions** → **New Let's Encrypt Certificate**
5. Setelah sertifikat aktif, nyalakan **Force HTTPS**

Setelah itu backend bisa diakses lewat:

```text
https://api.desamu.id
```

---

## 11. Verifikasi deployment

Lakukan pengecekan berikut:

### Cek health endpoint

```bash
curl http://127.0.0.1:8000/health
curl https://api.desamu.id/health
```

Respons yang diharapkan:

```json
{"status":"healthy"}
```

### Cek dokumentasi API

Buka di browser:

- `https://api.desamu.id/docs`
- `https://api.desamu.id/redoc`

### Setup admin pertama

Jika database masih baru dan **belum ada admin sama sekali**:

```bash
curl -X POST https://api.desamu.id/api/v1/auth/setup
```

Endpoint ini hanya berhasil jika belum ada admin di database. Jika admin sudah ada, endpoint akan mengembalikan error 400.

Saat berhasil, endpoint akan membuat admin default:

- username: `admin`
- password: `admin123`

Segera ganti password tersebut setelah login pertama.

### Cek status service dan port

```bash
sudo systemctl status absen-api
ss -tlnp | grep 8000
sudo journalctl -u absen-api --since "5 minutes ago"
```

---

## 12. Update deployment saat ada perubahan kode

Karena repository sudah ada di VPS, alur update cukup dari root project yang sama.

```bash
cd /home/absen-api/htdocs/api.desamu.id
git pull origin main
cd backend
source venv/bin/activate
pip install -r requirements.txt
```

Jika ada migrasi schema:

```bash
alembic upgrade head
```

Jika ingin memastikan tabel utama tetap tersedia:

```bash
python setup_db.py
```

Lalu restart service:

```bash
deactivate
sudo systemctl restart absen-api
sudo systemctl status absen-api
curl https://api.desamu.id/health
```

---

## 13. Troubleshooting

### Service gagal start

```bash
sudo journalctl -u absen-api -n 50 --no-pager
sudo tail -50 /var/log/absen-api/error.log
```

Masalah umum:

| Masalah | Penyebab umum | Solusi |
|---|---|---|
| `ModuleNotFoundError` | dependency belum terinstall di `venv` | aktifkan `venv`, lalu `pip install -r requirements.txt` |
| `Connection refused` MySQL | MySQL belum aktif atau kredensial salah | cek `.env` dan status MySQL |
| `Permission denied` | user service tidak punya akses ke file/project | sesuaikan ownership project |
| `Address already in use` | port 8000 dipakai proses lain | cek proses yang memakai port 8000 |
| `SECRET_KEY` bermasalah | key terlalu pendek atau belum diganti | generate ulang key baru |

### Error 502 Bad Gateway

```bash
sudo systemctl status absen-api
curl http://127.0.0.1:8000/health
sudo tail -20 /var/log/nginx/api.desamu.id.error.log
```

Biasanya berarti Nginx bisa diakses, tetapi backend di `127.0.0.1:8000` tidak berjalan normal.

### CORS error di frontend

Pastikan `CORS_ORIGINS` di `.env` berisi domain frontend yang benar, misalnya:

```env
CORS_ORIGINS=https://absen-desa.pages.dev,https://absen.desamu.id
```

Lalu restart backend:

```bash
sudo systemctl restart absen-api
```

### Upload tidak muncul

Pastikan folder upload ada dan bisa diakses:

```bash
ls -la /home/absen-api/htdocs/api.desamu.id/backend/uploads/
sudo chown -R absen-api:absen-api /home/absen-api/htdocs/api.desamu.id/backend/uploads/
sudo chmod -R 755 /home/absen-api/htdocs/api.desamu.id/backend/uploads/
```

### Cek log realtime

```bash
sudo journalctl -u absen-api -f
sudo tail -f /var/log/absen-api/access.log
sudo tail -f /var/log/absen-api/error.log
```

---

## Ringkasan path dan service penting

| Item | Nilai contoh |
|---|---|
| Root project | `/home/absen-api/htdocs/api.desamu.id` |
| Folder backend | `/home/absen-api/htdocs/api.desamu.id/backend` |
| File environment | `/home/absen-api/htdocs/api.desamu.id/backend/.env` |
| Virtualenv | `/home/absen-api/htdocs/api.desamu.id/backend/venv` |
| Port backend internal | `8000` |
| Nama systemd service | `absen-api` |
| Log backend | `/var/log/absen-api/` |
| Health check | `https://api.desamu.id/health` |
| Swagger docs | `https://api.desamu.id/docs` |

---

## Perintah cepat yang sering dipakai

```bash
# Masuk ke backend
cd /home/absen-api/htdocs/api.desamu.id/backend

# Aktifkan virtualenv
source venv/bin/activate

# Jalankan manual untuk test
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000

# Restart service production
sudo systemctl restart absen-api

# Lihat status service
sudo systemctl status absen-api

# Lihat log service
sudo journalctl -u absen-api -f
```

Dokumentasi ini disusun untuk kondisi di mana project sudah ada di VPS dan kamu memulai dari root directory project, sehingga langkah clone/upload repo tidak diperlukan lagi sebagai alur utama deployment.