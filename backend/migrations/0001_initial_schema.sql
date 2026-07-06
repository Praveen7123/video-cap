-- Initial schema: users + projects.
create table if not exists public.users (
    id                   text primary key,
    email                text not null unique,
    name                 text,
    password_hash        text,
    plan                 text default 'free',
    credit_seconds_used  bigint default 0,
    role                 text default 'user',
    created_at           text
);

create table if not exists public.projects (
    id                 text primary key,
    user_id            text not null,
    name               text,
    status             text,
    progress           integer default 0,
    input_path         text,
    output_path        text,
    thumbnail_path     text,
    subtitle_style     text,
    accent_color       text,
    font               text,
    quality            text,
    auto_cut           text,
    original_duration  double precision,
    final_duration     double precision,
    cuts_count         integer default 0,
    seconds_removed    double precision default 0,
    captions           jsonb default '[]'::jsonb,
    created_at         text,
    updated_at         text,
    error              text
);

create index if not exists projects_user_id_idx on public.projects (user_id);
