import { Info } from "lucide-react";

// Shown when the backend couldn't detect any speech in the video and fell
// back to synthesized placeholder captions (see captions_source in the
// project doc) — otherwise a user would ship a video with made-up caption
// text without realizing it isn't a real transcript.
export function PlaceholderCaptionsBanner() {
  return (
    <div className="mb-4 bg-amber-950/30 border border-amber-900/40 rounded-xl p-4 flex items-start gap-3" data-testid="placeholder-captions-banner">
      <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-amber-300">Captions are placeholder text</div>
        <div className="mt-1 text-xs text-amber-300/80">
          We couldn't detect any speech in this video, so these captions were generated as a placeholder. Edit them manually in the Transcript panel before exporting.
        </div>
      </div>
    </div>
  );
}
