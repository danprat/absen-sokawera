import asyncio
from datetime import date, time

from fastapi import HTTPException

from app.config import get_settings
from app.models.daily_schedule import DailyWorkSchedule
from app.models.employee import Employee
from app.services.face_recognition import FaceRecognitionService, face_recognition_service
from app.models.face_embedding import FaceEmbedding
from app.models.holiday import Holiday
from app.models.survey import SurveyQuestion, QuestionType as SurveyQuestionType
from app.models.work_settings import WorkSettings
from app.routers.admin_survey import create_question, delete_question, reorder_questions, update_question
from app.routers.face import delete_face, refresh_face_embedding_cache, upload_face
from app.routers.attendance import invalidate_attendance_cache
from app.routers.settings import (
    create_holiday,
    delete_holiday,
    delete_logo,
    invalidate_holiday_related_caches,
    invalidate_schedule_related_caches,
    invalidate_settings_related_caches,
    restore_holiday,
    sync_holidays,
    update_schedules,
    update_settings,
)
from app.services.attendance import attendance_service
from app.schemas.holiday import HolidayCreate
from app.schemas.settings import DailyScheduleBatchUpdate, WorkSettingsUpdate
from app.schemas.survey import ReorderQuestionsRequest, SurveyQuestionCreate, SurveyQuestionUpdate
from app.utils.cache import (
    cache,
    DAILY_SCHEDULE_CACHE_KEY,
    HOLIDAY_CACHE_KEY_PREFIX,
    PUBLIC_SETTINGS_CACHE_KEY,
    SETTINGS_CACHE_KEY,
    SURVEY_STATS_CACHE_KEY,
)
from app.utils.face_service_auth import require_face_service_key


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
        self.deleted = []
        self.events = []

    def add(self, value):
        self.added.append(value)
        self.holiday = value

    def delete(self, value):
        self.deleted.append(value)
        if self.holiday is value:
            self.holiday = None

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


class HolidaySequenceDB(HolidayMutationDB):
    def refresh(self, value):
        self.events.append("refresh")
        raise RuntimeError("refresh failed")


class SyncSequenceDB(DummyDB):
    pass


class FaceCacheServiceStub:
    def __init__(self, enabled: bool):
        self.enabled = enabled
        self.events = []
        self.refresh_db = None

    def invalidate_cache(self):
        self.events.append("invalidate")

    def refresh_embedding_cache(self, db):
        self.events.append("refresh")
        self.refresh_db = db


class UploadFaceEmployeeQuery:
    def __init__(self, employee):
        self.employee = employee

    def filter(self, *args, **kwargs):
        return self

    def first(self):
        return self.employee


class UploadFaceCountQuery:
    def __init__(self, count_result):
        self.count_result = count_result

    def filter(self, *args, **kwargs):
        return self

    def count(self):
        return self.count_result


class UploadFaceDB:
    def __init__(self, employee, existing_count=0):
        self.employee = employee
        self.existing_count = existing_count
        self.added = []
        self.events = []

    def query(self, model):
        if model is Employee:
            return UploadFaceEmployeeQuery(self.employee)
        if model is FaceEmbedding:
            return UploadFaceCountQuery(self.existing_count)
        raise AssertionError(f"Unexpected model query: {model}")

    def add(self, value):
        self.added.append(value)

    def commit(self):
        self.events.append("commit")
        return None

    def refresh(self, value):
        self.events.append("refresh")
        value.id = 99
        return None


class DeleteFaceQuery:
    def __init__(self, face):
        self.face = face

    def filter(self, *args, **kwargs):
        return self

    def first(self):
        return self.face


class DeleteFaceDB:
    def __init__(self, face):
        self.face = face
        self.deleted = []
        self.events = []

    def query(self, model):
        if model is FaceEmbedding:
            return DeleteFaceQuery(self.face)
        raise AssertionError(f"Unexpected model query: {model}")

    def delete(self, value):
        self.deleted.append(value)

    def commit(self):
        self.events.append("commit")
        return None


class SurveyQuestionQuery:
    def __init__(self, question=None, max_order=0):
        self.question = question
        self.max_order = max_order
        self.updated_orders = []

    def filter(self, *args, **kwargs):
        return self

    def first(self):
        return self.question

    def scalar(self):
        return self.max_order

    def update(self, values):
        self.updated_orders.append(values)
        return 1


class SurveyQuestionMutationDB:
    def __init__(self, question=None, max_order=0):
        self.question = question
        self.max_order = max_order
        self.added = []
        self.deleted = []
        self.events = []
        self.last_query = None

    def query(self, model):
        if model is SurveyQuestion or getattr(model, "name", None) == "max":
            self.last_query = SurveyQuestionQuery(question=self.question, max_order=self.max_order)
            return self.last_query
        raise AssertionError(f"Unexpected model query: {model}")

    def add(self, value):
        self.added.append(value)
        self.question = value

    def delete(self, value):
        self.deleted.append(value)

    def commit(self):
        self.events.append("commit")
        return None

    def refresh(self, value):
        self.events.append("refresh")
        if getattr(value, "id", None) is None:
            value.id = 42
        return None


class UploadFileStub:
    def __init__(self, content_type="image/jpeg", filename="face.jpg", data=b"image-bytes"):
        self.content_type = content_type
        self.filename = filename
        self._data = data

    async def read(self):
        return self._data


class FileWriterStub:
    def __init__(self, events):
        self.events = events

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return None

    def write(self, data):
        self.events.append("write")
        self.data = data


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


def test_internal_attendance_cache_invalidation_clears_settings_schedule_and_holidays():
    cache.clear()
    cache.set(SETTINGS_CACHE_KEY, {"threshold": 0.5}, ttl_seconds=300)
    cache.set(f"{DAILY_SCHEDULE_CACHE_KEY}:6", make_schedule(6, is_workday=False), ttl_seconds=300)
    cache.set(f"{HOLIDAY_CACHE_KEY_PREFIX}:2026-04-26", True, ttl_seconds=300)
    cache.set(PUBLIC_SETTINGS_CACHE_KEY, {"keep": True}, ttl_seconds=300)

    response = invalidate_attendance_cache()

    assert response == {"message": "Cache absensi berhasil dihapus"}
    assert cache.get(SETTINGS_CACHE_KEY) is None
    assert cache.get(f"{DAILY_SCHEDULE_CACHE_KEY}:6") is None
    assert cache.get(f"{HOLIDAY_CACHE_KEY_PREFIX}:2026-04-26") is None
    assert cache.get(PUBLIC_SETTINGS_CACHE_KEY) == {"keep": True}



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



def test_delete_holiday_invalidates_holiday_cache_after_manual_delete_commit(monkeypatch):
    cache.clear()
    cache.set(f"{HOLIDAY_CACHE_KEY_PREFIX}:2026-04-08", True, ttl_seconds=300)
    holiday = Holiday(id=7, name="Libur Manual", date=date(2026, 4, 8), is_auto=False)
    db = HolidayMutationDB(existing_holiday=holiday)
    admin = type("AdminStub", (), {"name": "reviewer"})()

    monkeypatch.setattr("app.routers.settings.log_audit", lambda **kwargs: None)

    delete_holiday(holiday_id=holiday.id, db=db, admin=admin)

    assert db.deleted == [holiday]
    assert db.events == ["commit"]
    assert cache.get(f"{HOLIDAY_CACHE_KEY_PREFIX}:2026-04-08") is None



def test_delete_holiday_invalidates_holiday_cache_after_excluding_auto_holiday(monkeypatch):
    cache.clear()
    cache.set(f"{HOLIDAY_CACHE_KEY_PREFIX}:2026-12-25", True, ttl_seconds=300)
    holiday = Holiday(id=9, name="Libur API", date=date(2026, 12, 25), is_auto=True, is_excluded=False)
    db = HolidayMutationDB(existing_holiday=holiday)
    admin = type("AdminStub", (), {"name": "reviewer"})()

    monkeypatch.setattr("app.routers.settings.log_audit", lambda **kwargs: None)

    delete_holiday(holiday_id=holiday.id, db=db, admin=admin)

    assert holiday.is_excluded is True
    assert db.deleted == []
    assert db.events == ["commit"]
    assert cache.get(f"{HOLIDAY_CACHE_KEY_PREFIX}:2026-12-25") is None



def test_restore_holiday_invalidates_holiday_cache_after_commit_before_refresh(monkeypatch):
    cache.clear()
    cache.set(f"{HOLIDAY_CACHE_KEY_PREFIX}:2026-05-01", True, ttl_seconds=300)
    holiday = Holiday(id=11, name="Hari Buruh", date=date(2026, 5, 1), is_excluded=True)
    db = HolidaySequenceDB(existing_holiday=holiday)
    admin = type("AdminStub", (), {"name": "reviewer"})()

    monkeypatch.setattr("app.routers.settings.log_audit", lambda **kwargs: None)

    try:
        restore_holiday(holiday_id=holiday.id, db=db, admin=admin)
    except RuntimeError as exc:
        assert str(exc) == "refresh failed"
    else:
        raise AssertionError("restore_holiday should surface refresh failure in this regression test")

    assert holiday.is_excluded is False
    assert db.events == ["commit", "refresh"]
    assert cache.get(f"{HOLIDAY_CACHE_KEY_PREFIX}:2026-05-01") is None



def test_sync_holidays_invalidates_holiday_cache_before_audit_logging(monkeypatch):
    cache.clear()
    cache.set(f"{HOLIDAY_CACHE_KEY_PREFIX}:2026-01-01", True, ttl_seconds=300)
    db = SyncSequenceDB()
    admin = type("AdminStub", (), {"name": "reviewer"})()
    events = []

    async def fake_sync_holidays_from_api(passed_db, target_year):
        assert passed_db is db
        assert target_year == 2026
        events.append("service")
        return {"added": 1, "updated": 2, "skipped": 3}

    def fake_invalidate_holiday_related_caches():
        events.append("invalidate")
        cache.invalidate_prefix(f"{HOLIDAY_CACHE_KEY_PREFIX}:")

    def fake_log_audit(**kwargs):
        events.append("audit")
        assert cache.get(f"{HOLIDAY_CACHE_KEY_PREFIX}:2026-01-01") is None

    monkeypatch.setattr("app.routers.settings.sync_holidays_from_api", fake_sync_holidays_from_api)
    monkeypatch.setattr("app.routers.settings.invalidate_holiday_related_caches", fake_invalidate_holiday_related_caches)
    monkeypatch.setattr("app.routers.settings.log_audit", fake_log_audit)

    response = __import__("asyncio").run(sync_holidays(year=2026, db=db, admin=admin))

    assert response.added == 1
    assert response.updated == 2
    assert response.skipped == 3
    assert events == ["service", "invalidate", "audit"]
    assert cache.get(f"{HOLIDAY_CACHE_KEY_PREFIX}:2026-01-01") is None



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



def test_refresh_face_cache_invalidates_then_refreshes_for_enabled_service():
    db = object()
    service = FaceCacheServiceStub(enabled=True)

    refresh_face_embedding_cache(service, db)

    assert service.events == ["invalidate", "refresh"]
    assert service.refresh_db is db



def test_refresh_face_cache_invalidates_without_refresh_for_disabled_service():
    db = object()
    service = FaceCacheServiceStub(enabled=False)

    refresh_face_embedding_cache(service, db)

    assert service.events == ["invalidate"]
    assert service.refresh_db is None



def test_upload_face_refreshes_face_cache_after_commit(monkeypatch):
    db = UploadFaceDB(employee=Employee(id=5), existing_count=0)
    file = UploadFileStub()
    admin = type("AdminStub", (), {"name": "reviewer"})()
    events = []
    embedding_calls = []

    monkeypatch.setattr("app.routers.face.face_recognition_service.detect_face", lambda image_data: True)

    def generate_embedding(image_data, use_cnn, num_jitters):
        embedding_calls.append((use_cnn, num_jitters))
        return "embedding-vector"

    monkeypatch.setattr("app.routers.face.face_recognition_service.generate_embedding", generate_embedding)
    monkeypatch.setattr("app.routers.face.os.makedirs", lambda path, exist_ok: None)
    monkeypatch.setattr("app.routers.face.uuid.uuid4", lambda: "fixed-upload-id")
    monkeypatch.setattr("builtins.open", lambda *args, **kwargs: FileWriterStub(events))

    def record_refresh(service, passed_db):
        events.append("refresh_cache")
        assert passed_db is db
        assert db.events == ["commit", "refresh"]

    monkeypatch.setattr("app.routers.face.refresh_face_embedding_cache", record_refresh)

    response = asyncio.run(upload_face(employee_id=5, file=file, db=db, admin=admin))

    assert response.id == 99
    assert response.photo_url == "/uploads/faces/fixed-upload-id.jpg"
    assert db.events == ["commit", "refresh"]
    assert events == ["write", "refresh_cache"]
    assert len(db.added) == 1
    assert db.added[0].embedding == "embedding-vector"
    assert db.added[0].tenant_id == "default"
    assert db.added[0].is_primary is True
    assert embedding_calls == [(False, 1)]


def test_upload_face_rejects_when_embedding_generation_fails(monkeypatch):
    db = UploadFaceDB(employee=Employee(id=5), existing_count=0)
    file = UploadFileStub()
    admin = type("AdminStub", (), {"name": "reviewer"})()

    monkeypatch.setattr("app.routers.face.face_recognition_service.detect_face", lambda image_data: True)
    monkeypatch.setattr(
        "app.routers.face.face_recognition_service.generate_embedding",
        lambda image_data, use_cnn, num_jitters: None,
    )

    try:
        asyncio.run(upload_face(employee_id=5, file=file, db=db, admin=admin))
    except HTTPException as exc:
        assert exc.status_code == 400
        assert exc.detail == "Embedding wajah gagal dibuat. Coba gunakan foto wajah yang lebih jelas."
    else:
        raise AssertionError("upload_face should reject missing face embeddings")

    assert db.added == []
    assert db.events == []



def test_delete_face_refreshes_face_cache_after_commit(monkeypatch):
    face = FaceEmbedding(id=8, employee_id=5, photo_url="/uploads/faces/face.jpg")
    db = DeleteFaceDB(face=face)
    admin = type("AdminStub", (), {"name": "reviewer"})()
    events = []

    monkeypatch.setattr("app.routers.face.os.path.exists", lambda path: False)

    def record_refresh(service, passed_db):
        events.append("refresh_cache")
        assert passed_db is db
        assert db.events == ["commit"]

    monkeypatch.setattr("app.routers.face.refresh_face_embedding_cache", record_refresh)

    delete_face(employee_id=5, face_id=8, db=db, admin=admin)

    assert db.deleted == [face]
    assert db.events == ["commit"]
    assert events == ["refresh_cache"]



def test_create_question_invalidates_survey_stats_cache_after_commit(monkeypatch):
    cache.clear()
    cache.set(f"{SURVEY_STATS_CACHE_KEY}:questions:cached", {"questions": []}, ttl_seconds=300)
    cache.set(f"{SURVEY_STATS_CACHE_KEY}:summary:cached", {"total": 1}, ttl_seconds=300)
    db = SurveyQuestionMutationDB(max_order=3)
    admin = type("AdminStub", (), {"username": "reviewer"})()

    monkeypatch.setattr("app.routers.admin_survey.log_audit", lambda **kwargs: None)

    question = create_question(
        SurveyQuestionCreate(
            question_text="Apakah pertanyaan baru langsung muncul?",
            question_type=SurveyQuestionType.text,
            is_required=True,
        ),
        db=db,
        admin=admin,
    )

    assert question.id == 42
    assert db.events == ["commit", "refresh"]
    assert cache.get(f"{SURVEY_STATS_CACHE_KEY}:questions:cached") is None
    assert cache.get(f"{SURVEY_STATS_CACHE_KEY}:summary:cached") == {"total": 1}



def test_update_question_invalidates_survey_stats_cache_after_commit(monkeypatch):
    cache.clear()
    cache.set(f"{SURVEY_STATS_CACHE_KEY}:questions:cached", {"questions": []}, ttl_seconds=300)
    question = SurveyQuestion(
        id=9,
        question_text="Pertanyaan lama",
        question_type=SurveyQuestionType.rating,
        is_required=True,
        is_active=True,
        order=1,
    )
    db = SurveyQuestionMutationDB(question=question)
    admin = type("AdminStub", (), {"username": "reviewer"})()

    monkeypatch.setattr("app.routers.admin_survey.log_audit", lambda **kwargs: None)

    result = update_question(
        question_id=9,
        data=SurveyQuestionUpdate(question_text="Pertanyaan baru"),
        db=db,
        admin=admin,
    )

    assert result.question_text == "Pertanyaan baru"
    assert db.events == ["commit", "refresh"]
    assert cache.get(f"{SURVEY_STATS_CACHE_KEY}:questions:cached") is None



def test_reorder_questions_invalidates_survey_stats_cache_after_commit(monkeypatch):
    cache.clear()
    cache.set(f"{SURVEY_STATS_CACHE_KEY}:questions:cached", {"questions": []}, ttl_seconds=300)
    db = SurveyQuestionMutationDB()
    admin = type("AdminStub", (), {"username": "reviewer"})()

    monkeypatch.setattr("app.routers.admin_survey.log_audit", lambda **kwargs: None)

    response = reorder_questions(
        ReorderQuestionsRequest(question_ids=[5, 3, 8]),
        db=db,
        admin=admin,
    )

    assert response == {"message": "Questions reordered successfully"}
    assert db.events == ["commit"]
    assert cache.get(f"{SURVEY_STATS_CACHE_KEY}:questions:cached") is None



def test_delete_question_invalidates_survey_stats_cache_after_commit(monkeypatch):
    cache.clear()
    cache.set(f"{SURVEY_STATS_CACHE_KEY}:questions:cached", {"questions": []}, ttl_seconds=300)
    question = SurveyQuestion(
        id=7,
        question_text="Pertanyaan akan dihapus",
        question_type=SurveyQuestionType.text,
        is_required=True,
        is_active=True,
        order=2,
    )
    db = SurveyQuestionMutationDB(question=question)
    admin = type("AdminStub", (), {"username": "reviewer"})()

    monkeypatch.setattr("app.routers.admin_survey.log_audit", lambda **kwargs: None)

    delete_question(question_id=7, db=db, admin=admin)

    assert db.deleted == [question]
    assert db.events == ["commit"]
    assert cache.get(f"{SURVEY_STATS_CACHE_KEY}:questions:cached") is None



def test_face_recognition_debug_logging_defaults_to_false(monkeypatch):
    get_settings.cache_clear()
    monkeypatch.delenv("FACE_RECOGNITION_DEBUG_LOGS", raising=False)

    service = FaceRecognitionService()

    assert service.debug_logging is False


def test_face_embedding_byte_vector_roundtrip():
    vector = [float(index) for index in range(128)]
    embedding = FaceRecognitionService.embedding_vector_to_bytes(vector)

    assert len(embedding) == 128 * 4
    assert FaceRecognitionService.embedding_bytes_to_vector(embedding) == vector


def test_face_embedding_vector_rejects_wrong_dimensions():
    try:
        FaceRecognitionService.embedding_vector_to_bytes([0.0, 1.0])
    except ValueError as exc:
        assert "Expected 128 embedding dimensions" in str(exc)
    else:
        raise AssertionError("embedding_vector_to_bytes should reject non-128 dimension vectors")


def test_face_service_key_not_required_by_default(monkeypatch):
    get_settings.cache_clear()
    monkeypatch.setenv("FACE_SERVICE_REQUIRE_API_KEY", "false")
    monkeypatch.setenv("FACE_SERVICE_API_KEY", "expected-key")

    assert require_face_service_key() is None


def test_face_service_key_rejects_missing_or_wrong_key(monkeypatch):
    get_settings.cache_clear()
    monkeypatch.setenv("FACE_SERVICE_REQUIRE_API_KEY", "true")
    monkeypatch.setenv("FACE_SERVICE_API_KEY", "expected-key")

    for supplied_key in (None, "wrong-key"):
        try:
            require_face_service_key(supplied_key)
        except Exception as exc:
            assert getattr(exc, "status_code", None) == 401
        else:
            raise AssertionError("require_face_service_key should reject invalid keys")


def test_face_service_key_accepts_matching_key(monkeypatch):
    get_settings.cache_clear()
    monkeypatch.setenv("FACE_SERVICE_REQUIRE_API_KEY", "true")
    monkeypatch.setenv("FACE_SERVICE_API_KEY", "expected-key")

    assert require_face_service_key("expected-key") is None



def test_face_recognition_debug_logging_helper_suppresses_output_when_disabled(monkeypatch, capsys):
    get_settings.cache_clear()
    monkeypatch.setenv("FACE_RECOGNITION_DEBUG_LOGS", "false")

    service = FaceRecognitionService()
    service._debug("hidden message")

    captured = capsys.readouterr()
    assert captured.out == ""



def test_face_recognition_debug_logging_helper_emits_output_when_enabled(monkeypatch, capsys):
    get_settings.cache_clear()
    monkeypatch.setenv("FACE_RECOGNITION_DEBUG_LOGS", "true")

    service = FaceRecognitionService()
    service._debug("visible message")

    captured = capsys.readouterr()
    assert captured.out == "visible message\n"



def test_face_recognition_singleton_respects_latest_debug_flag(monkeypatch, capsys):
    get_settings.cache_clear()
    monkeypatch.setenv("FACE_RECOGNITION_DEBUG_LOGS", "false")
    face_recognition_service._debug("first hidden message")
    assert capsys.readouterr().out == ""

    get_settings.cache_clear()
    monkeypatch.setenv("FACE_RECOGNITION_DEBUG_LOGS", "true")
    face_recognition_service._debug("second visible message")

    captured = capsys.readouterr()
    assert captured.out == "second visible message\n"
