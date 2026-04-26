import mimetypes
from dataclasses import dataclass
from typing import Optional
from urllib.parse import quote

import httpx

from app.config import get_settings


class SupabaseStorageError(RuntimeError):
    pass


class SupabaseStorageNotConfigured(SupabaseStorageError):
    pass


@dataclass(frozen=True)
class StoredObject:
    reference: str
    signed_url: str


def _storage_config() -> tuple[str, str]:
    settings = get_settings()
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
        raise SupabaseStorageNotConfigured("Supabase Storage credentials are not configured")
    return settings.SUPABASE_URL.rstrip("/"), settings.SUPABASE_SERVICE_ROLE_KEY


def storage_reference(bucket: str, object_path: str) -> str:
    return f"supabase://{bucket}/{object_path.lstrip('/')}"


def parse_storage_reference(reference: Optional[str]) -> Optional[tuple[str, str]]:
    if not reference or not reference.startswith("supabase://"):
        return None
    value = reference.removeprefix("supabase://")
    if "/" not in value:
        return None
    bucket, object_path = value.split("/", 1)
    if not bucket or not object_path:
        return None
    return bucket, object_path


def guess_content_type(filename: Optional[str], fallback: str = "image/jpeg") -> str:
    if not filename:
        return fallback
    guessed, _ = mimetypes.guess_type(filename)
    return guessed or fallback


def _headers(service_role_key: str, content_type: Optional[str] = None) -> dict[str, str]:
    headers = {
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
    }
    if content_type:
        headers["Content-Type"] = content_type
    return headers


def _object_url(supabase_url: str, bucket: str, object_path: str) -> str:
    encoded_path = "/".join(quote(part, safe="") for part in object_path.strip("/").split("/"))
    return f"{supabase_url}/storage/v1/object/{quote(bucket, safe='')}/{encoded_path}"


async def create_signed_url(bucket: str, object_path: str, expires_in: int = 3600) -> str:
    supabase_url, service_role_key = _storage_config()
    encoded_path = "/".join(quote(part, safe="") for part in object_path.strip("/").split("/"))
    url = f"{supabase_url}/storage/v1/object/sign/{quote(bucket, safe='')}/{encoded_path}"
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(
            url,
            headers=_headers(service_role_key, "application/json"),
            json={"expiresIn": expires_in},
        )
    if response.status_code >= 400:
        raise SupabaseStorageError(f"Failed to create signed URL: {response.status_code} {response.text}")
    signed_url = response.json().get("signedURL")
    if not signed_url:
        raise SupabaseStorageError("Supabase did not return a signed URL")
    if signed_url.startswith("http://") or signed_url.startswith("https://"):
        return signed_url
    return f"{supabase_url}/storage/v1{signed_url}"


async def upload_object(
    bucket: str,
    object_path: str,
    content: bytes,
    content_type: str,
) -> StoredObject:
    supabase_url, service_role_key = _storage_config()
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.post(
            _object_url(supabase_url, bucket, object_path),
            headers={
                **_headers(service_role_key, content_type),
                "x-upsert": "false",
                "cache-control": "3600",
            },
            content=content,
        )
    if response.status_code >= 400:
        raise SupabaseStorageError(f"Failed to upload object: {response.status_code} {response.text}")
    return StoredObject(
        reference=storage_reference(bucket, object_path),
        signed_url=await create_signed_url(bucket, object_path),
    )


async def delete_object_reference(reference: Optional[str]) -> None:
    parsed = parse_storage_reference(reference)
    if not parsed:
        return
    bucket, object_path = parsed
    supabase_url, service_role_key = _storage_config()
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.request(
            "DELETE",
            f"{supabase_url}/storage/v1/object/{quote(bucket, safe='')}",
            headers=_headers(service_role_key, "application/json"),
            json={"prefixes": [object_path]},
        )
    if response.status_code >= 400:
        raise SupabaseStorageError(f"Failed to delete object: {response.status_code} {response.text}")


async def display_url_for_reference(reference: Optional[str]) -> str:
    parsed = parse_storage_reference(reference)
    if not parsed:
        return reference or ""
    bucket, object_path = parsed
    return await create_signed_url(bucket, object_path)
