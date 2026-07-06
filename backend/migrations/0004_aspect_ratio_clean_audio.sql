-- Vertical/aspect-ratio cropping + clean-audio (noise-removed) track.
-- NOTE: these two columns already exist on the live database (added via an
-- untracked manual ALTER at some point) — this migration exists so the
-- tracked history matches reality and a fresh environment gets them too.
alter table public.projects
    add column if not exists aspect_ratio    text default 'original',
    add column if not exists clean_audio_path text;
