import { useState, useEffect } from "react";
import { LayoutGrid } from "lucide-react";

export function TranscriptRow({ idx, caption, active, onChange, onJump }) {
  const [text, setText] = useState(caption.text);
  useEffect(() => { setText(caption.text); }, [caption.text]);
  const commit = () => { if (text !== caption.text) onChange(text); };
  return (
    <div
      data-testid={`transcript-row-${idx}`}
      className={`group flex items-start gap-2 px-2 py-2 rounded-lg cursor-pointer transition-colors ${active ? "bg-bg-2" : "hover:bg-bg-2/50"
        }`}
    >
      <button onClick={onJump} className="text-[10px] text-muted-ink w-6 text-right pt-1 shrink-0 hover:text-ink" data-testid={`jump-${idx}`}>
        {idx + 1}
      </button>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") { e.currentTarget.blur(); } }}
        data-testid={`transcript-input-${idx}`}
        className={`flex-1 bg-transparent text-sm outline-none py-1 rounded px-1 focus:bg-bg ${active ? "text-ink" : ""}`}
      />
      <LayoutGrid className="w-3 h-3 text-muted-ink opacity-0 group-hover:opacity-100 mt-1.5 shrink-0" />
    </div>
  );
}
