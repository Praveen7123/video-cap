import { useState, useEffect } from "react";
import { Lock, Eye, EyeOff, Volume2, VolumeX, MoreHorizontal } from "lucide-react";

export function TrackHead({ icon: Icon, name, cls, state, onToggle, menu }) {
  const { locked, hidden, muted } = state;
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btn = (active) => `flex items-center justify-center w-4 h-4 rounded ${active ? "text-ink" : "text-muted-ink/60"} hover:text-ink`;
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [open]);
  return (
    <div className={`flex items-center gap-1 px-2 border-b border-line/50 ${cls}`}>
      <Icon className="w-3.5 h-3.5 text-muted-ink shrink-0" />
      <span className="text-[10px] text-ink truncate flex-1">{name}</span>
      <button type="button" title="Lock" aria-label="Lock track" aria-pressed={locked} onClick={() => onToggle("locked")} className={btn(locked)}><Lock className="w-3 h-3" /></button>
      <button type="button" title="Hide" aria-label="Hide track" aria-pressed={hidden} onClick={() => onToggle("hidden")} className={btn(hidden)}>{hidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}</button>
      <button type="button" title="Mute" aria-label="Mute track" aria-pressed={muted} onClick={() => onToggle("muted")} className={btn(muted)}>{muted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}</button>
      {menu && menu.length > 0 ? (
        <button
          type="button"
          aria-label="More track options"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={(e) => {
            e.stopPropagation();
            const r = e.currentTarget.getBoundingClientRect();
            const h = menu.length * 30 + 10;
            const openUp = r.bottom + h > window.innerHeight - 8;
            const top = openUp ? Math.max(8, r.top - h) : r.bottom + 4;
            const left = Math.min(window.innerWidth - 150, Math.max(8, r.right - 140));
            setPos({ top, left });
            setOpen((o) => !o);
          }}
          className="text-muted-ink/60 hover:text-ink"
        ><MoreHorizontal className="w-3 h-3" /></button>
      ) : <span className="w-3" />}
      {open && menu && (
        <div role="menu" style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 60, minWidth: 140 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-card border border-line rounded-md shadow-2xl py-1 text-[11px]">
          {menu.map((m, i) => (
            <button key={i} type="button" role="menuitem" onClick={() => { m.onClick?.(); setOpen(false); }} className="block w-full text-left px-3 py-1.5 hover:bg-bg-2 text-ink">{m.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}
