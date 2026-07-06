import { Loader2, Languages, AlertTriangle } from "lucide-react";

// Read-only view of the English translation (Whisper's built-in translate
// mode) — deliberately not editable and not merged into the main transcript,
// so translating never risks corrupting the live caption-editing state
// (undo/redo, dirty tracking, etc. all stay scoped to the original captions).
export function TranslationPanel({ captionsEn, status, onTranslate, busy }) {
  if (status === "translating") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-ink" />
        <div className="text-sm text-muted-ink">Translating to English…</div>
      </div>
    );
  }

  if (status === "done" && captionsEn?.length > 0) {
    return (
      <div className="flex-1 overflow-y-auto p-2" data-testid="translation-list">
        {captionsEn.map((c, i) => (
          <div key={i} className="px-2 py-2 text-sm text-ink border-b border-line/50 last:border-0">
            {c.text}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
      {status === "failed" && (
        <div className="flex items-center gap-2 text-xs text-red-400" data-testid="translation-error">
          <AlertTriangle className="w-4 h-4" />
          Translation failed or found nothing to translate.
        </div>
      )}
      <div className="text-xs text-muted-ink max-w-[220px]">
        Generate an English translation of this video's captions. This is a
        read-only preview — it won't change your editable transcript.
      </div>
      <button
        onClick={onTranslate}
        disabled={busy}
        data-testid="translate-btn"
        className="inline-flex items-center gap-1.5 text-xs bg-white text-black hover:bg-hilite disabled:opacity-40 disabled:cursor-not-allowed rounded-lg px-4 py-2 font-medium transition-colors"
      >
        <Languages className="w-3.5 h-3.5" /> Translate to English
      </button>
    </div>
  );
}
