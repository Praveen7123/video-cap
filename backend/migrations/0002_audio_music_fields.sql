-- Audio volume/fade + background music support.
alter table public.projects
    add column if not exists audio_volume   double precision default 1.0,
    add column if not exists audio_fade_in  double precision default 0.0,
    add column if not exists audio_fade_out double precision default 0.0,
    add column if not exists music_path     text,
    add column if not exists music_volume   double precision default 0.3;
