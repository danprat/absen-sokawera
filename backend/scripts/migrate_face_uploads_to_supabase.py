import argparse
import asyncio
from pathlib import Path

from app.db import SessionLocal
from app.face.models import FaceTemplate
from app.face.api import build_face_object_path
from app.face.storage import guess_content_type, upload_object
from app.config import get_settings


def legacy_photo_path(legacy_root: Path, photo_url: str) -> Path:
    return legacy_root / photo_url.lstrip("/")


async def migrate(legacy_root: Path) -> int:
    settings = get_settings()
    db = SessionLocal()
    migrated = 0
    try:
        templates = db.query(FaceTemplate).filter(FaceTemplate.photo_url.like("/uploads/%")).all()
        for template in templates:
            source = legacy_photo_path(legacy_root, template.photo_url)
            if not source.exists() or not source.is_file():
                print(f"skip missing legacy file for template {template.id}: {source}")
                continue

            content = source.read_bytes()
            object_path = build_face_object_path(
                template.tenant_id,
                template.subject_id,
                source.name,
            )
            stored = await upload_object(
                settings.SUPABASE_STORAGE_FACE_BUCKET,
                object_path,
                content,
                guess_content_type(source.name),
            )
            template.photo_url = stored.reference
            migrated += 1

        if migrated:
            db.commit()
        print(f"migrated_face_uploads={migrated}")
        return migrated
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Migrate legacy local face uploads to Supabase Storage.")
    parser.add_argument(
        "--legacy-root",
        default=".",
        help="Backend root that contains the legacy uploads directory.",
    )
    args = parser.parse_args()
    asyncio.run(migrate(Path(args.legacy_root).resolve()))


if __name__ == "__main__":
    main()
