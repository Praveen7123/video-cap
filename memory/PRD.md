# ClipCut — Product Requirements Document

## Original Problem Statement
Build a web app called ClipCut — an AI-powered video editing tool for creators. Upload → AI transcribes → auto-cuts dead air/filler words → adds premium animated subtitles. Preset styles instead of a manual timeline.

## Architecture
- **Frontend**: React (CRA + craco), Tailwind, shadcn/ui, react-router v7, Outfit + Instrument Serif fonts.
- **Backend**: FastAPI + Motor (Mongo), JWT (httpOnly cookies) + bcrypt, ffmpeg for real cut/burn-in.
- **DB**: MongoDB collections `users`, `projects`.
- **Storage**: Local disk at `/app/backend/storage/{uploads,renders,thumbs}`.

## User Personas
1. **Solo YouTuber / Reels creator** — wants shorts published fast without learning Premiere.
2. **Agency editor** — needs 4K/60fps, alpha exports, higher monthly minutes.
3. **First-time creator** — needs a friction-free free tier to try before subscribing.

## Core Requirements (static)
- Sign up / sign in with JWT (httpOnly cookies).
- 5-click upload wizard: video → style → color/font → quality → review.
- Real ffmpeg silence-detect + cut + subtitles burn-in.
- Preset caption styles (karaoke, bold-pop, minimal-clean, bounce-in).
- Plan-gated qualities (1080p, 4K, alpha).
- Dashboard w/ live-polling project cards + credits meter.
- Billing page w/ 4 tiers (Free ₹0 / Editor ₹670 / Creator ₹950 / Studio ₹2400).

## Implemented (2026-02-03)
- ✅ Landing page (hero, problem/solution circles, features, 5-step how-it-works, pricing, CTA)
- ✅ Register + Login pages
- ✅ Dashboard with credits + project cards + live status polling
- ✅ 5-step New Project wizard with real drag-drop upload
- ✅ Job Status page with stage progression + result video player + download
- ✅ Billing page with plan cards + mock upgrade
- ✅ Backend: /api/auth (register/login/logout/me), /api/plans, /api/projects (list/get/upload/download/video/thumbnail), /api/billing/upgrade
- ✅ Real ffmpeg pipeline: silencedetect → concat → subtitles burn-in → thumbnail
- ✅ 12/12 backend tests + full frontend Playwright E2E pass on first try
- ✅ Admin seeded: admin@clipcut.app / Admin@12345 (studio plan)

## Backlog

### P0 (blocking growth)
- Real Whisper transcription (currently MOCKED — filler phrases)
- Real Razorpay integration (currently MOCKED — just updates DB)

### P1 (creator-critical)
- Word-level karaoke highlight (currently line-level via ASS force_style)
- Vertical / 9:16 auto-crop for shorts
- Emoji / broll insertion presets
- Multi-language captions
- Persistent job queue (survive backend restart)

### P2 (nice-to-have)
- Team workspaces + shared credits pool
- Public share links for finished renders
- API access (Studio tier)
- Referral credit system
- Object storage backend (S3) instead of local disk

## Known limitations
- Transcription is synthetic — captions are filler phrases, not real speech.
- Backend restart mid-render leaves projects stuck in an intermediate status.
- Files stored on local container disk (not durable across container restarts).
