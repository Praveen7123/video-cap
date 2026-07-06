import { createClient } from "@supabase/supabase-js";

// Supabase's client SDK manages the session (access + refresh tokens) itself,
// storing it in localStorage and refreshing silently — this is what actually
// works across the frontend (Vercel) and backend (Render) being on different
// domains, unlike cookies, which browsers increasingly block cross-site.
export const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY,
);
