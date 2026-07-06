import { Link } from "react-router-dom";
import { ArrowRight, Check, Play, Sparkles, Scissors, Type } from "lucide-react";

const features = [
  { icon: Scissors, title: "Auto-cut dead air", body: "Silence longer than 0.6s vanishes. Filler words trimmed." },
  { icon: Type, title: "Premium captions", body: "Whisper-accurate transcripts. Style presets one click away." },
  { icon: Sparkles, title: "Made for shorts", body: "1080p to 4K. Vertical or widescreen. Ship in seconds." },
];

const plans = [
  { name: "Free",    price: "₹0",     features: ["30 min / mo", "1080p exports", "Watermark"] },
  { name: "Editor",  price: "₹670",   features: ["5 hrs / mo", "1080p / 30fps", "No watermark"] },
  { name: "Creator", price: "₹950",   features: ["15 hrs / mo", "1080p + 4K", "Priority queue"], featured: true },
  { name: "Studio",  price: "₹2400",  features: ["50 hrs / mo", "4K / 60fps", "Green-screen"] },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-bg text-ink">
      {/* Header */}
      <header className="border-b border-line">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2" data-testid="brand-link">
            <span className="w-8 h-8 rounded-lg bg-white text-black flex items-center justify-center font-bold">K</span>
            <span className="font-semibold text-lg">Kalakar</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm text-muted-ink">
            <a href="#features" className="hover:text-ink" data-testid="nav-features">Features</a>
            <a href="#pricing" className="hover:text-ink" data-testid="nav-pricing">Pricing</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/login" data-testid="header-login" className="text-sm text-muted-ink hover:text-ink">Sign in</Link>
            <Link to="/register" data-testid="header-register" className="text-sm bg-white text-black rounded-lg px-4 py-2 hover:bg-hilite">Start free</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 py-24 md:py-32 text-center">
        <div className="inline-flex items-center gap-2 text-xs text-muted-ink border border-line rounded-full px-3 py-1 mb-8">
          <Sparkles className="w-3 h-3" /> Whisper-accurate captions · Auto-cut · One-click templates
        </div>
        <h1 className="text-5xl md:text-7xl font-semibold tracking-tight leading-[1.05]">
          Cut faster.<br /><span className="text-muted-ink">Ship sooner.</span>
        </h1>
        <p className="mt-6 text-base md:text-lg text-muted-ink max-w-xl mx-auto">
          Kalakar transcribes your video, cuts the dead air, and burns in premium animated captions — no timeline required.
        </p>
        <div className="mt-10 flex items-center justify-center gap-3">
          <Link to="/register" data-testid="hero-cta-primary" className="inline-flex items-center gap-2 bg-white text-black px-5 py-3 rounded-lg text-sm font-medium hover:bg-hilite transition-colors">
            Start editing free <ArrowRight className="w-4 h-4" />
          </Link>
          <a href="#features" data-testid="hero-cta-secondary" className="inline-flex items-center gap-2 border border-line px-5 py-3 rounded-lg text-sm hover:bg-card transition-colors">
            <Play className="w-3 h-3 fill-current" /> Watch demo
          </a>
        </div>

        {/* Editor preview mock */}
        <div className="mt-16 mx-auto max-w-4xl bg-card border border-line rounded-2xl overflow-hidden shadow-2xl">
          <div className="flex items-center gap-1.5 px-4 py-3 border-b border-line">
            <span className="w-2 h-2 rounded-full bg-line-2" />
            <span className="w-2 h-2 rounded-full bg-line-2" />
            <span className="w-2 h-2 rounded-full bg-line-2" />
            <span className="ml-3 text-xs text-muted-ink font-mono">kalakar.app/projects/my-video</span>
          </div>
          <div className="grid grid-cols-3 gap-3 p-4">
            <div className="col-span-1 space-y-2">
              {["Hey creators", "Welcome to Kalakar", "This tool auto-cuts", "and adds captions"].map((t, i) => (
                <div key={i} className={`text-xs px-2 py-2 rounded ${i === 1 ? "bg-bg-2 border border-line-2" : "text-muted-ink"}`}>
                  <span className="text-muted-ink-2 mr-2">{i+1}</span>{t}
                </div>
              ))}
            </div>
            <div className="col-span-2 relative aspect-video bg-black rounded-lg flex items-center justify-center">
              <div className="text-white text-xl md:text-2xl font-bold" style={{ textShadow: "0 2px 8px rgba(0,0,0,0.9)" }}>
                Welcome to Kalakar
              </div>
              <div className="absolute top-2 right-2 text-[10px] tracking-widest uppercase text-white/60 bg-black/60 px-2 py-1 rounded">1080P</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-20 border-t border-line">
        <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">Everything a creator needs.</h2>
        <p className="mt-3 text-sm text-muted-ink">Three tools. One flow. Zero timelines.</p>
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <div key={i} className="bg-card border border-line rounded-xl p-6" data-testid={`feature-${i}`}>
                <div className="w-10 h-10 rounded-lg bg-bg-2 border border-line flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="mt-5 text-base font-medium">{f.title}</div>
                <div className="mt-2 text-sm text-muted-ink">{f.body}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="max-w-6xl mx-auto px-6 py-20 border-t border-line">
        <div className="flex items-end justify-between mb-12">
          <div>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">Pricing</h2>
            <p className="mt-3 text-sm text-muted-ink">Pay for what you ship. Cancel anytime.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((p) => (
            <div key={p.name} data-testid={`pricing-card-${p.name.toLowerCase()}`} className={`rounded-xl p-6 border flex flex-col ${p.featured ? "bg-white text-black border-white" : "bg-card border-line"}`}>
              {p.featured && <div className="text-[10px] tracking-widest uppercase font-semibold mb-3">Most Popular</div>}
              <div className={`text-sm font-medium ${p.featured ? "text-black" : "text-muted-ink"}`}>{p.name}</div>
              <div className="mt-3 text-4xl font-semibold">{p.price}<span className={`text-xs ml-1 ${p.featured ? "text-black/60" : "text-muted-ink"}`}>/mo</span></div>
              <ul className={`mt-6 space-y-2 flex-1 text-sm ${p.featured ? "text-black" : "text-ink"}`}>
                {p.features.map(f => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className={`w-4 h-4 mt-0.5 shrink-0 ${p.featured ? "text-black" : "text-hilite"}`} />
                    {f}
                  </li>
                ))}
              </ul>
              <Link to="/register" data-testid={`pricing-cta-${p.name.toLowerCase()}`} className={`mt-8 inline-flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-medium ${p.featured ? "bg-black text-white hover:bg-neutral-800" : "bg-white text-black hover:bg-hilite"} transition-colors`}>
                Get started <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-line mt-20">
        <div className="max-w-6xl mx-auto px-6 py-10 text-xs text-muted-ink flex items-center justify-between">
          <div>© 2026 Kalakar Labs · Made for creators</div>
          <div>hi@kalakar.app</div>
        </div>
      </footer>
    </div>
  );
}
