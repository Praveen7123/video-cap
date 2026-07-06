# Hosting

This app has paying customers. Every tier below is chosen to avoid cold starts,
paused databases, and surprise bills — not to save money. Do not downgrade any
of this to a free tier without re-reading the risks section at the bottom.

## What's hosted where

| Component | Platform | Tier | Why |
|---|---|---|---|
| Frontend (static build) | Vercel or Netlify | Free | Static hosting has no server to sleep — free tier is fine here, no change needed. |
| Backend (FastAPI + ffmpeg) | Render | **Starter** ($7/mo, 512 MB / 0.5 CPU) | Render's free web services spin down after 15 min idle and take 30-60s to cold-start. Starter is the cheapest tier that stays running 24/7. |
| Database + Storage | Supabase | **Pro** (from $25/mo) | Supabase's free tier pauses a project after 7 days of inactivity (~30s to resume, and it can be permanently deleted if left paused too long) and ships zero automated backups. Pro removes the pause entirely and adds daily backups (7-day retention). |

**Estimated floor: ~$32/month** ($7 Render + $25 Supabase), before any usage-based
overage on either platform. This is a floor, not a ceiling — actual compute/bandwidth
usage can push it higher; see the spend-cap section below for how we guard against that.

If Render's Starter (512 MB) turns out to be too small once ffmpeg + faster-whisper
are both loaded under real traffic, the next tier up is Standard (2 GB / 1 CPU) —
check current pricing at render.com/pricing before assuming a number, prices
in this doc were last confirmed **July 2026** and are not guaranteed current.

## Why these specific risks are real, not theoretical

- **Render free tier**: web services sleep after 15 min inactivity; cold starts
  take 30-60 seconds; free accounts have reportedly been suspended without
  documented limits. A paying customer hitting a cold-started API on page load
  is a bad first impression at best, a lost customer at worst.
- **Supabase free tier**: projects pause after 7 days of inactivity, take ~30s
  to resume, have no automated backups, and can be permanently deleted if left
  paused too long. Losing customer data because a project sat idle over a
  slow week is not an acceptable risk for a paid product.
- **Railway** (evaluated, not chosen): no meaningful free tier anymore — the
  Trial gives ~$5/month in credit. Hobby is $5/mo flat (with $5 of included
  usage — overage beyond that is billed). A full-stack app with a database
  commonly lands at $20-50/month and can spike further under load. We're
  using Render + Supabase instead because Render's Starter web service floor
  ($7/mo) is a flat rate, not usage-metered, which makes the monthly bill
  predictable. If we ever do move to Railway, see the spend-cap steps below —
  Railway does support a real hard spending limit (see below), which is not
  true of every usage-based host.

## Guarding against surprise bills

**Render**: Starter/Standard/etc. instance pricing is a flat monthly rate per
service, not usage-metered, so there's no "surprise" compute bill on the
backend service itself. Bandwidth/build minutes are metered separately —
check your Render dashboard's usage page periodically; Render does not
currently expose a hard spend cap the way Railway does.

**If using Railway** (not our current platform, but documented here in case
we move): Railway *does* support a real hard spending limit.
1. Go to **railway.com/workspace/usage**
2. Click **Set Usage Limits**
3. Set two thresholds:
   - **Email alert (soft limit)** — notifies you at a chosen spend level;
     nothing is interrupted.
   - **Hard limit (max spend)** — once hit, **all workloads in the workspace
     are taken offline** to stop further charges. Minimum hard limit is $10.
4. Railway auto-emails at 75%/90%/100% of the hard limit.

**Supabase**: Pro plan compute is a flat monthly rate (from $25/mo, which
includes a $10/mo compute credit covering one Micro instance) — not
scale-to-zero, so no idle-cost surprises, but overages on storage/bandwidth
beyond plan inclusions are billed. Check the Supabase dashboard's billing
page if usage grows significantly (more storage, more users, more Storage
egress for video files).

## Monitoring

`GET /health` on the backend returns `{"status": "ok", "db": true}` (200) or
a 503 if the database is unreachable. This exists for uptime monitors and the
hosting platform's own health checks — it is **not** a keep-alive endpoint
and must never be used to defeat a free tier's sleep timer. If you're ever
tempted to add a cron job that pings this to "keep the service warm" instead
of paying for an always-on tier, don't — that's a documented anti-pattern
that doesn't actually guarantee uptime under real traffic and masks the real
fix (paying for the tier that doesn't sleep).

## Before ever downgrading to a free tier again

Check all of the following first:
1. Are there still paying customers? If yes, stop — this whole document
   exists because free tiers are not compatible with that.
2. Has Render/Supabase changed their free-tier terms since **July 2026**
   (when this doc was last verified)? Confirm on their current pricing pages,
   don't assume these numbers still hold.
3. Is there a lower-traffic "hold" period where downtime/cold-starts are
   actually acceptable (e.g., pre-launch, all customers notified in advance)?
   If not, don't downgrade.
