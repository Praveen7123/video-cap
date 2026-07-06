"""Storage quota enforcement — a user's real durable usage (Supabase Storage
is the source of truth; local disk is only an ephemeral cache, see storage.py)
summed across all their projects, checked against their plan's storage_gb."""
import os
from fastapi import HTTPException

import storage
from config import PLANS


def _object_size(obj: dict) -> int:
    meta = obj.get("metadata") or {}
    return int(meta.get("size") or 0)


async def get_user_storage_bytes(db, user_id: str) -> int:
    if not storage.enabled():
        return await _local_storage_bytes(db, user_id)
    total = 0
    cursor = db.projects.find({"user_id": user_id})
    async for p in cursor:
        objs = storage.list_prefix(f"{p['id']}/")
        total += sum(_object_size(o) for o in objs)
    return total


def _local_storage_bytes_sync_paths(p: dict) -> list:
    return [p.get("input_path"), p.get("output_path"), p.get("thumbnail_path"), p.get("music_path"), p.get("clean_audio_path")]


async def _local_storage_bytes(db, user_id: str) -> int:
    """Fallback for local dev without Supabase Storage configured — sums
    whatever's actually present on local disk right now (best-effort only)."""
    total = 0
    cursor = db.projects.find({"user_id": user_id})
    async for p in cursor:
        for path in _local_storage_bytes_sync_paths(p):
            if path and os.path.exists(path):
                total += os.path.getsize(path)
    return total


def get_plan_storage_bytes(user: dict) -> int:
    plan = PLANS.get(user.get("plan", "free"), PLANS["free"])
    return plan.get("storage_gb", 0) * 1024 * 1024 * 1024


async def check_storage_allowed(db, user: dict, incoming_bytes: int) -> None:
    quota = get_plan_storage_bytes(user)
    used = await get_user_storage_bytes(db, user["id"])
    if used + incoming_bytes > quota:
        used_gb = used / (1024 ** 3)
        quota_gb = quota / (1024 ** 3)
        raise HTTPException(
            400,
            f"Storage limit reached ({used_gb:.1f}GB / {quota_gb:.0f}GB used) — "
            f"delete a project or upgrade your plan for more space.",
        )
