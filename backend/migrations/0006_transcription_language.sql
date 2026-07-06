-- Which language the user asked Whisper to transcribe in (ISO 639-1 code, or
-- 'auto' for auto-detect). Powers multi-language transcription in the editor.
alter table public.projects
    add column if not exists transcription_language text default 'auto';
