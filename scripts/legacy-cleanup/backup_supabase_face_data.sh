#!/usr/bin/env bash
set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required. Use the Supabase pooler/direct Postgres URL." >&2
  exit 1
fi

backup_dir="${1:-./legacy-backups}"
timestamp="$(date +%Y%m%d%H%M%S)"
output="${backup_dir}/face-core-legacy-${timestamp}.sql"

mkdir -p "$backup_dir"
umask 077

pg_dump "$DATABASE_URL" \
  --data-only \
  --column-inserts \
  --table=public.face_clients \
  --table=public.face_subjects \
  --table=public.face_templates \
  --table=public.face_embeddings \
  > "$output"

sha256sum "$output" > "${output}.sha256" 2>/dev/null || shasum -a 256 "$output" > "${output}.sha256"

echo "Backup written to: $output"
echo "Checksum written to: ${output}.sha256"
