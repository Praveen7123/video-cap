import { Sparkles, Loader2, Volume2, Activity, Zap } from "lucide-react";

export function AIAudioPanel({ cleaningAudio, onCleanAudio }) {
  return (
    <div className="flex-1 flex flex-col relative h-full bg-card">
      <div className="p-6 flex-1 overflow-y-auto flex flex-col items-center justify-start pt-10">

        <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-editor-success/20 bg-editor-success/5 text-editor-success text-[11px] font-medium mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          AI-Powered
        </div>

        <h2 className="text-xl font-bold mb-6 text-white text-center">Audio Enhancement</h2>

        <p className="text-sm text-editor-muted text-center max-w-[280px] leading-relaxed mb-4">
          Clean up your audio, Remove Background Noise, and enhance speech in one single click.
        </p>

        <button onClick={onCleanAudio} disabled={cleaningAudio} className="bg-editor-cta hover:bg-editor-cta-hover text-white px-8 py-3 rounded-lg font-medium text-sm flex items-center gap-3 transition-colors mb-8 shadow-lg shadow-editor-cta/10 disabled:opacity-50">
          {cleaningAudio ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
          {cleaningAudio ? "Cleaning..." : "Clean Audio"}
          {!cleaningAudio && <Activity className="w-4 h-4" />}
        </button>

        <div className="flex flex-wrap justify-center gap-x-6 gap-y-4 max-w-[300px]">
          <div className="flex items-center gap-2 text-sm text-editor-muted">
            <div className="w-1.5 h-1.5 rounded-full bg-editor-cta" /> Noise Reduction
          </div>
          <div className="flex items-center gap-2 text-sm text-editor-muted">
            <div className="w-1.5 h-1.5 rounded-full bg-editor-cta" /> Voice Enhancement
          </div>
          <div className="flex items-center gap-2 text-sm text-editor-muted w-full justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-editor-cta" /> Real-time Processing
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-line mt-auto bg-card-2">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-editor-well border border-line flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5 text-editor-accent" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-white mb-0.5">Remaining Credits</span>
            <div className="flex items-center gap-2">
              <span className="bg-editor-well border border-line text-editor-muted text-xs px-2.5 py-0.5 rounded-full font-medium">3</span>
              <span className="text-xs text-editor-muted">credits available</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
