#!/usr/bin/env bash
set -euo pipefail

deploy_path="${DEPLOY_PATH:-/home/monika-face-rec/htdocs/face-rec.monika.id}"
keep_releases="${KEEP_RELEASES:-2}"
mode="${1:---dry-run}"

if [ "$mode" != "--dry-run" ] && [ "$mode" != "--execute" ]; then
  echo "Usage: DEPLOY_PATH=/path KEEP_RELEASES=2 $0 [--dry-run|--execute]" >&2
  exit 1
fi

cd "$deploy_path"

echo "Deploy path: $deploy_path"
echo "Mode: $mode"
echo

echo "Protected paths:"
printf ' - %s\n' \
  "current" \
  "$(readlink current 2>/dev/null || true)" \
  "current/backend/.env" \
  "current/backend/uploads" \
  "face-recognition.pid" \
  "face-recognition.log"
echo

echo "Top-level inventory:"
find . -maxdepth 2 -mindepth 1 -printf '%M %s %p\n' | sort || true
echo

cleanup_paths=()
for path in backend-release.tar.gz backend-env; do
  [ -e "$path" ] && cleanup_paths+=("$path")
done

while IFS= read -r path; do
  cleanup_paths+=("$path")
done < <(find . -type d \( -name '__pycache__' -o -name '.pytest_cache' \) -print)

if [ -d releases ]; then
  while IFS= read -r old_release; do
    cleanup_paths+=("$old_release")
  done < <(find releases -mindepth 1 -maxdepth 1 -type d | sort -r | tail -n +"$((keep_releases + 1))")
fi

if [ "${#cleanup_paths[@]}" -eq 0 ]; then
  echo "No cleanup candidates found."
  exit 0
fi

echo "Cleanup candidates:"
printf ' - %s\n' "${cleanup_paths[@]}"
echo

if [ "$mode" = "--dry-run" ]; then
  echo "Dry-run only. Re-run with --execute after reviewing candidates."
  exit 0
fi

for path in "${cleanup_paths[@]}"; do
  rm -rf -- "$path"
done

echo "Cleanup executed."
