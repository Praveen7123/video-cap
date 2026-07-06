import { useRef } from "react";
import { GripHorizontal, Minus, Square, PanelRight } from "lucide-react";

// A draggable, resizable, minimizable window — like CapCut's floating media
// browser. Header drag moves it; the corner handle resizes it.
export function FloatingWindow({ rect, onRectChange, minimized, onMinimizedChange, maximized, onMaximizedChange, onDock, title, children }) {
  const preMaximizeRect = useRef(rect);

  const startDrag = (e) => {
    if (maximized) return;
    e.preventDefault();
    const startX = e.clientX, startY = e.clientY;
    const { x: x0, y: y0 } = rect;
    const mv = (ev) => {
      const nx = Math.min(window.innerWidth - 60, Math.max(0, x0 + (ev.clientX - startX)));
      const ny = Math.min(window.innerHeight - 40, Math.max(0, y0 + (ev.clientY - startY)));
      onRectChange({ ...rect, x: nx, y: ny });
    };
    const up = () => { window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up); };
    window.addEventListener("mousemove", mv);
    window.addEventListener("mouseup", up);
  };

  const startResize = (e) => {
    if (maximized) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX, startY = e.clientY;
    const { w: w0, h: h0 } = rect;
    const mv = (ev) => {
      const nw = Math.min(window.innerWidth - rect.x - 8, Math.max(300, w0 + (ev.clientX - startX)));
      const nh = Math.min(window.innerHeight - rect.y - 8, Math.max(240, h0 + (ev.clientY - startY)));
      onRectChange({ ...rect, w: nw, h: nh });
    };
    const up = () => { window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up); };
    window.addEventListener("mousemove", mv);
    window.addEventListener("mouseup", up);
  };

  const toggleMaximize = () => {
    if (maximized) {
      onRectChange(preMaximizeRect.current);
      onMaximizedChange(false);
    } else {
      preMaximizeRect.current = rect;
      onMaximizedChange(true);
    }
  };

  const style = maximized
    ? { top: 64, left: 64, right: 24, bottom: 24, width: "auto", height: "auto" }
    : { top: rect.y, left: rect.x, width: rect.w, height: minimized ? "auto" : rect.h };

  return (
    <div
      className="fixed z-50 flex flex-col bg-card border border-line-2 rounded-xl shadow-2xl overflow-hidden"
      style={style}
      data-testid="floating-panel"
    >
      <div
        onMouseDown={startDrag}
        className="h-8 shrink-0 flex items-center gap-2 px-2 bg-bg-2 border-b border-line cursor-move select-none"
      >
        <GripHorizontal className="w-3.5 h-3.5 text-muted-ink shrink-0" />
        <span className="text-[11px] text-muted-ink flex-1 truncate">{title}</span>
        <button onMouseDown={(e) => e.stopPropagation()} onClick={() => onMinimizedChange(!minimized)} title="Minimize" className="w-5 h-5 rounded hover:bg-bg flex items-center justify-center text-muted-ink hover:text-ink">
          <Minus className="w-3 h-3" />
        </button>
        <button onMouseDown={(e) => e.stopPropagation()} onClick={toggleMaximize} title={maximized ? "Restore" : "Maximize"} className="w-5 h-5 rounded hover:bg-bg flex items-center justify-center text-muted-ink hover:text-ink">
          <Square className="w-3 h-3" />
        </button>
        <button onMouseDown={(e) => e.stopPropagation()} onClick={onDock} title="Dock back to sidebar" className="w-5 h-5 rounded hover:bg-bg flex items-center justify-center text-muted-ink hover:text-ink">
          <PanelRight className="w-3 h-3" />
        </button>
      </div>

      {!minimized && (
        <div className="flex-1 min-h-0 relative">
          {children}
          <div
            onMouseDown={startResize}
            title="Resize"
            className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
            style={{ background: "linear-gradient(135deg, transparent 50%, rgba(255,255,255,.25) 50%)" }}
          />
        </div>
      )}
    </div>
  );
}
