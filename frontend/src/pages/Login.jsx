import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { ArrowRight } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await login(email, password);
    setLoading(false);
    if (!res.ok) setError(res.error);
    else navigate(location.state?.from || "/dashboard");
  };

  return (
    <div className="min-h-screen bg-bg text-ink flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <Link to="/" data-testid="auth-brand-link" className="flex items-center gap-2 mb-10">
          <span className="w-8 h-8 rounded-lg bg-white text-black flex items-center justify-center font-bold">K</span>
          <span className="font-semibold text-lg tracking-tight">Kalakar</span>
        </Link>

        <h1 className="text-2xl font-semibold tracking-tight">Sign in to Kalakar</h1>
        <p className="mt-2 text-sm text-muted-ink">Welcome back. Let's ship some cuts.</p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label className="text-xs text-muted-ink block mb-1.5">Email</label>
            <input
              type="email" required data-testid="login-email"
              value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-card border border-line rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-line-2 transition-colors"
              placeholder="you@studio.com"
            />
          </div>
          <div>
            <label className="text-xs text-muted-ink block mb-1.5">Password</label>
            <input
              type="password" required data-testid="login-password"
              value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-card border border-line rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-line-2 transition-colors"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="text-xs text-red-400 bg-red-950/30 border border-red-900/40 rounded-lg px-3 py-2" data-testid="login-error">
              {error}
            </div>
          )}

          <button
            type="submit" disabled={loading} data-testid="login-submit"
            className="w-full bg-white text-black rounded-lg py-2.5 text-sm font-medium hover:bg-hilite transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? "Signing in…" : (<>Sign in <ArrowRight className="w-3.5 h-3.5" /></>)}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-muted-ink">
          No account?{" "}
          <Link to="/register" data-testid="link-to-register" className="text-ink hover:text-hilite">Create one →</Link>
        </div>
      </div>
    </div>
  );
}
