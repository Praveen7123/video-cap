import { useState, useEffect, useRef, startTransition } from "react";
import {
  ChevronDown, RotateCcw, ChevronsUpDown, Bold, Italic, Underline,
  AlignLeft, AlignCenter, AlignRight, Plus,
} from "lucide-react";
import { FONT_OPTIONS } from "@/features/editor/constants";

export function TextPanel({ project, textStyle, onTextStyleChange, onProjectStyleChange, onAddText }) {
  const ts = textStyle || {};
  const set = (patch) => onTextStyleChange?.(patch);
  const [openSection, setOpenSection] = useState({ fonts: true, format: true, position: true, color: true, spacing: false, effects: true });
  const toggle = (sec) => setOpenSection(p => ({ ...p, [sec]: !p[sec] }));
  const [fontOpen, setFontOpen] = useState(false);
  const currentFont = project?.font || "DejaVu Sans";
  const accentColor = project?.accent_color || "#FFFFFF";

  const Section = ({ id, title, children }) => (
    <div className="border-b border-line pb-5 mb-5 last:border-0 last:mb-0 last:pb-0">
      <button onClick={() => toggle(id)} className="flex items-center gap-2 text-xs font-bold tracking-widest text-editor-muted hover:text-white w-full mb-4 uppercase">
        <ChevronDown className={`w-4 h-4 transition-transform ${!openSection[id] ? "-rotate-90" : ""}`} /> {title}
      </button>
      {openSection[id] && <div className="space-y-5 px-1">{children}</div>}
    </div>
  );

  const ControlRow = ({ label, children, hasReset = true }) => (
    <div className="flex items-center gap-4">
      {label && <span className="text-sm text-editor-muted w-[92px] shrink-0 font-medium">{label}</span>}
      <div className="flex-1 flex items-center gap-2.5 min-w-0">
        {children}
      </div>
      {hasReset && (
        <button className="w-7 h-7 rounded bg-bg-2 hover:bg-line border border-transparent flex items-center justify-center text-editor-muted shrink-0 transition-colors">
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );

  const Toggle = ({ on, onChange, label }) => (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange?.(!on)}
      className={`w-8 h-4 rounded-full flex items-center p-0.5 cursor-pointer transition-colors ${on ? "bg-editor-success justify-end" : "bg-editor-well"}`}
    >
      <div className={`w-3 h-3 rounded-full transition-colors ${on ? "bg-black" : "bg-editor-muted"}`} />
    </button>
  );

  const StyleBtn = ({ active, onClick, children }) => (
    <button onClick={onClick} className={`w-9 h-9 flex items-center justify-center rounded-md transition-colors ${active ? "text-white bg-editor-border" : "text-editor-muted hover:text-white"}`}>
      {children}
    </button>
  );

  const SmoothSlider = ({ min, max, value, onChange, step = 1, ...props }) => {
    const [localVal, setLocalVal] = useState(value);
    const pendingRef = useRef(false);

    useEffect(() => { setLocalVal(value); }, [value]);
    return (
      <input
        type="range"
        min={min} max={max} step={step}
        value={localVal}
        onChange={e => {
          const val = e.target.value;
          setLocalVal(val);
          if (!pendingRef.current) {
            pendingRef.current = true;
            setTimeout(() => {
              startTransition(() => onChange(Number(val)));
              pendingRef.current = false;
            }, 50);
          }
        }}
        onPointerUp={e => onChange(Number(e.target.value))}
        onKeyUp={e => onChange(Number(e.target.value))}
        {...props}
      />
    );
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-bg relative">
      <div className="p-4 pb-20 flex-1 overflow-y-auto no-scrollbar space-y-2">
        <Section id="fonts" title="Fonts">
          <ControlRow label="Font Family">
            <div className="flex-1 relative">
              <button
                type="button"
                onClick={() => setFontOpen(o => !o)}
                onKeyDown={(e) => { if (e.key === "Escape") setFontOpen(false); }}
                aria-haspopup="listbox"
                aria-expanded={fontOpen}
                className="w-full flex-1 bg-card border border-editor-border rounded-md flex items-center px-2 py-1.5 cursor-pointer"
              >
                <span className="text-xs font-semibold flex-1 text-left text-white">{currentFont}</span>
                <ChevronsUpDown className="w-3.5 h-3.5 text-editor-muted" />
              </button>
              {fontOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setFontOpen(false)} />
                  <div role="listbox" aria-label="Font family" className="absolute top-full left-0 right-0 mt-1 bg-card border border-editor-border rounded-md shadow-xl z-20 max-h-[180px] overflow-y-auto">
                    {FONT_OPTIONS.map(f => (
                      <button key={f} role="option" aria-selected={f === currentFont} onClick={() => { onProjectStyleChange?.({ font: f }); setFontOpen(false); }}
                        className={`block w-full text-left px-3 py-1.5 text-xs hover:bg-editor-border ${f === currentFont ? "text-editor-success font-semibold" : "text-white"}`}
                        style={{ fontFamily: f }}>
                        {f}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </ControlRow>
          <ControlRow label="Size" hasReset={true}>
            <div className="flex-1 flex items-center gap-2">
              <SmoothSlider min="12" max="72" className="flex-1 h-1 accent-white" value={ts.fontSize || 32}
                onChange={v => set({ fontSize: v })} />
              <div className="w-[60px] flex items-center bg-card border border-editor-accent rounded-md px-1.5 py-1">
                <input className="w-full bg-transparent text-xs text-center outline-none text-white font-medium"
                  value={ts.fontSize || 32}
                  onChange={e => { const v = parseInt(e.target.value) || 12; set({ fontSize: Math.max(12, Math.min(72, v)) }); }} />
                <span className="text-[10px] text-editor-muted">px</span>
              </div>
            </div>
          </ControlRow>
        </Section>

        <Section id="format" title="Format">
          <ControlRow label="Styles" hasReset={false}>
            <div className="flex items-center bg-card rounded-md border border-editor-border divide-x divide-editor-border">
              <StyleBtn active={ts.bold !== false} onClick={() => set({ bold: ts.bold === false })}><Bold className="w-4 h-4" /></StyleBtn>
              <StyleBtn active={ts.italic} onClick={() => set({ italic: !ts.italic })}><Italic className="w-4 h-4" /></StyleBtn>
              <StyleBtn active={ts.underline} onClick={() => set({ underline: !ts.underline })}><Underline className="w-4 h-4" /></StyleBtn>
            </div>
          </ControlRow>
          <ControlRow label="Alignment" hasReset={false}>
            <div className="flex items-center bg-card rounded-md border border-editor-border divide-x divide-editor-border ml-auto">
              <StyleBtn active={ts.align === "left"} onClick={() => set({ align: "left" })}><AlignLeft className="w-4 h-4" /></StyleBtn>
              <StyleBtn active={!ts.align || ts.align === "center"} onClick={() => set({ align: "center" })}><AlignCenter className="w-4 h-4" /></StyleBtn>
              <StyleBtn active={ts.align === "right"} onClick={() => set({ align: "right" })}><AlignRight className="w-4 h-4" /></StyleBtn>
            </div>
          </ControlRow>
        </Section>

        <Section id="position" title="Position">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-editor-muted shrink-0 font-medium w-4">X</span>
              <SmoothSlider min="0" max="100" className="flex-1 h-1 accent-editor-accent" value={ts.posX ?? 50}
                onChange={v => set({ posX: v })} />
              <div className="w-[52px] flex items-center bg-card border border-editor-accent rounded-md px-1.5 py-1">
                <input className="w-full bg-transparent text-xs text-right outline-none text-white font-medium"
                  value={ts.posX ?? 50}
                  onChange={e => set({ posX: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} />
                <span className="text-[10px] text-editor-muted ml-0.5">%</span>
              </div>
              <button onClick={() => set({ posX: 50 })} className="w-5 h-5 rounded bg-bg-2 flex items-center justify-center text-editor-muted hover:text-white shrink-0"><RotateCcw className="w-2.5 h-2.5" /></button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-editor-muted shrink-0 font-medium w-4">Y</span>
              <SmoothSlider min="0" max="100" className="flex-1 h-1 accent-editor-accent" value={ts.posY ?? 90}
                onChange={v => set({ posY: v })} />
              <div className="w-[52px] flex items-center bg-card border border-editor-accent rounded-md px-1.5 py-1">
                <input className="w-full bg-transparent text-xs text-right outline-none text-white font-medium"
                  value={ts.posY ?? 90}
                  onChange={e => set({ posY: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} />
                <span className="text-[10px] text-editor-muted ml-0.5">%</span>
              </div>
              <button onClick={() => set({ posY: 90 })} className="w-5 h-5 rounded bg-bg-2 flex items-center justify-center text-editor-muted hover:text-white shrink-0"><RotateCcw className="w-2.5 h-2.5" /></button>
            </div>
          </div>
        </Section>

        <Section id="color" title="Color">
          <ControlRow label="Color">
            <div className="flex-1 flex items-center gap-2 bg-card border border-editor-border rounded-md px-2 py-1.5">
              <input type="color" value={accentColor} onChange={e => onProjectStyleChange?.({ accent_color: e.target.value })}
                className="w-5 h-5 rounded border border-editor-input-border cursor-pointer bg-transparent p-0" />
              <span className="text-xs font-mono text-editor-muted">#</span>
              <input className="flex-1 bg-transparent text-xs outline-none text-white font-medium uppercase"
                value={accentColor.replace("#", "")}
                onChange={e => { const v = e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6); onProjectStyleChange?.({ accent_color: `#${v}` }); }}
                maxLength={6} />
            </div>
          </ControlRow>
        </Section>

        <Section id="spacing" title="Spacing">
          <ControlRow label="Letter">
            <div className="flex-1 flex items-center gap-2">
              <SmoothSlider min="-5" max="20" step="0.5" className="flex-1 h-1 accent-editor-accent" value={ts.letterSpacing || 0}
                onChange={v => set({ letterSpacing: v })} />
              <div className="w-[48px] flex items-center bg-card border border-editor-accent rounded-md px-1.5 py-1">
                <input className="w-full bg-transparent text-xs text-center outline-none text-editor-accent font-medium"
                  value={ts.letterSpacing || 0}
                  onChange={e => set({ letterSpacing: Number(e.target.value) || 0 })} />
              </div>
            </div>
          </ControlRow>
          <ControlRow label="Line">
            <div className="flex-1 flex items-center gap-2">
              <input type="range" min="0.5" max="3" step="0.1" className="flex-1 h-1 accent-editor-accent" value={ts.lineHeight || 1.1}
                onChange={e => set({ lineHeight: Number(e.target.value) })} />
              <div className="w-[48px] flex items-center bg-card border border-editor-accent rounded-md px-1.5 py-1">
                <input className="w-full bg-transparent text-xs text-center outline-none text-editor-accent font-medium"
                  value={(ts.lineHeight || 1.1).toFixed(1)}
                  onChange={e => set({ lineHeight: Number(e.target.value) || 1.1 })} />
              </div>
            </div>
          </ControlRow>
        </Section>

        <Section id="effects" title="Effects">
          <div className="space-y-4 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-editor-muted font-medium">Drop Shadow</span>
              <Toggle label="Drop Shadow" on={ts.dropShadow !== false} onChange={v => set({ dropShadow: v })} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-editor-muted font-medium">Text Stroke</span>
              <Toggle label="Text Stroke" on={ts.textStroke !== false} onChange={v => set({ textStroke: v })} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-editor-muted font-medium">Background</span>
              <Toggle label="Background" on={ts.background} onChange={v => set({ background: v })} />
            </div>

            {ts.background && (
              <div className="pl-1 space-y-4 border-l-2 border-editor-border ml-1">
                <ControlRow label="BG Color">
                  <div className="flex-1 flex items-center gap-2 bg-card border border-editor-border rounded-md px-2 py-1.5">
                    <input type="color" value={ts.bgColor || "#000000"} onChange={e => set({ bgColor: e.target.value })}
                      className="w-4 h-4 rounded border border-editor-input-border cursor-pointer bg-transparent p-0" />
                    <input className="flex-1 bg-transparent text-xs outline-none text-white font-medium uppercase"
                      value={(ts.bgColor || "#000000").replace("#", "")}
                      onChange={e => { const v = e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6); set({ bgColor: `#${v}` }); }}
                      maxLength={6} />
                    <div className="w-px h-3 bg-editor-border" />
                    <input className="bg-transparent text-xs outline-none w-8 text-right text-white font-medium"
                      value={ts.bgOpacity ?? 70}
                      onChange={e => set({ bgOpacity: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} />
                    <span className="text-[10px] text-editor-muted">%</span>
                  </div>
                </ControlRow>
                <ControlRow label="Radius">
                  <div className="flex-1 flex items-center gap-2">
                    <input type="range" min="0" max="50" className="flex-1 h-1 accent-editor-accent" value={ts.bgRadius || 8}
                      onChange={e => set({ bgRadius: Number(e.target.value) })} />
                    <div className="w-[48px] flex items-center bg-card border border-editor-accent rounded-md px-1.5 py-1">
                      <input className="w-full bg-transparent text-xs text-center outline-none text-editor-accent font-medium"
                        value={ts.bgRadius || 8}
                        onChange={e => set({ bgRadius: Number(e.target.value) || 0 })} />
                    </div>
                  </div>
                </ControlRow>
              </div>
            )}
          </div>
        </Section>
      </div>

      {/* Footer / Actions */}
      <div className="p-3 bg-card border-t border-editor-border absolute bottom-0 left-0 right-0 z-10 w-full flex items-center justify-between gap-2">
        <button onClick={onAddText} className="flex-1 bg-white hover:bg-gray-200 text-black text-xs font-bold py-2 rounded-md shadow-sm transition-colors flex items-center justify-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Add Text
        </button>
      </div>
      <style dangerouslySetInnerHTML={{
        __html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
  );
}
