"""Supabase Storage backing for local disk (local disk = ephemeral cache)."""
import os
import asyncio
from pathlib import Path

import storage
from config import THUMB_DIR, RENDER_DIR


def skey(local_path) -> str:
    """Map a local media file to its Supabase Storage key '<project_id>/<name>'."""
    p = Path(local_path)
    if p.parent == THUMB_DIR:            # thumbs/<id>.jpg
        return f"{p.stem}/thumb.jpg"
    return f"{p.parent.name}/{p.name}"   # uploads|renders/<id>/<name>


def ctype(local_path) -> str:
    n = str(local_path).lower()
    if n.endswith(".mp4"):
        return "video/mp4"
    if n.endswith(".jpg") or n.endswith(".jpeg"):
        return "image/jpeg"
    if n.endswith(".m4a"):
        return "audio/mp4"
    if n.endswith((".mp3", ".wav", ".ogg", ".aac")):
        return "audio/mpeg"
    return "application/octet-stream"


async def backup(local_path):
    if storage.enabled() and os.path.exists(local_path):
        await asyncio.to_thread(storage.upload, skey(local_path), str(local_path), ctype(local_path))


async def restore(local_path) -> bool:
    """Ensure a media file is present locally, pulling from Storage if missing."""
    if os.path.exists(local_path) and os.path.getsize(local_path) > 0:
        return True
    if storage.enabled():
        return await asyncio.to_thread(storage.download, skey(local_path), str(local_path))
    return False


async def backup_outputs(project_id: str):
    """Back up the durable outputs (cut/final/thumb) to Storage; drop stale filmstrip."""
    cut_dir = RENDER_DIR / project_id
    await backup(cut_dir / "cut.mp4")
    await backup(cut_dir / "final.mp4")
    await backup(THUMB_DIR / f"{project_id}.jpg")
    if storage.enabled():
        await asyncio.to_thread(storage.remove, f"{project_id}/filmstrip.jpg")


async def cut_available(project_id: str) -> bool:
    """True if the cut source exists locally or in Storage."""
    local = RENDER_DIR / project_id / "cut.mp4"
    if local.exists() and local.stat().st_size > 0:
        return True
    if storage.enabled():
        return await asyncio.to_thread(storage.exists, f"{project_id}/cut.mp4")
    return False
