# Backend Face Recognition Low-Cost Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep face-recognition attendance responsive and stable for about 9 active users on a single-machine deployment without adding Redis, extra workers, or new services.

**Architecture:** Keep the backend single-process and optimize the existing hot path instead of introducing new infrastructure. Strengthen in-memory cache invalidation for settings, schedules, and holidays; eagerly refresh face embeddings after admin changes; and reduce per-request overhead in the face-recognition path.

**Tech Stack:** FastAPI, SQLAlchemy, MySQL, in-memory TTL cache, pytest, face_recognition/dlib, NumPy

---

## File Map

- Modify: `backend/app/utils/cache.py` — define reusable cache key constants for holiday cache invalidation.
- Modify: `backend/app/services/attendance.py` — centralize cache key usage and use helper-based invalidation-friendly reads.
- Modify: `backend/app/routers/settings.py` — invalidate settings, schedule, and holiday cache entries when admins mutate reference data.
- Modify: `backend/app/services/face_recognition.py` — reduce hot-path logging noise and gate verbose logs behind a debug flag.
- Modify: `backend/app/routers/face.py` — refresh the face embedding cache immediately after face create/delete changes.
- Test: `backend/tests/test_small_scale_optimizations.py` — add regression tests for cache invalidation and eager face-cache refresh behavior.

### Task 1: Add explicit cache keys for holiday and schedule invalidation

**Files:**
- Modify: `backend/app/utils/cache.py:55-63`
- Modify: `backend/app/services/attendance.py:1-76`
- Test: `backend/tests/test_small_scale_optimizations.py`

- [ ] **Step 1: Write the failing tests**

```python
from datetime import date

from app.services.attendance import attendance_service
from app.utils.cache import DAILY_SCHEDULE_CACHE_KEY, HOLIDAY_CACHE_KEY_PREFIX


def test_daily_schedule_cache_key_is_reused_by_service():
    assert attendance_service.get_daily_schedule_cache_key(2) == f"{DAILY_SCHEDULE_CACHE_KEY}:2"


def test_holiday_cache_key_is_reused_by_service():
    assert attendance_service.get_holiday_cache_key(date(2026, 4, 8)) == f"{HOLIDAY_CACHE_KEY_PREFIX}:2026-04-08"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/danypratmanto/Documents/GitHub/api-absen-desa.monika.id/backend && python3 -m pytest tests/test_small_scale_optimizations.py -k "cache_key" -v`
Expected: FAIL with `AttributeError` for missing helper methods or import errors for the holiday cache key constant.

- [ ] **Step 3: Write minimal implementation**

```python
# backend/app/utils/cache.py
HOLIDAY_CACHE_KEY_PREFIX = "holiday"

# backend/app/services/attendance.py
from app.utils.cache import (
    cache,
    SETTINGS_CACHE_KEY,
    DAILY_SCHEDULE_CACHE_KEY,
    HOLIDAY_CACHE_KEY_PREFIX,
)

class AttendanceService:
    def get_daily_schedule_cache_key(self, day_of_week: int) -> str:
        return f"{DAILY_SCHEDULE_CACHE_KEY}:{day_of_week}"

    def get_holiday_cache_key(self, check_date: date) -> str:
        return f"{HOLIDAY_CACHE_KEY_PREFIX}:{check_date.isoformat()}"
```

Replace direct string construction in `get_daily_schedule()` and `is_holiday()` to call these helper methods.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/danypratmanto/Documents/GitHub/api-absen-desa.monika.id/backend && python3 -m pytest tests/test_small_scale_optimizations.py -k "cache_key" -v`
Expected: PASS with 2 selected tests.

- [ ] **Step 5: Commit**

```bash
git add backend/app/utils/cache.py backend/app/services/attendance.py backend/tests/test_small_scale_optimizations.py
git commit -m "refactor: centralize attendance cache keys"
```

### Task 2: Invalidate settings and schedule caches on admin updates

**Files:**
- Modify: `backend/app/routers/settings.py:23-24`
- Modify: `backend/app/routers/settings.py:50-90`
- Modify: `backend/app/routers/settings.py:511-581`
- Test: `backend/tests/test_small_scale_optimizations.py`

- [ ] **Step 1: Write the failing tests**

```python
from app.routers.settings import (
    invalidate_schedule_related_caches,
    invalidate_settings_related_caches,
)
from app.utils.cache import cache, SETTINGS_CACHE_KEY, PUBLIC_SETTINGS_CACHE_KEY, DAILY_SCHEDULE_CACHE_KEY


def test_update_settings_clears_settings_and_public_cache():
    cache.clear()
    cache.set(SETTINGS_CACHE_KEY, "settings", ttl_seconds=300)
    cache.set(f"{PUBLIC_SETTINGS_CACHE_KEY}:2", "public", ttl_seconds=300)

    invalidate_settings_related_caches()

    assert cache.get(SETTINGS_CACHE_KEY) is None
    assert cache.get(f"{PUBLIC_SETTINGS_CACHE_KEY}:2") is None


def test_update_schedules_clears_all_daily_schedule_cache_entries():
    cache.clear()
    cache.set(f"{DAILY_SCHEDULE_CACHE_KEY}:0", "mon", ttl_seconds=300)
    cache.set(f"{DAILY_SCHEDULE_CACHE_KEY}:6", "sun", ttl_seconds=300)

    invalidate_schedule_related_caches()

    assert cache.get(f"{DAILY_SCHEDULE_CACHE_KEY}:0") is None
    assert cache.get(f"{DAILY_SCHEDULE_CACHE_KEY}:6") is None
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/danypratmanto/Documents/GitHub/api-absen-desa.monika.id/backend && python3 -m pytest tests/test_small_scale_optimizations.py -k "settings_clears or schedules_clears" -v`
Expected: FAIL with `NameError` or import errors because the invalidation helpers do not exist.

- [ ] **Step 3: Write minimal implementation**

```python
# backend/app/routers/settings.py
from app.utils.cache import (
    cache,
    SETTINGS_CACHE_KEY,
    PUBLIC_SETTINGS_CACHE_KEY,
    DAILY_SCHEDULE_CACHE_KEY,
    HOLIDAY_CACHE_KEY_PREFIX,
)


def invalidate_settings_related_caches() -> None:
    cache.invalidate(SETTINGS_CACHE_KEY)
    cache.invalidate_prefix(PUBLIC_SETTINGS_CACHE_KEY)


def invalidate_schedule_related_caches() -> None:
    cache.invalidate_prefix(DAILY_SCHEDULE_CACHE_KEY)
    cache.invalidate_prefix(PUBLIC_SETTINGS_CACHE_KEY)
```

Use `invalidate_settings_related_caches()` right after successful `db.commit()` inside `update_settings()`, `upload_logo()`, `delete_logo()`, `upload_background()`, and `delete_background()`. Use `invalidate_schedule_related_caches()` right after `db.commit()` inside `update_schedules()`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/danypratmanto/Documents/GitHub/api-absen-desa.monika.id/backend && python3 -m pytest tests/test_small_scale_optimizations.py -k "settings_clears or schedules_clears" -v`
Expected: PASS with 2 selected tests.

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/settings.py backend/tests/test_small_scale_optimizations.py
git commit -m "fix: invalidate settings and schedule caches"
```

### Task 3: Invalidate holiday cache entries on holiday mutations

**Files:**
- Modify: `backend/app/routers/settings.py:341-488`
- Test: `backend/tests/test_small_scale_optimizations.py`

- [ ] **Step 1: Write the failing tests**

```python
from app.routers.settings import invalidate_holiday_related_caches
from app.utils.cache import cache, HOLIDAY_CACHE_KEY_PREFIX


def test_holiday_mutation_clears_holiday_cache_prefix():
    cache.clear()
    cache.set(f"{HOLIDAY_CACHE_KEY_PREFIX}:2026-04-08", True, ttl_seconds=300)
    cache.set(f"{HOLIDAY_CACHE_KEY_PREFIX}:2026-12-25", True, ttl_seconds=300)

    invalidate_holiday_related_caches()

    assert cache.get(f"{HOLIDAY_CACHE_KEY_PREFIX}:2026-04-08") is None
    assert cache.get(f"{HOLIDAY_CACHE_KEY_PREFIX}:2026-12-25") is None
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/danypratmanto/Documents/GitHub/api-absen-desa.monika.id/backend && python3 -m pytest tests/test_small_scale_optimizations.py -k "holiday_mutation" -v`
Expected: FAIL because `invalidate_holiday_related_caches()` does not exist.

- [ ] **Step 3: Write minimal implementation**

```python
# backend/app/routers/settings.py

def invalidate_holiday_related_caches() -> None:
    cache.invalidate_prefix(HOLIDAY_CACHE_KEY_PREFIX)
```

Call `invalidate_holiday_related_caches()` after successful `db.commit()` in:
- `create_holiday()`
- `delete_holiday()`
- `sync_holidays()`
- `restore_holiday()`

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/danypratmanto/Documents/GitHub/api-absen-desa.monika.id/backend && python3 -m pytest tests/test_small_scale_optimizations.py -k "holiday_mutation" -v`
Expected: PASS with 1 selected test.

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/settings.py backend/tests/test_small_scale_optimizations.py
git commit -m "fix: invalidate holiday cache after admin changes"
```

### Task 4: Refresh face embedding cache eagerly after admin face changes

**Files:**
- Modify: `backend/app/routers/face.py:18-83`
- Modify: `backend/app/routers/face.py:103-129`
- Test: `backend/tests/test_small_scale_optimizations.py`

- [ ] **Step 1: Write the failing tests**

```python
from app.routers.face import refresh_face_embedding_cache


class DummyFaceRecognitionService:
    def __init__(self):
        self.calls = []
        self.enabled = True

    def invalidate_cache(self):
        self.calls.append("invalidate")

    def refresh_embedding_cache(self, db):
        self.calls.append(("refresh", db))


def test_refresh_face_cache_forces_refresh_after_invalidation():
    service = DummyFaceRecognitionService()
    db = object()

    refresh_face_embedding_cache(service, db)

    assert service.calls == ["invalidate", ("refresh", db)]
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/danypratmanto/Documents/GitHub/api-absen-desa.monika.id/backend && python3 -m pytest tests/test_small_scale_optimizations.py -k "refresh_face_cache" -v`
Expected: FAIL because `refresh_face_embedding_cache()` does not exist.

- [ ] **Step 3: Write minimal implementation**

```python
# backend/app/routers/face.py

def refresh_face_embedding_cache(service, db: Session) -> None:
    service.invalidate_cache()
    if service.enabled:
        service.refresh_embedding_cache(db)
```

Replace the current direct `invalidate_cache()` calls in both `upload_face()` and `delete_face()` with `refresh_face_embedding_cache(face_recognition_service, db)`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/danypratmanto/Documents/GitHub/api-absen-desa.monika.id/backend && python3 -m pytest tests/test_small_scale_optimizations.py -k "refresh_face_cache" -v`
Expected: PASS with 1 selected test.

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/face.py backend/tests/test_small_scale_optimizations.py
git commit -m "perf: eagerly refresh face cache after updates"
```

### Task 5: Reduce hot-path face recognition logging noise

**Files:**
- Modify: `backend/app/config.py:17-29`
- Modify: `backend/app/services/face_recognition.py:1-316`
- Test: `backend/tests/test_small_scale_optimizations.py`

- [ ] **Step 1: Write the failing tests**

```python
from app.services.face_recognition import FaceRecognitionService


def test_face_recognition_debug_logging_defaults_to_false():
    service = FaceRecognitionService()

    assert service.debug_logging is False
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/danypratmanto/Documents/GitHub/api-absen-desa.monika.id/backend && python3 -m pytest tests/test_small_scale_optimizations.py -k "debug_logging" -v`
Expected: FAIL with `AttributeError: 'FaceRecognitionService' object has no attribute 'debug_logging'`.

- [ ] **Step 3: Write minimal implementation**

```python
# backend/app/config.py
FACE_RECOGNITION_DEBUG_LOGS: bool = False

# backend/app/services/face_recognition.py
from app.config import get_settings

settings = get_settings()

class FaceRecognitionService:
    def __init__(self):
        self.enabled = FACE_RECOGNITION_AVAILABLE
        self.debug_logging = settings.FACE_RECOGNITION_DEBUG_LOGS

    def _debug(self, message: str) -> None:
        if self.debug_logging:
            print(message)
```

Replace informational `print(...)` calls inside hot-path methods with `self._debug(...)`. Keep startup import messages and actual error logging intact.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/danypratmanto/Documents/GitHub/api-absen-desa.monika.id/backend && python3 -m pytest tests/test_small_scale_optimizations.py -k "debug_logging" -v`
Expected: PASS with 1 selected test.

- [ ] **Step 5: Commit**

```bash
git add backend/app/config.py backend/app/services/face_recognition.py backend/tests/test_small_scale_optimizations.py
git commit -m "perf: reduce face recognition log noise"
```

### Task 6: Run the focused verification suite and startup checks

**Files:**
- Test: `backend/tests/test_small_scale_optimizations.py`

- [ ] **Step 1: Run the focused optimization test suite**

Run: `cd /Users/danypratmanto/Documents/GitHub/api-absen-desa.monika.id/backend && python3 -m pytest tests/test_small_scale_optimizations.py -v`
Expected: PASS with the cache-key, cache-invalidation, eager-refresh, TTL, and debug-logging regression tests green.

- [ ] **Step 2: Run backend startup verification**

Run: `cd /Users/danypratmanto/Documents/GitHub/api-absen-desa.monika.id/backend && python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8000`
Expected: startup logs complete without import or cache refresh errors. Stop the server after verifying startup.

- [ ] **Step 3: Run health verification against the running server**

Run: `curl -sSf http://127.0.0.1:8000/health`
Expected: `{"status":"healthy"}`

- [ ] **Step 4: Commit**

```bash
git add backend/tests/test_small_scale_optimizations.py backend/app/utils/cache.py backend/app/services/attendance.py backend/app/routers/settings.py backend/app/routers/face.py backend/app/config.py backend/app/services/face_recognition.py
git commit -m "perf: optimize low-cost face recognition path"
```
