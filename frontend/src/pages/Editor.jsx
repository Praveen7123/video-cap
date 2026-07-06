import { useEffect, useState, useMemo, useRef, useCallback, startTransition } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import api, { API } from "@/lib/api";
import { AppShell } from "@/components/Layout";
import { useAuth } from "@/context/AuthContext";
import { usePolling } from "@/hooks/usePolling";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { reportError } from "@/lib/reportError";
import { pollProjectUntilSettled } from "@/lib/pollUntilSettled";
import {
  Captions, Type as FontIcon, Search, ChevronDown, Save, RefreshCw, Download, Loader2,
  ArrowLeft, Clock, ChevronUp, RotateCcw, AlignLeft, PanelBottom, PanelRight,
  PictureInPicture2, Eraser
} from "lucide-react";
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";
import { EMOJI_REGEX, LEFT_RAIL } from "@/features/editor/constants";
import { regroupByWordCount, splitByMaxChars, mergeLines } from "@/features/editor/captionTools";
import { ProcessingBanner } from "@/features/editor/components/ProcessingBanner";
import { TranslationPanel } from "@/features/editor/components/TranslationPanel";
import { PlaceholderCaptionsBanner } from "@/features/editor/components/PlaceholderCaptionsBanner";
import { TranscriptRow } from "@/features/editor/components/TranscriptRow";
import { Timeline } from "@/features/editor/components/Timeline";
import { VideoPreview } from "@/features/editor/components/VideoPreview";
import { RightPanelBody } from "@/features/editor/components/RightPanelBody";
import { FloatingWindow } from "@/features/editor/components/FloatingWindow";
import { AudioPanel } from "@/features/editor/components/AudioPanel";
import { CustomFontsPanel } from "@/features/editor/components/CustomFontsPanel";

// Draggable dividers between panels (drag to resize the workspace).
function HResize() {
  return (
    <PanelResizeHandle className="group w-2 flex items-center justify-center outline-none">
      <div className="w-1 h-10 rounded-full bg-line group-hover:bg-line-2 group-data-[resize-handle-state=drag]:bg-hilite transition-colors" />
    </PanelResizeHandle>
  );
}
function VResize() {
  return (
    <PanelResizeHandle className="group h-2 flex items-center justify-center outline-none">
      <div className="h-1 w-10 rounded-full bg-line group-hover:bg-line-2 group-data-[resize-handle-state=drag]:bg-hilite transition-colors" />
    </PanelResizeHandle>
  );
}

export default function Editor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [captions, setCaptions] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rerendering, setRerendering] = useState(false);
  const [leftRail, setLeftRail] = useState("captions");
  const [rightTab, setRightTab] = useState("Templates");

  const [cleaningAudio, setCleaningAudio] = useState(false);
  const triggerCleanAudio = async () => {
    setCleaningAudio(true);
    try {
      const { data } = await api.post(`/projects/${id}/clean-audio`);
      setProject(data);
    } catch (e) {
      console.error(e);
    } finally {
      setCleaningAudio(false);
    }
  };

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [selectedCap, setSelectedCap] = useState(null);
  const [videoSplits, setVideoSplits] = useState([]);
  const [selectedSeg, setSelectedSeg] = useState(null);
  const [textTracks, setTextTracks] = useState(1);
  const [muted, setMuted] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [timelinePos, setTimelinePos] = useState(() => localStorage.getItem("clipcut-timeline-pos") || "bottom");
  useEffect(() => { localStorage.setItem("clipcut-timeline-pos", timelinePos); }, [timelinePos]);

  // Right panel (Templates/Text/Transitions/AI Audio) can pop out into a
  // floating, draggable, resizable window instead of staying docked.
  const [rightFloating, setRightFloating] = useState(false);
  const [floatMinimized, setFloatMinimized] = useState(false);
  const [floatMaximized, setFloatMaximized] = useState(false);
  const [floatRect, setFloatRect] = useState(() => {
    try { return JSON.parse(localStorage.getItem("clipcut-float-rect")) || { x: 140, y: 90, w: 420, h: 520 }; }
    catch { return { x: 140, y: 90, w: 420, h: 520 }; }
  });
  useEffect(() => { localStorage.setItem("clipcut-float-rect", JSON.stringify(floatRect)); }, [floatRect]);

  // Simple stacked layout on small screens — the resizable/floating panel
  // system is desktop-only; phones get one column and a collapsible timeline.
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const [mobileShowTimeline, setMobileShowTimeline] = useState(false);
  const [mobileShowStyles, setMobileShowStyles] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [toolsOpen, setToolsOpen] = useState(false);
  const [translateOpen, setTranslateOpen] = useState(false);
  const { run: runTranslate, loading: translating } = useAsyncAction();
  const startTranslation = () => runTranslate(async () => {
    await api.post(`/projects/${id}/translate`);
    await pollProjectUntilSettled(id, setProject, { statusField: "translation_status" });
  }, { errorMessage: "Couldn't start translation" });
  const [audio, setAudio] = useState({ volume: 1, fadeIn: 0, fadeOut: 0 });
  const audioLoadedRef = useRef(false);
  const videoRef = useRef(null);
  const [videoBust, setVideoBust] = useState(0);
  const [textStyle, setTextStyle] = useState({
    fontSize: 32, align: "center", bold: true, italic: false, underline: false,
    posX: 50, posY: 90, letterSpacing: 0, lineHeight: 1.1,
    dropShadow: true, textStroke: true, background: false,
    bgColor: "#000000", bgOpacity: 70, bgRadius: 8,
  });
  const updateTextStyle = (patch) => setTextStyle(s => ({ ...s, ...patch }));

  const [capSettings, setCapSettings] = useState({
    punct: false, emph: false, gaps: true, emojis: false, delay: 0,
    wordsPerLine: "default", maxChars: 24, lines: 1,
  });
  // Any Caption Tools change should enable Save/Re-render, same as editing text directly.
  const setCapSetting = (patch) => { setCapSettings((s) => ({ ...s, ...patch })); setDirty(true); };
  const [wordsMenuOpen, setWordsMenuOpen] = useState(false);
  const [linesMenuOpen, setLinesMenuOpen] = useState(false);
  const WORDS_OPTIONS = [
    { value: "default", label: "Default" },
    { value: "1", label: "1 word" },
    { value: "2", label: "2 words" },
    { value: "3", label: "3 words" },
    { value: "4", label: "4 words" },
  ];
  const LINES_OPTIONS = [
    { value: 1, label: "1 Line" },
    { value: 2, label: "2 Lines" },
  ];

  const processedCaptions = useMemo(() => {
    if (!captions) return [];
    let result = captions.map(c => ({
      ...c,
      words: c.words ? c.words.map(w => ({ ...w })) : []
    }));

    if (capSettings.gaps) {
      for (let i = 0; i < result.length - 1; i++) {
        if (result[i + 1].start - result[i].end < 0.5 && result[i + 1].start > result[i].end) {
          result[i].end = result[i + 1].start;
        }
      }
    }

    // Regroup by words-per-line / max-chars / lines-per-caption — applied per
    // text track so captions on different tracks never get merged together.
    const trackIds = [...new Set(result.map((c) => c.track || 0))];
    let regrouped = [];
    for (const tid of trackIds) {
      let track = result.filter((c) => (c.track || 0) === tid);
      track = regroupByWordCount(track, capSettings.wordsPerLine);
      track = splitByMaxChars(track, capSettings.maxChars);
      track = mergeLines(track, capSettings.lines);
      regrouped = regrouped.concat(track.map((c) => ({ ...c, track: tid })));
    }
    regrouped.sort((a, b) => a.start - b.start);

    return regrouped.map(c => {
      let t = c.text;
      if (capSettings.punct) {
        t = t.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
        c.words?.forEach(x => { x.word = x.word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ""); });
      }
      if (capSettings.emph) {
        t = t.toLowerCase();
        c.words?.forEach(x => { x.word = x.word.toLowerCase(); });
      }
      if (capSettings.emojis) {
        t = t.replace(EMOJI_REGEX, "").replace(/[ \t]+/g, " ").trim();
        c.words?.forEach(x => { x.word = x.word.replace(EMOJI_REGEX, ""); });
      }
      if (capSettings.delay !== 0) {
        c.start += capSettings.delay;
        c.end += capSettings.delay;
        c.words?.forEach(x => {
          x.start += capSettings.delay;
          x.end += capSettings.delay;
        });
      }
      return { ...c, text: t };
    });
  }, [captions, capSettings]);
  const updateProjectStyle = (patch) => {
    setProject(p => ({ ...p, ...patch }));
    api.patch(`/projects/${id}`, patch).catch((e) => reportError(e, "Couldn't save style changes"));
  };

  // ---- Undo / redo history for caption edits ----
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);
  const capRef = useRef(captions);
  useEffect(() => { capRef.current = captions; }, [captions]);
  const snapshot = useCallback(() => { setPast((p) => [...p.slice(-49), capRef.current]); setFuture([]); }, []);
  const undo = useCallback(() => {
    setPast((p) => {
      if (!p.length) return p;
      setFuture((f) => [capRef.current, ...f].slice(0, 50));
      setCaptions(p[p.length - 1]);
      setDirty(true); setSelectedCap(null);
      return p.slice(0, -1);
    });
  }, []);
  const redo = useCallback(() => {
    setFuture((f) => {
      if (!f.length) return f;
      setPast((p) => [...p, capRef.current]);
      setCaptions(f[0]);
      setDirty(true); setSelectedCap(null);
      return f.slice(1);
    });
  }, []);
  const shortcutsRef = useRef({});
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target.tagName || "").toLowerCase();
      const typing = tag === "input" || tag === "textarea" || e.target.isContentEditable;
      if (e.ctrlKey || e.metaKey) {
        const k = e.key.toLowerCase();
        if (k === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
        else if ((k === "z" && e.shiftKey) || k === "y") { e.preventDefault(); redo(); }
        return;
      }
      if (typing) return;
      const s = shortcutsRef.current;
      const k = e.key.toLowerCase();
      if (k === "m") { e.preventDefault(); s.toggleMute?.(); }
      else if (k === "s") { e.preventDefault(); s.split?.(); }
      else if (e.key === "Delete" || e.key === "Backspace") {
        if (s.hasSelection) { e.preventDefault(); s.del?.(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  usePolling(async () => {
    try {
      const { data } = await api.get(`/projects/${id}`);
      setProject(data);
      if (!dirty && data.captions) setCaptions(data.captions);
      if (!audioLoadedRef.current) {
        setAudio({ volume: data.audio_volume ?? 1, fadeIn: data.audio_fade_in ?? 0, fadeOut: data.audio_fade_out ?? 0 });
        audioLoadedRef.current = true;
      }
      if (data.status === "done" || data.status === "failed") return false;
    } catch (err) { /* transient network hiccup — try again next tick */ }
  }, 2000, { deps: [id] });

  const status = project?.status;
  const isDone = status === "done";
  const totalDuration = project?.final_duration || 0;

  const editCaption = (idx, text) => {
    snapshot();
    setCaptions(prev => prev.map((c, i) => i === idx ? { ...c, text } : c));
    setDirty(true);
  };

  // ---- Timeline editing (split / delete / move / trim caption clips) ----
  const updateCaptionTiming = (idx, start, end) => {
    const rawStart = start - capSettings.delay;
    const rawEnd = end - capSettings.delay;
    setCaptions(prev => prev.map((c, i) => i === idx ? { ...c, start: rawStart, end: rawEnd } : c));
    setDirty(true);
  };

  const deleteCaption = (idx) => {
    snapshot();
    setCaptions(prev => prev.filter((_, i) => i !== idx));
    setSelectedCap(null);
    setDirty(true);
  };

  const addTextTrack = () => setTextTracks((n) => Math.min(n + 1, 5));

  const updateAudio = (patch) => {
    setAudio((a) => {
      const next = { ...a, ...patch };
      api.patch(`/projects/${id}`, {
        audio_volume: next.volume, audio_fade_in: next.fadeIn, audio_fade_out: next.fadeOut,
      }).catch((e) => reportError(e, "Couldn't save audio changes"));
      return next;
    });
  };

  const musicInputRef = useRef(null);
  const { run: runMusicAction, loading: musicBusy } = useAsyncAction();
  const uploadMusic = (file) => runMusicAction(async () => {
    const form = new FormData();
    form.append("file", file);
    await api.post(`/projects/${id}/music`, form, { headers: { "Content-Type": "multipart/form-data" } });
    const { data } = await api.get(`/projects/${id}`);
    setProject(data);
  }, { errorMessage: "Couldn't upload music" });
  const removeMusic = () => runMusicAction(async () => {
    await api.delete(`/projects/${id}/music`);
    const { data } = await api.get(`/projects/${id}`);
    setProject(data);
  }, { errorMessage: "Couldn't remove music" });
  const updateMusicVolume = (v) => {
    setProject((p) => ({ ...p, music_volume: v }));
    api.patch(`/projects/${id}`, { music_volume: v }).catch((e) => reportError(e, "Couldn't save music volume"));
  };

  const clearTrackCaptions = (lane) => {
    snapshot();
    setCaptions((prev) => prev.filter((c) => (c.track || 0) !== lane));
    setSelectedCap(null);
    setDirty(true);
  };

  // Set a caption's track directly (used by vertical drag); auto-adds tracks.
  const setCapTrack = (idx, track) => {
    const t = Math.max(0, Math.min(4, track));
    setTextTracks((n) => Math.max(n, t + 1));
    setCaptions((prev) => prev.map((c, i) => (i === idx ? { ...c, track: t } : c)));
    setDirty(true);
  };

  const moveCapTrack = (idx, dir) => {
    if (idx == null) return;
    snapshot();
    setCaptions((prev) => prev.map((c, i) => {
      if (i !== idx) return c;
      const nt = Math.max(0, Math.min(4, (c.track || 0) + dir));
      if (nt + 1 > textTracks) setTextTracks(nt + 1);
      return { ...c, track: nt };
    }));
    setDirty(true);
  };

  const splitAtPlayhead = () => {
    snapshot();
    const t = currentTime;
    setCaptions(prev => {
      const idx = prev.findIndex(c => t > c.start + 0.08 && t < c.end - 0.08);
      if (idx < 0) return prev;
      const c = prev[idx];
      const a = { ...c, end: t };
      const b = { ...c, start: t };
      setSelectedCap(idx + 1);
      return [...prev.slice(0, idx), a, b, ...prev.slice(idx + 1)];
    });
    setDirty(true);
  };

  const addCaptionAtPlayhead = () => {
    snapshot();
    const t = currentTime;
    setCaptions(prev => [...prev, { start: t, end: Math.min(t + 3, totalDuration || 10), text: "New Text", track: 0 }]);
    setDirty(true);
  };

  // Keep keyboard shortcuts pointed at the latest handlers/state.
  shortcutsRef.current = {
    toggleMute: () => setMuted((m) => !m),
    split: () => (selectedSeg != null ? splitVideoAtPlayhead() : splitAtPlayhead()),
    del: () => (selectedSeg != null ? deleteVideoSeg(selectedSeg) : (selectedCap != null && deleteCaption(selectedCap))),
    hasSelection: selectedSeg != null || selectedCap != null,
  };

  const applyTemplate = async (tpl) => {
    setSaving(true);
    try {
      await api.patch(`/projects/${id}`, {
        subtitle_style: tpl.style,
        accent_color: tpl.color,
        font: tpl.font,
      });
      const { data } = await api.get(`/projects/${id}`);
      setProject(data);
    } finally { setSaving(false); }
  };

  const saveCaptions = async () => {
    setSaving(true);
    try {
      await api.patch(`/projects/${id}`, { captions: processedCaptions });
      setCaptions(processedCaptions);
      setCapSettings({ punct: false, emph: false, gaps: false, emojis: false, delay: 0 });
      setDirty(false);
    } finally { setSaving(false); }
  };

  const rerender = async () => {
    if (dirty) await saveCaptions();
    setRerendering(true);
    try {
      await api.post(`/projects/${id}/rerender`);
      await pollProjectUntilSettled(id, setProject);
      setVideoBust(Date.now());
    } catch (e) { reportError(e, "Couldn't re-render this project"); } finally { setRerendering(false); }
  };

  const videoSegments = useMemo(() => {
    const segs = [];
    let prev = 0;
    [...videoSplits].sort((a, b) => a - b).forEach((sp) => {
      if (sp > prev + 0.05 && sp < totalDuration - 0.05) { segs.push([prev, sp]); prev = sp; }
    });
    segs.push([prev, totalDuration]);
    return segs;
  }, [videoSplits, totalDuration]);

  const splitVideoAtPlayhead = () => {
    const t = currentTime;
    if (t <= 0.2 || t >= totalDuration - 0.2) return;
    setVideoSplits((prev) => Array.from(new Set([...prev, +t.toFixed(3)])).sort((a, b) => a - b));
  };

  const recutVideo = async (keeps) => {
    setRerendering(true);
    try {
      await api.post(`/projects/${id}/recut`, { keep: keeps });
      const data = await pollProjectUntilSettled(id, setProject);
      setVideoBust(Date.now());
      setVideoSplits([]);
      setSelectedSeg(null);
      if (data.captions) setCaptions(data.captions);
    } catch (e) { reportError(e, "Couldn't recut this project"); } finally { setRerendering(false); }
  };

  const deleteVideoSeg = (segIdx) => {
    const keeps = videoSegments.filter((_, i) => i !== segIdx).map((s) => [s[0], s[1]]);
    if (keeps.length === 0) return;
    recutVideo(keeps);
  };

  const trimVideo = async (start, end) => {
    setRerendering(true);
    try {
      await api.post(`/projects/${id}/trim`, { start, end });
      await pollProjectUntilSettled(id, (d) => {
        setProject(d);
        if (d.captions) setCaptions(d.captions);
      });
      setVideoBust(Date.now());
    } catch (e) { reportError(e, "Couldn't trim this project"); } finally { setRerendering(false); }
  };

  const activeCaptionIdx = useMemo(() => {
    return processedCaptions.findIndex(c => currentTime >= c.start && currentTime < c.end);
  }, [processedCaptions, currentTime]);

  if (!project) {
    return (
      <AppShell topbarVariant="editor">
        <div className="px-10 py-16 text-muted-ink text-sm" data-testid="editor-loading">Loading project…</div>
      </AppShell>
    );
  }

  return (
    <AppShell topbarVariant="editor">
      <div className="px-4 md:px-6 py-4">
        <input
          ref={musicInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadMusic(f); e.target.value = ""; }}
        />
        {/* Back link */}
        <div className="flex items-center justify-between mb-3">
          <Link to="/dashboard" data-testid="back-to-dashboard" className="inline-flex items-center gap-1.5 text-xs text-muted-ink hover:text-ink transition-colors">
            <ArrowLeft className="w-3 h-3" /> Back to projects
          </Link>
          {!isMobile && (
            <div className="flex items-center gap-1 bg-card border border-line rounded-lg p-0.5" title="Timeline position">
              <button
                onClick={() => setTimelinePos("bottom")}
                data-testid="timeline-pos-bottom"
                className={`px-2 py-1 rounded-md text-[10px] flex items-center gap-1 transition-colors ${timelinePos === "bottom" ? "bg-bg-2 text-ink" : "text-muted-ink hover:text-ink"}`}
              >
                <PanelBottom className="w-3 h-3" /> Bottom
              </button>
              <button
                onClick={() => setTimelinePos("right")}
                data-testid="timeline-pos-right"
                className={`px-2 py-1 rounded-md text-[10px] flex items-center gap-1 transition-colors ${timelinePos === "right" ? "bg-bg-2 text-ink" : "text-muted-ink hover:text-ink"}`}
              >
                <PanelRight className="w-3 h-3" /> Side
              </button>
            </div>
          )}
        </div>

        {!isDone && (
          <ProcessingBanner project={project} />
        )}

        {isDone && project.captions_source === "placeholder" && (
          <PlaceholderCaptionsBanner />
        )}

        {/* ---- Mobile: simple stacked layout ---- */}
        {isMobile && (
          <div className="flex flex-col gap-3 pb-24">
            <div className="rounded-xl overflow-hidden bg-card border border-line" style={{ height: "46vh" }}>
              <VideoPreview
                project={project}
                videoRef={videoRef}
                playing={playing}
                setPlaying={setPlaying}
                onTimeUpdate={(t) => setCurrentTime(t)}
                activeCaption={processedCaptions[activeCaptionIdx]}
                videoBust={videoBust}
                muted={muted}
                setMuted={setMuted}
                volume={audio.volume}
                textStyle={textStyle}
                onProjectStyleChange={updateProjectStyle}
                navigate={navigate}
              />
            </div>

            {captions.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={saveCaptions}
                  disabled={!dirty || saving}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 text-sm bg-bg-2 border border-line hover:bg-card-2 disabled:opacity-40 rounded-lg py-2.5 transition-colors"
                >
                  <Save className="w-4 h-4" /> {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
                </button>
                <button
                  onClick={rerender}
                  disabled={rerendering || !isDone}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 text-sm bg-white text-black hover:bg-hilite disabled:opacity-40 rounded-lg py-2.5 font-medium transition-colors"
                >
                  {rerendering ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  {rerendering ? "Re-rendering…" : "Re-render"}
                </button>
              </div>
            )}

            <div className="bg-card border border-line rounded-xl overflow-hidden">
              <div className="p-3 border-b border-line text-sm font-medium">Captions</div>
              <div className="max-h-[38vh] overflow-y-auto p-2">
                {captions.length === 0 && (
                  <div className="p-6 text-xs text-muted-ink text-center">
                    {isDone ? "No captions available." : "Waiting for transcription…"}
                  </div>
                )}
                {captions.map((c, i) => (
                  <TranscriptRow
                    key={i}
                    idx={i}
                    caption={c}
                    active={i === activeCaptionIdx}
                    onChange={(t) => editCaption(i, t)}
                    onJump={() => {
                      if (videoRef.current) {
                        try { videoRef.current.currentTime = c.start; } catch (e) { }
                        videoRef.current.play?.().catch(() => { });
                      }
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="bg-card border border-line rounded-xl overflow-hidden">
              <button
                onClick={() => setMobileShowStyles((v) => !v)}
                className="w-full p-3 flex items-center justify-between text-sm font-medium"
              >
                Styles &amp; Templates
                {mobileShowStyles ? <ChevronUp className="w-4 h-4 text-muted-ink" /> : <ChevronDown className="w-4 h-4 text-muted-ink" />}
              </button>
              {mobileShowStyles && (
                <div className="h-[50vh] border-t border-line">
                  <TemplatesPanel onPick={applyTemplate} current={project.subtitle_style} />
                </div>
              )}
            </div>

            <div className="bg-card border border-line rounded-xl overflow-hidden">
              <button
                onClick={() => setMobileShowTimeline((v) => !v)}
                className="w-full p-3 flex items-center justify-between text-sm font-medium"
              >
                Timeline (advanced)
                {mobileShowTimeline ? <ChevronUp className="w-4 h-4 text-muted-ink" /> : <ChevronDown className="w-4 h-4 text-muted-ink" />}
              </button>
              {mobileShowTimeline && (
                <div className="h-[280px] border-t border-line">
                  <Timeline
                    captions={processedCaptions}
                    activeIdx={activeCaptionIdx}
                    duration={totalDuration}
                    currentTime={currentTime}
                    projectId={project.id}
                    onSeek={(t) => { if (videoRef.current) { videoRef.current.currentTime = t; } setCurrentTime(t); }}
                    selectedCap={selectedCap}
                    onSelectCap={(i) => { setSelectedCap(i); setSelectedSeg(null); }}
                    onSplit={splitAtPlayhead}
                    onDeleteCap={deleteCaption}
                    onUpdateTiming={updateCaptionTiming}
                    onBeginEdit={snapshot}
                    onUndo={undo}
                    onRedo={redo}
                    canUndo={past.length > 0}
                    canRedo={future.length > 0}
                    textTracks={textTracks}
                    onAddTextTrack={addTextTrack}
                    onMoveCapTrack={moveCapTrack}
                    onSetCapTrack={setCapTrack}
                    onClearTrack={clearTrackCaptions}
                    onTrimVideo={trimVideo}
                    videoSegments={videoSegments}
                    selectedSeg={selectedSeg}
                    onSelectSeg={(i) => { setSelectedSeg(i); setSelectedCap(null); }}
                    onSplitVideo={splitVideoAtPlayhead}
                    onDeleteSeg={deleteVideoSeg}
                    muted={muted}
                    onToggleMute={() => setMuted((m) => !m)}
                    audio={audio}
                    onAudioChange={updateAudio}
                    hasMusic={!!project.music_path}
                    musicVolume={project.music_volume ?? 0.3}
                    onAddMusic={() => musicInputRef.current?.click()}
                    onRemoveMusic={removeMusic}
                    onMusicVolume={updateMusicVolume}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ---- Desktop: resizable panel workspace ---- */}
        {!isMobile && (
          <div className="h-[calc(100vh-90px)]">
            <PanelGroup
              direction={timelinePos === "bottom" ? "vertical" : "horizontal"}
              autoSaveId={`clipcut-rows-${timelinePos}`}
            >
              <Panel defaultSize={68} minSize={35} className="min-h-0">
                <div className="flex gap-1 h-full min-h-0">
                  {/* Left rail */}
                  <div className="shrink-0 h-full">
                    <div className="flex md:flex-col gap-1 bg-card border border-line rounded-xl p-2">
                      {LEFT_RAIL.map((item) => {
                        const active = leftRail === item.id;
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.id}
                            onClick={() => setLeftRail(item.id)}
                            data-testid={`rail-${item.id}`}
                            className={`relative flex flex-col items-center justify-center py-3 px-2 rounded-lg transition-colors ${active ? "bg-bg-2 text-ink" : "text-muted-ink hover:text-ink"
                              }`}
                          >
                            <Icon className="w-4 h-4" />
                            <span className="text-[10px] mt-1.5">{item.label}</span>
                            {item.badge && (
                              <span className="absolute top-1 right-1 text-[8px] bg-line rounded px-1 py-0.5 text-muted-ink">
                                {item.badge}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <PanelGroup direction="horizontal" autoSaveId="clipcut-cols" className="flex-1 min-w-0">
                    {/* Captions / Fonts / Audio panel */}
                    <Panel defaultSize={31} minSize={18} className="flex flex-col min-h-0">
                      {leftRail === "captions" && (
                        <div className="flex-1 min-h-0 bg-card border border-line rounded-xl overflow-hidden flex flex-col">
                          <div className="p-4 border-b border-line flex items-center justify-between">
                            <h3 className="text-sm font-medium">Captions</h3>
                            <div className="flex items-center gap-2 relative">
                              <button onClick={() => setShowSearch(!showSearch)} className={`p-1.5 rounded-md transition-colors ${showSearch ? "bg-bg-2 text-ink" : "text-muted-ink hover:bg-bg-2"}`} data-testid="captions-search">
                                <Search className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => { setTranslateOpen(!translateOpen); setToolsOpen(false); }}
                                title={translateOpen ? "Back to caption list" : "Translate to English"}
                                className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors ${translateOpen ? "bg-bg-2 text-ink" : "text-muted-ink hover:text-ink hover:bg-bg-2"}`}
                                data-testid="captions-translate"
                              >
                                Translate
                              </button>
                              <button onClick={() => { setToolsOpen(!toolsOpen); setTranslateOpen(false); }} title={toolsOpen ? "Back to caption list" : "Caption tools"} className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors ${toolsOpen ? "bg-bg-2 text-ink" : "text-muted-ink hover:text-ink hover:bg-bg-2"}`} data-testid="captions-tools">
                                Caption Tools <ChevronDown className={`w-3 h-3 transition-transform ${toolsOpen ? "rotate-180" : ""}`} />
                              </button>
                            </div>
                          </div>

                          {showSearch && !toolsOpen && !translateOpen && (
                            <div className="p-2 border-b border-line bg-bg-2">
                              <input
                                type="text"
                                autoFocus
                                placeholder="Search captions..."
                                className="w-full bg-bg border border-line rounded text-xs px-2 py-1.5 outline-none focus:border-ink/50"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                              />
                            </div>
                          )}

                          {translateOpen && (
                            <TranslationPanel
                              captionsEn={project.captions_en}
                              status={project.translation_status}
                              onTranslate={startTranslation}
                              busy={translating}
                            />
                          )}

                          {!toolsOpen && !translateOpen && (
                            <div className="flex-1 overflow-y-auto p-2" data-testid="transcript-list">
                              {captions.length === 0 && (
                                <div className="p-6 text-xs text-muted-ink text-center">
                                  {isDone ? "No captions available." : "Waiting for transcription…"}
                                </div>
                              )}
                              {captions.map((c, i) => {
                                if (searchQuery && !c.text.toLowerCase().includes(searchQuery.toLowerCase())) return null;
                                return (
                                  <TranscriptRow
                                    key={i}
                                    idx={i}
                                    caption={c}
                                    active={i === activeCaptionIdx}
                                    onChange={(t) => editCaption(i, t)}
                                    onJump={() => {
                                      if (videoRef.current) {
                                        try { videoRef.current.currentTime = c.start; } catch (e) { }
                                        videoRef.current.play?.().catch(() => { });
                                      }
                                    }}
                                  />
                                );
                              })}
                            </div>
                          )}

                          {toolsOpen && (
                            <div className="flex-1 overflow-y-auto p-4 space-y-6" data-testid="captions-settings">
                              {/* DISPLAY SETTINGS */}
                              <div>
                                <div className="flex items-center gap-2 mb-3">
                                  <div className="h-[1px] flex-1 bg-line"></div>
                                  <span className="text-[10px] font-semibold text-editor-muted tracking-wider uppercase">Display Settings</span>
                                  <div className="h-[1px] flex-1 bg-line"></div>
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                  <div className="relative">
                                    <label className="text-xs text-editor-muted mb-1.5 block">Words</label>
                                    <button
                                      type="button"
                                      onClick={() => setWordsMenuOpen((o) => !o)}
                                      onKeyDown={(e) => { if (e.key === "Escape") setWordsMenuOpen(false); }}
                                      aria-haspopup="listbox"
                                      aria-expanded={wordsMenuOpen}
                                      className="w-full flex items-center gap-2 bg-bg-2 border border-line rounded px-2.5 py-1.5 hover:border-line-2 transition-colors"
                                    >
                                      <FontIcon className="w-3.5 h-3.5 text-editor-muted shrink-0" />
                                      <span className="text-xs text-white flex-1 text-left truncate">
                                        {WORDS_OPTIONS.find((o) => o.value === capSettings.wordsPerLine)?.label}
                                      </span>
                                      <ChevronDown className={`w-3.5 h-3.5 text-editor-muted shrink-0 transition-transform ${wordsMenuOpen ? "rotate-180" : ""}`} />
                                    </button>
                                    {wordsMenuOpen && (
                                      <>
                                        <div className="fixed inset-0 z-40" onClick={() => setWordsMenuOpen(false)} />
                                        <div role="listbox" aria-label="Words per line" className="absolute top-full left-0 right-0 mt-1 bg-card-2 border border-line rounded-md shadow-2xl z-50 overflow-hidden py-1">
                                          {WORDS_OPTIONS.map((o) => (
                                            <button
                                              key={o.value}
                                              type="button"
                                              role="option"
                                              aria-selected={capSettings.wordsPerLine === o.value}
                                              onClick={() => { setCapSetting({ wordsPerLine: o.value }); setWordsMenuOpen(false); }}
                                              className={`block w-full text-left px-3 py-1.5 text-xs transition-colors ${capSettings.wordsPerLine === o.value ? "bg-bg-2 text-white" : "text-muted-ink hover:bg-bg-2 hover:text-white"}`}
                                            >
                                              {o.label}
                                            </button>
                                          ))}
                                        </div>
                                      </>
                                    )}
                                  </div>
                                  <div>
                                    <label className="text-xs text-editor-muted mb-1.5 block">Max Chars</label>
                                    <div className="flex items-center gap-2 bg-bg-2 border border-line rounded px-2.5 py-1.5 focus-within:border-editor-muted/50 transition-colors">
                                      <FontIcon className="w-3.5 h-3.5 text-editor-muted shrink-0" />
                                      <input
                                        type="number"
                                        min="8"
                                        max="80"
                                        value={capSettings.maxChars}
                                        onChange={(e) => setCapSetting({ maxChars: Number(e.target.value) })}
                                        className="bg-transparent outline-none text-xs text-white flex-1 min-w-0"
                                      />
                                      <button onClick={() => setCapSetting({ maxChars: 24 })} className="text-editor-muted hover:text-white shrink-0"><RotateCcw className="w-3.5 h-3.5" /></button>
                                    </div>
                                  </div>
                                  <div className="relative">
                                    <label className="text-xs text-editor-muted mb-1.5 block">Lines</label>
                                    <button
                                      type="button"
                                      onClick={() => setLinesMenuOpen((o) => !o)}
                                      onKeyDown={(e) => { if (e.key === "Escape") setLinesMenuOpen(false); }}
                                      aria-haspopup="listbox"
                                      aria-expanded={linesMenuOpen}
                                      className="w-full flex items-center gap-2 bg-bg-2 border border-line rounded px-2.5 py-1.5 hover:border-line-2 transition-colors"
                                    >
                                      <AlignLeft className="w-3.5 h-3.5 text-editor-muted shrink-0" />
                                      <span className="text-xs text-white flex-1 text-left truncate">
                                        {LINES_OPTIONS.find((o) => o.value === capSettings.lines)?.label}
                                      </span>
                                      <ChevronDown className={`w-3.5 h-3.5 text-editor-muted shrink-0 transition-transform ${linesMenuOpen ? "rotate-180" : ""}`} />
                                    </button>
                                    {linesMenuOpen && (
                                      <>
                                        <div className="fixed inset-0 z-40" onClick={() => setLinesMenuOpen(false)} />
                                        <div role="listbox" aria-label="Lines per caption" className="absolute top-full left-0 right-0 mt-1 bg-card-2 border border-line rounded-md shadow-2xl z-50 overflow-hidden py-1">
                                          {LINES_OPTIONS.map((o) => (
                                            <button
                                              key={o.value}
                                              type="button"
                                              role="option"
                                              aria-selected={capSettings.lines === o.value}
                                              onClick={() => { setCapSetting({ lines: o.value }); setLinesMenuOpen(false); }}
                                              className={`block w-full text-left px-3 py-1.5 text-xs transition-colors ${capSettings.lines === o.value ? "bg-bg-2 text-white" : "text-muted-ink hover:bg-bg-2 hover:text-white"}`}
                                            >
                                              {o.label}
                                            </button>
                                          ))}
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* ACTIONS */}
                              <div>
                                <div className="flex items-center gap-2 mb-3">
                                  <div className="h-[1px] flex-1 bg-line"></div>
                                  <span className="text-[10px] font-semibold text-editor-muted tracking-wider uppercase">Actions</span>
                                  <div className="h-[1px] flex-1 bg-line"></div>
                                </div>
                                <div className="space-y-2">
                                  {[
                                    { id: "punct", title: "Remove Punctuation", desc: "Strip all punctuation for a cleaner, minimal look", on: capSettings.punct },
                                    { id: "emph", title: "Remove Emphasis", desc: "Remove all text emphasis for uniform appearance", on: capSettings.emph },
                                    { id: "gaps", title: "Remove Gaps in Captions", desc: "Eliminate gaps between captions for seamless flow", on: capSettings.gaps },
                                    { id: "emojis", title: "Remove Emojis", desc: "Remove all emojis from captions", on: capSettings.emojis },
                                  ].map(action => (
                                    <div key={action.id} className={`flex items-center gap-4 bg-card border ${action.on ? 'border-editor-success/30 bg-editor-success/5' : 'border-line'} rounded-lg p-3`}>
                                      <div className="w-8 h-8 rounded-md bg-editor-well flex items-center justify-center shrink-0">
                                        <Eraser className="w-4 h-4 text-editor-muted" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-white">{action.title}</div>
                                        <div className="text-[11px] text-editor-muted truncate">{action.desc}</div>
                                      </div>
                                      <button
                                        type="button"
                                        role="switch"
                                        aria-checked={action.on}
                                        aria-label={action.title}
                                        onClick={() => setCapSetting({ [action.id]: !capSettings[action.id] })}
                                        className={`w-9 h-5 rounded-full flex items-center p-0.5 cursor-pointer transition-colors shrink-0 ${action.on ? "bg-white justify-end" : "bg-editor-well"}`}
                                      >
                                        <div className={`w-4 h-4 rounded-full transition-colors ${action.on ? "bg-black" : "bg-editor-muted"}`} />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* TIMING */}
                              <div>
                                <div className="flex items-center gap-2 mb-3">
                                  <div className="h-[1px] flex-1 bg-line"></div>
                                  <span className="text-[10px] font-semibold text-editor-muted tracking-wider uppercase">Timing</span>
                                  <div className="h-[1px] flex-1 bg-line"></div>
                                </div>

                                <div className="bg-card flex flex-col justify-between border border-line rounded-lg p-4">
                                  <div className="flex items-start gap-3 mb-4">
                                    <div className="w-8 h-8 rounded-md bg-editor-well flex items-center justify-center shrink-0 mt-0.5">
                                      <Clock className="w-4 h-4 text-editor-muted" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex justify-between items-center mb-0.5">
                                        <div className="text-[13px] font-medium text-white">Caption Delay Control</div>
                                        <div className="flex items-center gap-2 pt-0.5">
                                          <span className="text-[10px] text-editor-muted text-right">No delay</span>
                                          <button onClick={() => setCapSetting({ delay: 0 })} className="text-editor-muted hover:text-white"><RotateCcw className="w-3.5 h-3.5" /></button>
                                        </div>
                                      </div>
                                      <div className="text-[11px] text-editor-muted">Shift all captions earlier or later in time</div>
                                    </div>
                                  </div>
                                  <div className="px-1 relative pb-2 pt-4">
                                    <input type="range" min="-5" max="5" step="0.1" value={capSettings.delay} onChange={e => setCapSetting({ delay: Number(e.target.value) })} className="w-full accent-white h-1 bg-editor-well appearance-none rounded-full outline-none relative z-10" />
                                    <div className="flex justify-between items-center mt-3 mx-[-2px]">
                                      <span className="text-[9px] text-editor-muted-2">-5s</span>
                                      <span className="text-[9px] text-editor-muted-2">0</span>
                                      <span className="text-[9px] text-editor-muted-2">+5s</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {captions.length > 0 && (
                            <div className="p-3 border-t border-line flex items-center gap-2">
                              <button
                                onClick={saveCaptions}
                                disabled={!dirty || saving}
                                data-testid="save-captions-btn"
                                className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs bg-bg-2 border border-line hover:bg-card-2 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg py-2 transition-colors"
                              >
                                <Save className="w-3 h-3" /> {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
                              </button>
                              <button
                                onClick={rerender}
                                disabled={rerendering || !isDone}
                                data-testid="rerender-btn"
                                className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs bg-white text-black hover:bg-hilite disabled:opacity-40 disabled:cursor-not-allowed rounded-lg py-2 font-medium transition-colors"
                              >
                                {rerendering ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                                {rerendering ? "Re-rendering…" : "Re-render"}
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {leftRail === "fonts" && (
                        <CustomFontsPanel />
                      )}

                      {leftRail === "audio" && (
                        <AudioPanel
                          audio={audio}
                          updateAudio={updateAudio}
                          project={project}
                          uploadMusic={uploadMusic}
                          removeMusic={removeMusic}
                          updateMusicVolume={updateMusicVolume}
                          musicBusy={musicBusy}
                        />
                      )}
                    </Panel>
                    <HResize />
                    {/* Video preview (center) */}
                    <Panel defaultSize={38} minSize={22} className="min-h-0">
                      <VideoPreview
                        project={project}
                        videoRef={videoRef}
                        playing={playing}
                        setPlaying={setPlaying}
                        onTimeUpdate={(t) => setCurrentTime(t)}
                        activeCaption={processedCaptions[activeCaptionIdx]}
                        videoBust={videoBust}
                        muted={muted}
                        setMuted={setMuted}
                        volume={audio.volume}
                        textStyle={textStyle}
                        onProjectStyleChange={updateProjectStyle}
                        navigate={navigate}
                      />
                    </Panel>
                    <HResize />
                    {/* Right panel: templates (docked, or a placeholder while floating) */}
                    <Panel defaultSize={31} minSize={18} className="min-h-0">
                      {rightFloating ? (
                        <div className="bg-card border border-line border-dashed rounded-xl h-full flex flex-col items-center justify-center gap-2 text-muted-ink">
                          <PictureInPicture2 className="w-5 h-5" />
                          <span className="text-xs">Panel is floating</span>
                          <button
                            onClick={() => setRightFloating(false)}
                            className="text-[11px] px-2 py-1 rounded-md bg-bg-2 hover:bg-line border border-line"
                          >
                            Dock back
                          </button>
                        </div>
                      ) : (
                        <RightPanelBody
                          rightTab={rightTab}
                          setRightTab={setRightTab}
                          applyTemplate={applyTemplate}
                          project={project}
                          textStyle={textStyle}
                          onTextStyleChange={updateTextStyle}
                          onProjectStyleChange={updateProjectStyle}
                          addCaptionAtPlayhead={addCaptionAtPlayhead}
                          cleaningAudio={cleaningAudio}
                          onCleanAudio={triggerCleanAudio}
                          headerExtra={
                            <button
                              onClick={() => setRightFloating(true)}
                              title="Pop out into a floating window"
                              data-testid="pop-out-right-panel"
                              className="w-6 h-6 shrink-0 rounded-md text-muted-ink hover:text-ink hover:bg-bg-2 flex items-center justify-center"
                            >
                              <PictureInPicture2 className="w-3.5 h-3.5" />
                            </button>
                          }
                        />
                      )}
                    </Panel>
                  </PanelGroup>
                </div>
              </Panel>
              {timelinePos === "bottom" ? <VResize /> : <HResize />}
              <Panel defaultSize={32} minSize={14} className="min-h-0">
                <div className={`h-full min-h-0 ${timelinePos === "bottom" ? "pt-1" : "pl-1"}`}>
                  {/* Timeline — resizable, dockable to bottom or side */}
                  <Timeline
                    captions={processedCaptions}
                    activeIdx={activeCaptionIdx}
                    duration={totalDuration}
                    currentTime={currentTime}
                    projectId={project.id}
                    onSeek={(t) => { if (videoRef.current) { videoRef.current.currentTime = t; } setCurrentTime(t); }}
                    selectedCap={selectedCap}
                    onSelectCap={(i) => { setSelectedCap(i); setSelectedSeg(null); }}
                    onSplit={splitAtPlayhead}
                    onDeleteCap={deleteCaption}
                    onUpdateTiming={updateCaptionTiming}
                    onBeginEdit={snapshot}
                    onUndo={undo}
                    onRedo={redo}
                    canUndo={past.length > 0}
                    canRedo={future.length > 0}
                    textTracks={textTracks}
                    onAddTextTrack={addTextTrack}
                    onMoveCapTrack={moveCapTrack}
                    onSetCapTrack={setCapTrack}
                    onClearTrack={clearTrackCaptions}
                    onTrimVideo={trimVideo}
                    videoSegments={videoSegments}
                    selectedSeg={selectedSeg}
                    onSelectSeg={(i) => { setSelectedSeg(i); setSelectedCap(null); }}
                    onSplitVideo={splitVideoAtPlayhead}
                    onDeleteSeg={deleteVideoSeg}
                    muted={muted}
                    onToggleMute={() => setMuted((m) => !m)}
                    audio={audio}
                    onAudioChange={updateAudio}
                    hasMusic={!!project.music_path}
                    musicVolume={project.music_volume ?? 0.3}
                    onAddMusic={() => musicInputRef.current?.click()}
                    onRemoveMusic={removeMusic}
                    onMusicVolume={updateMusicVolume}
                  />
                </div>
              </Panel>
            </PanelGroup>
          </div>
        )}

        {/* Floating window — the popped-out right panel (Templates/Text/…) — desktop only */}
        {!isMobile && rightFloating && (
          <FloatingWindow
            rect={floatRect}
            onRectChange={setFloatRect}
            minimized={floatMinimized}
            onMinimizedChange={setFloatMinimized}
            maximized={floatMaximized}
            onMaximizedChange={setFloatMaximized}
            onDock={() => { setRightFloating(false); setFloatMaximized(false); setFloatMinimized(false); }}
            title={rightTab}
          >
            <RightPanelBody
              rightTab={rightTab}
              setRightTab={setRightTab}
              applyTemplate={applyTemplate}
              project={project}
              textStyle={textStyle}
              onTextStyleChange={updateTextStyle}
              onProjectStyleChange={updateProjectStyle}
              addCaptionAtPlayhead={addCaptionAtPlayhead}
              cleaningAudio={cleaningAudio}
              onCleanAudio={triggerCleanAudio}
            />
          </FloatingWindow>
        )}

        {/* Bottom-right sticky Export */}
        {isDone && (
          <div className="fixed bottom-6 right-6 z-30 flex items-center gap-2">
            <a
              href={`${API}/projects/${project.id}/export/srt`}
              data-testid="export-srt-btn"
              title="Download captions as an .srt file for use in other editors"
              className="inline-flex items-center gap-2 bg-card border border-line text-ink text-sm font-medium px-4 py-3 rounded-lg hover:bg-bg-2 shadow-2xl transition-colors"
            >
              <Download className="w-4 h-4" /> SRT
            </a>
            <a
              href={`${API}/projects/${project.id}/download`}
              data-testid="export-btn"
              className="inline-flex items-center gap-2 bg-white text-black text-sm font-semibold px-5 py-3 rounded-lg hover:bg-hilite shadow-2xl transition-colors"
            >
              <Download className="w-4 h-4" /> Export
            </a>
          </div>
        )}
      </div>
    </AppShell>
  );
}
