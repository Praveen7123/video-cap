import { useState, useEffect, useRef } from "react";
import { API } from "@/lib/api";
import {
  Type as FontIcon, Film, Music2, VolumeX, Volume2,
  ZoomIn, ZoomOut, Undo2, Redo2, Scissors, Trash2, ChevronUp, ChevronDown, Plus,
} from "lucide-react";
import { formatTime } from "@/features/editor/constants";
import { ToolBtn } from "@/features/editor/components/ToolBtn";
import { TrackHead } from "@/features/editor/components/TrackHead";

export function Timeline({ captions, activeIdx, duration, currentTime, projectId, onSeek,
  selectedCap, onSelectCap, onSplit, onDeleteCap, onUpdateTiming,
  onBeginEdit, onUndo, onRedo, canUndo, canRedo,
  textTracks = 1, onAddTextTrack, onMoveCapTrack, onSetCapTrack, onClearTrack, onTrimVideo, muted, onToggleMute,
  audio = { volume: 1, fadeIn: 0, fadeOut: 0 }, onAudioChange,
  hasMusic, musicVolume = 0.3, onAddMusic, onRemoveMusic, onMusicVolume,
  videoSegments = [], selectedSeg, onSelectSeg, onSplitVideo, onDeleteSeg }) {
  const dur = Math.max(duration, 1);
  const trackRef = useRef(null);
  const canvasRef = useRef(null);
  const [peaks, setPeaks] = useState([]);
  // Per-track visibility/lock/mute (real toggles).
  const [tracks, setTracks] = useState({
    text: { locked: false, hidden: false, muted: false },
    video: { locked: false, hidden: false, muted: false },
    audio: { locked: false, hidden: false, muted: false },
  });
  const toggleTrack = (id, kind) => setTracks((t) => ({ ...t, [id]: { ...t[id], [kind]: !t[id][kind] } }));

  // Decode the video's audio into real waveform peaks (once per project).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API}/projects/${projectId}/source`, { credentials: "include" });
        if (!res.ok) return;
        const buf = await res.arrayBuffer();
        const AC = window.AudioContext || window.webkitAudioContext;
        const ac = new AC();
        const audio = await ac.decodeAudioData(buf);
        const raw = audio.getChannelData(0);
        const N = 260;
        const block = Math.floor(raw.length / N) || 1;
        const out = [];
        for (let i = 0; i < N; i++) {
          let max = 0;
          for (let j = 0; j < block; j += 8) {
            const v = Math.abs(raw[i * block + j] || 0);
            if (v > max) max = v;
          }
          out.push(max);
        }
        const mx = Math.max(...out) || 1;
        if (!cancelled) setPeaks(out.map((p) => Math.pow(p / mx, 0.7)));
        ac.close();
      } catch (e) { /* fall back to synthetic bars */ }
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  const [zoom, setZoom] = useState(1);

  // Draw the audio waveform inside the audio clip — blue, CapCut-style.
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const data = peaks.length
      ? peaks
      : Array.from({ length: 260 }, (_, i) => 0.2 + Math.abs(Math.sin(i * 0.3) * 0.6 + Math.cos(i * 0.11) * 0.2));
    const dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return;
    cv.width = w * dpr; cv.height = h * dpr;
    const g = cv.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const bars = data.length, bw = w / bars, mid = h / 2;
    const playedX = (currentTime / dur) * w;
    for (let i = 0; i < bars; i++) {
      const x = i * bw;
      const bh = Math.max(1.5, data[i] * h * 0.86);
      const played = x <= playedX;
      g.fillStyle = played ? "rgba(147,197,253,0.98)" : "rgba(96,165,250,0.55)";
      const bx = x + bw * 0.25, bwidth = Math.max(0.8, bw * 0.5);
      g.fillRect(bx, mid - bh / 2, bwidth, bh);
    }
  }, [peaks, currentTime, dur, zoom]);

  const seekAt = (clientX) => {
    const el = trackRef.current;
    if (!el || !onSeek) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    onSeek(ratio * dur);
  };
  const startScrub = (e) => {
    seekAt(e.clientX);
    const mv = (ev) => seekAt(ev.clientX);
    const up = () => { window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up); };
    window.addEventListener("mousemove", mv);
    window.addEventListener("mouseup", up);
  };

  // Drag a caption clip: mode = "move" | "trimL" | "trimR".
  const startCapDrag = (e, idx, mode) => {
    e.stopPropagation();
    if (tracks.text.locked || !onUpdateTiming) return;
    onSelectCap?.(idx);
    const el = trackRef.current;
    const trackW = el ? el.getBoundingClientRect().width : 1;
    const perPx = dur / trackW;
    const startX = e.clientX;
    const rectTop = el ? el.getBoundingClientRect().top : 0;
    const LANE_H = 28;
    const nStart = nText;
    let curTrack = captions[idx].track || 0;
    const { start: s0, end: e0 } = captions[idx];
    const prev = captions[idx - 1], next = captions[idx + 1];
    const lo = prev ? prev.end : 0;
    const hi = next ? next.start : dur;
    const MIN = 0.15;
    let snapped = false;
    const mv = (ev) => {
      if (!snapped) { onBeginEdit?.(); snapped = true; }  // snapshot on first real move
      const dt = (ev.clientX - startX) * perPx;
      let s = s0, en = e0;
      if (mode === "move") {
        const len = e0 - s0;
        s = Math.min(Math.max(lo, s0 + dt), hi - len);
        en = s + len;
        // Vertical: drag between tracks; above the top auto-creates a new track.
        if (onSetCapTrack) {
          const laneFromTop = Math.floor((ev.clientY - rectTop) / LANE_H);
          const target = Math.max(0, Math.min(nStart, (nStart - 1) - laneFromTop));
          if (target !== curTrack) { onSetCapTrack(idx, target); curTrack = target; }
        }
      } else if (mode === "trimL") {
        s = Math.min(Math.max(lo, s0 + dt), e0 - MIN);
      } else if (mode === "trimR") {
        en = Math.max(Math.min(hi, e0 + dt), s0 + MIN);
      }
      onUpdateTiming(idx, s, en);
    };
    const up = () => { window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up); };
    window.addEventListener("mousemove", mv);
    window.addEventListener("mouseup", up);
  };

  // Video-clip trim: [start,end] preview while dragging the video edges.
  const [vTrim, setVTrim] = useState(null);
  const vStart = vTrim ? vTrim.start : 0;
  const vEnd = vTrim ? vTrim.end : dur;
  const startVideoTrim = (e, side) => {
    e.stopPropagation();
    if (tracks.video.locked || !onTrimVideo) return;
    const el = trackRef.current;
    const trackW = el ? el.getBoundingClientRect().width : 1;
    const perPx = dur / trackW;
    const startX = e.clientX;
    let s = 0, en = dur;
    const mv = (ev) => {
      const dt = (ev.clientX - startX) * perPx;
      if (side === "L") s = Math.min(Math.max(0, dt), en - 0.5);
      else en = Math.max(Math.min(dur, dur + dt), s + 0.5);
      setVTrim({ start: s, end: en });
    };
    const up = () => {
      window.removeEventListener("mousemove", mv);
      window.removeEventListener("mouseup", up);
      if (s > 0.05 || en < dur - 0.05) onTrimVideo(s, en);
      setVTrim(null);
    };
    window.addEventListener("mousemove", mv);
    window.addEventListener("mouseup", up);
  };

  const playPct = Math.min(100, (currentTime / dur) * 100);
  const step = dur <= 20 ? 2 : dur <= 60 ? 5 : 10;
  const ticks = [];
  for (let t = 0; t <= dur + 0.01; t += step) ticks.push(t);

  const H_VIDEO = "h-[44px]";
  const filmstripUrl = `${API}/projects/${projectId}/filmstrip`;
  // Number of text lanes = max(added tracks, highest track used) + captions on track 0 default.
  const nText = Math.max(textTracks, 1, ...captions.map((c) => (c.track || 0) + 1));
  const textLanes = Array.from({ length: nText }, (_, i) => nText - 1 - i); // top lane = highest index

  return (
    <div className="bg-card border border-line rounded-xl h-full min-h-0 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 h-9 border-b border-line shrink-0">
        <div className="flex items-center gap-0.5">
          <ToolBtn icon={Undo2} label="Undo (Ctrl+Z)" onClick={onUndo} disabled={!canUndo} />
          <ToolBtn icon={Redo2} label="Redo (Ctrl+Shift+Z)" onClick={onRedo} disabled={!canRedo} />
          <div className="w-px h-4 bg-line mx-1.5" />
          <ToolBtn icon={Scissors} label={selectedSeg != null ? "Split video at playhead" : "Split caption at playhead"} onClick={() => (selectedSeg != null ? onSplitVideo?.() : onSplit?.())} />
          <ToolBtn icon={Trash2} label="Delete selected" onClick={() => (selectedSeg != null ? onDeleteSeg?.(selectedSeg) : selectedCap != null && onDeleteCap?.(selectedCap))} disabled={selectedSeg == null && selectedCap == null} />
          <div className="w-px h-4 bg-line mx-1.5" />
          <ToolBtn icon={ChevronUp} label="Move caption up a track" onClick={() => onMoveCapTrack?.(selectedCap, 1)} disabled={selectedCap == null} />
          <ToolBtn icon={ChevronDown} label="Move caption down a track" onClick={() => onMoveCapTrack?.(selectedCap, -1)} disabled={selectedCap == null} />
          <ToolBtn icon={Plus} label="Add text track" onClick={onAddTextTrack} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-ink font-mono tabular-nums">{formatTime(currentTime)} / {formatTime(dur)}</span>
          <button onClick={() => setZoom((z) => Math.max(1, +(z - 0.5).toFixed(1)))} className="text-muted-ink hover:text-ink"><ZoomOut className="w-3.5 h-3.5" /></button>
          <input
            type="range" min="1" max="6" step="0.5" value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-24 h-1 accent-white cursor-pointer"
          />
          <button onClick={() => setZoom((z) => Math.min(6, +(z + 0.5).toFixed(1)))} className="text-muted-ink hover:text-ink"><ZoomIn className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      {/* Body: track headers + lanes — scrolls vertically when there are many tracks */}
      <div className="flex-1 min-h-0 overflow-y-auto flex">
        {/* Track headers (left) */}
        <div className="w-[128px] shrink-0 border-r border-line flex flex-col bg-bg-2/40 min-h-full">
          <div className="h-5 border-b border-line shrink-0" />{/* ruler spacer */}
          {textLanes.map((laneIdx) => (
            <TrackHead
              key={`th-${laneIdx}`}
              icon={FontIcon}
              name={nText > 1 ? `Text ${laneIdx + 1}` : "Text"}
              cls="h-[28px] shrink-0"
              state={tracks.text}
              onToggle={(k) => toggleTrack("text", k)}
              menu={[
                { label: "Clear captions", onClick: () => onClearTrack?.(laneIdx) },
                { label: "Add text track", onClick: () => onAddTextTrack?.() },
              ]}
            />
          ))}
          <TrackHead icon={Film} name="Video" cls={`${H_VIDEO} shrink-0`} state={tracks.video} onToggle={(k) => toggleTrack("video", k)} />
          <TrackHead
            icon={Music2}
            name="Audio"
            cls={`${H_VIDEO} shrink-0`}
            state={{ ...tracks.audio, muted }}
            onToggle={(k) => (k === "muted" ? onToggleMute?.() : toggleTrack("audio", k))}
            menu={[
              { label: audio.fadeIn > 0 ? "✓ Fade in" : "Fade in", onClick: () => onAudioChange?.({ fadeIn: audio.fadeIn > 0 ? 0 : 0.8 }) },
              { label: audio.fadeOut > 0 ? "✓ Fade out" : "Fade out", onClick: () => onAudioChange?.({ fadeOut: audio.fadeOut > 0 ? 0 : 0.8 }) },
              { label: "Reset volume", onClick: () => onAudioChange?.({ volume: 1 }) },
              hasMusic
                ? { label: "🎵 Remove music", onClick: () => onRemoveMusic?.() }
                : { label: "🎵 Add music…", onClick: () => onAddMusic?.() },
            ]}
          />
        </div>

        {/* Lane area (horizontal scroll for zoom) */}
        <div className="flex-1 min-w-0 overflow-x-auto">
          <div className="flex flex-col" style={{ width: `${zoom * 100}%`, minWidth: "100%" }}>
            {/* Ruler */}
            <div className="relative h-5 border-b border-line shrink-0">
              {ticks.map((t, i) => (
                <div key={i} className="absolute top-0 h-full" style={{ left: `${(t / dur) * 100}%` }}>
                  <div className="w-px h-1.5 bg-line-2" />
                  <span className="absolute top-1.5 left-1 text-[9px] text-muted-ink font-mono whitespace-nowrap">{formatTime(t)}</span>
                </div>
              ))}
            </div>

            {/* Lanes — click / drag to seek */}
            <div ref={trackRef} onMouseDown={startScrub} className="relative flex flex-col cursor-pointer select-none">
              {/* Text / caption lanes (one per track) — selectable, draggable, trimmable */}
              {textLanes.map((laneIdx) => (
                <div key={`lane-${laneIdx}`} className={`relative h-[28px] shrink-0 border-b border-line/60 ${tracks.text.locked ? "opacity-50" : ""}`}>
                  {!tracks.text.hidden && captions.map((c, i) => {
                    if ((c.track || 0) !== laneIdx) return null;
                    const left = (c.start / dur) * 100;
                    const width = Math.max(0.4, ((c.end - c.start) / dur) * 100);
                    const active = i === activeIdx;
                    const selected = i === selectedCap;
                    return (
                      <div
                        key={i}
                        title={c.text}
                        onMouseDown={(e) => startCapDrag(e, i, "move")}
                        onClick={(e) => { e.stopPropagation(); onSelectCap?.(i); onSeek?.(c.start); }}
                        className="group absolute inset-y-[3px] rounded-[3px] text-[9px] flex items-center gap-1 overflow-hidden text-white/95 border cursor-grab active:cursor-grabbing"
                        style={{
                          left: `${left}%`,
                          width: `${width}%`,
                          background: active ? "#d1492f" : "#a53a28",
                          borderColor: selected ? "#fff" : active ? "rgba(255,255,255,.5)" : "rgba(255,255,255,.12)",
                          boxShadow: selected ? "0 0 0 1px #fff inset" : "none",
                        }}
                      >
                        <div onMouseDown={(e) => startCapDrag(e, i, "trimL")} className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize bg-white/0 hover:bg-white/40 z-10" />
                        <div className="flex items-center gap-1 px-1 min-w-0 pointer-events-none">
                          <FontIcon className="w-2.5 h-2.5 shrink-0 opacity-80" />
                          <span className="truncate">{c.text}</span>
                        </div>
                        <div onMouseDown={(e) => startCapDrag(e, i, "trimR")} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize bg-white/0 hover:bg-white/40 z-10" />
                      </div>
                    );
                  })}
                </div>
              ))}

              {/* Video lane — split into selectable segments; drag edges to trim */}
              <div className={`relative ${H_VIDEO} shrink-0 border-b border-line/60 ${tracks.video.locked ? "opacity-50" : ""}`}>
                {!tracks.video.hidden && (videoSegments.length ? videoSegments : [[0, dur]]).map((seg, i) => {
                  const single = (videoSegments.length || 1) <= 1;
                  const s0 = seg[0], e0 = seg[1];
                  const segLen = Math.max(0.01, e0 - s0);
                  const l = single ? (vStart / dur) * 100 : (s0 / dur) * 100;
                  const r = single ? (1 - vEnd / dur) * 100 : (1 - e0 / dur) * 100;
                  const bgSize = single ? "100% 100%" : `${(dur / segLen) * 100}% 100%`;
                  const bgPos = single || dur - segLen <= 0.01 ? "0%" : `${(s0 / (dur - segLen)) * 100}%`;
                  const selected = selectedSeg === i;
                  return (
                    <div
                      key={i}
                      onClick={(ev) => { ev.stopPropagation(); onSelectSeg?.(i); }}
                      className="absolute inset-y-[3px] rounded-[3px] overflow-hidden border cursor-pointer"
                      style={{ left: `${l}%`, right: `${r}%`, borderColor: selected ? "#5eead4" : (vTrim && single ? "#2dd4bf" : "rgba(20,184,166,.55)"), background: "#0f2e2b", boxShadow: selected ? "0 0 0 1px #5eead4 inset" : "none" }}
                    >
                      <div className="absolute inset-0 opacity-80" style={{ backgroundImage: `url(${filmstripUrl})`, backgroundRepeat: "no-repeat", backgroundSize: bgSize, backgroundPositionX: bgPos }} />
                      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg,rgba(20,184,166,.15),transparent 40%)" }} />
                      {i === 0 && <span className="absolute top-0.5 left-1.5 text-[9px] text-white/90 flex items-center gap-1 pointer-events-none"><Film className="w-2.5 h-2.5" /> Video</span>}
                      {single && !tracks.video.locked && onTrimVideo && <>
                        <div onMouseDown={(ev) => startVideoTrim(ev, "L")} className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize bg-white/0 hover:bg-teal-300/60 z-10" />
                        <div onMouseDown={(ev) => startVideoTrim(ev, "R")} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize bg-white/0 hover:bg-teal-300/60 z-10" />
                      </>}
                    </div>
                  );
                })}
              </div>

              {/* Audio lane — blue waveform */}
              <div className={`relative ${H_VIDEO} shrink-0 ${tracks.audio.locked ? "opacity-50" : ""}`}>
                {!tracks.audio.hidden && (
                  <div className="absolute inset-y-[3px] left-0 right-0 rounded-[3px] overflow-hidden border" style={{ borderColor: "rgba(59,130,246,.5)", background: "#0b1f3d" }}>
                    <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
                    <div className="absolute top-0.5 left-1.5 right-1.5 flex items-center gap-1.5 text-[9px] text-blue-200/90" onMouseDown={(e) => e.stopPropagation()}>
                      {muted ? <VolumeX className="w-2.5 h-2.5" /> : <Music2 className="w-2.5 h-2.5" />}
                      <span>Audio</span>
                      <span className="ml-auto flex items-center gap-1">
                        <input
                          type="range" min="0" max="2" step="0.05" value={audio.volume}
                          onChange={(e) => onAudioChange?.({ volume: Number(e.target.value) })}
                          title={`Volume ${Math.round(audio.volume * 100)}%`}
                          className="w-16 h-1 accent-blue-400 cursor-pointer"
                        />
                        <span className="w-7 text-right tabular-nums">{Math.round(audio.volume * 100)}%</span>
                      </span>
                    </div>
                    {hasMusic && (
                      <div className="absolute bottom-0.5 left-1.5 right-1.5 flex items-center gap-1.5 text-[9px] text-emerald-300/90" onMouseDown={(e) => e.stopPropagation()}>
                        <span>🎵 Music</span>
                        <span className="ml-auto flex items-center gap-1">
                          <input
                            type="range" min="0" max="1" step="0.05" value={musicVolume}
                            onChange={(e) => onMusicVolume?.(Number(e.target.value))}
                            title={`Music ${Math.round(musicVolume * 100)}%`}
                            className="w-16 h-1 accent-emerald-400 cursor-pointer"
                          />
                          <span className="w-7 text-right tabular-nums">{Math.round(musicVolume * 100)}%</span>
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Playhead */}
              <div className="absolute top-0 bottom-0 z-10 pointer-events-none" style={{ left: `${playPct}%` }}>
                <div className="absolute -top-[3px] -translate-x-1/2 w-2.5 h-2.5 rotate-45 rounded-[1px] bg-ink" />
                <div className="absolute top-0.5 bottom-0 left-0 -translate-x-1/2 w-px bg-ink" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
