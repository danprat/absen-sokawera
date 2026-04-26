import asyncio

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db import Base
from app.face.models import FaceClient
from app.face.models import FaceSubject
from app.face.models import FaceTemplate
from app.face import api as face_api_module
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
from app.face.storage import delete_object_reference
from app.face.storage import display_url_for_reference
from app.face.storage import upload_object
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
                reference=f"/uploads/face/{tenant_id}/subjects/{subject_id}/faces/test.jpg",
                signed_url=f"/uploads/face/{tenant_id}/subjects/{subject_id}/faces/test.jpg",
            ),
        ),
    )

    response = asyncio.run(
        upload_subject_face(subject_id=subject.id, file=UploadFileStub(), db=db, client=context("tenant-a"))
    )
    template = db.query(FaceTemplate).filter(FaceTemplate.id == response.id).first()

    assert response.subject_id == subject.id
    assert response.photo_url == f"/uploads/face/tenant-a/subjects/{subject.id}/faces/test.jpg"
    assert template.tenant_id == "tenant-a"
    assert template.subject_id == subject.id
    assert template.photo_url == f"/uploads/face/tenant-a/subjects/{subject.id}/faces/test.jpg"
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


def test_list_subject_faces_returns_local_urls():
    db = make_session()
    subject = FaceSubject(tenant_id="tenant-a", external_subject_id="EMP-1", display_name="Ani")
    db.add(subject)
    db.commit()
    db.refresh(subject)
    template = FaceTemplate(
        tenant_id="tenant-a",
        subject_id=subject.id,
        embedding=b"1" * 512,
        photo_url="/uploads/face/tenant-a/subjects/1/faces/test.jpg",
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    result = asyncio.run(list_subject_faces(subject_id=subject.id, db=db, client=context("tenant-a")))

    assert result[0].photo_url == "/uploads/face/tenant-a/subjects/1/faces/test.jpg"


def test_list_face_counts_returns_bulk_counts_for_current_tenant_only():
    db = make_session()
    tenant_a_subject = FaceSubject(tenant_id="tenant-a", external_subject_id="EMP-1", display_name="Ani")
    tenant_a_empty_subject = FaceSubject(tenant_id="tenant-a", external_subject_id="EMP-2", display_name="Budi")
    tenant_b_subject = FaceSubject(tenant_id="tenant-b", external_subject_id="EMP-1", display_name="Cici")
    db.add_all([tenant_a_subject, tenant_a_empty_subject, tenant_b_subject])
    db.commit()
    db.refresh(tenant_a_subject)
    db.refresh(tenant_a_empty_subject)
    db.refresh(tenant_b_subject)
    db.add_all([
        FaceTemplate(tenant_id="tenant-a", subject_id=tenant_a_subject.id, embedding=b"1" * 512, photo_url="/a.jpg"),
        FaceTemplate(tenant_id="tenant-a", subject_id=tenant_a_subject.id, embedding=b"2" * 512, photo_url="/b.jpg"),
        FaceTemplate(tenant_id="tenant-b", subject_id=tenant_b_subject.id, embedding=b"3" * 512, photo_url="/c.jpg"),
    ])
    db.commit()

    handler = getattr(face_api_module, "list_face_counts", None)
    assert handler is not None

    result = handler(external_subject_ids="EMP-1,EMP-2", db=db, client=context("tenant-a"))

    counts = {item.external_subject_id: item.face_count for item in result.items}
    assert counts == {"EMP-1": 2, "EMP-2": 0}


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
        photo_url="/uploads/face/tenant-a/subjects/1/faces/test.jpg",
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

    assert deleted == ["/uploads/face/tenant-a/subjects/1/faces/test.jpg"]
    assert db.query(FaceTemplate).filter(FaceTemplate.id == template.id).first() is None


def test_local_storage_upload_display_and_delete(monkeypatch, tmp_path):
    monkeypatch.setattr("app.face.storage.upload_root", lambda: tmp_path)
    monkeypatch.setattr("app.face.storage.public_upload_prefix", lambda: "/uploads")

    stored = asyncio.run(upload_object("local", "face/tenant-a/subjects/1/faces/test.jpg", b"image", "image/jpeg"))

    assert stored.reference == "/uploads/face/tenant-a/subjects/1/faces/test.jpg"
    assert stored.signed_url == stored.reference
    assert (tmp_path / "face/tenant-a/subjects/1/faces/test.jpg").read_bytes() == b"image"
    assert asyncio.run(display_url_for_reference(stored.reference)) == stored.reference

    asyncio.run(delete_object_reference(stored.reference))

    assert not (tmp_path / "face/tenant-a/subjects/1/faces/test.jpg").exists()


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
