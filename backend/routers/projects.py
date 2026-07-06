import os
import uuid
import shutil
import asyncio
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form
from fastapi.responses import FileResponse
from pydantic import BaseModel

import deps
import video_processor as vp
import storage
from auth import get_current_user
from config import UPLOAD_DIR, RENDER_DIR, THUMB_DIR, NO_CACHE, SUPPORTED_LANGUAGES, MAX_DURATION_MINUTES
from services import render_service
from services.storage_sync import skey, backup, restore, backup_outputs, cut_available
from services.plan_service import check_quality_allowed, check_translation_allowed
from services.storage_service import check_storage_allowed, get_user_storage_bytes, get_plan_storage_bytes

log = logging.getLogger("clipcut")

router = APIRouter(prefix="/projects")


async def get_project_and_verify_access(project_id: str, user: dict) -> dict:
    p = await deps.db.projects.find_one({"id": project_id})
    if not p:
        raise HTTPException(404, "Project not found")
    if p.get("user_id") == user["id"]:
        return p
    team_id = p.get("team_id")
    if team_id:
        member = await deps.db.team_members.find_one({"team_id": team_id, "user_id": user["id"]})
        if member:
            return p
        member_email = await deps.db.team_members.find_one({"team_id": team_id, "email": user["email"].lower().strip()})
        if member_email:
            return p
    raise HTTPException(403, "Access denied")


@router.get("")
async def list_projects(request: Request):
    user = await get_current_user(request, deps.db)
    
    # User's own projects
    user_projects = []
    cursor = deps.db.projects.find({"user_id": user["id"]})
    async for p in cursor:
        p.pop("_id", None)
        user_projects.append(p)
        
    # Teams user belongs to
    team_projects = []
    email = user["email"].lower().strip()
    team_ids = []
    
    cursor_member = deps.db.team_members.find({"user_id": user["id"]})
    async for m in cursor_member:
        team_ids.append(m["team_id"])
        
    cursor_member_email = deps.db.team_members.find({"email": email})
    async for m in cursor_member_email:
        team_ids.append(m["team_id"])
        
    team_ids = list(set(team_ids))
    
    for t_id in team_ids:
        cursor_team = deps.db.projects.find({"team_id": t_id})
        async for p in cursor_team:
            p.pop("_id", None)
            if p["user_id"] != user["id"]:
                team_projects.append(p)
                
    all_projects = user_projects + team_projects
    all_projects.sort(key=lambda x: x.get("created_at") or "", reverse=True)
    return all_projects



@router.get("/{project_id}")
async def get_project(project_id: str, request: Request):
    user = await get_current_user(request, deps.db)
    p = await get_project_and_verify_access(project_id, user)
    p.pop("_id", None)
    return p


@router.delete("/{project_id}")
async def delete_project(project_id: str, request: Request):
    user = await get_current_user(request, deps.db)
    p = await get_project_and_verify_access(project_id, user)


    await deps.db.projects.delete_one({"id": project_id})

    # Best-effort cleanup of local disk + Supabase Storage; DB row is already gone.
    shutil.rmtree(UPLOAD_DIR / project_id, ignore_errors=True)
    shutil.rmtree(RENDER_DIR / project_id, ignore_errors=True)
    try:
        os.remove(THUMB_DIR / f"{project_id}.jpg")
    except OSError:
        pass
    if storage.enabled():
        for name in ("original.mp4", "cut.mp4", "final.mp4", "thumb.jpg", "filmstrip.jpg"):
            await asyncio.to_thread(storage.remove, f"{project_id}/{name}")

    return {"success": True}


@router.post("/upload")
async def upload_project(
    request: Request,
    file: UploadFile = File(...),
    name: str = Form(...),
    subtitle_style: str = Form("bold-pop"),
    accent_color: str = Form("#E8622C"),
    font: str = Form("DejaVu Sans"),
    quality: str = Form("1080p"),
    auto_cut: str = Form("balanced"),
    aspect_ratio: str = Form("original"),
    transcription_language: str = Form("auto"),
    team_id: Optional[str] = Form(None),
):
    user = await get_current_user(request, deps.db)
    if team_id:
        member = await deps.db.team_members.find_one({"team_id": team_id, "user_id": user["id"]})
        if not member:
            member = await deps.db.team_members.find_one({"team_id": team_id, "email": user["email"].lower().strip()})
            if not member:
                raise HTTPException(403, "Not a member of this team")

    check_quality_allowed(user, quality)
    if auto_cut not in vp.SENSITIVITY_PRESETS:
        raise HTTPException(400, f"Invalid auto_cut sensitivity: {auto_cut}")
    if transcription_language not in SUPPORTED_LANGUAGES:
        raise HTTPException(400, f"Unsupported transcription_language: {transcription_language}")

    project_id = str(uuid.uuid4())
    proj_dir = UPLOAD_DIR / project_id
    proj_dir.mkdir(parents=True, exist_ok=True)
    ext = Path(file.filename or "video.mp4").suffix or ".mp4"
    input_path = proj_dir / f"original{ext}"
    with open(input_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    # Enforce storage quota and duration cap now that we know the file's real
    # size/length — before it's backed up to Storage or a project row exists,
    # so a rejected upload leaves nothing durable behind.
    try:
        incoming_bytes = os.path.getsize(input_path)
        await check_storage_allowed(deps.db, user, incoming_bytes)

        duration = vp.get_duration(str(input_path))
        max_minutes = MAX_DURATION_MINUTES.get(user.get("plan", "free"), MAX_DURATION_MINUTES["free"])
        if duration > max_minutes * 60:
            raise HTTPException(400, f"This video is {duration / 60:.1f} min — your plan's limit is {max_minutes} min. Upgrade for longer videos.")
    except HTTPException:
        shutil.rmtree(proj_dir, ignore_errors=True)
        raise

    await backup(input_path)

    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": project_id,
        "user_id": user["id"],
        "name": name,
        "status": "queued",
        "progress": 0,
        "input_path": str(input_path),
        "output_path": None,
        "thumbnail_path": None,
        "subtitle_style": subtitle_style,
        "accent_color": accent_color,
        "font": font,
        "quality": quality,
        "aspect_ratio": aspect_ratio,
        "auto_cut": auto_cut,
        "audio_volume": 1.0,
        "audio_fade_in": 0.0,
        "audio_fade_out": 0.0,
        "clean_audio_path": None,
        "music_path": None,
        "music_volume": 0.3,
        "original_duration": None,
        "final_duration": None,
        "cuts_count": 0,
        "seconds_removed": 0.0,
        "created_at": now,
        "updated_at": now,
        "error": None,
        "captions_source": None,
        "transcription_language": transcription_language,
        "team_id": team_id,
    }

    await deps.db.projects.insert_one(doc)

    asyncio.create_task(_process_project(project_id))

    return {"id": project_id, "status": "queued"}


@router.get("/{project_id}/thumbnail")
async def get_thumbnail(project_id: str, request: Request):
    user = await get_current_user(request, deps.db)
    p = await get_project_and_verify_access(project_id, user)
    if not p.get("thumbnail_path"):
        raise HTTPException(404, "Not found")
    if not await restore(p["thumbnail_path"]):
        raise HTTPException(404, "File unavailable")
    return FileResponse(p["thumbnail_path"], media_type="image/jpeg", headers=NO_CACHE)


@router.get("/{project_id}/download")
async def download_project(project_id: str, request: Request):
    user = await get_current_user(request, deps.db)
    p = await get_project_and_verify_access(project_id, user)
    if not p.get("output_path"):
        raise HTTPException(404, "Not found")
    if not await restore(p["output_path"]):
        raise HTTPException(404, "File unavailable")
    return FileResponse(p["output_path"], media_type="video/mp4", filename=f"{p['name']}.mp4", headers=NO_CACHE)


@router.get("/{project_id}/export/srt")
async def export_srt(project_id: str, request: Request):
    """Standalone .srt of the project's current captions, for use in other
    NLEs (Premiere, Resolve, etc.) — independent of the burned-in render."""
    user = await get_current_user(request, deps.db)
    p = await get_project_and_verify_access(project_id, user)
    caps = p.get("captions") or []
    if not caps:
        raise HTTPException(400, "This project has no captions yet")
    srt_dir = RENDER_DIR / project_id
    srt_dir.mkdir(parents=True, exist_ok=True)
    srt_path = srt_dir / "export.srt"
    await asyncio.to_thread(vp.write_srt, caps, str(srt_path))
    return FileResponse(str(srt_path), media_type="application/x-subrip", filename=f"{p['name']}.srt", headers=NO_CACHE)


@router.get("/{project_id}/video")
async def stream_project(project_id: str, request: Request):
    user = await get_current_user(request, deps.db)
    p = await get_project_and_verify_access(project_id, user)
    if not p.get("output_path"):
        raise HTTPException(404, "Not found")
    if not await restore(p["output_path"]):
        raise HTTPException(404, "File unavailable")
    return FileResponse(p["output_path"], media_type="video/mp4", headers=NO_CACHE)


@router.get("/{project_id}/filmstrip")
async def get_filmstrip(project_id: str, request: Request):
    """A horizontal strip of sampled frames for the timeline's video track."""
    user = await get_current_user(request, deps.db)
    p = await get_project_and_verify_access(project_id, user)
    strip = RENDER_DIR / project_id / "filmstrip.jpg"
    if not await restore(strip):
        cut_path = RENDER_DIR / project_id / "cut.mp4"
        if not await restore(cut_path):
            raise HTTPException(404, "Source not ready")
        await asyncio.to_thread(vp.make_filmstrip, str(cut_path), str(strip))
        await backup(strip)
    if not strip.exists():
        raise HTTPException(404, "Filmstrip unavailable")
    return FileResponse(str(strip), media_type="image/jpeg", headers=NO_CACHE)


@router.post("/{project_id}/music")
async def upload_music(project_id: str, request: Request, file: UploadFile = File(...)):
    user = await get_current_user(request, deps.db)
    p = await get_project_and_verify_access(project_id, user)
    mdir = RENDER_DIR / project_id
    mdir.mkdir(parents=True, exist_ok=True)
    ext = Path(file.filename or "music.mp3").suffix or ".mp3"
    mpath = mdir / f"music{ext}"
    with open(mpath, "wb") as f:
        shutil.copyfileobj(file.file, f)
    await backup(mpath)
    await deps.db.projects.update_one(
        {"id": project_id},
        {"$set": {"music_path": str(mpath), "music_volume": p.get("music_volume", 0.3) or 0.3,
                  "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"success": True}


@router.delete("/{project_id}/music")
async def remove_music(project_id: str, request: Request):
    user = await get_current_user(request, deps.db)
    p = await get_project_and_verify_access(project_id, user)
    if p.get("music_path"):
        try:
            os.remove(p["music_path"])
        except OSError:
            pass
        if storage.enabled():
            await asyncio.to_thread(storage.remove, skey(p["music_path"]))
    await deps.db.projects.update_one({"id": project_id}, {"$set": {"music_path": None}})
    return {"success": True}


@router.get("/{project_id}/asset")
async def get_asset(project_id: str, request: Request, path: str):
    user = await get_current_user(request, deps.db)
    p = await get_project_and_verify_access(project_id, user)
    if path not in [p.get("music_path"), p.get("clean_audio_path")]:
        raise HTTPException(403)
    if not os.path.exists(path):
        raise HTTPException(404)
    return FileResponse(path, headers=NO_CACHE)


@router.get("/{project_id}/source")
async def stream_source(project_id: str, request: Request):
    """The cut video WITHOUT burned-in captions — used by the editor so caption
    edits can be previewed live as a text overlay."""
    user = await get_current_user(request, deps.db)
    p = await get_project_and_verify_access(project_id, user)
    cut_path = RENDER_DIR / project_id / "cut.mp4"
    if not await restore(cut_path):
        raise HTTPException(404, "Source not ready")
    return FileResponse(str(cut_path), media_type="video/mp4", headers=NO_CACHE)


# ---------- Transcript / re-render ----------
class CaptionIn(BaseModel):
    start: float
    end: float
    text: str
    track: int = 0


class ProjectPatch(BaseModel):
    name: Optional[str] = None
    captions: Optional[List[CaptionIn]] = None
    subtitle_style: Optional[str] = None
    accent_color: Optional[str] = None
    font: Optional[str] = None
    audio_volume: Optional[float] = None
    audio_fade_in: Optional[float] = None
    audio_fade_out: Optional[float] = None
    music_volume: Optional[float] = None
    aspect_ratio: Optional[str] = None
    quality: Optional[str] = None
    team_id: Optional[str] = None



@router.patch("/{project_id}")
async def patch_project(project_id: str, payload: ProjectPatch, request: Request):
    user = await get_current_user(request, deps.db)
    p = await get_project_and_verify_access(project_id, user)
    updates = {}
    if payload.captions is not None:
        updates["captions"] = [c.model_dump() for c in payload.captions]
    if payload.quality is not None:
        check_quality_allowed(user, payload.quality)
        updates["quality"] = payload.quality
    if payload.team_id is not None:
        t_id = payload.team_id or None
        if t_id:
            member = await deps.db.team_members.find_one({"team_id": t_id, "user_id": user["id"]})
            if not member:
                member = await deps.db.team_members.find_one({"team_id": t_id, "email": user["email"].lower().strip()})
                if not member:
                    raise HTTPException(403, "Not a member of target team")
        updates["team_id"] = t_id
    for f in ("name", "subtitle_style", "accent_color", "font", "audio_volume", "audio_fade_in", "audio_fade_out", "music_volume", "aspect_ratio"):
        v = getattr(payload, f)
        if v is not None:
            updates[f] = v
    if updates:
        updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        await deps.db.projects.update_one({"id": project_id}, {"$set": updates})
    updated = await deps.db.projects.find_one({"id": project_id})
    updated.pop("_id", None)
    return updated


@router.post("/{project_id}/clean-audio")
async def clean_project_audio(project_id: str, request: Request):
    user = await get_current_user(request, deps.db)
    p = await get_project_and_verify_access(project_id, user)

    input_path = p.get("output_path") or p.get("input_path")
    if not input_path or not os.path.exists(input_path):
        raise HTTPException(400, "Project missing input file")

    clean_out = str(vp.UPLOAD_DIR / project_id / "clean_audio.m4a")
    loop = asyncio.get_event_loop()
    # Executing synchronously in thread pool
    success = await loop.run_in_executor(None, vp.clean_audio_sync, input_path, clean_out)
    if success:
        await deps.db.projects.update_one({"id": project_id}, {"$set": {"clean_audio_path": clean_out}})
        p["clean_audio_path"] = clean_out

    p.pop("_id", None)
    return p


@router.post("/{project_id}/translate")
async def translate_project(project_id: str, request: Request):
    """Kick off an English translation of this project's captions (Whisper's
    built-in translate mode — not a separate translation service). Gated by
    the user's plan's translation-minutes budget, same pattern as render
    minutes."""
    user = await get_current_user(request, deps.db)
    p = await get_project_and_verify_access(project_id, user)
    if not await cut_available(project_id):
        raise HTTPException(400, "Cut source missing, cannot translate")
    duration = p.get("final_duration") or p.get("original_duration") or 0
    check_translation_allowed(user, duration)

    await deps.db.projects.update_one({"id": project_id}, {"$set": {"translation_status": "translating"}})
    asyncio.create_task(_translate_project(project_id, user["id"], duration))
    return {"id": project_id, "translation_status": "translating"}


async def _translate_project(project_id: str, user_id: str, duration: float):
    try:
        p = await deps.db.projects.find_one({"id": project_id})
        if not p:
            return
        cut_dir = RENDER_DIR / project_id
        cut_path = cut_dir / "cut.mp4"
        await restore(cut_path)
        audio_path = cut_dir / "cut_audio.m4a"
        if not os.path.exists(audio_path):
            await asyncio.to_thread(vp.extract_audio, str(cut_path), str(audio_path))
        caps_en = await vp.transcribe_with_whisper(
            str(audio_path), language=p.get("transcription_language"), task="translate",
        )
        await deps.db.projects.update_one({"id": project_id}, {"$set": {
            "captions_en": caps_en,
            "translation_status": "done" if caps_en else "failed",
        }})
        if caps_en:
            await deps.db.users.update_one({"id": user_id}, {"$inc": {"translation_seconds_used": int(duration)}})
    except Exception as e:
        log.exception(f"Translate {project_id} failed")
        await deps.db.projects.update_one({"id": project_id}, {"$set": {"translation_status": "failed"}})


@router.post("/{project_id}/rerender")
async def rerender_project(project_id: str, request: Request):
    user = await get_current_user(request, deps.db)
    p = await get_project_and_verify_access(project_id, user)
    if not await cut_available(project_id):
        raise HTTPException(400, "Cut source missing, cannot re-render")

    await _update(project_id, status="rendering", progress=50)
    asyncio.create_task(_rerender_project(project_id))
    return {"id": project_id, "status": "rendering"}


class TrimIn(BaseModel):
    start: float
    end: float


@router.post("/{project_id}/trim")
async def trim_project(project_id: str, payload: TrimIn, request: Request):
    user = await get_current_user(request, deps.db)
    p = await get_project_and_verify_access(project_id, user)
    if not await cut_available(project_id):
        raise HTTPException(400, "Cut source missing, cannot trim")
    await _update(project_id, status="rendering", progress=40)
    asyncio.create_task(_trim_and_render(project_id, max(0.0, payload.start), payload.end))
    return {"id": project_id, "status": "rendering"}


async def _trim_and_render(project_id: str, start: float, end: float):
    try:
        p = await deps.db.projects.find_one({"id": project_id})
        if not p:
            return
        cut_dir = RENDER_DIR / project_id
        cut_path = cut_dir / "cut.mp4"
        await restore(cut_path)
        tmp = cut_dir / "cut_trimmed.mp4"
        new_dur = await asyncio.to_thread(vp.trim_video, str(cut_path), str(tmp), start, end)
        os.replace(str(tmp), str(cut_path))
        await asyncio.to_thread(vp.extract_audio, str(cut_path), str(cut_dir / "cut_audio.m4a"))

        # Shift captions into the trimmed timeline; drop/clip those outside it.
        caps = []
        for c in (p.get("captions") or []):
            ns, ne = c["start"] - start, c["end"] - start
            if ne <= 0.05 or ns >= new_dur:
                continue
            caps.append({**c, "start": max(0.0, ns), "end": min(new_dur, ne)})
        await _update(project_id, captions=caps, final_duration=round(new_dur, 2))

        output_path = cut_dir / "final.mp4"
        thumb_path = THUMB_DIR / f"{project_id}.jpg"
        await render_service.render_captions(str(cut_path), caps, str(output_path), str(thumb_path), p, restore_fn=restore)
        try:
            os.remove(str(cut_dir / "filmstrip.jpg"))
        except OSError:
            pass
        await backup_outputs(project_id)
        await _update(project_id, status="done", progress=100,
                      output_path=str(output_path), thumbnail_path=str(thumb_path))
    except Exception as e:
        log.exception(f"Trim {project_id} failed")
        await _update(project_id, status="failed", error=str(e))


class RecutIn(BaseModel):
    keep: List[List[float]]  # ordered [start, end] ranges to keep (in current cut seconds)


@router.post("/{project_id}/recut")
async def recut_project(project_id: str, payload: RecutIn, request: Request):
    user = await get_current_user(request, deps.db)
    p = await get_project_and_verify_access(project_id, user)
    if not await cut_available(project_id):

        raise HTTPException(400, "Cut source missing")
    keeps = [(max(0.0, a), b) for a, b in payload.keep if b - a > 0.05]
    if not keeps:
        raise HTTPException(400, "Nothing left to keep")
    await _update(project_id, status="rendering", progress=40)
    asyncio.create_task(_recut_and_render(project_id, keeps))
    return {"id": project_id, "status": "rendering"}


async def _recut_and_render(project_id: str, keeps):
    try:
        p = await deps.db.projects.find_one({"id": project_id})
        if not p:
            return
        cut_dir = RENDER_DIR / project_id
        cut_path = cut_dir / "cut.mp4"
        await restore(cut_path)
        tmp = cut_dir / "cut_recut.mp4"
        new_dur = await asyncio.to_thread(vp.cut_video, str(cut_path), str(tmp), keeps)
        os.replace(str(tmp), str(cut_path))
        await asyncio.to_thread(vp.extract_audio, str(cut_path), str(cut_dir / "cut_audio.m4a"))

        def remap(t):
            acc = 0.0
            for (s, e) in keeps:
                if t <= s:
                    break
                if t >= e:
                    acc += e - s
                else:
                    acc += t - s
                    break
            return acc

        caps = []
        for c in (p.get("captions") or []):
            ns, ne = remap(c["start"]), remap(c["end"])
            if ne - ns <= 0.05:
                continue
            caps.append({**c, "start": ns, "end": ne})
        await _update(project_id, captions=caps, final_duration=round(new_dur, 2))

        output_path = cut_dir / "final.mp4"
        thumb_path = THUMB_DIR / f"{project_id}.jpg"
        await render_service.render_captions(str(cut_path), caps, str(output_path), str(thumb_path), p, restore_fn=restore)
        try:
            os.remove(str(cut_dir / "filmstrip.jpg"))
        except OSError:
            pass
        await backup_outputs(project_id)
        await _update(project_id, status="done", progress=100,
                      output_path=str(output_path), thumbnail_path=str(thumb_path))
    except Exception as e:
        log.exception(f"Recut {project_id} failed")
        await _update(project_id, status="failed", error=str(e))


async def _rerender_project(project_id: str):
    try:
        p = await deps.db.projects.find_one({"id": project_id})
        if not p:
            return
        cut_dir = RENDER_DIR / project_id
        cut_path = cut_dir / "cut.mp4"
        await restore(cut_path)
        caps = p.get("captions") or []
        output_path = cut_dir / "final.mp4"
        thumb_path = THUMB_DIR / f"{project_id}.jpg"
        await render_service.render_captions(str(cut_path), caps, str(output_path), str(thumb_path), p, restore_fn=restore)
        await backup_outputs(project_id)
        await _update(
            project_id, status="done", progress=100,
            output_path=str(output_path), thumbnail_path=str(thumb_path),
        )
    except Exception as e:
        log.exception(f"Re-render {project_id} failed")
        await _update(project_id, status="failed", error=str(e))


# ---------- Background pipeline ----------
async def _update(project_id: str, **fields):
    fields["updated_at"] = datetime.now(timezone.utc).isoformat()
    await deps.db.projects.update_one({"id": project_id}, {"$set": fields})


async def _process_project(project_id: str):
    try:
        p = await deps.db.projects.find_one({"id": project_id})
        if not p:
            return
        input_path = p["input_path"]
        await restore(input_path)

        # Stage 1: cutting (real ffmpeg silence detection + cut)
        await _update(project_id, status="cutting", progress=15)
        duration = vp.get_duration(input_path)
        await _update(project_id, original_duration=duration)

        sensitivity = p.get("auto_cut", "balanced")
        preset = vp.SENSITIVITY_PRESETS.get(sensitivity, vp.SENSITIVITY_PRESETS["balanced"])
        cut_dir = RENDER_DIR / project_id
        cut_dir.mkdir(parents=True, exist_ok=True)
        cut_path = cut_dir / "cut.mp4"

        if preset[0] is None:
            # auto_cut = "off" — skip silence removal, just re-encode
            keeps = [(0.0, duration)]
            silences = []
        else:
            noise_db, min_dur = preset
            silences = await asyncio.to_thread(vp.detect_silences, input_path, noise_db, min_dur)
            keeps = vp.compute_keep_segments(duration, silences)

        new_duration = await asyncio.to_thread(vp.cut_video, input_path, str(cut_path), keeps)
        cuts_count = len(silences)
        seconds_removed = max(0.0, duration - new_duration)
        await _update(
            project_id, final_duration=new_duration, progress=40,
            cuts_count=cuts_count, seconds_removed=round(seconds_removed, 2),
        )

        # Stage 2: transcribing (REAL Whisper on cut audio for accurate timestamps)
        await _update(project_id, status="transcribing", progress=55)
        audio_path = cut_dir / "cut_audio.m4a"
        await asyncio.to_thread(vp.extract_audio, str(cut_path), str(audio_path))
        caps = await vp.transcribe_with_whisper(str(audio_path), language=p.get("transcription_language"))
        captions_source = "whisper"
        if not caps:
            log.warning(f"Project {project_id}: Whisper returned no captions, using fallback")
            caps = vp.synth_captions(new_duration)
            captions_source = "placeholder"
        await _update(project_id, progress=70, captions=caps, captions_source=captions_source)

        # Stage 3: rendering (real ffmpeg subtitles burn-in)
        await _update(project_id, status="rendering", progress=80)
        output_path = cut_dir / "final.mp4"
        thumb_path = THUMB_DIR / f"{project_id}.jpg"
        await render_service.render_captions(str(cut_path), caps, str(output_path), str(thumb_path), p, restore_fn=restore)
        await backup_outputs(project_id)

        # Increment credit usage
        await deps.db.users.update_one(
            {"id": p["user_id"]},
            {"$inc": {"credit_seconds_used": int(duration)}},
        )

        await _update(
            project_id, status="done", progress=100,
            output_path=str(output_path), thumbnail_path=str(thumb_path),
        )
        log.info(f"Project {project_id} done")
    except Exception as e:
        log.exception(f"Project {project_id} failed")
        await _update(project_id, status="failed", error=str(e))
