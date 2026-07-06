-- Migration 0008: Team Collaboration MVP
-- Add nullable team_id to projects, create teams and team_members tables with indexes.

alter table public.projects 
    add column if not exists team_id text default null;

create table if not exists public.teams (
    id          text primary key,
    name        text not null,
    seats       integer default 1,
    created_at  text not null
);

create table if not exists public.team_members (
    id          text primary key,
    team_id     text not null references public.teams(id) on delete cascade,
    email       text not null,
    user_id     text references public.users(id) on delete cascade,
    created_at  text not null
);

-- Indexes for performance and uniqueness
create unique index if not exists team_members_team_email_idx on public.team_members(team_id, email);
create index if not exists team_members_user_id_idx on public.team_members(user_id);
create index if not exists team_members_email_idx on public.team_members(email);
create index if not exists projects_team_id_idx on public.projects(team_id);
