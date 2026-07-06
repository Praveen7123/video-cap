import { Volume2 } from "lucide-react";

export function AudioPanel({ audio, updateAudio, project, uploadMusic, removeMusic, updateMusicVolume, musicBusy }) {
  return (
    <div className="flex-1 min-h-0 bg-card border border-line rounded-xl overflow-hidden flex flex-col p-4 space-y-4">
      <h3 className="text-sm font-medium">Audio</h3>
      <div className="space-y-6">
        <div>
          <label className="text-xs font-medium mb-2 block">Video Volume</label>
          <div className="flex items-center gap-3 bg-bg-2 p-2 rounded border border-line">
            <Volume2 className="w-4 h-4 text-muted-ink" />
            <input type="range" min="0" max="2" step="0.1" value={audio.volume} onChange={(e) => updateAudio({ volume: parseFloat(e.target.value) })} className="flex-1 h-1" />
            <span className="text-xs text-muted-ink w-8 text-right">{Math.round(audio.volume * 100)}%</span>
          </div>
        </div>
        <div>
          <label className="text-xs font-medium mb-2 block">Audio Fades</label>
          <div className="space-y-2">
            <div className="flex justify-between items-center bg-bg-2 p-2 rounded border border-line">
              <span className="text-xs text-muted-ink">Fade In</span>
              <input type="number" min="0" max="10" step="0.5" value={audio.fadeIn} onChange={(e) => updateAudio({ fadeIn: parseFloat(e.target.value) || 0 })} className="w-16 bg-bg border border-line rounded text-xs px-2 py-1 outline-none text-right" />
            </div>
            <div className="flex justify-between items-center bg-bg-2 p-2 rounded border border-line">
              <span className="text-xs text-muted-ink">Fade Out</span>
              <input type="number" min="0" max="10" step="0.5" value={audio.fadeOut} onChange={(e) => updateAudio({ fadeOut: parseFloat(e.target.value) || 0 })} className="w-16 bg-bg border border-line rounded text-xs px-2 py-1 outline-none text-right" />
            </div>
          </div>
        </div>
        <div>
          <label className="text-xs font-medium mb-2 block">Background Music</label>
          <div className="bg-bg-2 p-3 rounded border border-line flex flex-col gap-3">
            {project?.music_path ? (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-green-400 font-medium">Track Uploaded</span>
                  <button onClick={removeMusic} disabled={musicBusy} className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50">
                    {musicBusy ? "Removing…" : "Remove"}
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <Volume2 className="w-3.5 h-3.5 text-muted-ink" />
                  <input type="range" min="0" max="1" step="0.05" value={project.music_volume ?? 0.3} onChange={(e) => updateMusicVolume(parseFloat(e.target.value))} className="flex-1 h-1" />
                  <span className="text-[10px] text-muted-ink w-6">{Math.round((project.music_volume ?? 0.3) * 100)}%</span>
                </div>
              </>
            ) : (
              <>
                <button onClick={() => document.getElementById("music-upload").click()} disabled={musicBusy} className="text-xs text-ink hover:text-white bg-bg border border-line rounded py-2 transition-colors disabled:opacity-50">
                  {musicBusy ? "Uploading…" : "Upload Music (.mp3)"}
                </button>
                <input id="music-upload" type="file" accept="audio/*" className="hidden" onChange={(e) => { if (e.target.files[0]) uploadMusic(e.target.files[0]); e.target.value = ''; }} />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
