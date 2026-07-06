"""Data-access abstraction for ClipCut.

Exposes a Mongo-like async interface (find_one / insert_one / update_one /
find().sort() / create_index) backed by either MongoDB (Motor) or Supabase
(Postgres via supabase-py). The backend is chosen by the DB_BACKEND env var:

    DB_BACKEND=supabase   -> use Supabase (falls back to Mongo on init failure)
    DB_BACKEND=mongo      -> use MongoDB   (default)

server.py is unaware of which backend is active; it just uses `db.users` /
`db.projects` with the same call shapes it used against Motor.
"""
from __future__ import annotations

import os
import asyncio
import logging
from typing import Any, Dict, List, Optional

log = logging.getLogger("clipcut.db")


# --------------------------------------------------------------------------
# Supabase shim — presents the subset of the Motor API that server.py uses.
# The supabase-py client is synchronous, so every call is pushed to a thread
# to avoid blocking the event loop.
# --------------------------------------------------------------------------
class _SupabaseFindQuery:
    """Lazy result of collection.find(filter); supports .sort() then `async for`."""

    def __init__(self, client, table: str, flt: Dict[str, Any]):
        self._client = client
        self._table = table
        self._flt = flt
        self._sort: Optional[tuple] = None

    def sort(self, field: str, direction: int = -1):
        self._sort = (field, direction)
        return self

    def _run(self) -> List[dict]:
        q = self._client.table(self._table).select("*")
        for k, v in self._flt.items():
            q = q.eq(k, v)
        if self._sort:
            field, direction = self._sort
            q = q.order(field, desc=(direction < 0))
        return q.execute().data or []

    def __aiter__(self):
        return self._agen()

    async def _agen(self):
        rows = await asyncio.to_thread(self._run)
        for r in rows:
            yield r


class _SupabaseCollection:
    def __init__(self, client, table: str):
        self._client = client
        self._table = table

    async def find_one(self, flt: Dict[str, Any]) -> Optional[dict]:
        def _run():
            q = self._client.table(self._table).select("*")
            for k, v in flt.items():
                q = q.eq(k, v)
            return q.limit(1).execute().data or []
        rows = await asyncio.to_thread(_run)
        return rows[0] if rows else None

    async def insert_one(self, doc: Dict[str, Any]):
        await asyncio.to_thread(
            lambda: self._client.table(self._table).insert(doc).execute()
        )
        return doc

    async def update_one(self, flt: Dict[str, Any], update: Dict[str, Any]):
        set_fields = dict(update.get("$set", {}))
        inc = update.get("$inc", {})
        if inc:
            # Postgres/PostgREST has no atomic $inc here; read-modify-write.
            current = await self.find_one(flt) or {}
            for k, delta in inc.items():
                set_fields[k] = (current.get(k) or 0) + delta
        if not set_fields:
            return

        def _run():
            q = self._client.table(self._table).update(set_fields)
            for k, v in flt.items():
                q = q.eq(k, v)
            return q.execute()
        await asyncio.to_thread(_run)

    def find(self, flt: Dict[str, Any]) -> _SupabaseFindQuery:
        return _SupabaseFindQuery(self._client, self._table, flt)

    async def delete_one(self, flt: Dict[str, Any]):
        def _run():
            q = self._client.table(self._table).delete()
            for k, v in flt.items():
                q = q.eq(k, v)
            return q.execute()
        await asyncio.to_thread(_run)

    async def create_index(self, *args, **kwargs):
        # Indexes/uniqueness are defined in the SQL schema; nothing to do here.
        return None


class SupabaseDB:
    def __init__(self, client):
        self.users = _SupabaseCollection(client, "users")
        self.projects = _SupabaseCollection(client, "projects")
        self.teams = _SupabaseCollection(client, "teams")
        self.team_members = _SupabaseCollection(client, "team_members")


# --------------------------------------------------------------------------
# Factory
# --------------------------------------------------------------------------
def _make_mongo():
    from motor.motor_asyncio import AsyncIOMotorClient
    mongo_url = os.environ["MONGO_URL"]
    client = AsyncIOMotorClient(mongo_url)
    return client, client[os.environ["DB_NAME"]]


async def get_db():
    """Return (client, db). `client` is the object to close on shutdown (or None)."""
    backend = os.environ.get("DB_BACKEND", "mongo").strip().lower()

    if backend == "supabase":
        try:
            from supabase import create_client
            url = os.environ["SUPABASE_URL"]
            key = os.environ["SUPABASE_SERVICE_KEY"]
            client = create_client(url, key)
            # Fail fast if the tables aren't reachable, so we can fall back.
            await asyncio.to_thread(
                lambda: client.table("users").select("id").limit(1).execute()
            )
            log.info("DB backend: Supabase")
            return None, SupabaseDB(client)
        except Exception:
            log.exception("Supabase init failed — falling back to MongoDB")

    client, db = _make_mongo()
    log.info("DB backend: MongoDB")
    return client, db
