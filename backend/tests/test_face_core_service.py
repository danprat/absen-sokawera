import asyncio

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db import Base
from app.face.models import FaceClient
from app.face.models import FaceSubject
from app.face.models import FaceTemplate
from app.face.api import (
    FaceClientContext,
    create_subject,
    delete_face_template,
    list_subject_faces,
    recognize_subject,
    upload_subject_face,
)
from app.face.schemas import FaceSubjectCreate
from app.face.recognition import face_recognition_service
from app.face.storage import StoredObject
from app.face.auth import hash_face_app_key


class UploadFileStub:
    content_type = "image/jpeg"
    filename = "face.jpg"

    def __init__(self, data=b"image-bytes"):
        self.data = data

    async def read(self):
        return self.data


def make_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(bind=engine)
    return SessionLocal()


def context(tenant_id="tenant-a"):
    return FaceClientContext(id=1, tenant_id=tenant_id, name="Tenant A")


def test_hash_face_app_key_is_stable_and_not_plaintext():
    key_hash = hash_face_app_key("secret-key")

    assert key_hash == hash_face_app_key("secret-key")
    assert key_hash != "secret-key"


def test_create_subject_is_scoped_to_current_tenant():
    db = make_session()

    subject = create_subject(
        FaceSubjectCreate(external_subject_id="EMP-1", display_name="Ani"),
        db=db,
        client=context("tenant-a"),
    )

    assert subject.tenant_id == "tenant-a"
    assert subject.external_subject_id == "EMP-1"
    assert subject.display_name == "Ani"


def test_upload_subject_face_stores_template_under_subject_tenant(monkeypatch):
    db = make_session()
    subject = FaceSubject(tenant_id="tenant-a", external_subject_id="EMP-1", display_name="Ani")
    db.add(subject)
    db.commit()
    db.refresh(subject)
    monkeypatch.setattr(face_recognition_service, "detect_face", lambda data: True)
    monkeypatch.setattr(face_recognition_service, "generate_embedding", lambda data, use_cnn=False, num_jitters=1: b"1" * 512)
    refresh_events = []
    monkeypatch.setattr(face_recognition_service, "invalidate_template_cache", lambda tenant_id=None: refresh_events.append(tenant_id))
    monkeypatch.setattr(
        "app.face.api.save_template_photo",
        lambda image_data, tenant_id, subject_id, filename, content_type: asyncio.sleep(
            0,
            result=StoredObject(
                reference=f"supabase://face-originals/{tenant_id}/subjects/{subject_id}/faces/test.jpg",
                signed_url="https://signed.example/test.jpg",
            ),
        ),
    )

    response = asyncio.run(
        upload_subject_face(subject_id=subject.id, file=UploadFileStub(), db=db, client=context("tenant-a"))
    )
    template = db.query(FaceTemplate).filter(FaceTemplate.id == response.id).first()

    assert response.subject_id == subject.id
    assert response.photo_url == "https://signed.example/test.jpg"
    assert template.tenant_id == "tenant-a"
    assert template.subject_id == subject.id
    assert template.photo_url == f"supabase://face-originals/tenant-a/subjects/{subject.id}/faces/test.jpg"
    assert refresh_events == ["tenant-a"]


def test_tenant_cannot_list_or_delete_other_tenant_faces():
    db = make_session()
    subject = FaceSubject(tenant_id="tenant-b", external_subject_id="EMP-1", display_name="Ani")
    db.add(subject)
    db.commit()
    db.refresh(subject)
    template = FaceTemplate(tenant_id="tenant-b", subject_id=subject.id, embedding=b"1" * 512, photo_url="/x.jpg")
    db.add(template)
    db.commit()
    db.refresh(template)

    try:
        asyncio.run(list_subject_faces(subject_id=subject.id, db=db, client=context("tenant-a")))
    except HTTPException as list_error:
        assert list_error.status_code == 404
    else:
        raise AssertionError("Tenant A should not list tenant B subject faces")

    try:
        asyncio.run(delete_face_template(face_id=template.id, db=db, client=context("tenant-a")))
    except HTTPException as delete_error:
        assert delete_error.status_code == 404
    else:
        raise AssertionError("Tenant A should not delete tenant B face templates")


def test_list_subject_faces_returns_signed_urls(monkeypatch):
    db = make_session()
    subject = FaceSubject(tenant_id="tenant-a", external_subject_id="EMP-1", display_name="Ani")
    db.add(subject)
    db.commit()
    db.refresh(subject)
    template = FaceTemplate(
        tenant_id="tenant-a",
        subject_id=subject.id,
        embedding=b"1" * 512,
        photo_url="supabase://face-originals/tenant-a/subjects/1/faces/test.jpg",
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    monkeypatch.setattr(
        "app.face.api.display_url_for_reference",
        lambda reference: asyncio.sleep(0, result=f"https://signed.example/{reference.rsplit('/', 1)[-1]}"),
    )

    result = asyncio.run(list_subject_faces(subject_id=subject.id, db=db, client=context("tenant-a")))

    assert result[0].photo_url == "https://signed.example/test.jpg"


def test_delete_face_template_removes_storage_object(monkeypatch):
    db = make_session()
    subject = FaceSubject(tenant_id="tenant-a", external_subject_id="EMP-1", display_name="Ani")
    db.add(subject)
    db.commit()
    db.refresh(subject)
    template = FaceTemplate(
        tenant_id="tenant-a",
        subject_id=subject.id,
        embedding=b"1" * 512,
        photo_url="supabase://face-originals/tenant-a/subjects/1/faces/test.jpg",
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    deleted = []
    monkeypatch.setattr(
        "app.face.api.delete_object_reference",
        lambda reference: asyncio.sleep(0, result=deleted.append(reference)),
    )
    monkeypatch.setattr(face_recognition_service, "invalidate_template_cache", lambda tenant_id=None: None)

    asyncio.run(delete_face_template(face_id=template.id, db=db, client=context("tenant-a")))

    assert deleted == ["supabase://face-originals/tenant-a/subjects/1/faces/test.jpg"]
    assert db.query(FaceTemplate).filter(FaceTemplate.id == template.id).first() is None


def test_recognize_subject_returns_best_match_from_same_tenant(monkeypatch):
    subject = FaceSubject(
        id=7,
        tenant_id="tenant-a",
        external_subject_id="EMP-1",
        display_name="Ani",
        is_active=True,
    )
    monkeypatch.setattr(
        face_recognition_service,
        "find_matching_subject",
        lambda image_data, db, tenant_id, threshold=0.5: (subject, 0.87, 12),
    )

    result = asyncio.run(
        recognize_subject(file=UploadFileStub(), image_base64=None, db=make_session(), client=context("tenant-a"))
    )

    assert result.matched is True
    assert result.confidence == 87.0
    assert result.face_id == 12
    assert result.subject.external_subject_id == "EMP-1"


def test_face_client_model_stores_hashed_api_key():
    db = make_session()
    client = FaceClient(tenant_id="tenant-a", name="App A", api_key_hash=hash_face_app_key("key-a"))
    db.add(client)
    db.commit()

    stored = db.query(FaceClient).first()
    assert stored.api_key_hash != "key-a"
    assert stored.tenant_id == "tenant-a"
