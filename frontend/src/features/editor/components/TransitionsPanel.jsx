export function TransitionsPanel() {
  const transitions = [
    { id: "none", name: "None", icon: "None" },
    { id: "fade", name: "Fade in/out", icon: "Fade" },
    { id: "zoom", name: "Zoom in", icon: "Zoom" },
    { id: "slide", name: "Slide right", icon: "Slide" },
  ];
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-4 flex-1 overflow-y-auto space-y-4">
        <h3 className="text-sm font-medium mb-3">Transitions</h3>
        <div className="grid grid-cols-2 gap-2">
          {transitions.map(t => (
            <button key={t.id} disabled className="p-3 border border-line rounded-lg bg-bg-2/50 opacity-50 cursor-not-allowed flex flex-col items-center justify-center gap-2 transition-colors">
              <div className="w-12 h-8 bg-black rounded shadow-inner flex items-center justify-center text-[10px] text-muted-ink border border-line-2">
                {t.icon}
              </div>
              <span className="text-xs">{t.name}</span>
            </button>
          ))}
        </div>
        <p className="text-[10px] text-muted-ink text-center mt-4 px-2">
          Coming Soon
        </p>
      </div>
    </div>
  );
}
