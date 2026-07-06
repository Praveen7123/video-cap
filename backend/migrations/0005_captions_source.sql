-- Tracks whether a project's captions came from real Whisper transcription
-- or the silent/no-speech placeholder fallback, so the editor can warn the
-- user instead of silently shipping made-up caption text.
alter table public.projects
    add column if not exists captions_source text default null;
