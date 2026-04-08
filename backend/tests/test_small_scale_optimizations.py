from datetime import date, time

from app.models.daily_schedule import DailyWorkSchedule
from app.models.holiday import Holiday
from app.models.work_settings import WorkSettings
from app.routers.settings import (
    create_holiday,
    delete_logo,
    invalidate_holiday_related_caches,
    invalidate_schedule_related_caches,
    invalidate_settings_related_caches,
    update_schedules,
    update_settings,
)
from app.services.attendance import attendance_service
from app.schemas.holiday import HolidayCreate
from app.schemas.settings import DailyScheduleBatchUpdate, WorkSettingsUpdate
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


class HolidayMutationDB(DummyDB):
    def __init__(self, existing_holiday=None):
        super().__init__(holiday=existing_holiday)
        self.added = []
        self.events = []

    def add(self, value):
        self.added.append(value)
        self.holiday = value

    def commit(self):
        self.events.append("commit")
        return None

    def refresh(self, value):
        self.events.append("refresh")
        return None


class QueryList:
    def __init__(self, result):
        self.result = list(result)

    def order_by(self, *args, **kwargs):
        return self

    def all(self):
        return list(self.result)


class ScheduleSequenceDB(DummyDB):
    def __init__(self, schedules):
        super().__init__()
        self.schedules = list(schedules)
        self.events = []

    def query(self, model):
        self.query_calls.append(model)
        if model is DailyWorkSchedule:
            return QueryList(self.schedules)
        raise AssertionError(f"Unexpected model query: {model}")

    def commit(self):
        self.events.append("commit")
        return None


def make_schedule(day_of_week: int, is_workday: bool = True):
    return DailyWorkSchedule(
        day_of_week=day_of_week,
        is_workday=is_workday,
        check_in_start=time(8, 0),
        check_in_end=time(9, 0),
        check_out_start=time(16, 0),
    )


def build_batch_update():
    return DailyScheduleBatchUpdate(
        schedules=[
            {
                "day_of_week": day,
                "is_workday": day < 5,
                "check_in_start": time(8, 0),
                "check_in_end": time(9, 0),
                "check_out_start": time(16, 0),
            }
            for day in range(7)
        ]
    )


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


def test_holiday_mutation_helper_clears_holiday_prefix_entries():
    cache.clear()
    cache.set(f"{HOLIDAY_CACHE_KEY_PREFIX}:2026-04-08", True, ttl_seconds=300)
    cache.set(f"{HOLIDAY_CACHE_KEY_PREFIX}:2026-12-25", True, ttl_seconds=300)
    cache.set(SETTINGS_CACHE_KEY, {"theme": "desa"}, ttl_seconds=300)

    invalidate_holiday_related_caches()

    assert cache.get(f"{HOLIDAY_CACHE_KEY_PREFIX}:2026-04-08") is None
    assert cache.get(f"{HOLIDAY_CACHE_KEY_PREFIX}:2026-12-25") is None
    assert cache.get(SETTINGS_CACHE_KEY) == {"theme": "desa"}



def test_create_holiday_invalidates_holiday_cache_after_commit(monkeypatch):
    cache.clear()
    cache.set(f"{HOLIDAY_CACHE_KEY_PREFIX}:2026-04-08", True, ttl_seconds=300)
    db = HolidayMutationDB(existing_holiday=None)
    admin = type("AdminStub", (), {"name": "reviewer"})()

    monkeypatch.setattr("app.routers.settings.log_audit", lambda **kwargs: None)

    holiday = create_holiday(
        HolidayCreate(name="Libur Nasional", date=date(2026, 4, 8), description="Tes regresi"),
        db=db,
        admin=admin,
    )

    assert holiday.name == "Libur Nasional"
    assert db.events == ["commit", "refresh"]
    assert len(db.added) == 1
    assert cache.get(f"{HOLIDAY_CACHE_KEY_PREFIX}:2026-04-08") is None



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



def test_update_schedules_invalidates_schedule_and_public_caches_after_commit(monkeypatch):
    cache.clear()
    cache.set(f"{DAILY_SCHEDULE_CACHE_KEY}:1", {"is_workday": True}, ttl_seconds=300)
    cache.set(f"{PUBLIC_SETTINGS_CACHE_KEY}:home", {"logo": "/logo.png"}, ttl_seconds=300)
    db = ScheduleSequenceDB([make_schedule(day) for day in range(7)])
    admin = type("AdminStub", (), {"name": "reviewer"})()

    monkeypatch.setattr("app.routers.settings.log_audit", lambda **kwargs: None)

    result = update_schedules(build_batch_update(), db=db, admin=admin)

    assert len(result) == 7
    assert db.events == ["commit"]
    assert cache.get(f"{DAILY_SCHEDULE_CACHE_KEY}:1") is None
    assert cache.get(f"{PUBLIC_SETTINGS_CACHE_KEY}:home") is None



def test_delete_logo_invalidates_settings_and_public_caches_after_commit(monkeypatch):
    cache.clear()
    cache.set(SETTINGS_CACHE_KEY, {"theme": "desa"}, ttl_seconds=300)
    cache.set(f"{PUBLIC_SETTINGS_CACHE_KEY}:home", {"logo": "/logo.png"}, ttl_seconds=300)
    settings = WorkSettings(logo_url="/missing-logo.png")
    db = SequenceDB(work_settings=settings)
    admin = type("AdminStub", (), {"name": "reviewer"})()

    monkeypatch.setattr("app.routers.settings.log_audit", lambda **kwargs: None)
    monkeypatch.setattr("app.routers.settings.os.path.exists", lambda path: False)

    response = delete_logo(db=db, admin=admin)

    assert response == {"message": "Logo berhasil dihapus"}
    assert settings.logo_url is None
    assert db.events == ["commit"]
    assert cache.get(SETTINGS_CACHE_KEY) is None
    assert cache.get(f"{PUBLIC_SETTINGS_CACHE_KEY}:home") is None
