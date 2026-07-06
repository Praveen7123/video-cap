import { Captions, Type as FontIcon, Music2 } from "lucide-react";

export const ASPECT_OPTIONS = [
  { value: "original", label: "Original Aspect" },
  { value: "9:16", label: "9:16 (TikTok/Reel)" },
  { value: "16:9", label: "16:9 (YouTube)" },
  { value: "1:1", label: "1:1 (Square)" },
  { value: "4:5", label: "4:5 (Instagram)" },
];

export const QUALITY_OPTIONS = [
  { value: "1080p", label: "1080P" },
  { value: "4k", label: "4K" },
];

// Mirrors backend PLANS[*]["qualities"] (server.py / config.py) — keep in sync.
export const PLAN_QUALITIES = {
  free: ["1080p"],
  editor: ["1080p"],
  creator: ["1080p", "4k"],
  studio: ["1080p", "4k"],
};

export const EMOJI_REGEX = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu;

export const TEMPLATES = [
  { id: "karaoke-pop-yellow", name: "Karaoke Yellow", style: "karaoke", color: "#FFE500", font: "Inter", tags: ["Karaoke", "Fast"] },
  { id: "karaoke-cyan", name: "Karaoke Cyan", style: "karaoke", color: "#00E5FF", font: "Poppins", tags: ["Karaoke", "Vibrant"] },
  { id: "karaoke-magenta", name: "Karaoke Pink", style: "karaoke", color: "#FF007F", font: "Montserrat", tags: ["Karaoke", "Bold"] },
  { id: "ali-abdaal-yellow", name: "Ali Abdaal", style: "bold-pop", color: "#FFE500", font: "Outfit", tags: ["Bold", "Standard"] },
  { id: "mr-beast-glow", name: "MrBeast Strike", style: "bounce-in", color: "#FF3333", font: "Impact", tags: ["Aggressive", "Bounce"] },
  { id: "devos-clean", name: "Devos Minimal", style: "minimal-clean", color: "#FFFFFF", font: "Inter", tags: ["Clean", "Modern"] },
  { id: "hormozi-impact", name: "Hormozi Impact", style: "bold-pop", color: "#00FF00", font: "Impact", tags: ["Bold", "Green"] },
  { id: "bounced-pastel", name: "Pastel Bounce", style: "bounce-in", color: "#FFB6C1", font: "Nunito", tags: ["Soft", "Bounce"] },
  { id: "cinematic-serif", name: "Cinematic", style: "minimal-clean", color: "#FFFDD0", font: "Playfair Display", tags: ["Elegant", "Clean"] },
  { id: "neon-rider", name: "Neon Rider", style: "bounce-in", color: "#A800FF", font: "Space Grotesk", tags: ["Neon", "Dark"] },
];

export const LEFT_RAIL = [
  { id: "captions", label: "Captions", icon: Captions },
  { id: "fonts", label: "Custom Fonts", icon: FontIcon },
  { id: "audio", label: "Audio", icon: Music2, badge: "Soon" },
];

export const RIGHT_TABS = ["Text", "Templates", "Transitions", "AI Audio"];

export const STAGE_LABELS = {
  queued: "Queued", cutting: "Cutting dead air",
  transcribing: "Transcribing with Whisper", rendering: "Rendering captions", done: "Ready", failed: "Failed",
};

export const FONT_OPTIONS = [
  "DejaVu Sans", "Arial", "Helvetica", "Poppins", "Roboto", "Inter",
  "Montserrat", "Open Sans", "Lato", "Oswald", "Playfair Display",
];

export function formatTime(seconds) {
  if (!isFinite(seconds)) return "00:00.000";
  const s = Math.max(0, seconds);
  const min = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.floor((s - Math.floor(s)) * 1000);
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}
