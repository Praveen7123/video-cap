from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

import deps
from auth import get_current_user
from schemas.serializers import user_public
from config import VALID_SUBTITLE_STYLES
from services.storage_service import get_user_storage_bytes, get_plan_storage_bytes

router = APIRouter(prefix="/account")


class UpdateNameIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)


class BrandKitIn(BaseModel):
    enabled: bool
    subtitle_style: str = "bold-pop"
    accent_color: str = "#FFFFFF"
    font: str = "DejaVu Sans"


@router.patch("")
async def update_name(payload: UpdateNameIn, request: Request):
    user = await get_current_user(request, deps.db)
    await deps.db.users.update_one({"id": user["id"]}, {"$set": {"name": payload.name.strip()}})
    updated = await deps.db.users.find_one({"id": user["id"]})
    return user_public(updated)


@router.get("/storage")
async def get_storage_usage(request: Request):
    """Not folded into /auth/me — this scans Storage across all of a user's
    projects, so it's only worth paying for when a screen actually shows it
    (e.g. Billing/Profile), not on every auth check."""
    user = await get_current_user(request, deps.db)
    used = await get_user_storage_bytes(deps.db, user["id"])
    quota = get_plan_storage_bytes(user)
    return {"used_bytes": used, "quota_bytes": quota}


@router.patch("/brand-kit")
async def update_brand_kit(payload: BrandKitIn, request: Request):
    user = await get_current_user(request, deps.db)
    if payload.subtitle_style not in VALID_SUBTITLE_STYLES:
        raise HTTPException(400, f"Invalid subtitle_style: {payload.subtitle_style}")
    await deps.db.users.update_one({"id": user["id"]}, {"$set": {
        "brand_kit_enabled": payload.enabled,
        "brand_subtitle_style": payload.subtitle_style,
        "brand_accent_color": payload.accent_color,
        "brand_font": payload.font,
    }})
    updated = await deps.db.users.find_one({"id": user["id"]})
    return user_public(updated)
