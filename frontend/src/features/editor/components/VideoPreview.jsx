import { useState, useEffect, useRef } from "react";
import { API } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Play, Pause, Volume2, VolumeX, Maximize2, ChevronDown, Lock, Loader2, AlertTriangle } from "lucide-react";
import { ASPECT_OPTIONS, QUALITY_OPTIONS, PLAN_QUALITIES, STAGE_LABELS, formatTime } from "@/features/editor/constants";

export function VideoPreview({ project, videoRef, playing, setPlaying, onTimeUpdate, activeCaption, videoBust, muted, setMuted, volume = 1, textStyle = {}, onProjectStyleChange, navigate }) {
  const { user } = useAuth();
  const allowedQualities = PLAN_QUALITIES[user?.plan] || PLAN_QUALITIES.free;
  const [duration, setDuration] = useState(project.final_duration || 0);
  const [current, setCurrent] = useState(0);
  const [srcError, setSrcError] = useState(false);
  const [aspectMenuOpen, setAspectMenuOpen] = useState(false);
  const [qualityMenuOpen, setQualityMenuOpen] = useState(false);

  const musicAudioRef = useRef(null);
  const cleanAudioRef = useRef(null);

  useEffect(() => { setSrcError(false); }, [videoBust, project.id]);
  useEffect(() => {
    if (musicAudioRef.current) musicAudioRef.current.volume = project?.music_volume ?? 0.3;
    if (cleanAudioRef.current) cleanAudioRef.current.volume = volume;
  }, [project?.music_volume, volume]);

  useEffect(() => {
    const sync = (ref) => {
      if (ref.current && videoRef.current) {
        if (Math.abs(ref.current.currentTime - videoRef.current.currentTime) > 0.25) {
          ref.current.currentTime = videoRef.current.currentTime;
        }
        if (playing) ref.current.play().catch(() => { });
        else ref.current.pause();
      }
    };
    sync(musicAudioRef);
    sync(cleanAudioRef);
  }, [playing, current]);

  useEffect(() => {
    if (videoRef.current) {
      if (muted) {
        videoRef.current.muted = true;
        if (cleanAudioRef.current) cleanAudioRef.current.muted = true;
        if (musicAudioRef.current) musicAudioRef.current.muted = true;
      } else {
        videoRef.current.muted = !!project.clean_audio_path;
        if (cleanAudioRef.current) cleanAudioRef.current.muted = false;
        if (musicAudioRef.current) musicAudioRef.current.muted = false;
      }
    }
  }, [muted, project.clean_audio_path]);

  useEffect(() => { if (videoRef.current && (!project.clean_audio_path || muted)) videoRef.current.volume = Math.min(1, Math.max(0, volume)); }, [volume, videoRef, project.clean_audio_path, muted]);

  // Track the video's rendered width so the caption can be scaled to the video
  // (not the letterboxed canvas). container queries can't be used here because
  // they'd break the shrink-to-fit wrapper.
  const vidWrapRef = useRef(null);
  const [vidW, setVidW] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === vidWrapRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  // Aspect ratio of the actual video, so the canvas adapts to the format
  // (9:16 portrait, 16:9 widescreen, …) instead of forcing a fixed box.
  const [aspect, setAspect] = useState(9 / 16);

  const getAspectRatio = (ar) => {
    switch (ar) {
      case "9:16": return 9 / 16;
      case "16:9": return 16 / 9;
      case "1:1": return 1;
      case "4:5": return 4 / 5;
      default: return null;
    }
  };

  useEffect(() => {
    const el = vidWrapRef.current;
    if (!el) return;
    const update = () => setVidW(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [project.status, videoBust, project.aspect_ratio]);

  useEffect(() => {
    const manualAspect = getAspectRatio(project.aspect_ratio);
    if (manualAspect) {
      setAspect(manualAspect);
    } else if (videoRef.current) {
      const { videoWidth, videoHeight } = videoRef.current;
      if (videoWidth && videoHeight) setAspect(videoWidth / videoHeight);
    }
  }, [project.aspect_ratio, videoBust]);

  // Portrait/square: cap the height and let width follow. Landscape: fill the
  // available width and let height follow. Either way the box matches the video.
  // In fullscreen, skip this math entirely — the browser sizes the fullscreen
  // element to the viewport, and object-contain on the <video> below handles
  // correct letterboxing on its own. Mixing the two caused the cropped/zoomed
  // fullscreen bug (percentage height + aspectRatio resolving oddly there).
  const boxStyle = isFullscreen
    ? { width: "100%", height: "100%" }
    : aspect >= 1
      ? { width: "100%", maxHeight: "100%", aspectRatio: String(aspect), overflow: "hidden" }
      : { height: "100%", maxWidth: "100%", aspectRatio: String(aspect), overflow: "hidden" };

  const togglePlay = () => {
    if (!videoRef.current || srcError) return;
    if (playing) { videoRef.current.pause(); setPlaying(false); }
    else { videoRef.current.play().then(() => setPlaying(true)).catch(() => { }); }
  };

  return (
    <div className="bg-card border border-line rounded-xl overflow-hidden flex flex-col h-full">
      <div className="relative bg-black flex items-center justify-center flex-1 min-h-0">
        {project.status === "done" && project.output_path ? (
          // The box's aspect ratio matches the video, so the canvas adapts to the
          // video format. The caption is positioned/scaled relative to this box.
          <div ref={vidWrapRef} className={`relative bg-black ${isFullscreen ? "flex items-center justify-center" : ""}`} style={boxStyle}>
            <video
              ref={videoRef}
              src={`${API}/projects/${project.id}/source?v=${videoBust}`}
              data-testid="editor-video"
              muted={muted}
              className={isFullscreen ? "block max-w-full max-h-full w-auto h-auto object-contain" : "block w-full h-full object-contain"}
              onTimeUpdate={(e) => {
                setCurrent(e.currentTarget.currentTime);
                onTimeUpdate?.(e.currentTarget.currentTime);
              }}
              onLoadedMetadata={(e) => {
                setDuration(e.currentTarget.duration);
                const manualAspect = getAspectRatio(project.aspect_ratio);
                const { videoWidth, videoHeight } = e.currentTarget;
                if (manualAspect) {
                  setAspect(manualAspect);
                } else if (videoWidth && videoHeight) {
                  setAspect(videoWidth / videoHeight);
                }
              }}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onError={() => setSrcError(true)}
            />
            {srcError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center gap-2 bg-black/70 px-4">
                <div className="text-sm text-red-300 font-medium">Video unavailable</div>
                <div className="text-[11px] text-muted-ink max-w-[240px]">This project's source file is missing — re-upload the video to recreate it.</div>
              </div>
            )}

            {/* Live caption overlay — sized/positioned relative to the video so it
                stays inside the frame. Edits show instantly; export bakes them in. */}
            {activeCaption && (
              <div
                className="absolute inset-x-0 px-[4%] pointer-events-none"
                style={{
                  top: textStyle.posY != null ? `${textStyle.posY}%` : undefined,
                  bottom: textStyle.posY == null ? "10%" : undefined,
                  textAlign: textStyle.align || "center",
                  transform: textStyle.posY != null ? "translateY(-50%)" : undefined,
                }}
              >
                <div
                  className="inline-block"
                  style={{
                    color: project.accent_color || "#FFFFFF",
                    fontFamily: project.font,
                    fontWeight: textStyle.bold !== false ? 800 : 400,
                    fontStyle: textStyle.italic ? "italic" : "normal",
                    textDecoration: textStyle.underline ? "underline" : "none",
                    fontSize: `${Math.max(14, Math.round(vidW * (textStyle.fontSize || 32) / 350))}px`,
                    lineHeight: textStyle.lineHeight || 1.1,
                    letterSpacing: `${textStyle.letterSpacing || 0}px`,
                    WebkitTextStroke: textStyle.textStroke !== false ? `${Math.max(1.5, vidW * 0.008)}px #000` : "none",
                    paintOrder: "stroke fill",
                    textShadow: textStyle.dropShadow !== false ? "0 2px 5px rgba(0,0,0,0.55)" : "none",
                    ...(textStyle.background ? {
                      backgroundColor: `${textStyle.bgColor || "#000000"}${Math.round((textStyle.bgOpacity ?? 70) * 2.55).toString(16).padStart(2, "0")}`,
                      padding: "2px 8px",
                      borderRadius: `${textStyle.bgRadius || 8}px`,
                    } : {}),
                  }}
                >
                  {activeCaption.words && activeCaption.words.length > 0 && project.subtitle_style === "karaoke" ? (
                    activeCaption.words.map((w, i) => {
                      const isActive = current >= w.start && current <= w.end;
                      return (
                        <span key={i} style={{
                          color: isActive ? project.accent_color || "#00E5FF" : "#FFFFFF",
                          display: "inline-block",
                          transform: isActive ? "scale(1.15) translateY(-2px)" : "scale(1) translateY(0)",
                          transition: "transform 0.1s ease-out, color 0.1s",
                          marginRight: "0.25em"
                        }}>
                          {w.word}
                        </span>
                      );
                    })
                  ) : (
                    activeCaption.text
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-muted-ink text-sm flex flex-col items-center gap-3">
            {project.status === "failed"
              ? <AlertTriangle className="w-5 h-5 text-red-400" />
              : <Loader2 className="w-5 h-5 animate-spin" />}
            {project.status === "failed" ? "Render failed" : (STAGE_LABELS[project.status] || project.status)}
          </div>
        )}

        {/* Overlays (positioned to the whole canvas) */}
        <button onClick={() => navigate("/")} className="absolute top-3 left-3 text-[10px] bg-black/60 backdrop-blur border border-line rounded-md px-2 py-1 hover:bg-black/80" data-testid="replace-btn">
          Replace
        </button>

        <div className="absolute top-3 right-3 flex items-center gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setAspectMenuOpen((o) => !o)}
              onKeyDown={(e) => { if (e.key === "Escape") setAspectMenuOpen(false); }}
              data-testid="aspect-ratio-trigger"
              aria-haspopup="listbox"
              aria-expanded={aspectMenuOpen}
              className="flex items-center gap-1 text-[10px] bg-black/60 backdrop-blur border border-line rounded-md px-2 py-1 text-white hover:bg-black/80 transition-colors"
            >
              {ASPECT_OPTIONS.find((a) => a.value === (project.aspect_ratio || "original"))?.label || "Original Aspect"}
              <ChevronDown className={`w-3 h-3 transition-transform ${aspectMenuOpen ? "rotate-180" : ""}`} />
            </button>
            {aspectMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setAspectMenuOpen(false)} />
                <div role="listbox" aria-label="Aspect ratio" className="absolute top-full right-0 mt-1 w-40 bg-card-2 border border-line rounded-md shadow-2xl z-50 overflow-hidden py-1">
                  {ASPECT_OPTIONS.map((a) => (
                    <button
                      key={a.value}
                      type="button"
                      role="option"
                      aria-selected={(project.aspect_ratio || "original") === a.value}
                      onClick={() => { onProjectStyleChange?.({ aspect_ratio: a.value }); setAspectMenuOpen(false); }}
                      className={`block w-full text-left px-3 py-1.5 text-xs transition-colors ${(project.aspect_ratio || "original") === a.value ? "bg-bg-2 text-white" : "text-muted-ink hover:bg-bg-2 hover:text-white"}`}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setQualityMenuOpen((o) => !o)}
              onKeyDown={(e) => { if (e.key === "Escape") setQualityMenuOpen(false); }}
              data-testid="quality-trigger"
              aria-haspopup="listbox"
              aria-expanded={qualityMenuOpen}
              className="flex items-center gap-1.5 text-[10px] bg-black/60 backdrop-blur border border-line rounded-md px-2 py-1 text-white hover:bg-black/80 transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-white" />
              {project.quality?.toUpperCase() || "1080P"}
              <ChevronDown className={`w-3 h-3 transition-transform ${qualityMenuOpen ? "rotate-180" : ""}`} />
            </button>
            {qualityMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setQualityMenuOpen(false)} />
                <div role="listbox" aria-label="Video quality" className="absolute top-full right-0 mt-1 w-36 bg-card-2 border border-line rounded-md shadow-2xl z-50 overflow-hidden py-1">
                  {QUALITY_OPTIONS.map((q) => {
                    const locked = !allowedQualities.includes(q.value);
                    const active = (project.quality || "1080p") === q.value;
                    return (
                      <button
                        key={q.value}
                        type="button"
                        role="option"
                        aria-selected={active}
                        onClick={() => {
                          setQualityMenuOpen(false);
                          if (locked) { navigate?.("/billing"); return; }
                          onProjectStyleChange?.({ quality: q.value });
                        }}
                        className={`w-full flex items-center justify-between px-3 py-1.5 text-xs transition-colors ${active ? "bg-bg-2 text-white" : locked ? "text-muted-ink/60 hover:bg-bg-2" : "text-muted-ink hover:bg-bg-2 hover:text-white"}`}
                      >
                        {q.label}
                        {locked && <Lock className="w-3 h-3" aria-label="Requires upgrade" />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="hidden">
        {project.music_path && (
          <audio ref={musicAudioRef} src={`${API}/projects/${project.id}/asset?path=${encodeURIComponent(project.music_path)}`} preload="auto" />
        )}
        {project.clean_audio_path && (
          <audio ref={cleanAudioRef} src={`${API}/projects/${project.id}/asset?path=${encodeURIComponent(project.clean_audio_path)}`} preload="auto" />
        )}
      </div>

      {/* Controls */}
      <div className="p-3 flex items-center gap-3">
        <button onClick={togglePlay} data-testid="play-toggle" className="w-8 h-8 rounded-md bg-white text-black flex items-center justify-center hover:bg-hilite transition-colors">
          {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5 fill-black" />}
        </button>
        <button onClick={() => setMuted(m => !m)} title={muted ? "Unmute" : "Mute"} className={`w-8 h-8 rounded-md border border-line flex items-center justify-center ${muted ? "text-ink bg-bg-2" : "text-muted-ink hover:text-ink"}`}>
          {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
        </button>
        <div className="flex-1 text-xs font-mono text-muted-ink text-center" data-testid="timecode">
          {formatTime(current)} / {formatTime(duration)}
        </div>
        <button onClick={() => vidWrapRef.current?.requestFullscreen?.()} className="w-8 h-8 rounded-md border border-line text-muted-ink hover:text-ink flex items-center justify-center">
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
