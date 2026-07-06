-- Brand Kit Sync plugin: per-user default caption style.
alter table public.users
    add column if not exists brand_kit_enabled    boolean default false,
    add column if not exists brand_subtitle_style text default 'bold-pop',
    add column if not exists brand_accent_color   text default '#FFFFFF',
    add column if not exists brand_font           text default 'DejaVu Sans';
