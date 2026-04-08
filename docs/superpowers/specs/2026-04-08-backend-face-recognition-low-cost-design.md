# Backend Face Recognition Low-Cost Optimization Design

## Goal
Menjaga endpoint absensi wajah tetap responsif dan stabil untuk sekitar 9 pengguna aktif pada deployment satu mesin dengan backend API dan MySQL berada di host yang sama, tanpa menambah Redis, worker tambahan, atau service baru.

## Scope
Fokus optimasi adalah jalur panas absensi wajah dan data referensi yang sering dibaca:
- `backend/app/routers/attendance.py`
- `backend/app/services/face_recognition.py`
- `backend/app/services/attendance.py`
- `backend/app/routers/settings.py`
- `backend/app/routers/face.py`
- `backend/app/config.py`

Di luar scope:
- pemisahan service face recognition
- penambahan Redis atau cache eksternal
- multi-worker Uvicorn
- perubahan behavior bisnis absensi

## Current State
Codebase sudah memiliki fondasi optimasi yang cocok untuk deployment kecil:
- single-process backend adalah pola yang dianjurkan
- database pool kecil sudah dikonfigurasi
- face embedding sudah bisa dipreload ke RAM
- settings, holiday, dan schedule sudah memiliki TTL cache in-memory

Masalah utamanya adalah optimasi belum sepenuhnya event-driven. Beberapa cache referensi belum diinvalidasi saat data admin berubah, refresh cache wajah masih berpotensi terjadi pada request berikutnya, dan jalur panas masih mengandung logging/perubahan data yang tidak esensial untuk respons cepat.

## Chosen Approach
Gunakan pendekatan hot-path first:
1. optimalkan jalur `/attendance/recognize`
2. pertahankan cache in-memory lokal
3. pindahkan kerja berat ke event admin/update data jika memungkinkan
4. pertahankan runtime single-process dengan pool DB kecil

Pendekatan ini dipilih karena memberi peningkatan latensi terbesar dengan biaya operasional paling rendah untuk skala penggunaan saat ini.

## Design

### 1. Face recognition hot path
`find_matching_employee()` tetap menjadi pusat matching dan request recognize hanya melakukan empat pekerjaan inti:
1. membaca gambar
2. membuat embedding
3. membandingkan dengan embedding aktif di RAM
4. memeriksa eligibility absensi dengan pembacaan data referensi seminimal mungkin

Tidak ada perubahan aturan bisnis pada hasil recognize.

### 2. Event-driven face cache refresh
Cache embedding wajah tetap berada di RAM pada proses backend tunggal.

Perubahan desain:
- preload cache wajah tetap dijalankan saat startup bila face recognition aktif
- setiap create/delete/update data wajah harus membersihkan cache dan me-refresh cache sekali setelah perubahan berhasil
- request recognize setelah perubahan data wajah tidak boleh menjadi titik pertama yang menanggung cold refresh berat

### 3. Reference cache hardening
Cache untuk `WorkSettings`, `DailyWorkSchedule`, dan `Holiday` tetap memakai in-memory TTL cache.

Perubahan desain:
- semua pembacaan data referensi di jalur absensi harus melalui helper cache
- update settings menginvalidasi cache settings dan public settings
- update schedule menginvalidasi cache schedule yang relevan
- create/delete/restore/sync holiday menginvalidasi cache holiday yang relevan
- TTL dapat dibuat lebih panjang karena invalidasi dipicu event admin, bukan hanya menunggu expiry

### 4. Cache payload shape
Untuk pembacaan yang sering terjadi, cache sebaiknya menyimpan bentuk data ringan yang benar-benar dibutuhkan jalur panas, bukan object ORM penuh bila tidak perlu.

Tujuan:
- menurunkan jejak memori
- mengurangi risiko object stale yang masih terikat session
- menjaga akses cache tetap cepat dan sederhana

### 5. Runtime constraints
Deployment tetap memakai:
- satu proses Uvicorn
- backend dan MySQL pada host yang sama
- pool DB kecil
- mode produksi dengan logging seperlunya dan `DEBUG=False`

Multi-worker tidak dipakai karena akan menggandakan cache RAM dan menaikkan biaya memori tanpa manfaat yang sebanding pada skala ini.

### 6. Logging policy
Logging di jalur panas face recognition dikurangi agar tidak menambah overhead CPU dan IO.

Aturan desain:
- log detail per request hanya aktif saat debug
- error penting tetap dicatat
- startup summary dan refresh summary tetap boleh dicatat

## Error Handling
Optimasi tidak mengubah behavior bisnis yang terlihat oleh user.

Yang tetap dipertahankan:
- wajah yang tidak cocok tetap ditolak seperti sebelumnya
- absensi di luar jam tetap ditolak seperti sebelumnya
- jika cache kosong atau stale, sistem tetap bisa refresh dan melanjutkan proses
- jika preload gagal saat startup, backend tetap hidup dan dapat jatuh ke lazy refresh yang aman

## Verification Plan
Keberhasilan optimasi diverifikasi dengan:
1. membandingkan waktu respons `POST /attendance/recognize` sebelum dan sesudah perubahan
2. memeriksa request pertama setelah startup
3. memeriksa request pertama setelah admin mengubah data wajah
4. memverifikasi update settings, schedules, dan holiday benar-benar menginvalidasi cache terkait
5. memverifikasi hasil bisnis tidak berubah untuk kasus wajah valid, wajah tidak valid, dan aturan jam kerja

## Success Criteria
Desain dianggap berhasil jika:
- absensi wajah tetap responsif dan stabil untuk sekitar 9 pengguna aktif
- query DB berulang untuk settings, schedule, dan holiday berkurang
- request pertama setelah startup tidak mengalami cold-path berlebihan
- request setelah perubahan data wajah tidak memindahkan beban berat ke user berikutnya
- tidak perlu menambah Redis, worker tambahan, atau service baru

## Implementation Order
1. lengkapi invalidasi cache untuk settings, schedules, dan holiday
2. ubah refresh cache wajah menjadi eager setelah perubahan data wajah
3. kurangi logging di jalur panas face recognition
4. rapikan bentuk payload cache agar lebih ringan
5. review TTL default berdasarkan pola update admin
