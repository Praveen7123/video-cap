import axios from "axios";
import { supabase } from "@/lib/supabaseClient";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const api = axios.create({
  baseURL: API,
});

// Attach the current Supabase session token as a Bearer header on every
// request — this (not cookies) is what actually works with the frontend and
// backend on different domains, since browsers increasingly block cross-site
// cookies regardless of SameSite settings.
api.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Supabase's client SDK refreshes the access token silently in the
// background before it expires, so a 401 here means the session is genuinely
// gone (expired refresh token, revoked, etc.) — send the user back to login
// rather than retrying, since there's nothing left to refresh.
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const status = error.response?.status;
    const isAuthCall = error.config?.url?.includes("/auth/");
    if (status === 401 && !isAuthCall) {
      if (window.location.pathname !== "/login" && window.location.pathname !== "/") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export function formatApiErrorDetail(detail) {
  if (detail == null) return "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail
      .map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e)))
      .filter(Boolean)
      .join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

export default api;
