# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository structure

- `backend/` — FastAPI API, business logic, SQLAlchemy models, and local MySQL/XAMPP integration
- `frontend/` — React + TypeScript + Vite app for public pages and admin dashboard

Detailed local guidance already exists in:
- `backend/AGENTS.md`
- `frontend/AGENTS.md`

## Common commands

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python3 setup_db.py
python3 -m uvicorn app.main:app --reload --port 8000
```

Useful backend checks:

```bash
cd backend
python3 setup_db.py
python3 -m uvicorn app.main:app --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
npm run build
npm run lint
npm run preview
```

## Architecture overview

### Backend

- Entry point: `backend/app/main.py`
- API prefix: `/api/v1`
- Main layers:
  - `app/routers/` — route handlers
  - `app/schemas/` — Pydantic request/response models
  - `app/models/` — SQLAlchemy models
  - `app/services/` — business logic
  - `app/utils/` — auth, audit, export, cache helpers
- Database config lives in `backend/app/config.py` and `backend/app/database.py`
- Local development currently targets MySQL/XAMPP via `DATABASE_URL`
- Uploaded files are served from `/uploads` by the backend

### Frontend

- Entry point: `frontend/src/main.tsx`
- Router: `frontend/src/App.tsx`
- Global API client: `frontend/src/lib/api.ts`
- Main UI areas:
  - public pages in `frontend/src/pages/`
  - admin pages in `frontend/src/pages/admin/`
  - shared components in `frontend/src/components/`
  - shadcn/ui primitives in `frontend/src/components/ui/`
- Global styling is in `frontend/src/index.css`
- Vite config is in `frontend/vite.config.ts`

## Important implementation notes

- Backend auth uses bearer tokens and `/api/v1/auth/*` endpoints.
- Guest book now supports admin-managed meeting targets plus manual input.
- Admin guest book management lives in `frontend/src/pages/admin/AdminBukuTamu.tsx` and backend guest book routes.
- Frontend expects the backend to be running locally when using `.env` pointing to `http://127.0.0.1:8000`.

## Verification

For end-to-end local verification:

```bash
curl http://127.0.0.1:8000/health
```

```bash
cd frontend && npm run build
```

Manual flows commonly worth checking:
- `/login`
- `/buku-tamu`
- `/admin/buku-tamu`
- image URLs under `/uploads/*`
