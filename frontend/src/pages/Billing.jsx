import { useEffect, useState } from "react";
import api from "@/lib/api";
import { AppShell } from "@/components/Layout";
import { useAuth } from "@/context/AuthContext";
import { Check, Sparkles } from "lucide-react";

export default function Billing() {
  const { user, refresh } = useAuth();
  const [plans, setPlans] = useState(null);
  const [upgrading, setUpgrading] = useState(null);
  const [message, setMessage] = useState("");
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    api.get("/plans").then(({ data }) => setPlans(data)).catch(() => {});
    api.get("/projects").then(({ data }) => setProjects(data)).catch(() => {});
  }, []);

  const upgrade = async (planKey) => {
    setUpgrading(planKey);
    setMessage("");
    try {
      await api.post("/billing/upgrade", { plan: planKey });
      await refresh();
      setMessage(`Switched to the ${plans[planKey].name} plan.`);
    } catch (e) {
      setMessage(e.response?.data?.detail || e.message);
    } finally {
      setUpgrading(null);
    }
  };

  const currentPlan = user?.plan || "free";

  return (
    <AppShell projects={projects}>
      <main className="px-6 md:px-10 py-8">
        <h1 className="text-2xl font-semibold tracking-tight" data-testid="billing-heading">Manage subscription</h1>
        <p className="mt-1 text-sm text-muted-ink">
          You're on the <span className="text-ink font-medium capitalize" data-testid="current-plan">{currentPlan}</span> plan.
        </p>

        {message && (
          <div className="mt-6 bg-card border border-line rounded-lg px-4 py-3 text-sm" data-testid="billing-message">
            {message}
          </div>
        )}

        {plans && (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(plans).map(([key, p]) => {
              const isCurrent = key === currentPlan;
              const featured = key === "creator";
              return (
                <div
                  key={key}
                  data-testid={`billing-plan-${key}`}
                  className={`rounded-xl p-6 border flex flex-col ${featured ? "bg-white text-black border-white" : "bg-card border-line"}`}
                >
                  {featured && <div className="text-[10px] tracking-widest uppercase font-semibold mb-3">Most Popular</div>}
                  <div className={`text-sm font-medium ${featured ? "text-black" : "text-muted-ink"}`}>{p.name}</div>
                  <div className="mt-3 text-4xl font-semibold">
                    ₹{p.price_inr}<span className={`text-xs ml-1 ${featured ? "text-black/60" : "text-muted-ink"}`}>/mo</span>
                  </div>
                  <ul className="mt-6 space-y-2 flex-1 text-sm">
                    <li className="flex items-start gap-2">
                      <Check className={`w-4 h-4 mt-0.5 shrink-0 ${featured ? "text-black" : "text-hilite"}`} />
                      {p.credit_minutes} min / mo
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className={`w-4 h-4 mt-0.5 shrink-0 ${featured ? "text-black" : "text-hilite"}`} />
                      {p.qualities.join(", ")}
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className={`w-4 h-4 mt-0.5 shrink-0 ${featured ? "text-black" : "text-hilite"}`} />
                      All caption styles
                    </li>
                  </ul>
                  <button
                    disabled={isCurrent || upgrading === key}
                    onClick={() => upgrade(key)}
                    data-testid={`billing-upgrade-${key}`}
                    className={`mt-8 inline-flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-medium transition-colors ${
                      isCurrent
                        ? (featured ? "bg-black/10 text-black/60 cursor-default" : "bg-line/40 text-muted-ink cursor-default")
                        : featured
                        ? "bg-black text-white hover:bg-neutral-800"
                        : "bg-white text-black hover:bg-hilite"
                    }`}
                  >
                    {isCurrent ? "Current plan" : upgrading === key ? "Switching…" : "Switch"}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-8 rounded-xl bg-card border border-line p-4 flex items-center gap-3">
          <Sparkles className="w-4 h-4 text-muted-ink shrink-0" />
          <div className="text-sm text-muted-ink">
            <span className="text-ink font-medium">Razorpay checkout coming soon.</span> Plan changes are simulated for now.
          </div>
        </div>
      </main>
    </AppShell>
  );
}
