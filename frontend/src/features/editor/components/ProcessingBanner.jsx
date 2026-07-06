import { Loader2, AlertTriangle } from "lucide-react";
import { STAGE_LABELS } from "@/features/editor/constants";

export function ProcessingBanner({ project }) {
  const stage = project.status;

  if (stage === "failed") {
    return (
      <div className="mb-4 bg-red-950/30 border border-red-900/40 rounded-xl p-4 flex items-start gap-3" data-testid="render-error-banner">
        <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-red-300">This render failed</div>
          <div className="mt-1 text-xs text-red-300/80 break-words">
            {project.error || "An unexpected error occurred while processing this video."}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 bg-card border border-line rounded-xl p-4 flex items-center gap-4">
      <Loader2 className="w-5 h-5 animate-spin shrink-0" />
      <div className="flex-1">
        <div className="text-sm font-medium">{STAGE_LABELS[stage] || stage}</div>
        <div className="mt-1 h-1 bg-line rounded-full overflow-hidden">
          <div className="h-full bg-white transition-all" style={{ width: `${project.progress || 0}%` }} />
        </div>
      </div>
      <div className="text-xs text-muted-ink" data-testid="banner-progress">{project.progress || 0}%</div>
    </div>
  );
}
