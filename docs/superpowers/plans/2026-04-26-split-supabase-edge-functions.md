# Split Supabase Edge Functions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the transitional `app-api` Edge Function into maintainable domain functions without breaking existing frontend flows.

**Architecture:** Keep shared Supabase, CORS, auth, audit, and response helpers in `supabase/functions/_shared`. Each domain function owns one route family and imports only the shared helpers it needs. Keep `app-api` as temporary compatibility fallback while the frontend moves to module-specific function URLs.

**Tech Stack:** Supabase Edge Functions, Deno TypeScript, `@supabase/supabase-js`, React/Vite Axios client.

---

### Task 1: Shared Function Runtime

**Files:**
- Create: `supabase/functions/_shared/runtime.ts`

- [x] Extract CORS headers, JSON helpers, Supabase service-role client, admin JWT verification, audit logging, route path helpers, and CSV response helpers from `app-api`.
- [x] Run `npm run build` in `frontend/` to ensure frontend TypeScript remains valid.

### Task 2: Domain Edge Functions

**Files:**
- Create: `supabase/functions/auth-api/index.ts`
- Create: `supabase/functions/public-api/index.ts`
- Create: `supabase/functions/employees-api/index.ts`
- Create: `supabase/functions/attendance-api/index.ts`
- Create: `supabase/functions/admin-settings-api/index.ts`
- Create: `supabase/functions/admin-reports-api/index.ts`
- Create: `supabase/functions/audit-api/index.ts`
- Create: `supabase/functions/admins-api/index.ts`
- Create: `supabase/functions/guestbook-api/index.ts`
- Create: `supabase/functions/survey-api/index.ts`

- [x] Move the matching route handlers from `app-api` into module functions.
- [x] Preserve the old `/api/v1/...` route shape inside each function so frontend call methods remain readable.
- [x] Keep `face-orchestrator` separate for Python face recognition routing.

### Task 3: Frontend API Route Map

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/.env.example`
- Modify: `frontend/.env`

- [x] Add module base URL environment variables.
- [x] Route auth, public, employees, attendance, admin settings, reports, audit logs, admins, guest book, survey, and face operations to their matching Edge Function.
- [x] Keep `VITE_API_BASE_URL` fallback for compatibility.

### Task 4: Verification

**Commands:**
- `cd frontend && npm run build`
- Smoke test module health endpoints with `curl`.
- Test admin UI in browser for `/admin`, `/admin/log`, `/admin/buku-tamu`, `/admin/pengaturan`, and `/admin/survey`.

- [ ] Fix any route or CORS regressions discovered during verification.

Deployment note: Supabase CLI deploy to project `aysyhhzfmigjsryaoizu` currently returns 403 for this local account, so remote deployment needs a Supabase token/account with Edge Function deploy privileges or deployment via the authenticated MCP path.
