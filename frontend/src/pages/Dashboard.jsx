import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api, { API } from "@/lib/api";
import { AppShell } from "@/components/Layout";
import { useAuth } from "@/context/AuthContext";
import { usePolling } from "@/hooks/usePolling";
import { SUPPORTED_LANGUAGES } from "@/constants/languages";
import { UploadCloud, Play, MoreVertical, Loader2, VolumeX, Volume2, Circle, Pencil, Trash2 } from "lucide-react";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState("");
  const [renameTarget, setRenameTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [newName, setNewName] = useState("");
  const [language, setLanguage] = useState("auto");

  const fileRef = useRef(null);
  const [teams, setTeams] = useState([]);
  const [activeWorkspace, setActiveWorkspace] = useState("all");

  useEffect(() => {
    api.get("/teams")
      .then((res) => setTeams(res.data))
      .catch(() => { });
  }, []);

  usePolling(async () => {
    try {
      const { data } = await api.get("/projects");
      setProjects(data);
    } catch (err) { /* transient network hiccup — try again next tick */ }
  }, 3000);


  const upload = useCallback(async (file) => {
    setError("");
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("name", file.name.replace(/\.[^.]+$/, ""));
      // Brand Kit Sync: auto-apply the user's saved style to every new upload.
      if (user?.brand_kit_enabled) {
        form.append("subtitle_style", user.brand_subtitle_style || "bold-pop");
        form.append("accent_color", user.brand_accent_color || "#FFFFFF");
        form.append("font", user.brand_font || "DejaVu Sans");
      } else {
        form.append("subtitle_style", "bold-pop");
        form.append("accent_color", "#FFFFFF");
        form.append("font", "DejaVu Sans");
      }
      form.append("quality", "1080p");
      form.append("auto_cut", "balanced");
      form.append("transcription_language", language);
      if (activeWorkspace !== "all" && activeWorkspace !== "personal") {
        form.append("team_id", activeWorkspace);
      }
      const { data } = await api.post("/projects/upload", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      navigate(`/projects/${data.id}`);
    } catch (e) {
      setError(e.response?.data?.detail || e.message);
      setUploading(false);
    }
  }, [user, language, activeWorkspace, navigate]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f) upload(f);
  }, [upload]);

  const handleSelect = (e) => {
    const f = e.target.files?.[0];
    if (f) upload(f);
  };

  return (
    <AppShell projects={projects} topbarVariant="app">
      <main className="px-6 md:px-10 py-8">
        <h1 className="text-2xl font-semibold tracking-tight" data-testid="dashboard-heading">
          Welcome back, {user?.name?.split(" ")[0] || "creator"}
        </h1>
        <p className="mt-1 text-sm text-muted-ink">Drop a video below or pick a recent project to edit captions.</p>

        {/* Workspace Switcher */}
        <div className="mt-6 flex items-center justify-between border-b border-line pb-4 flex-wrap gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-full py-1">
            <button
              onClick={() => setActiveWorkspace("all")}
              data-testid="workspace-tab-all"
              className={`text-xs px-3 py-1.5 font-medium rounded-lg border transition-all ${activeWorkspace === "all"
                ? "bg-white text-black border-transparent"
                : "bg-transparent text-muted-ink border-line hover:border-line-2"
                }`}
            >
              All Workspaces ({projects.length})
            </button>
            <button
              onClick={() => setActiveWorkspace("personal")}
              data-testid="workspace-tab-personal"
              className={`text-xs px-3 py-1.5 font-medium rounded-lg border transition-all ${activeWorkspace === "personal"
                ? "bg-white text-black border-transparent"
                : "bg-transparent text-muted-ink border-line hover:border-line-2"
                }`}
            >
              Personal ({projects.filter(p => !p.team_id).length})
            </button>
            {teams.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveWorkspace(t.id)}
                data-testid={`workspace-tab-team-${t.id}`}
                className={`text-xs px-3 py-1.5 font-medium rounded-lg border transition-all ${activeWorkspace === t.id
                  ? "bg-white text-black border-transparent"
                  : "bg-transparent text-muted-ink border-line hover:border-line-2"
                  }`}
              >
                {t.name} ({projects.filter(p => p.team_id === t.id).length})
              </button>
            ))}
          </div>
          <button
            onClick={() => navigate("/profile")}
            data-testid="manage-teams-lnk"
            className="text-xs text-muted-ink hover:text-white transition-colors shrink-0 underline decoration-dotted"
          >
            Manage Teams
          </button>
        </div>

        <div className="mt-6 flex items-center gap-2">
          <label htmlFor="transcription-language" className="text-sm text-muted-ink">Transcription language</label>
          <select
            id="transcription-language"
            data-testid="upload-language-select"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            disabled={uploading}
            className="bg-card border border-line rounded-md text-sm px-2.5 py-1.5 outline-none text-ink"
          >
            {SUPPORTED_LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
        </div>

        {/* Upload dropzone */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onClick={() => !uploading && fileRef.current?.click()}
          data-testid="upload-dropzone"
          className={`mt-8 border-2 border-dashed rounded-2xl p-16 md:p-20 text-center transition-all cursor-pointer ${dragActive ? "border-ink bg-card" : "border-line hover:border-line-2 bg-card"
            } ${uploading ? "opacity-70 cursor-wait" : ""}`}
        >
          <div className="mx-auto w-14 h-14 rounded-2xl bg-bg-2 flex items-center justify-center">
            {uploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <UploadCloud className="w-6 h-6" />}
          </div>
          <div className="mt-6 text-lg font-medium">
            {uploading ? "Uploading…" : "Drop your videos here or click to upload"}
          </div>
          <div className="mt-2 text-sm text-muted-ink">Max: 2:00 minutes, 1GB · Supports: MP4, MOV</div>
          <input
            ref={fileRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={handleSelect}
            data-testid="upload-file-input"
          />
        </div>

        {error && (
          <div className="mt-4 text-sm text-red-400 bg-red-950/30 border border-red-900/40 rounded-lg px-4 py-3" data-testid="upload-error">
            {error}
          </div>
        )}

        {/* Recent Videos */}
        <div className="mt-14">
          {(() => {
            const filteredProjects = projects.filter(p => {
              if (activeWorkspace === "all") return true;
              if (activeWorkspace === "personal") return !p.team_id;
              return p.team_id === activeWorkspace;
            });
            return (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-medium">Recent Videos</h2>
                  <span className="text-xs text-muted-ink">{filteredProjects.length} project{filteredProjects.length === 1 ? "" : "s"}</span>
                </div>

                {filteredProjects.length === 0 ? (
                  <div className="rounded-2xl border border-line bg-card p-12 text-center">
                    <div className="text-muted-ink text-sm">No videos yet — upload one above to get started.</div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {filteredProjects.map((p) => (
                      <VideoCard
                        key={p.id}
                        p={p}
                        onRename={(proj) => { setRenameTarget(proj); setNewName(proj.name); }}
                        onDelete={(proj) => setDeleteTarget(proj)}
                      />
                    ))}
                  </div>
                )}
              </>
            );
          })()}
        </div>
      </main>

      {/* Rename Modal */}
      {renameTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#1c1c1c] border border-line rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-semibold text-white mb-4">Rename Project</h3>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full bg-[#111] border border-line focus:border-white/20 rounded-xl px-4 py-2.5 text-sm outline-none text-white transition-colors mb-6"
              placeholder="e.g. My Awesome Video"
              autoFocus
            />
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setRenameTarget(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    await api.patch(`/projects/${renameTarget.id}`, { name: newName });
                    setRenameTarget(null);
                    window.location.reload();
                  } catch (err) {
                    alert('Error renaming video: ' + (err.response?.data?.detail || err.message));
                  }
                }}
                disabled={!newName.trim() || newName === renameTarget.name}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-white text-black hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#1c1c1c] border border-line rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-semibold text-white mb-2">Delete Project?</h3>
            <p className="text-sm text-muted-ink mb-6">Are you sure you want to delete <span className="font-semibold text-white/90">"{deleteTarget.name}"</span>? This action cannot be undone.</p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    await api.delete(`/projects/${deleteTarget.id}`);
                    setDeleteTarget(null);
                    window.location.reload();
                  } catch (err) {
                    alert('Error deleting video: ' + (err.response?.data?.detail || err.message));
                  }
                }}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                Delete Video
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function VideoCard({ p, onRename, onDelete }) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const clickTimeout = useRef(null);

  const daysAgo = Math.floor((Date.now() - new Date(p.created_at).getTime()) / (1000 * 60 * 60 * 24));
  const timeLabel = daysAgo <= 0 ? "Today" : daysAgo === 1 ? "1 day ago" : `${daysAgo} days ago`;

  const handleDelete = (e) => {
    e.stopPropagation();
    setMenuOpen(false);
    onDelete(p);
  };

  const handleRename = (e) => {
    e.stopPropagation();
    setMenuOpen(false);
    onRename(p);
  };

  const handleCardClick = (e) => {
    if (clickTimeout.current) {
      clearTimeout(clickTimeout.current);
      clickTimeout.current = null;
      navigate(`/projects/${p.id}`);
    } else {
      clickTimeout.current = setTimeout(() => {
        setPreviewPlaying((prev) => !prev);
        clickTimeout.current = null;
      }, 250);
    }
  };

  return (
    <div
      onClick={handleCardClick}
      data-testid={`video-card-${p.id}`}
      className="group cursor-pointer rounded-xl bg-card border border-line hover:border-line-2 transition-all overflow-hidden user-select-none"
    >
      <div
        className="relative aspect-square bg-[#111] overflow-hidden rounded-t-xl"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {p.status === "done" ? (
          <HoverVideoPreview p={p} isPlaying={previewPlaying || isHovered} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-muted-ink animate-spin" />
          </div>
        )}
        {p.status !== "done" && (
          <div className="absolute bottom-2 left-2 text-[10px] tracking-widest uppercase text-white bg-black/70 rounded px-2 py-1">
            {p.status}
          </div>
        )}
      </div>
      <div className="p-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate text-white">{p.name}</div>
          <div className="mt-1 text-xs text-muted-ink truncate flex items-center gap-1.5">
            <span>{timeLabel}</span>
            <span>·</span>
            <span>English (Native)</span>
            {p.team_id && (
              <span className="bg-[#ff5c00]/20 text-[#ff5c00] border border-[#ff5c00]/30 px-1 py-0.2. rounded text-[9px] font-mono tracking-tight font-black uppercase">
                Team
              </span>
            )}
          </div>
        </div>
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
            className="text-muted-ink hover:text-white transition-colors mt-0.5 shrink-0 outline-none"
            data-testid={`video-menu-${p.id}`}
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }} />
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute bottom-full right-0 mb-2 w-40 bg-[#262626] border border-[#3f3f3f] rounded-xl shadow-2xl z-50 overflow-hidden"
              >
                <div className="py-1">
                  <button onClick={handleRename} className="w-full px-4 py-2.5 text-left flex items-center gap-3 text-sm text-white hover:bg-white/5 transition-colors">
                    <Pencil className="w-4 h-4 text-muted-ink" />
                    Rename
                  </button>
                  <div className="h-px bg-[#3f3f3f] mx-3" />
                  <button onClick={handleDelete} className="w-full px-4 py-2.5 text-left flex items-center gap-3 text-sm text-red-500 hover:bg-white/5 transition-colors">
                    <Trash2 className="w-4 h-4 text-red-500" />
                    Delete
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function HoverVideoPreview({ p, isPlaying }) {
  const videoRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(true);

  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying) {
        if (progress === 100) videoRef.current.currentTime = 0;
        videoRef.current.play().catch(() => { });
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying, progress]);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const pct = (videoRef.current.currentTime / videoRef.current.duration) * 100;
      setProgress(pct || 0);
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const formatTime = (time) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="absolute inset-0 w-full h-full">
      <img
        src={`${API}/projects/${p.id}/thumbnail`}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${isPlaying ? 'opacity-0' : 'opacity-100'}`}
        alt={p.name}
        onError={(e) => { e.currentTarget.style.display = "none"; }}
      />

      {isPlaying && (
        <video
          ref={videoRef}
          src={`${API}/projects/${p.id}/video`}
          muted={isMuted}
          playsInline
          onTimeUpdate={handleTimeUpdate}
          onEnded={() => setProgress(100)}
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      {/* Overlay UI when NOT playing (Play icon) */}
      <div className={`absolute inset-0 flex items-center justify-center transition-opacity pointer-events-none ${isPlaying ? 'opacity-0' : 'opacity-100'}`}>
        <div className="absolute w-32 h-32 bg-black/60 blur-2xl rounded-full" />

        {/* Play Button */}
        <div className="relative w-14 h-14 rounded-full border-2 border-white text-white flex items-center justify-center shadow-xl group-hover:scale-105 transition-transform duration-300">
          <Play className="w-6 h-6 ml-1 text-white fill-none stroke-current stroke-2" />
        </div>
      </div>

      {/* Overlay UI when playing */}
      {isPlaying && (
        <div className="absolute inset-0 pointer-events-none bg-black/20">
          <div className="absolute top-3 left-3 flex items-center gap-1.5 text-white/90 text-xs font-semibold drop-shadow-md">
            <Circle className="w-3 h-3" />
            {formatTime(currentTime)}
          </div>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsMuted(!isMuted); }}
            className="absolute bottom-4 right-3 text-white/90 pointer-events-auto hover:text-white"
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4 drop-shadow-md shadow-black" />
            ) : (
              <Volume2 className="w-4 h-4 drop-shadow-md shadow-black" />
            )}
          </button>
          {/* Progress bar */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/30">
            <div className="h-full bg-white transition-all duration-75" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}
