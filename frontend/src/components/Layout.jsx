import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { API } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
  Home, Clock, GraduationCap, CreditCard, Puzzle, LifeBuoy,
  Search, Sparkles, ChevronDown, PanelLeft, LogOut, User
} from "lucide-react";

const NAV = [
  { to: "/dashboard", icon: Home, label: "Home", testId: "nav-home" },
  { to: "/tutorials", icon: GraduationCap, label: "Tutorials", testId: "nav-tutorials" },
  { to: "/billing", icon: CreditCard, label: "Manage Subscription", testId: "nav-billing" },
  { to: "/plugins", icon: Puzzle, label: "Manage Plugins", testId: "nav-plugins" },
  { to: "/help", icon: LifeBuoy, label: "Help & Support", testId: "nav-help" },
];

const PLAN_MINUTES = { free: 30, editor: 300, creator: 900, studio: 3000 };
const AUDIO_CLEAN_LIMIT = { free: 3, editor: 20, creator: 100, studio: 1000 };
const STORAGE_LIMIT_GB = { free: 5, editor: 25, creator: 100, studio: 500 };

export function Sidebar({ projects = [], collapsed = false }) {
  const location = useLocation();
  const { user } = useAuth();
  const plan = user?.plan || "free";
  const totalMin = PLAN_MINUTES[plan] || 30;
  const usedMin = (user?.credit_seconds_used || 0) / 60;
  const remainMin = Math.max(0, totalMin - usedMin);
  const storageGb = Math.min(STORAGE_LIMIT_GB[plan], (projects.length * 0.15));
  const audioClean = Math.min(AUDIO_CLEAN_LIMIT[plan], projects.filter(p => p.status === "done").length);

  return (
    <aside className={`hidden lg:flex flex-col fixed left-0 top-0 bottom-0 w-[280px] bg-bg-2 border-r border-line z-30 transition-transform duration-200 ${collapsed ? "-translate-x-full" : "translate-x-0"}`}>
      {/* Logo */}
      <div className="px-6 pt-6 pb-8">
        <Link to="/dashboard" data-testid="brand-link" className="inline-flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-white text-black flex items-center justify-center font-bold">K</span>
          <span className="font-semibold text-lg tracking-tight">Kalakar</span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="px-3 space-y-1">
        {NAV.map((item) => {
          const active = location.pathname === item.to || (item.to === "/projects" && location.pathname.startsWith("/projects"));
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              data-testid={item.testId}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${active ? "bg-card text-ink" : "text-muted-ink hover:text-ink hover:bg-card/50"
                }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Usage card at bottom */}
      <div className="mt-auto p-4">
        <div className="rounded-xl bg-card border border-line p-4">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] tracking-eyebrow uppercase text-muted-ink font-semibold">
              {plan.toUpperCase()} — MONTHLY
            </span>
            <Sparkles className="w-3.5 h-3.5 text-muted-ink" />
          </div>

          <UsageBar label="Storage" current={storageGb.toFixed(1)} limit={STORAGE_LIMIT_GB[plan]} unit="GB" pct={(storageGb / STORAGE_LIMIT_GB[plan]) * 100} />
          <UsageBar label="Transcription" current={remainMin.toFixed(1)} limit={null} unit=" mins left" pct={(remainMin / totalMin) * 100} />
          <UsageBar label="Audio Clean" current={audioClean} limit={AUDIO_CLEAN_LIMIT[plan]} unit="" pct={(audioClean / AUDIO_CLEAN_LIMIT[plan]) * 100} />

          <Link
            to="/billing"
            data-testid="upgrade-btn"
            className="mt-4 block w-full text-center bg-white text-black text-sm font-medium py-2.5 rounded-lg hover:bg-hilite transition-colors"
          >
            Upgrade Now
          </Link>
        </div>
      </div>
    </aside>
  );
}

function UsageBar({ label, current, limit, unit, pct }) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-xs text-muted-ink">{label}</span>
        <span className="text-xs text-ink">
          {current}{limit != null ? `/${limit}` : ""}{unit}
        </span>
      </div>
      <div className="h-1 bg-line rounded-full overflow-hidden">
        <div className="h-full bg-hilite transition-all" style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
      </div>
    </div>
  );
}

export function TopBar({ variant = "app", collapsed = false, onToggleSidebar, projects = [] }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTab, setSearchTab] = useState("All");

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const isEditor = variant === "editor";
  const [menuOpen, setMenuOpen] = useState(false);

  // Close menu if clicked outside isn't strictly necessary for a simple demo but can add later
  return (
    <header className="sticky top-0 z-20 bg-bg/80 backdrop-blur-md border-b border-line">
      <div className={`${isEditor ? "h-11" : "h-16"} px-6 md:px-10 flex items-center justify-between gap-6`}>
        <button
          onClick={onToggleSidebar}
          data-testid="toggle-sidebar"
          title={collapsed ? "Show sidebar" : "Hide sidebar"}
          className="hidden lg:flex w-7 h-7 rounded-md border border-line text-muted-ink hover:text-ink hover:bg-card items-center justify-center shrink-0 transition-colors"
        >
          <PanelLeft className="w-3.5 h-3.5" />
        </button>
        {!isEditor && (
          <div className="relative flex-1 max-w-sm hidden md:block ml-2 z-50">
            <div className={`flex items-center gap-2 bg-[#141414] border transition-all duration-300 px-3 py-1.5 ${searchOpen ? 'border-emerald-500/80 rounded-t-xl rounded-b-none' : 'border-[#27272a] rounded-xl hover:border-[#3f3f46]'}`}>
              <Search className={`w-3.5 h-3.5 shrink-0 transition-colors ${searchOpen ? 'text-emerald-500' : 'text-muted-ink'}`} />
              <input
                type="text"
                value={searchQuery}
                onFocus={() => setSearchOpen(true)}
                onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="topbar-search"
                placeholder="Search by title..."
                className="flex-1 bg-transparent outline-none text-sm text-ink placeholder:text-muted-ink min-w-0"
              />
              <span className="text-[10px] text-muted-ink opacity-70">(⌘K)</span>
            </div>

            {searchOpen && (
              <div className="absolute top-full left-0 right-0 bg-[#1c1c1c] border-x border-b border-[#27272a] rounded-b-xl shadow-2xl overflow-hidden mt-0 flex flex-col">
                <div className="flex gap-2 p-3 border-b border-[#27272a]">
                  <button
                    onMouseDown={(e) => { e.preventDefault(); setSearchTab("All"); }}
                    className={`text-xs font-semibold px-4 py-1.5 rounded-full border transition-colors ${searchTab === "All" ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400" : "bg-white/5 border-transparent text-muted-ink hover:text-white"}`}
                  >
                    All
                  </button>
                  <button
                    onMouseDown={(e) => { e.preventDefault(); setSearchTab("Recent"); }}
                    className={`text-xs font-semibold px-4 py-1.5 rounded-full border transition-colors ${searchTab === "Recent" ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400" : "bg-white/5 border-transparent text-muted-ink hover:text-white"}`}
                  >
                    Recent
                  </button>
                </div>

                <div className="max-h-[350px] overflow-y-auto p-1.5 min-h-[220px]">
                  {searchTab === "Recent" ? (
                    <div className="flex flex-col items-center justify-center h-full pt-10 pb-6 opacity-80">
                      <Clock className="w-6 h-6 text-muted-ink mb-4" />
                      <div className="text-[15px] font-medium text-[#ebebeb] mb-1.5">No recent searches</div>
                      <div className="text-[13px] text-muted-ink">Your search history will appear here</div>
                    </div>
                  ) : (
                    <>
                      {projects.filter(p => !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase())).map(p => (
                        <Link to={`/projects/${p.id}`} key={p.id} className="flex gap-3 items-center p-2 rounded-lg hover:bg-white/5 transition-colors">
                          <div className="w-[42px] h-[42px] bg-[#111] rounded-md overflow-hidden shrink-0 border border-line">
                            <img
                              src={`${API}/projects/${p.id}/thumbnail`}
                              className="w-full h-full object-cover"
                              alt={p.name}
                              onError={(e) => { e.currentTarget.style.display = "none"; }}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-bold text-white truncate leading-tight">{p.name}</div>
                            <div className="text-xs text-muted-ink mt-0.5 truncate flex gap-1">
                              <span>{Math.floor((Date.now() - new Date(p.created_at).getTime()) / (1000 * 60 * 60 * 24)) <= 0 ? "Today" : `${Math.floor((Date.now() - new Date(p.created_at).getTime()) / (1000 * 60 * 60 * 24))} days ago`}</span>
                              <span>•</span>
                              <span>English (Native)</span>
                            </div>
                          </div>
                        </Link>
                      ))}
                      {projects.length === 0 && (
                        <div className="p-4 text-center text-sm text-muted-ink">No projects found.</div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        {isEditor && <div className="flex-1" />}

        <div className="flex items-center gap-3">
          {variant === "editor" && (
            <Link to="/billing" data-testid="topbar-upgrade" className="text-xs border border-line rounded-md px-3 py-1.5 hover:bg-card transition-colors">
              Upgrade
            </Link>
          )}

          <div className="relative group">
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenuOpen(!menuOpen); }}
              data-testid="user-menu"
              className="flex items-center gap-2 rounded-full pl-1 pr-2.5 py-1 bg-[#1a1a1a] border border-[#27272a] hover:bg-[#222] transition-colors outline-none"
            >
              <div className="w-6 h-6 rounded-full bg-[#f97316] text-white text-[10px] font-bold flex items-center justify-center">
                {(user?.name || user?.email || "U").slice(0, 1).toUpperCase()}
              </div>
              <span className="text-[11px] font-semibold tracking-wide hidden md:inline text-white uppercase" data-testid="user-name">
                {user?.name || user?.email?.split("@")[0]}
              </span>
              <ChevronDown className="w-3 h-3 text-muted-ink opacity-60 ml-0.5" />
            </button>

            {menuOpen && (
              <div
                className="absolute top-full right-0 mt-2 w-64 bg-[#212121] border border-[#333] rounded-lg shadow-2xl z-50 overflow-hidden"
              >
                <div className="px-4 py-3">
                  <div className="text-base font-semibold text-white uppercase tracking-tight">{user?.name || "PRAVEEN K S"}</div>
                  <div className="text-sm text-muted-ink">{user?.email || "praveenks15326@gmail.com"}</div>
                </div>

                <div className="h-px bg-[#333] mx-4" />

                <div className="py-2">
                  <Link to="/profile" className="group flex items-center gap-4 w-full px-4 py-2.5 text-base text-white hover:bg-white/5 transition-colors">
                    <User className="w-5 h-5 text-white" />
                    Profile
                  </Link>
                  <Link to="/billing" className="group flex items-center gap-4 w-full px-4 py-2.5 text-base text-white hover:bg-white/5 transition-colors">
                    <CreditCard className="w-5 h-5 text-white" />
                    Billing
                  </Link>
                </div>

                <div className="h-px bg-[#333] mx-4" />

                <div className="py-2">
                  <button type="button" onClick={handleLogout} className="flex items-center gap-4 w-full text-left px-4 py-2.5 text-base text-[#ef4444] hover:bg-white/5 transition-colors">
                    <LogOut className="w-5 h-5 text-[#ef4444]" />
                    Log out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export function AppShell({ children, projects, topbarVariant = "app" }) {
  const [collapsed, setCollapsed] = useState(topbarVariant === "editor");
  return (
    <div className="min-h-screen bg-bg text-ink">
      <Sidebar projects={projects} collapsed={collapsed} />
      <div className={`transition-[padding] duration-200 ${collapsed ? "lg:pl-0" : "lg:pl-[280px]"}`}>
        <TopBar
          variant={topbarVariant}
          collapsed={collapsed}
          onToggleSidebar={() => setCollapsed((c) => !c)}
          projects={projects}
        />
        {children}
      </div>
    </div>
  );
}
