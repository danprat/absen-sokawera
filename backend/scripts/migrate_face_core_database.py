import argparse
from dataclasses import dataclass
from typing import Any

from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import sessionmaker

from app.config import normalize_database_url_for_sqlalchemy
from app.db import Base
from app.face.models import FaceClient, FaceSubject, FaceTemplate


FACE_TABLES = (FaceClient, FaceSubject, FaceTemplate)


@dataclass(frozen=True)
class MigrationCounts:
    clients: int
    subjects: int
    templates: int


def make_engine(database_url: str):
    return create_engine(
        normalize_database_url_for_sqlalchemy(database_url),
        pool_pre_ping=True,
    )


def count_rows(session) -> MigrationCounts:
    return MigrationCounts(
        clients=session.scalar(select(func.count()).select_from(FaceClient)) or 0,
        subjects=session.scalar(select(func.count()).select_from(FaceSubject)) or 0,
        templates=session.scalar(select(func.count()).select_from(FaceTemplate)) or 0,
    )


def row_dict(row: Any, columns: list[str]) -> dict[str, Any]:
    data = {column: getattr(row, column) for column in columns}
    if "embedding" in data and isinstance(data["embedding"], memoryview):
        data["embedding"] = data["embedding"].tobytes()
    return data


def copy_face_core(source_url: str, target_url: str, replace: bool = False) -> MigrationCounts:
    if source_url == target_url:
        raise ValueError("source and target database URLs must be different")

    source_engine = make_engine(source_url)
    target_engine = make_engine(target_url)
    SourceSession = sessionmaker(bind=source_engine)
    TargetSession = sessionmaker(bind=target_engine)

    Base.metadata.create_all(bind=target_engine, tables=[table.__table__ for table in FACE_TABLES])

    with SourceSession() as source, TargetSession() as target:
        existing = count_rows(target)
        if existing != MigrationCounts(0, 0, 0) and not replace:
            print(
                "target already has face data; skip import "
                f"(clients={existing.clients}, subjects={existing.subjects}, templates={existing.templates})"
            )
            return existing

        if replace:
            target.query(FaceTemplate).delete()
            target.query(FaceSubject).delete()
            target.query(FaceClient).delete()
            target.commit()

        for client in source.query(FaceClient).order_by(FaceClient.id).all():
            target.merge(
                FaceClient(
                    **row_dict(
                        client,
                        [
                            "id",
                            "tenant_id",
                            "name",
                            "api_key_hash",
                            "is_active",
                            "created_at",
                            "updated_at",
                        ],
                    )
                )
            )

        for subject in source.query(FaceSubject).order_by(FaceSubject.id).all():
            target.merge(
                FaceSubject(
                    **row_dict(
                        subject,
                        [
                            "id",
                            "tenant_id",
                            "external_subject_id",
                            "display_name",
                            "subject_metadata",
                            "is_active",
                            "created_at",
                            "updated_at",
                        ],
                    )
                )
            )

        for template in source.query(FaceTemplate).order_by(FaceTemplate.id).all():
            target.merge(
                FaceTemplate(
                    **row_dict(
                        template,
                        [
                            "id",
                            "tenant_id",
                            "subject_id",
                            "embedding",
                            "photo_url",
                            "model_name",
                            "embedding_version",
                            "is_primary",
                            "created_at",
                        ],
                    )
                )
            )

        target.commit()
        return count_rows(target)


def main() -> None:
    parser = argparse.ArgumentParser(description="Copy agnostic face-core data from one database to another.")
    parser.add_argument("--source-url", required=True)
    parser.add_argument("--target-url", required=True)
    parser.add_argument("--replace", action="store_true", help="Delete target face-core rows before importing.")
    args = parser.parse_args()

    counts = copy_face_core(args.source_url, args.target_url, replace=args.replace)
    print(
        "face-core migration complete "
        f"(clients={counts.clients}, subjects={counts.subjects}, templates={counts.templates})"
    )


if __name__ == "__main__":
    main()
