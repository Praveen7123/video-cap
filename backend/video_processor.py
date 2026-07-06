"""ClipCut video processing pipeline.

Pipeline stages:
1. cutting (REAL ffmpeg): detect silent segments > 0.6s and cut them out.
2. transcribing (REAL local Whisper): word-level captions on cut audio.
3. rendering (REAL ffmpeg): burn stylized subtitles into the cut video.
"""
from __future__ import annotations

import os
import re
import asyncio
import subprocess
import logging
from pathlib import Path
from typing import List, Tuple

log = logging.getLogger("clipcut.vp")

FILLER_PHRASES = [
    "Hey creators", "Welcome back to the channel", "So today", "I want to show you",
    "something incredible", "This will change", "the way you edit", "let's dive in",
    "First thing to remember", "consistency wins", "keep it short", "hook them fast",
    "add subtitles always", "eighty percent watch muted", "cut the dead air",
    "that pause was too long", "reshoot never", "just trim it", "ClipCut handles it",
    "done in seconds", "no timeline required", "pure creator flow", "subscribe for more",
]

EMOJI_MAP = {
    "fire": "🔥", "crazy": "🤯", "money": "💰", "cash": "💰", 
    "rocket": "🚀", "boom": "💥", "sad": "😢", "happy": "😃",
    "win": "🏆", "winner": "🏆", "love": "❤️", "mind": "🧠",
    "idea": "💡", "stop": "🛑", "warning": "⚠️", "fast": "⚡", 
    "time": "⏱️", "question": "❓", "secret": "🤫", "100": "💯",
    "laugh": "😂", "lol": "😂", "wow": "😲", "omg": "😱"
}


def _run(cmd: List[str], capture=False) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, check=False, capture_output=capture, text=True)


def get_duration(path: str) -> float:
    result = _run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", path],
        capture=True,
    )
    try:
        return float(result.stdout.strip())
    except ValueError:
        return 0.0


def get_dimensions(path: str) -> Tuple[int, int]:
    """Return (width, height) of the first video stream."""
    result = _run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0",
         "-show_entries", "stream=width,height",
         "-of", "csv=p=0:s=x", path],
        capture=True,
    )
    try:
        w, h = result.stdout.strip().split("x")
        return int(w), int(h)
    except Exception:
        return 1080, 1920


def clean_audio_sync(video_path: str, output_path: str) -> bool:
    """Uses FFmpeg's afftdn filter to denoise audio payload and extract it."""
    cmd = [
        "ffmpeg", "-y", "-i", video_path,
        "-vn",
        "-af", "afftdn=nf=-25",
        "-c:a", "aac", "-b:a", "192k",
        output_path
    ]
    res = _run(cmd)
    return res.returncode == 0


SENSITIVITY_PRESETS = {
    # (noise_db, min_silence_dur) — aggressive cuts the most, subtle cuts the least
    "aggressive": ("-24dB", 0.3),
    "balanced":   ("-30dB", 0.6),
    "subtle":     ("-36dB", 1.2),
    "off":        (None, None),
}


def detect_silences(path: str, noise_db: str = "-30dB", min_dur: float = 0.6) -> List[Tuple[float, float]]:
    """Return list of (start, end) silent intervals."""
    result = _run(
        ["ffmpeg", "-hide_banner", "-nostats", "-i", path,
         "-af", f"silencedetect=noise={noise_db}:d={min_dur}", "-f", "null", "-"],
        capture=True,
    )
    out = (result.stderr or "") + (result.stdout or "")
    starts = [float(m) for m in re.findall(r"silence_start:\s*([0-9.]+)", out)]
    ends = [float(m) for m in re.findall(r"silence_end:\s*([0-9.]+)", out)]
    pairs = list(zip(starts, ends))
    return pairs


def compute_keep_segments(duration: float, silences: List[Tuple[float, float]]) -> List[Tuple[float, float]]:
    """Return non-silent segments to keep."""
    keeps: List[Tuple[float, float]] = []
    cursor = 0.0
    for s, e in silences:
        if s > cursor + 0.05:
            keeps.append((cursor, s))
        cursor = max(cursor, e)
    if duration - cursor > 0.05:
        keeps.append((cursor, duration))
    if not keeps:
        keeps = [(0.0, duration)]
    return keeps


def cut_video(input_path: str, output_path: str, keeps: List[Tuple[float, float]]) -> float:
    """Cut & concatenate keep segments using ffmpeg select filter. Returns new duration."""
    if len(keeps) == 1 and keeps[0][0] < 0.1 and abs(keeps[0][1] - get_duration(input_path)) < 0.2:
        # Nothing to cut; just copy
        _run(["ffmpeg", "-y", "-i", input_path, "-c", "copy", output_path], capture=True)
        return keeps[0][1] - keeps[0][0]

    select_v = "+".join([f"between(t,{s:.3f},{e:.3f})" for s, e in keeps])
    select_a = select_v
    vf = f"select='{select_v}',setpts=N/FRAME_RATE/TB"
    af = f"aselect='{select_a}',asetpts=N/SR/TB"
    cmd = [
        "ffmpeg", "-y", "-i", input_path,
        "-vf", vf, "-af", af,
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "22",
        "-c:a", "aac", "-b:a", "128k",
        "-movflags", "+faststart",
        output_path,
    ]
    _run(cmd, capture=True)
    return sum(e - s for s, e in keeps)


def synth_captions(duration: float) -> List[dict]:
    """Fallback captions when transcription fails or returns nothing."""
    if duration <= 0:
        return []
    window = 1.6
    n = max(1, int(duration / window))
    caps: List[dict] = []
    for i in range(n):
        start = i * window
        end = min(duration, start + window - 0.08)
        phrase = FILLER_PHRASES[i % len(FILLER_PHRASES)]
        words = []
        # mock word timings
        ph_words = phrase.split()
        if ph_words:
            w_dur = (end - start) / len(ph_words)
            for j, w in enumerate(ph_words):
                words.append({"start": start + j * w_dur, "end": start + (j + 1) * w_dur - 0.01, "word": w})
        caps.append({"start": start, "end": end, "text": phrase, "words": words})
    return caps


def extract_audio(video_path: str, out_path: str) -> None:
    """Extract mono 16kHz m4a audio, small enough for Whisper (25MB limit)."""
    _run([
        "ffmpeg", "-y", "-i", video_path,
        "-vn", "-ac", "1", "-ar", "16000",
        "-c:a", "aac", "-b:a", "48k",
        out_path,
    ], capture=True)


MAX_WORDS = 5
MAX_DUR = 2.2


def _group_words(word_tuples: List[Tuple[float, float, str]]) -> List[dict]:
    """Group (start, end, word) tuples into ~4-6 word caption lines (<= MAX_DUR)."""
    caps: List[dict] = []
    group: List[Tuple[float, float, str]] = []
    group_start = None

    def _flush():
        if not group:
            return
        text = " ".join(w[2].strip() for w in group).strip()
        words = [{"start": w[0], "end": w[1], "word": w[2].strip()} for w in group]
        
        found_emoji = None
        for w in words:
            w_clean = re.sub(r'[^a-zA-Z0-9]', '', w["word"].lower())
            if w_clean in EMOJI_MAP:
                found_emoji = EMOJI_MAP[w_clean]
                break
        
        if found_emoji and words:
            last_end = words[-1]["end"]
            words.append({"start": last_end, "end": last_end + 0.1, "word": found_emoji})
            text += f" {found_emoji}"

        if text:
            caps.append({
                "start": float(group_start),
                "end": float(words[-1]["end"]),
                "text": text,
                "words": words
            })

    for (ws, we, wt) in word_tuples:
        if group_start is None:
            group_start = ws
            group = [(ws, we, wt)]
            continue
        if len(group) >= MAX_WORDS or (we - group_start) > MAX_DUR:
            _flush()
            group_start = ws
            group = [(ws, we, wt)]
        else:
            group.append((ws, we, wt))
    _flush()
    return caps


# faster-whisper model is expensive to load, so cache it for the process lifetime.
_WHISPER_MODEL = None


def _get_whisper_model():
    global _WHISPER_MODEL
    if _WHISPER_MODEL is None:
        from faster_whisper import WhisperModel
        size = os.environ.get("WHISPER_MODEL", "base")
        log.info(f"Loading faster-whisper model '{size}' (first run downloads it)…")
        _WHISPER_MODEL = WhisperModel(size, device="cpu", compute_type="int8")
    return _WHISPER_MODEL


def _transcribe_faster_whisper(audio_path: str, language: str = None, task: str = "transcribe") -> List[dict]:
    """Real local transcription via faster-whisper. Word-level timestamps.

    `language` is an ISO 639-1 code (e.g. "hi", "ta") or None to let Whisper
    auto-detect the spoken language. `task="translate"` uses Whisper's built-in
    translation mode, which always outputs English regardless of the source
    language — no separate translation API needed."""
    model = _get_whisper_model()
    segments, _info = model.transcribe(audio_path, word_timestamps=True, language=language, task=task)
    tuples: List[Tuple[float, float, str]] = []
    for seg in segments:
        if seg.words:
            for w in seg.words:
                tuples.append((float(w.start), float(w.end), w.word))
        elif (seg.text or "").strip():
            tuples.append((float(seg.start), float(seg.end), seg.text))
    return _group_words(tuples)


async def transcribe_with_whisper(audio_path: str, language: str = None, task: str = "transcribe") -> List[dict]:
    """Return word-grouped captions [{"start": s, "end": e, "text": t, "words": []}, ...].

    `language` is an ISO 639-1 code (e.g. "hi" for Hindi, "ta" for Tamil) or
    None/"auto" to auto-detect. See config.SUPPORTED_LANGUAGES for the set we
    expose in the UI. `task="translate"` produces an English translation of
    non-English speech instead of a same-language transcript.

    Runs local faster-whisper (free, offline). Falls back to [] on any error
    (caller then uses synthetic captions).
    """
    lang = None if language in (None, "auto") else language
    try:
        caps = await asyncio.to_thread(_transcribe_faster_whisper, audio_path, lang, task)
        if caps:
            log.info(f"Local Whisper produced {len(caps)} caption lines")
            return caps
        log.warning("Local Whisper returned no captions")
    except Exception as e:
        log.warning(f"faster-whisper unavailable/failed: {e}")
    return []


def _srt_time(t: float) -> str:
    ms = int(round(t * 1000))
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def write_srt(caps: List[dict], path: str):
    with open(path, "w", encoding="utf-8") as f:
        for i, item in enumerate(caps, 1):
            s, e, text = item["start"], item["end"], item["text"]
            f.write(f"{i}\n{_srt_time(s)} --> {_srt_time(e)}\n{text}\n\n")


# Subtitle style presets
STYLE_PRESETS = {
    "karaoke": {
        "Fontname": "DejaVu Sans", "Fontsize": "26", "Bold": "1",
        "PrimaryColour": "&H0000E5FF", "OutlineColour": "&H00000000",
        "BackColour": "&H80000000", "Outline": "3", "Shadow": "0",
        "Alignment": "2", "MarginV": "60",
    },
    "bold-pop": {
        "Fontname": "DejaVu Sans", "Fontsize": "32", "Bold": "1",
        "PrimaryColour": "&H00FFFFFF", "OutlineColour": "&H00000000",
        "BackColour": "&H00000000", "Outline": "4", "Shadow": "1",
        "Alignment": "2", "MarginV": "80",
    },
    "minimal-clean": {
        "Fontname": "DejaVu Sans", "Fontsize": "22", "Bold": "0",
        "PrimaryColour": "&H00FFFFFF", "OutlineColour": "&H00000000",
        "BackColour": "&H00000000", "Outline": "1", "Shadow": "0",
        "Alignment": "2", "MarginV": "50",
    },
    "bounce-in": {
        "Fontname": "DejaVu Sans", "Fontsize": "28", "Bold": "1",
        "PrimaryColour": "&H002CE8E8", "OutlineColour": "&H00000000",
        "BackColour": "&H00000000", "Outline": "3", "Shadow": "1",
        "Alignment": "2", "MarginV": "70",
    },
}


def _hex_to_ass_bgr(hex_color: str) -> str:
    """Convert #RRGGBB to ASS &H00BBGGRR."""
    h = hex_color.lstrip("#")
    if len(h) != 6:
        return "&H00FFFFFF"
    r, g, b = h[0:2], h[2:4], h[4:6]
    return f"&H00{b.upper()}{g.upper()}{r.upper()}"


# Caption sizing as fractions of the OUTPUT video, so the burned-in result
# matches the editor's live CSS overlay (which uses the same fractions).
# Keep these in sync with STYLE_SIZING in frontend/src/pages/Editor.jsx.
STYLE_SIZING = {
    "bold-pop":      {"size": 0.092, "outline": 0.11, "shadow": 0.03, "bold": True,  "marginV": 0.10,  "primary": "&H00FFFFFF"},
    "karaoke":       {"size": 0.078, "outline": 0.10, "shadow": 0.00, "bold": True,  "marginV": 0.09,  "primary": "&H0000E5FF"},
    "minimal-clean": {"size": 0.062, "outline": 0.05, "shadow": 0.00, "bold": False, "marginV": 0.08,  "primary": "&H00FFFFFF"},
    "bounce-in":     {"size": 0.082, "outline": 0.10, "shadow": 0.03, "bold": True,  "marginV": 0.095, "primary": "&H002CE8E8"},
}


def _ass_time(t: float) -> str:
    cs = int(round(t * 100))
    h, cs = divmod(cs, 360000)
    m, cs = divmod(cs, 6000)
    s, cs = divmod(cs, 100)
    return f"{h:d}:{m:02d}:{s:02d}.{cs:02d}"


def _parse_srt(path: str) -> List[dict]:
    """Parse an SRT file back into [{"start", "end", "text", "words": []}, ...]."""
    with open(path, encoding="utf-8") as f:
        content = f.read()
    caps: List[dict] = []
    for block in re.split(r"\n\s*\n", content.strip()):
        lines = [l for l in block.splitlines() if l.strip()]
        tl = next((i for i, l in enumerate(lines) if "-->" in l), None)
        if tl is None:
            continue
        stamps = re.findall(r"(\d{2}):(\d{2}):(\d{2})[,.](\d{3})", lines[tl])
        if len(stamps) < 2:
            continue
        to_s = lambda g: int(g[0]) * 3600 + int(g[1]) * 60 + int(g[2]) + int(g[3]) / 1000
        text = " ".join(lines[tl + 1:]).strip()
        if text:
            caps.append({"start": to_s(stamps[0]), "end": to_s(stamps[1]), "text": text, "words": []})
    return caps


def build_ass(caps: List[dict], ass_path: str, style: str,
              accent_hex: str, font: str, out_w: int, out_h: int) -> None:
    """Write an ASS file whose PlayRes matches the output video, so libass
    renders 1:1 and the burned captions match the editor preview."""
    cfg = STYLE_SIZING.get(style, STYLE_SIZING["bold-pop"])
    fontsize = max(12, round(cfg["size"] * out_w))
    outline = max(1, round(fontsize * cfg["outline"]))
    shadow = round(fontsize * cfg["shadow"])
    margin_v = round(cfg["marginV"] * out_h)
    margin_lr = round(0.04 * out_w)
    bold = -1 if cfg["bold"] else 0
    primary = _hex_to_ass_bgr(accent_hex) if accent_hex else cfg["primary"]
    fontname = font or "DejaVu Sans"

    header = (
        "[Script Info]\n"
        "ScriptType: v4.00+\n"
        f"PlayResX: {out_w}\n"
        f"PlayResY: {out_h}\n"
        "WrapStyle: 0\n"
        "ScaledBorderAndShadow: yes\n\n"
        "[V4+ Styles]\n"
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, "
        "Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, "
        "Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n"
        f"Style: Default,{fontname},{fontsize},{primary},&H00FFFFFF,&H00000000,&H00000000,"
        f"{bold},0,0,0,100,100,0,0,1,{outline},{shadow},2,{margin_lr},{margin_lr},{margin_v},1\n\n"
        "[Events]\n"
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
    )
    # Each caption may carry a track index (0 = bottom). Higher tracks are
    # stacked upward via a per-line MarginV override, so multiple text tracks
    # appear one above another in the video.
    line_step = round(fontsize * 1.4)
    events = []
    for item in caps:
        s, e, text = item.get("start", 0), item.get("end", 0), item.get("text", "")
        track = item.get("track", 0)
        
        # Word-level karaoke logic if words exist and style is karaoke
        words = item.get("words", [])
        if style == "karaoke" and words:
            k_text = ""
            for w in words:
                ws, we, word = w.get("start", s), w.get("end", e), w.get("word", "")
                dur_cs = int((we - ws) * 100)
                # ASS karaoke override tag properly formats each word \k<duration_in_centiseconds>
                k_text += f"{{\\k{dur_cs}}}{word} "
            text = k_text.strip()
        else:
            text = text.replace(chr(10), chr(92) + 'N')
            
        mv = margin_v + int(track) * line_step
        events.append(
            f"Dialogue: 0,{_ass_time(s)},{_ass_time(e)},Default,,0,0,{mv},,{text}"
        )
    with open(ass_path, "w", encoding="utf-8") as f:
        f.write(header + "\n".join(events) + "\n")


def build_force_style(style: str, accent_hex: str, font: str) -> str:
    preset = dict(STYLE_PRESETS.get(style, STYLE_PRESETS["bold-pop"]))
    if accent_hex:
        preset["PrimaryColour"] = _hex_to_ass_bgr(accent_hex)
    if font:
        preset["Fontname"] = font
    return ",".join(f"{k}={v}" for k, v in preset.items())


def render_with_subtitles(input_path: str, caps: List[dict], output_path: str, style: str, accent_hex: str, font: str, quality: str, work_dir: str = None,
                          audio_volume: float = 1.0, fade_in: float = 0.0, fade_out: float = 0.0,
                          music_path: str = None, music_volume: float = 0.3, clean_audio_path: str = None, aspect_ratio: str = "original"):
    """Burn subtitles into video, sized to match the editor preview.

    `caps` is a list of {"start", "end", "text", "track", "words"} — track stacks lines upward.
    We build an ASS file whose PlayRes equals the output video resolution and
    size the font as a fraction of width (same fractions the CSS preview uses),
    so libass renders 1:1 and the burned captions match what the editor shows.

    ffmpeg's subtitles filter mangles Windows paths, so we run ffmpeg from the
    ASS file's directory and reference it by basename.
    """
    input_path = os.path.abspath(input_path)
    output_path = os.path.abspath(output_path)
    work_dir = os.path.abspath(work_dir or os.path.dirname(output_path))

    target_res = 2160 if quality == "4k" else 1080
    crf = "20" if quality == "4k" else "22"
    src_w, src_h = get_dimensions(input_path)
    if src_h <= 0:
        src_h, src_w = 1920, 1080
        
    if aspect_ratio == "9:16":
        out_w = target_res
        out_h = int(round(target_res * 16 / 9))
    elif aspect_ratio == "16:9":
        out_h = target_res
        out_w = int(round(target_res * 16 / 9))
    elif aspect_ratio == "4:5":
        out_w = target_res
        out_h = int(round(target_res * 5 / 4))
    elif aspect_ratio == "1:1":
        out_w = target_res
        out_h = target_res
    else: # original
        out_h = target_res
        out_w = int(round(target_res * src_w / src_h))
        
    if out_w % 2: out_w += 1
    if out_h % 2: out_h += 1

    ass_path = os.path.join(work_dir, "captions.ass")
    build_ass(caps, ass_path, style, accent_hex, font, out_w, out_h)
    ass_name = os.path.basename(ass_path)

    vf = f"scale={out_w}:{out_h}:force_original_aspect_ratio=increase,crop={out_w}:{out_h},subtitles={ass_name}"

    # Audio filter chain: volume + optional fades.
    af_parts = []
    if abs(audio_volume - 1.0) > 0.01:
        af_parts.append(f"volume={max(0.0, audio_volume):.2f}")
    if fade_in and fade_in > 0:
        af_parts.append(f"afade=t=in:st=0:d={fade_in:.2f}")
    if fade_out and fade_out > 0:
        d = get_duration(input_path)
        af_parts.append(f"afade=t=out:st={max(0.0, d - fade_out):.2f}:d={fade_out:.2f}")

    main_input_args = ["-i", input_path]
    clean_audio_args = ["-i", os.path.abspath(clean_audio_path)] if clean_audio_path and os.path.exists(clean_audio_path) else []
    music_args = ["-stream_loop", "-1", "-i", os.path.abspath(music_path)] if music_path and os.path.exists(music_path) else []
    
    clean_audio_idx = 1 if clean_audio_args else 0
    music_idx = clean_audio_idx + 1 if music_args else None
    
    fc = [f"[0:v]{vf}[v]"]
    af_main = ",".join(af_parts) if af_parts else "anull"
    
    # We must defensively pick out the audio stream from the target node
    fc.append(f"[{clean_audio_idx}:a]{af_main}[a0]")
    
    if music_idx is not None:
        fc.append(f"[{music_idx}:a]volume={max(0.0, music_volume):.2f}[a1]")
        fc.append("[a0][a1]amix=inputs=2:duration=first:dropout_transition=0[aout]")
        map_a = "[aout]"
    else:
        map_a = "[a0]"

    cmd = [
        "ffmpeg", "-y", *main_input_args, *clean_audio_args, *music_args,
        "-filter_complex", ";".join(fc), "-map", "[v]", "-map", map_a,
        "-c:v", "libx264", "-preset", "veryfast", "-crf", crf,
        "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart",
        output_path,
    ]

    result = subprocess.run(cmd, cwd=work_dir, check=False, capture_output=True, text=True)
    if not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
        tail = (result.stderr or "")[-1000:]
        raise RuntimeError(f"ffmpeg subtitle render produced no output:\n{tail}")



def make_thumbnail(input_path: str, output_path: str, at: float = 1.0):
    _run(["ffmpeg", "-y", "-ss", f"{at}", "-i", input_path,
          "-vframes", "1", "-vf", "scale=480:-2", output_path], capture=True)


def trim_video(input_path: str, output_path: str, start: float, end: float) -> float:
    """Re-cut a video to [start, end] (re-encoded, frame-accurate). Returns new duration."""
    length = max(0.2, end - start)
    _run([
        "ffmpeg", "-y", "-ss", f"{start:.3f}", "-i", input_path, "-t", f"{length:.3f}",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "22",
        "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart",
        output_path,
    ], capture=True)
    return get_duration(output_path) or length


def make_filmstrip(input_path: str, output_path: str, frames: int = 24, height: int = 48):
    """Sample `frames` frames evenly across the video into one horizontal strip."""
    dur = get_duration(input_path)
    fps = frames / max(dur, 0.5)
    _run([
        "ffmpeg", "-y", "-i", input_path, "-frames:v", "1",
        "-vf", f"fps={fps:.6f},scale=-1:{height},tile={frames}x1",
        output_path,
    ], capture=True)
