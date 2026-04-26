import argparse
import asyncio
from pathlib import Path
from typing import Optional
from urllib.parse import quote

import httpx

from app.db import SessionLocal
from app.face.api import build_face_object_path
from app.face.models import FaceTemplate
from app.face.storage import guess_content_type, upload_object


def parse_supabase_reference(reference: Optional[str]) -> Optional[tuple[str, str]]:
    if not reference or not reference.startswith("supabase://"):
        return None
    value = reference.removeprefix("supabase://")
    if "/" not in value:
        return None
    bucket, object_path = value.split("/", 1)
    if not bucket or not object_path:
        return None
    return bucket, object_path


def storage_object_url(supabase_url: str, bucket: str, object_path: str) -> str:
    encoded_path = "/".join(quote(part, safe="") for part in object_path.strip("/").split("/"))
    return f"{supabase_url.rstrip('/')}/storage/v1/object/{quote(bucket, safe='')}/{encoded_path}"


async def download_object(
    supabase_url: str,
    service_role_key: str,
    bucket: str,
    object_path: str,
) -> bytes:
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.get(
            storage_object_url(supabase_url, bucket, object_path),
            headers={
                "apikey": service_role_key,
                "Authorization": f"Bearer {service_role_key}",
            },
        )
    response.raise_for_status()
    return response.content


async def migrate(supabase_url: str, service_role_key: str) -> int:
    db = SessionLocal()
    migrated = 0
    try:
        templates = db.query(FaceTemplate).filter(FaceTemplate.photo_url.like("supabase://%")).all()
        for template in templates:
            parsed = parse_supabase_reference(template.photo_url)
            if not parsed:
                continue
            bucket, source_path = parsed
            content = await download_object(supabase_url, service_role_key, bucket, source_path)
            object_path = build_face_object_path(
                template.tenant_id,
                template.subject_id,
                Path(source_path).name,
            )
            stored = await upload_object(
                "local",
                object_path,
                content,
                guess_content_type(source_path),
            )
            template.photo_url = stored.reference
            migrated += 1
        if migrated:
            db.commit()
        return migrated
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Move face photos from Supabase Storage to local VPS storage.")
    parser.add_argument("--supabase-url", required=True)
    parser.add_argument("--service-role-key", required=True)
    args = parser.parse_args()
    migrated = asyncio.run(migrate(args.supabase_url, args.service_role_key))
    print(f"migrated {migrated} face photos from Supabase Storage to local VPS storage")


if __name__ == "__main__":
    main()
