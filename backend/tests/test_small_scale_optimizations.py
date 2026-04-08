from datetime import date

from app.models.daily_schedule import DailyWorkSchedule
from app.models.work_settings import WorkSettings
from app.services.attendance import attendance_service
from app.utils.cache import (
    cache,
    DAILY_SCHEDULE_CACHE_KEY,
    HOLIDAY_CACHE_KEY_PREFIX,
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
    def __init__(self, schedule=None, work_settings=None):
        self.schedule = schedule
        self.work_settings = work_settings
        self.query_calls = []

    def query(self, model):
        self.query_calls.append(model)
        if model is DailyWorkSchedule:
            return DummyQuery(self.schedule)
        if model is WorkSettings:
            return DummyQuery(self.work_settings)
        raise AssertionError(f"Unexpected model query: {model}")

    def add(self, value):
        self.work_settings = value

    def commit(self):
        return None

    def refresh(self, value):
        return None


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



def test_get_holiday_cache_key_uses_shared_prefix():
    assert (
        attendance_service.get_holiday_cache_key(date(2026, 4, 8))
        == f"{HOLIDAY_CACHE_KEY_PREFIX}:2026-04-08"
    )
