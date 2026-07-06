"""Single source of truth for plan/quality gating — was previously duplicated
inline in both the upload and patch project routes."""
from fastapi import HTTPException

from config import PLANS


def get_plan(user: dict) -> dict:
    return PLANS.get(user.get("plan", "free"), PLANS["free"])


def check_quality_allowed(user: dict, quality: str) -> None:
    plan = get_plan(user)
    if quality not in plan["qualities"]:
        raise HTTPException(400, f"Quality '{quality}' not available on plan '{user.get('plan')}'")


def check_translation_allowed(user: dict, duration_seconds: float) -> None:
    """Translation is gated by a monthly minutes budget per plan (mirrors the
    existing credit_seconds_used pattern for render minutes)."""
    plan = get_plan(user)
    budget_seconds = plan.get("translation_minutes", 0) * 60
    if budget_seconds <= 0:
        raise HTTPException(400, f"Translation isn't available on plan '{user.get('plan')}'")
    used = user.get("translation_seconds_used", 0) or 0
    if used + duration_seconds > budget_seconds:
        raise HTTPException(400, "Translation minutes for this month are used up — upgrade your plan for more.")
