-- English translation of a project's captions (Whisper's built-in translate
-- mode), generated on demand and gated by the user's plan translation budget.
alter table public.projects
    add column if not exists captions_en jsonb,
    add column if not exists translation_status text default null;

alter table public.users
    add column if not exists translation_seconds_used integer default 0;
