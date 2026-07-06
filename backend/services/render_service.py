"""Single source of truth for turning a project's caption data into a
rendered video.

All 4 render call sites (initial process, rerender, trim, recut) go through
render_captions() so the caption "shape" (always list[dict], never tuples)
and the render_with_subtitles() call signature can never drift between them
again. This consolidation fixes the exact bug class that crashed re-render
on 2026-07-05 (one call site built tuples while video_processor.py expected
dicts) — that class of bug is now structurally impossible since there is
only one place that builds this call.
"""
from __future__ import annotations

import os
import asyncio
from typing import Awaitable, Callable, List, Optional

import video_processor as vp


def audio_kwargs(project: dict) -> dict:
    """Pure: extract the render_with_subtitles() audio kwargs from a project doc."""
    music = project.get("music_path")
    return {
        "audio_volume": float(project.get("audio_volume", 1.0) or 1.0),
        "fade_in": float(project.get("audio_fade_in", 0.0) or 0.0),
        "fade_out": float(project.get("audio_fade_out", 0.0) or 0.0),
        "music_path": music if music and os.path.exists(music) else None,
        "music_volume": float(project.get("music_volume", 0.3) or 0.3),
    }


async def audio_kwargs_local(project: dict, restore_fn: Optional[Callable[[str], Awaitable[bool]]] = None) -> dict:
    """Like audio_kwargs(), but restores the music file from Storage first
    if it's missing locally (restore_fn is server.py's _restore)."""
    music = project.get("music_path")
    if music and restore_fn:
        await restore_fn(music)
    return audio_kwargs(project)


async def render_captions(
    cut_path: str,
    caps: List[dict],
    output_path: str,
    thumb_path: str,
    project: dict,
    restore_fn: Optional[Callable[[str], Awaitable[bool]]] = None,
) -> None:
    """Burn `caps` into cut_path, producing final.mp4 + a thumbnail.

    `caps` must be a list of dicts with at least start/end/text keys — the
    same shape stored in the project's `captions` field. Never pass tuples.
    """
    work_dir = os.path.dirname(output_path)
    srt_path = os.path.join(work_dir, "captions.srt")
    vp.write_srt(caps, srt_path)

    kwargs = await audio_kwargs_local(project, restore_fn)
    await asyncio.to_thread(
        vp.render_with_subtitles, cut_path, caps, output_path,
        project["subtitle_style"], project["accent_color"], project["font"], project["quality"],
        **kwargs,
    )
    await asyncio.to_thread(vp.make_thumbnail, output_path, thumb_path, 1.0)
