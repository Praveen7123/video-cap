"""Shape DB documents into what the frontend is allowed to see."""


def user_public(u: dict) -> dict:
    return {
        "id": u["id"],
        "email": u["email"],
        "name": u.get("name"),
        "plan": u.get("plan", "free"),
        "credit_seconds_used": u.get("credit_seconds_used", 0),
        "translation_seconds_used": u.get("translation_seconds_used", 0),
        "role": u.get("role", "user"),
        "created_at": u.get("created_at"),
        "brand_kit_enabled": bool(u.get("brand_kit_enabled", False)),
        "brand_subtitle_style": u.get("brand_subtitle_style") or "bold-pop",
        "brand_accent_color": u.get("brand_accent_color") or "#FFFFFF",
        "brand_font": u.get("brand_font") or "DejaVu Sans",
    }


def project_public(p: dict) -> dict:
    p.pop("_id", None)
    return p


def team_public(t: dict) -> dict:
    t.pop("_id", None)
    return {
        "id": t["id"],
        "name": t["name"],
        "seats": t.get("seats", 1),
        "created_at": t.get("created_at")
    }


def team_member_public(m: dict) -> dict:
    m.pop("_id", None)
    return {
        "id": m["id"],
        "team_id": m["team_id"],
        "email": m["email"],
        "user_id": m.get("user_id"),
        "created_at": m.get("created_at")
    }

