"""Supabase Storage helper — durable file store for ClipCut media.

Local disk is treated as an ephemeral cache: after producing a file we back it
up here; before serving/processing we restore it if the local copy is missing.
So the source of truth for all media is Supabase Storage (survives local wipes).
"""
from __future__ import annotations

import os
import logging
import httpx

log = logging.getLogger("clipcut.storage")


def _url() -> str:
    return os.environ["SUPABASE_URL"].rstrip("/")


def _key() -> str:
    return os.environ["SUPABASE_SERVICE_KEY"]


def _bucket() -> str:
    return os.environ.get("SUPABASE_BUCKET", "media")


def enabled() -> bool:
    return bool(os.environ.get("SUPABASE_URL") and os.environ.get("SUPABASE_SERVICE_KEY")
               and os.environ.get("DB_BACKEND", "").lower() == "supabase")


def _headers(extra: dict | None = None) -> dict:
    h = {"Authorization": f"Bearer {_key()}", "apikey": _key()}
    if extra:
        h.update(extra)
    return h


def upload(key: str, local_path: str, content_type: str = "application/octet-stream") -> bool:
    """Upload (upsert) a local file to Storage under `key`."""
    try:
        with open(local_path, "rb") as f:
            data = f.read()
        r = httpx.post(
            f"{_url()}/storage/v1/object/{_bucket()}/{key}",
            headers=_headers({"Content-Type": content_type, "x-upsert": "true"}),
            content=data, timeout=180,
        )
        if r.status_code not in (200, 201):
            log.warning(f"upload {key} -> {r.status_code} {r.text[:200]}")
            return False
        return True
    except Exception as e:
        log.warning(f"upload {key} failed: {e}")
        return False


def download(key: str, local_path: str) -> bool:
    """Download `key` from Storage to a local path. Returns False if missing."""
    try:
        r = httpx.get(
            f"{_url()}/storage/v1/object/authenticated/{_bucket()}/{key}",
            headers=_headers(), timeout=180,
        )
        if r.status_code != 200:
            return False
        os.makedirs(os.path.dirname(local_path) or ".", exist_ok=True)
        with open(local_path, "wb") as f:
            f.write(r.content)
        return True
    except Exception as e:
        log.warning(f"download {key} failed: {e}")
        return False


def exists(key: str) -> bool:
    try:
        r = httpx.post(
            f"{_url()}/storage/v1/object/sign/{_bucket()}/{key}",
            headers=_headers({"Content-Type": "application/json"}),
            json={"expiresIn": 60}, timeout=30,
        )
        return r.status_code == 200
    except Exception:
        return False


def list_prefix(prefix: str) -> list[dict]:
    """List objects directly under `prefix` (non-recursive) with their sizes.
    Used to compute a user's real durable storage usage for quota checks."""
    try:
        r = httpx.post(
            f"{_url()}/storage/v1/object/list/{_bucket()}",
            headers=_headers({"Content-Type": "application/json"}),
            json={"prefix": prefix, "limit": 100, "offset": 0}, timeout=30,
        )
        if r.status_code != 200:
            return []
        return r.json() or []
    except Exception as e:
        log.warning(f"list_prefix {prefix} failed: {e}")
        return []


def remove(key: str) -> None:
    try:
        httpx.request("DELETE", f"{_url()}/storage/v1/object/{_bucket()}/{key}",
                      headers=_headers(), timeout=30)
    except Exception:
        pass


def ensure_local(key: str, local_path: str) -> bool:
    """Guarantee the file is present locally: use the local copy or restore it."""
    if os.path.exists(local_path) and os.path.getsize(local_path) > 0:
        return True
    return download(key, local_path)
