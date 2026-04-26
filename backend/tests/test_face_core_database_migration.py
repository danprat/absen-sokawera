from __future__ import annotations

from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db import Base
from app.face.models import FaceClient, FaceSubject, FaceTemplate
from app.face.auth import hash_face_app_key
from scripts.migrate_face_core_database import MigrationCounts, copy_face_core, count_rows


def sqlite_url(path: Path) -> str:
    return f"sqlite:///{path}"


def seed_source(database_url: str) -> None:
    engine = create_engine(database_url)
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    with Session() as session:
        session.add(
            FaceClient(
                id=1,
                tenant_id="monika",
                name="Monika",
                api_key_hash=hash_face_app_key("key-a"),
            )
        )
        session.add(
            FaceSubject(
                id=1,
                tenant_id="monika",
                external_subject_id="7",
                display_name="Ani",
                subject_metadata={"source": "employees"},
            )
        )
        session.add(
            FaceTemplate(
                id=1,
                tenant_id="monika",
                subject_id=1,
                embedding=b"1" * 512,
                photo_url="supabase://face-originals/monika/subjects/1/faces/a.jpg",
            )
        )
        session.commit()


def read_target(database_url: str) -> tuple[MigrationCounts, FaceTemplate | None]:
    engine = create_engine(database_url)
    Session = sessionmaker(bind=engine)
    with Session() as session:
        return count_rows(session), session.query(FaceTemplate).first()


def test_copy_face_core_creates_target_tables_and_copies_rows(tmp_path):
    source_url = sqlite_url(tmp_path / "source.db")
    target_url = sqlite_url(tmp_path / "target.db")
    seed_source(source_url)

    counts = copy_face_core(source_url, target_url)
    target_counts, template = read_target(target_url)

    assert counts == MigrationCounts(clients=1, subjects=1, templates=1)
    assert target_counts == counts
    assert template is not None
    assert template.embedding == b"1" * 512
    assert template.photo_url.startswith("supabase://face-originals/")


def test_copy_face_core_skips_non_empty_target_without_replace(tmp_path):
    source_url = sqlite_url(tmp_path / "source.db")
    target_url = sqlite_url(tmp_path / "target.db")
    seed_source(source_url)
    seed_source(target_url)

    counts = copy_face_core(source_url, target_url)

    assert counts == MigrationCounts(clients=1, subjects=1, templates=1)


def test_copy_face_core_rejects_same_source_and_target(tmp_path):
    database_url = sqlite_url(tmp_path / "same.db")

    with pytest.raises(ValueError, match="must be different"):
        copy_face_core(database_url, database_url)
