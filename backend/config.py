"""Pure constants shared across routers/services. Nothing here is mutated
after import, so `from config import X` is safe everywhere (contrast with
deps.py, where `db` is reassigned after import and must be accessed as
`deps.db`, never destructured)."""
import os
from pathlib import Path

FILES_DIR = Path(os.environ.get("FILES_DIR", "/app/backend/storage"))
UPLOAD_DIR = FILES_DIR / "uploads"
RENDER_DIR = FILES_DIR / "renders"
THUMB_DIR = FILES_DIR / "thumbs"
for d in (UPLOAD_DIR, RENDER_DIR, THUMB_DIR):
    d.mkdir(parents=True, exist_ok=True)

PLANS = {
    "free": {"name": "Free", "price_inr": 0, "credit_minutes": 30, "qualities": ["1080p"], "translation_minutes": 0, "storage_gb": 5},
    "editor": {"name": "Editor", "price_inr": 670, "credit_minutes": 300, "qualities": ["1080p"], "translation_minutes": 0, "storage_gb": 20},
    "creator": {"name": "Creator", "price_inr": 950, "credit_minutes": 900, "qualities": ["1080p", "4k"], "translation_minutes": 120, "storage_gb": 60},
    "studio": {"name": "Studio", "price_inr": 2400, "credit_minutes": 3000, "qualities": ["1080p", "4k", "alpha"], "translation_minutes": 300, "storage_gb": 150},
}

# Longest video a project is allowed to be, per plan (matches Kalakar's tiering
# — e.g. Studio explicitly supports up to 30-minute videos).
MAX_DURATION_MINUTES = {
    "free": 2,
    "editor": 10,
    "creator": 20,
    "studio": 30,
}

VALID_SUBTITLE_STYLES = {"bold-pop", "karaoke", "minimal-clean", "bounce-in"}

# ISO 639-1 codes Whisper supports well, plus "auto" for language auto-detect.
# Mirrors frontend/src/constants/languages.js — keep in sync.
SUPPORTED_LANGUAGES = {
    "auto", "en", "hi", "ur", "bn", "ta", "te", "kn", "ml", "gu", "pa", "mr", "ne", "sd", "ps", "ms",
}

# Media is regenerated in place on re-render, so tell browsers never to cache it.
NO_CACHE = {"Cache-Control": "no-store, no-cache, must-revalidate", "Pragma": "no-cache"}
