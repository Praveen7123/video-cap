"""Mutable runtime state (the DB handle), set once at startup.

Routers/services must `import deps` and reference `deps.db` at call time —
never `from deps import db`, which would bind the `None` placeholder below
and never see the real handle assigned in `init_db()`.
"""
import uuid
from datetime import datetime, timezone

import db as dbmod
from auth import hash_password, verify_password

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
    import os
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@clipcut.app")
    admin_password = os.environ.get("ADMIN_PASSWORD", "Admin@12345")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "name": "Admin",
            "password_hash": hash_password(admin_password),
            "plan": "studio",
            "credit_seconds_used": 0,
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_password)}},
        )


def close_db():
    if db_client is not None:
        db_client.close()
