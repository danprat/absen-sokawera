from datetime import date

from app.models.daily_schedule import DailyWorkSchedule
from app.models.holiday import Holiday
from app.models.work_settings import WorkSettings
from app.routers.settings import (
    invalidate_schedule_related_caches,
    invalidate_settings_related_caches,
    update_settings,
)
from app.services.attendance import attendance_service
from app.schemas.settings import WorkSettingsUpdate
from app.utils.cache import (
    cache,
    DAILY_SCHEDULE_CACHE_KEY,
    HOLIDAY_CACHE_KEY_PREFIX,
    PUBLIC_SETTINGS_CACHE_KEY,
    SETTINGS_CACHE_KEY,
)


class DummyQuery:
    def __init__(self, result):
        self.result = result

    def filter(self, *args, **kwargs):
        return self

    def first(self):
        return self.result


class DummyDB:
    def __init__(self, schedule=None, work_settings=None, holiday=None):
        self.schedule = schedule
        self.work_settings = work_settings
        self.holiday = holiday
        self.query_calls = []

    def query(self, model):
        self.query_calls.append(model)
        if model is DailyWorkSchedule:
            return DummyQuery(self.schedule)
        if model is WorkSettings:
            return DummyQuery(self.work_settings)
        if model is Holiday:
            return DummyQuery(self.holiday)
        raise AssertionError(f"Unexpected model query: {model}")

    def add(self, value):
        self.work_settings = value

    def commit(self):
        return None

    def refresh(self, value):
        return None


class SequenceDB(DummyDB):
    def __init__(self, work_settings=None):
        super().__init__(work_settings=work_settings)
        self.events = []

    def commit(self):
        self.events.append("commit")
        return None

    def refresh(self, value):
        self.events.append("refresh")
        raise RuntimeError("refresh failed")


def test_is_workday_uses_cached_daily_schedule_result():
    cache.clear()
    check_date = date(2026, 4, 8)
    schedule = DailyWorkSchedule(day_of_week=check_date.weekday(), is_workday=False)
    cache_key = f"{DAILY_SCHEDULE_CACHE_KEY}:{check_date.weekday()}"
    cache.set(cache_key, schedule, ttl_seconds=300)
    db = DummyDB(schedule=None)

    result = attendance_service.is_workday(db, check_date)

    assert result is False
    assert db.query_calls == []


def test_attendance_cache_ttls_are_tuned_for_small_deployment():
    cache.clear()
    db = DummyDB(work_settings=WorkSettings())

    attendance_service.get_work_settings(db)

    _, expires = cache._cache[SETTINGS_CACHE_KEY]
    remaining_seconds = int((expires - expires.now()).total_seconds())

    assert remaining_seconds >= 250


def test_get_daily_schedule_cache_key_uses_shared_prefix():
    assert (
        attendance_service.get_daily_schedule_cache_key(2)
        == f"{DAILY_SCHEDULE_CACHE_KEY}:2"
    )



def test_is_holiday_returns_cached_value_without_querying_holiday_table():
    cache.clear()
    check_date = date(2026, 4, 8)
    cache_key = attendance_service.get_holiday_cache_key(check_date)
    cache.set(cache_key, True, ttl_seconds=300)
    db = DummyDB(holiday=None)

    result = attendance_service.is_holiday(db, check_date)

    assert result is True
    assert Holiday not in db.query_calls



def test_get_holiday_cache_key_uses_shared_prefix():
    assert (
        attendance_service.get_holiday_cache_key(date(2026, 4, 8))
        == f"{HOLIDAY_CACHE_KEY_PREFIX}:2026-04-08"
    )


def test_settings_clears_settings_and_public_settings_prefix():
    cache.clear()
    cache.set(SETTINGS_CACHE_KEY, {"theme": "desa"}, ttl_seconds=300)
    cache.set(f"{PUBLIC_SETTINGS_CACHE_KEY}:home", {"logo": "/logo.png"}, ttl_seconds=300)
    cache.set(f"{PUBLIC_SETTINGS_CACHE_KEY}:guestbook", {"logo": "/logo.png"}, ttl_seconds=300)
    cache.set(f"{DAILY_SCHEDULE_CACHE_KEY}:1", {"is_workday": True}, ttl_seconds=300)

    invalidate_settings_related_caches()

    assert cache.get(SETTINGS_CACHE_KEY) is None
    assert cache.get(f"{PUBLIC_SETTINGS_CACHE_KEY}:home") is None
    assert cache.get(f"{PUBLIC_SETTINGS_CACHE_KEY}:guestbook") is None
    assert cache.get(f"{DAILY_SCHEDULE_CACHE_KEY}:1") == {"is_workday": True}


def test_update_settings_invalidates_cache_immediately_after_commit(monkeypatch):
    cache.clear()
    cache.set(SETTINGS_CACHE_KEY, {"theme": "desa"}, ttl_seconds=300)
    cache.set(f"{PUBLIC_SETTINGS_CACHE_KEY}:home", {"logo": "/logo.png"}, ttl_seconds=300)
    db = SequenceDB(work_settings=WorkSettings())
    admin = type("AdminStub", (), {"name": "reviewer"})()

    monkeypatch.setattr("app.routers.settings.log_audit", lambda **kwargs: None)

    try:
        update_settings(WorkSettingsUpdate(village_name="Desa Maju"), db=db, admin=admin)
    except RuntimeError as exc:
        assert str(exc) == "refresh failed"
    else:
        raise AssertionError("update_settings should surface refresh failure in this regression test")

    assert db.events == ["commit", "refresh"]
    assert cache.get(SETTINGS_CACHE_KEY) is None
    assert cache.get(f"{PUBLIC_SETTINGS_CACHE_KEY}:home") is None


def test_schedules_clears_schedule_and_public_settings_prefixes():
    cache.clear()
    cache.set(f"{DAILY_SCHEDULE_CACHE_KEY}:1", {"is_workday": True}, ttl_seconds=300)
    cache.set(f"{DAILY_SCHEDULE_CACHE_KEY}:5", {"is_workday": False}, ttl_seconds=300)
    cache.set(f"{PUBLIC_SETTINGS_CACHE_KEY}:home", {"logo": "/logo.png"}, ttl_seconds=300)
    cache.set(SETTINGS_CACHE_KEY, {"theme": "desa"}, ttl_seconds=300)

    invalidate_schedule_related_caches()

    assert cache.get(f"{DAILY_SCHEDULE_CACHE_KEY}:1") is None
    assert cache.get(f"{DAILY_SCHEDULE_CACHE_KEY}:5") is None
    assert cache.get(f"{PUBLIC_SETTINGS_CACHE_KEY}:home") is None
    assert cache.get(SETTINGS_CACHE_KEY) == {"theme": "desa"}
