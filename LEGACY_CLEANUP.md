# Legacy Cleanup Status

## Current Policy

Cleanup is split into two stages.

- Stage 1 is reversible: document, guard, backup, audit, and dry-run cleanup only.
- Stage 2 is destructive: remove `app-api`, drop legacy tables, and delete old VPS releases only after production has completed a successful agnostic face-recognition cycle.

## Supabase

Active module functions:

- `auth-api`
- `public-api`
- `employees-api`
- `attendance-api`
- `admin-settings-api`
- `admin-reports-api`
- `audit-api`
- `admins-api`
- `guestbook-api`
- `survey-api`
- `face-orchestrator`

Legacy function retained for rollback:

- `app-api`

Face tables:

- Active: `face_clients`, `face_subjects`, `face_templates`
- Legacy rollback source: `face_embeddings`

Before dropping `face_embeddings`, run:

```bash
psql "$DATABASE_URL" -f scripts/legacy-cleanup/supabase_face_cleanup_audit.sql
scripts/legacy-cleanup/backup_supabase_face_data.sh ./legacy-backups
```

The backup directory must be outside the VPS deploy folder and must not be committed.

GitHub Actions manual cleanup:

- Workflow: `Legacy Cleanup Audit`
- `target=audit` writes a Supabase face-table audit artifact.
- `target=backup` writes a SQL backup artifact for `face_clients`, `face_subjects`, `face_templates`, and `face_embeddings`.
- `target=vps-cleanup`, `mode=dry-run` inventories safe VPS cleanup candidates.
- `target=vps-cleanup`, `mode=execute` requires `confirm_execute=CLEANUP_LEGACY` and only removes candidates listed by `scripts/legacy-cleanup/vps_cleanup_dry_run.sh`.

## VPS

Protected paths under `/home/monika-face-rec/htdocs/face-rec.monika.id`:

- `current`
- active release targeted by `current`
- `current/backend/.env`
- `current/backend/uploads`
- `face-recognition.pid`
- `face-recognition.log`

Dry-run cleanup command on the VPS:

```bash
DEPLOY_PATH=/home/monika-face-rec/htdocs/face-rec.monika.id \
KEEP_RELEASES=2 \
scripts/legacy-cleanup/vps_cleanup_dry_run.sh --dry-run
```

Execute only after reviewing the dry-run output:

```bash
DEPLOY_PATH=/home/monika-face-rec/htdocs/face-rec.monika.id \
KEEP_RELEASES=2 \
scripts/legacy-cleanup/vps_cleanup_dry_run.sh --execute
```

## Route Guard

The frontend must not call these legacy face routes through `face-orchestrator`:

- `/attendance/recognize`
- `/attendance/confirm`
- `/employees/{id}/face`

The allowed face routes are:

- `/recognize`
- `/detect`
- `/subjects`
- `/subjects/{id}`
- `/subjects/{id}/faces`
- `/faces/{id}`

Run guard tests:

```bash
node frontend/src/lib/apiFaceMigration.test.mjs
node supabase/functions/tests/face-routes.test.mjs
```
