import { useEffect, useState } from "react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { AppShell } from "@/components/Layout";
import { useAuth } from "@/context/AuthContext";
import { Puzzle, CheckCircle2, Settings2, ChevronDown } from "lucide-react";
import { toast } from "sonner";

const STYLE_OPTIONS = [
  { id: "bold-pop", label: "Bold Pop" },
  { id: "karaoke", label: "Karaoke" },
  { id: "minimal-clean", label: "Minimal Clean" },
  { id: "bounce-in", label: "Bounce In" },
];
const FONT_OPTIONS = [
  "DejaVu Sans", "Arial", "Helvetica", "Poppins", "Roboto", "Inter",
  "Montserrat", "Open Sans", "Lato", "Oswald", "Playfair Display",
];
const COLOR_SWATCHES = [
  "#FFFFFF", "#FFE500", "#00E5FF", "#FF007F", "#FF3333", "#00FF00",
  "#FFB6C1", "#FFFDD0", "#000000", "#3B82F6", "#F97316", "#A855F7",
];

export default function Plugins() {
  const [projects, setProjects] = useState([]);
  const [brandKitOpen, setBrandKitOpen] = useState(false);

  useEffect(() => {
    api.get("/projects").then(({ data }) => setProjects(data)).catch(() => { });
  }, []);

  const { user } = useAuth();

  const plugins = [
    { id: "brand-kit", name: "Brand Kit Sync", desc: "Auto-sync your color palettes and fonts across all new projects.", installed: !!user?.brand_kit_enabled, real: true },
    { id: "frameio", name: "Frame.io Integration", desc: "Send drafts to Frame.io directly from the Kalakar export menu.", installed: false, real: false },
    { id: "stock-media", name: "Stock Media Library", desc: "Search and import B-roll from Pexels and Unsplash instantly.", installed: false, real: false },
    { id: "analytics", name: "Advanced Analytics", desc: "Track average watch time and engagement for published reels.", installed: false, real: false },
  ];

  return (
    <AppShell projects={projects}>
      <main className="px-6 md:px-10 py-8 max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-500">
        <h1 className="text-2xl font-semibold tracking-tight">Manage Plugins</h1>
        <p className="mt-1 text-sm text-muted-ink mb-8">Extend Kalakar with third-party integrations and tools.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {plugins.map((p) => (
            <div key={p.id} className="bg-card border border-line rounded-xl p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-[#161616] border border-[#27272a] flex items-center justify-center shrink-0">
                <Puzzle className="w-5 h-5 text-muted-ink" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white mb-1">{p.name}</div>
                <div className="text-xs text-muted-ink leading-relaxed h-[36px] overflow-hidden text-ellipsis line-clamp-2">{p.desc}</div>
                <div className="mt-4 flex items-center gap-2">
                  {p.real ? (
                    <button
                      onClick={() => setBrandKitOpen(true)}
                      data-testid={`configure-${p.id}`}
                      className={`text-[11px] flex items-center gap-1.5 font-medium px-3 py-1.5 rounded-md border transition-colors ${p.installed ? "text-green-400 bg-green-400/10 border-green-400/20 hover:bg-green-400/20" : "text-black bg-white border-transparent hover:bg-gray-200"}`}
                    >
                      {p.installed ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Settings2 className="w-3.5 h-3.5" />}
                      {p.installed ? "Installed — Configure" : "Set up"}
                    </button>
                  ) : (
                    <span className="text-[11px] text-muted-ink font-medium px-3 py-1.5 bg-bg-2 rounded-md border border-line">
                      Coming soon
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {brandKitOpen && <BrandKitModal onClose={() => setBrandKitOpen(false)} />}
    </AppShell>
  );
}

function Toggle({ on, onChange }) {
  return (
    <div
      onClick={onChange}
      className={`w-9 h-5 rounded-full flex items-center px-0.5 cursor-pointer transition-colors shrink-0 ${on ? "bg-white" : "bg-bg-2 border border-line"}`}
    >
      <div className={`w-4 h-4 rounded-full bg-black transition-transform ${on ? "translate-x-4" : "translate-x-0 !bg-muted-ink"}`} />
    </div>
  );
}

function Dropdown({ value, options, onChange, render }) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value) || options[0];
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between bg-bg-2 border border-line rounded-lg px-3 py-2 text-sm hover:border-line-2 transition-colors"
      >
        <span className="truncate">{render ? render(current) : current.label}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-muted-ink shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-line rounded-lg shadow-2xl z-50 max-h-52 overflow-y-auto py-1">
            {options.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false); }}
                className={`block w-full text-left px-3 py-2 text-sm transition-colors ${o.value === value ? "bg-bg-2 text-ink" : "text-muted-ink hover:bg-bg-2 hover:text-ink"}`}
                style={o.style}
              >
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ColorPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        data-testid="color-swatch-trigger"
        className="w-9 h-9 rounded-md border border-line shrink-0"
        style={{ background: /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000" }}
      />
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 bg-card border border-line rounded-lg shadow-2xl z-50 p-3 w-48">
            <div className="grid grid-cols-6 gap-2">
              {COLOR_SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => { onChange(c); setOpen(false); }}
                  title={c}
                  className={`w-6 h-6 rounded-md border transition-transform hover:scale-110 ${value.toUpperCase() === c ? "border-white ring-2 ring-white/50" : "border-line"}`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function BrandKitModal({ onClose }) {
  const { user, setUser } = useAuth();
  const [enabled, setEnabled] = useState(!!user?.brand_kit_enabled);
  const [style, setStyle] = useState(user?.brand_subtitle_style || "bold-pop");
  const [color, setColor] = useState(user?.brand_accent_color || "#FFFFFF");
  const [font, setFont] = useState(user?.brand_font || "DejaVu Sans");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await api.patch("/account/brand-kit", {
        enabled, subtitle_style: style, accent_color: color, font,
      });
      setUser(data);
      toast.success(enabled ? "Brand Kit enabled" : "Brand Kit disabled");
      onClose();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm bg-card border border-line rounded-2xl p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-1">Brand Kit Sync</h3>
        <p className="text-xs text-muted-ink mb-5">Every new upload will automatically use this caption style.</p>

        <div className="flex items-center justify-between mb-5">
          <span className="text-sm font-medium">Auto-apply to new uploads</span>
          <div data-testid="brand-kit-toggle">
            <Toggle on={enabled} onChange={() => setEnabled((v) => !v)} />
          </div>
        </div>

        <label className="text-xs text-muted-ink block mb-1.5">Caption style</label>
        <div className="mb-4">
          <Dropdown
            value={style}
            onChange={setStyle}
            options={STYLE_OPTIONS.map((s) => ({ value: s.id, label: s.label }))}
          />
        </div>

        <label className="text-xs text-muted-ink block mb-1.5">Accent color</label>
        <div className="flex items-center gap-2 mb-4">
          <ColorPicker value={color} onChange={setColor} />
          <input
            value={color}
            onChange={(e) => setColor(e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`)}
            className="flex-1 bg-bg-2 border border-line rounded-lg px-3 py-2 text-sm outline-none uppercase"
          />
        </div>

        <label className="text-xs text-muted-ink block mb-1.5">Font</label>
        <div className="mb-6">
          <Dropdown
            value={font}
            onChange={setFont}
            options={FONT_OPTIONS.map((f) => ({ value: f, label: f, style: { fontFamily: f } }))}
            render={(o) => <span style={o.style}>{o.label}</span>}
          />
        </div>

        <div className="flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-muted-ink hover:text-ink hover:bg-bg-2 transition-colors">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            data-testid="brand-kit-save"
            className="px-4 py-2 rounded-lg text-sm font-medium bg-white text-black hover:bg-hilite disabled:opacity-40 transition-colors"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
