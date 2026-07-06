import { useState } from "react";
import { Search } from "lucide-react";
import { TEMPLATES } from "@/features/editor/constants";

export function TemplatesPanel({ onPick, current }) {
  const [subtab, setSubtab] = useState("built-in");
  const [search, setSearch] = useState("");
  const filtered = TEMPLATES.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-3 border-b border-line flex items-center gap-1">
        <button
          onClick={() => setSubtab("built-in")}
          data-testid="tpl-tab-built-in"
          className={`text-xs px-3 py-1.5 rounded-md ${subtab === "built-in" ? "bg-bg-2 text-ink" : "text-muted-ink hover:text-ink"}`}
        >
          Built-in Templates
        </button>
        <button
          onClick={() => setSubtab("my")}
          data-testid="tpl-tab-my"
          className={`text-xs px-3 py-1.5 rounded-md ${subtab === "my" ? "bg-bg-2 text-ink" : "text-muted-ink hover:text-ink"}`}
        >
          My Presets
        </button>
      </div>

      <div className="p-3 border-b border-line flex items-center gap-2">
        <div className="flex-1 min-w-0 flex items-center gap-2 bg-bg-2 border border-line rounded-md px-2.5 py-1.5">
          <Search className="w-3 h-3 text-muted-ink shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find a template"
            data-testid="tpl-search"
            className="flex-1 min-w-0 bg-transparent text-xs outline-none placeholder:text-muted-ink"
          />
        </div>
        <button data-testid="save-preset-btn" className="shrink-0 text-xs border border-line rounded-md px-2.5 py-1.5 hover:bg-bg-2 whitespace-nowrap">
          Save preset
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {subtab === "my" ? (
          <div className="text-center text-xs text-muted-ink py-8">No custom presets yet.</div>
        ) : (
          filtered.map((tpl) => (
            <button
              key={tpl.id}
              onClick={() => onPick(tpl)}
              data-testid={`template-${tpl.id}`}
              className={`w-full text-left p-3 rounded-lg border transition-all ${current === tpl.style
                ? "bg-bg-2 border-line-2"
                : "bg-bg-2/50 border-transparent hover:border-line"
                }`}
            >
              <div className="aspect-[16/6] bg-black/80 rounded-md mb-2 flex items-center justify-center overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a1a] to-transparent opacity-50" />

                {/* Dynamically simulated preview layout based on style configuration */}
                <div className="relative flex items-center justify-center font-bold px-3 text-center" style={{ fontFamily: tpl.font }}>

                  {tpl.style === "karaoke" && (
                    <div className="flex gap-1.5 text-sm uppercase tracking-tight">
                      <span style={{ color: "#FFFFFF", textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}>The</span>
                      <span style={{ color: tpl.color, transform: "scale(1.1) translateY(-1px)", textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}>Template</span>
                    </div>
                  )}

                  {tpl.style === "bold-pop" && (
                    <div
                      className="text-sm uppercase tracking-tight"
                      style={{
                        color: tpl.color,
                        WebkitTextStroke: "1px #000",
                        paintOrder: "stroke fill",
                        textShadow: "0 2px 5px rgba(0,0,0,0.8)"
                      }}
                    >
                      {tpl.name}
                    </div>
                  )}

                  {tpl.style === "minimal-clean" && (
                    <div
                      className="text-xs bg-black/60 rounded px-2.5 py-1 backdrop-blur-sm"
                      style={{ color: tpl.color, fontWeight: 500 }}
                    >
                      {tpl.name}
                    </div>
                  )}

                  {tpl.style === "bounce-in" && (
                    <div
                      className="text-sm lowercase tracking-wide"
                      style={{
                        color: tpl.color,
                        textShadow: "0 0 8px rgba(0,0,0,0.6)",
                        transform: "rotate(-2deg)"
                      }}
                    >
                      {tpl.name}
                    </div>
                  )}

                  {/* Fallback */}
                  {["karaoke", "bold-pop", "minimal-clean", "bounce-in"].indexOf(tpl.style) === -1 && (
                    <span className="text-sm font-bold" style={{ color: tpl.color }}>{tpl.name}</span>
                  )}

                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">{tpl.name}</span>
                <div className="flex gap-1">
                  {tpl.tags.map(t => (
                    <span key={t} className="text-[9px] text-muted-ink border border-line rounded px-1.5 py-0.5">{t}</span>
                  ))}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
