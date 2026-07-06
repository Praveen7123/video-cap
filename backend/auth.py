import os
import logging
from datetime import datetime, timezone

import httpx
from fastapi import HTTPException, Request

log = logging.getLogger("clipcut.auth")


async def _verify_with_supabase(token: str) -> dict:
    """Ask Supabase's own Auth API to verify the token, rather than
    verifying the JWT signature ourselves. Supabase signs user session
    tokens with per-project asymmetric keys (ES256/RS256, rotatable) — only
    its long-lived API keys (anon/service_role) use the legacy shared HS256
    secret, so a local HS256 verification silently rejects every real user
    session. Delegating to Supabase avoids depending on which scheme a given
    project uses."""
    url = os.environ["SUPABASE_URL"]
    anon_key = os.environ["SUPABASE_ANON_KEY"]
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                f"{url}/auth/v1/user",
                headers={"apikey": anon_key, "Authorization": f"Bearer {token}"},
            )
    except httpx.HTTPError as e:
        log.warning(f"Supabase auth verification request failed: {e}")
        raise HTTPException(status_code=401, detail="Could not verify session")
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    return r.json()


async def get_current_user(request: Request, db) -> dict:
    """Verifies the Supabase Auth session token sent as `Authorization: Bearer
    <token>` by the frontend's Supabase JS client. Cookies aren't used here —
    the frontend and backend are on different domains (Vercel/Render), and
    browsers increasingly block cross-site cookies regardless of SameSite
    settings, so Supabase's own token-based session (managed client-side) is
    what actually works cross-domain.

    On first request from a given Supabase user, auto-provisions a matching
    profile row in our own `users` table (plan, credits, etc. live there —
    Supabase Auth only owns identity/credentials)."""
    auth_header = request.headers.get("Authorization", "")
    token = auth_header[7:] if auth_header.startswith("Bearer ") else None
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    supabase_user = await _verify_with_supabase(token)
    supabase_uid = supabase_user.get("id")
    email = (supabase_user.get("email") or "").lower().strip()
    if not supabase_uid:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = await db.users.find_one({"id": supabase_uid})
    if not user:
        user = {
            "id": supabase_uid,
            "email": email,
            "name": email.split("@")[0] if email else "User",
            "plan": "free",
            "credit_seconds_used": 0,
            "translation_seconds_used": 0,
            "role": "user",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.users.insert_one(user)

        # Link any pending team invites (created before this user existed).
        try:
            cursor = db.team_members.find({"email": email})
            async for tm in cursor:
                if tm.get("user_id") is None:
                    await db.team_members.update_one({"id": tm["id"]}, {"$set": {"user_id": supabase_uid}})
        except Exception:
            pass

    user.pop("_id", None)
    return user
