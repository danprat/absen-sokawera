# Supabase Local Face Orchestrator Test

This setup lets the browser call a Supabase Edge Function first, while Python face recognition still runs in the local FastAPI backend.

## Local Data Flow

```text
Frontend Vite
  -> local Supabase Edge Function face-orchestrator
  -> local FastAPI backend
  -> Supabase Postgres/Storage online
```

The Edge Function is only a gateway. It validates the route shape, keeps browser calls away from the raw Python face endpoint, forwards the browser `Authorization` header when present, and adds an internal `x-face-service-key` header when `FACE_SERVICE_API_KEY` is configured.

## Backend

Create `backend/.env` with your Supabase online database connection and local face recognition settings:

```env
DATABASE_URL=postgresql+psycopg://postgres:<password>@<project-ref>.supabase.co:5432/postgres
SECRET_KEY=change-this-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
CORS_ORIGINS=http://127.0.0.1:8080,http://localhost:8080,http://127.0.0.1:54321,http://localhost:54321
DEBUG=True
AUTO_CREATE_SCHEMA=True
DEFAULT_TENANT_ID=default

SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<anon-or-publishable-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-or-secret-key>

FACE_RECOGNITION_ENABLED=True
FACE_RECOGNITION_DEBUG_LOGS=True
FACE_SERVICE_API_KEY=local-dev-internal-key
FACE_SERVICE_REQUIRE_API_KEY=True
```

Run the backend:

```bash
cd backend
python3 setup_db.py
python3 -m alembic upgrade head
python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

If the local machine does not have `dlib`/`face_recognition` ready yet, set `FACE_RECOGNITION_ENABLED=False` to test the gateway and attendance flow without real matching.

## Edge Function

Create `supabase/functions/.env.local`:

```env
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<anon-or-publishable-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-or-secret-key>
FACE_SERVICE_URL=http://127.0.0.1:8000
FACE_SERVICE_API_KEY=local-dev-internal-key
```

Serve the function locally:

```bash
supabase functions serve face-orchestrator --no-verify-jwt --env-file supabase/functions/.env.local
```

Local health check:

```bash
curl http://127.0.0.1:54321/functions/v1/face-orchestrator/health
```

Expected response:

```json
{"status":"ok","service":"face-orchestrator"}
```

## Frontend

Create `frontend/.env`:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
VITE_FACE_ORCHESTRATOR_URL=http://127.0.0.1:54321/functions/v1/face-orchestrator
```

Run the frontend:

```bash
cd frontend
npm run dev -- --host 127.0.0.1 --port 8080
```

Manual checks:

1. Open `http://127.0.0.1:8080`.
2. Login as admin.
3. Add or select an employee.
4. Upload/enroll a face photo.
5. Open the attendance camera flow.
6. Confirm attendance after recognition.
7. Verify rows in Supabase Table Editor.

## Production Notes

For production, do not point hosted Edge Functions to `127.0.0.1`. Use a private/internal face service URL when the platform supports it, or a public HTTPS URL protected by an internal service token. Keep `SUPABASE_SERVICE_ROLE_KEY`, secret keys, and `FACE_SERVICE_API_KEY` only in backend/Edge Function secrets, never in `VITE_*` variables.
