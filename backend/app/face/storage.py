import mimetypes
from dataclasses import dataclass
from pathlib import Path
from typing import Optional
from urllib.parse import unquote, urlsplit

from app.config import get_settings


class LocalStorageError(RuntimeError):
    pass


@dataclass(frozen=True)
class StoredObject:
    reference: str
    signed_url: str


def guess_content_type(filename: Optional[str], fallback: str = "image/jpeg") -> str:
    if not filename:
        return fallback
    guessed, _ = mimetypes.guess_type(filename)
    return guessed or fallback


def upload_root() -> Path:
    return Path(get_settings().FACE_UPLOAD_ROOT).resolve()


def public_upload_prefix() -> str:
    return "/" + get_settings().FACE_UPLOAD_PUBLIC_PREFIX.strip("/")


def local_reference(object_path: str) -> str:
    return f"{public_upload_prefix()}/{object_path.strip('/')}"


def public_reference_to_path(reference: Optional[str]) -> Optional[Path]:
    if not reference:
        return None
    parsed = urlsplit(reference)
    path = unquote(parsed.path or reference)
    prefix = public_upload_prefix().rstrip("/") + "/"
    if not path.startswith(prefix):
        return None
    relative_path = path.removeprefix(prefix)
    target = (upload_root() / relative_path).resolve()
    try:
        target.relative_to(upload_root())
    except ValueError:
        return None
    return target


async def upload_object(
    bucket: str,
    object_path: str,
    content: bytes,
    content_type: str,
) -> StoredObject:
    del bucket, content_type
    relative_path = object_path.strip("/")
    target = (upload_root() / relative_path).resolve()
    try:
        target.relative_to(upload_root())
    except ValueError as error:
        raise LocalStorageError("Invalid upload path") from error

    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(content)
    reference = local_reference(relative_path)
    return StoredObject(reference=reference, signed_url=reference)


async def delete_object_reference(reference: Optional[str]) -> None:
    target = public_reference_to_path(reference)
    if not target:
        return
    try:
        target.unlink(missing_ok=True)
    except OSError as error:
        raise LocalStorageError(f"Failed to delete local object: {error}") from error


async def display_url_for_reference(reference: Optional[str]) -> str:
    return reference or ""
