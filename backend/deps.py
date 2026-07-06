"""Mutable runtime state (the DB handle), set once at startup.

Routers/services must `import deps` and reference `deps.db` at call time —
never `from deps import db`, which would bind the `None` placeholder below
and never see the real handle assigned in `init_db()`.
"""
import os
import asyncio
import logging
from datetime import datetime, timezone

import db as dbmod

log = logging.getLogger("clipcut.deps")

db = None
db_client = None


async def init_db():
    global db, db_client
    db_client, db = await dbmod.get_db()

    await db.users.create_index("email", unique=True)
    await db.projects.create_index("user_id")
    await db.teams.create_index("id", unique=True)
    await db.team_members.create_index("team_id")
    await db.team_members.create_index("user_id")
    await db.team_members.create_index("email")

    await _seed_admin()


async def _seed_admin():
    """Ensure a Supabase Auth user + matching profile row exists for the
    admin account. Auth identity lives in Supabase Auth now (not our own
    bcrypt scheme) — created via the Admin API using the service role key."""
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@clipcut.app")
    admin_password = os.environ.get("ADMIN_PASSWORD", "Admin@12345")

    if await db.users.find_one({"email": admin_email}):
        return  # profile already provisioned

    try:
        from supabase import create_client
        auth_client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])
        resp = await asyncio.to_thread(
            lambda: auth_client.auth.admin.create_user({
                "email": admin_email,
                "password": admin_password,
                "email_confirm": True,
            })
        )
        supabase_uid = resp.user.id
    except Exception as e:
        log.warning(f"Could not create Supabase Auth admin user (may already exist there): {e}")
        return

    await db.users.insert_one({
        "id": supabase_uid,
        "email": admin_email,
        "name": "Admin",
        "plan": "studio",
        "credit_seconds_used": 0,
        "translation_seconds_used": 0,
        "role": "admin",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })


def close_db():
    if db_client is not None:
        db_client.close()
