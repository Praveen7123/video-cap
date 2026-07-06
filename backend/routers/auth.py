from fastapi import APIRouter, Request

import deps
from auth import get_current_user
from schemas.serializers import user_public

router = APIRouter(prefix="/auth")


@router.get("/me")
async def me(request: Request):
    """Register/login/logout all happen client-side now via the Supabase JS
    SDK — this route just verifies the resulting session token and returns
    (auto-provisioning on first call) the matching app profile."""
    user = await get_current_user(request, deps.db)
    return user_public(user)
