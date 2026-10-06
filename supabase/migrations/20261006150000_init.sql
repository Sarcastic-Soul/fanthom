-- Core schema for the demo workspace.
-- Visitors are never signed in: everyone can read, and all writes go through
-- server code using the service role key.

create table meetings (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  started_at timestamptz not null,
  duration_ms integer not null default 0,
  -- 'youtube' plays through the YouTube embed, 'audio' and 'video' play a file.
  media_type text not null check (media_type in ('youtube', 'audio', 'video')),
  media_url text,
  youtube_id text,
  source_name text,
  source_url text,
  credit text,
  kind text not null default 'demo' check (kind in ('demo', 'upload')),
  status text not null default 'ready' check (status in ('processing', 'ready', 'failed')),
  meeting_type text,
  created_at timestamptz not null default now()
);

create table speakers (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references meetings (id) on delete cascade,
  label text not null,
  name text not null,
  role text,
  color integer not null default 0,
  talk_ms integer not null default 0,
  turns integer not null default 0,
  unique (meeting_id, label)
);

create table utterances (
  id bigint generated always as identity primary key,
  meeting_id uuid not null references meetings (id) on delete cascade,
  speaker_id uuid not null references speakers (id) on delete cascade,
  idx integer not null,
  start_ms integer not null,
  end_ms integer not null,
  text text not null,
  tsv tsvector generated always as (to_tsvector('english', text)) stored,
  unique (meeting_id, idx)
);
create index utterances_tsv_idx on utterances using gin (tsv);
create index utterances_meeting_start_idx on utterances (meeting_id, start_ms);

create table summaries (
  meeting_id uuid not null references meetings (id) on delete cascade,
  template text not null,
  content jsonb not null,
  model text,
  created_at timestamptz not null default now(),
  primary key (meeting_id, template)
);

create table chapters (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references meetings (id) on delete cascade,
  idx integer not null,
  title text not null,
  start_ms integer not null,
  end_ms integer not null,
  gist text
);
create index chapters_meeting_idx on chapters (meeting_id, idx);

create table action_items (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references meetings (id) on delete cascade,
  idx integer not null,
  text text not null,
  owner_name text,
  speaker_id uuid references speakers (id) on delete set null,
  ts_ms integer,
  done boolean not null default false
);
create index action_items_meeting_idx on action_items (meeting_id, idx);

create table highlights (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references meetings (id) on delete cascade,
  start_ms integer not null,
  end_ms integer not null check (end_ms > start_ms),
  title text,
  quote text not null,
  created_at timestamptz not null default now()
);
create index highlights_meeting_idx on highlights (meeting_id, start_ms);

alter table meetings enable row level security;
alter table speakers enable row level security;
alter table utterances enable row level security;
alter table summaries enable row level security;
alter table chapters enable row level security;
alter table action_items enable row level security;
alter table highlights enable row level security;

create policy "public read" on meetings for select using (true);
create policy "public read" on speakers for select using (true);
create policy "public read" on utterances for select using (true);
create policy "public read" on summaries for select using (true);
create policy "public read" on chapters for select using (true);
create policy "public read" on action_items for select using (true);
create policy "public read" on highlights for select using (true);

-- Search across every meeting. Returns the matching lines with a short
-- highlighted snippet, best matches first.
create or replace function search_utterances(q text, max_results integer default 50)
returns table (
  utterance_id bigint,
  meeting_id uuid,
  meeting_slug text,
  meeting_title text,
  started_at timestamptz,
  speaker_name text,
  speaker_color integer,
  start_ms integer,
  snippet text,
  rank real
)
language sql stable
as $$
  with query as (select websearch_to_tsquery('english', q) as tsq)
  select
    u.id,
    m.id,
    m.slug,
    m.title,
    m.started_at,
    s.name,
    s.color,
    u.start_ms,
    ts_headline('english', u.text, query.tsq,
      'StartSel=<mark>, StopSel=</mark>, MaxWords=28, MinWords=12, ShortWord=2'),
    ts_rank(u.tsv, query.tsq)
  from utterances u
  join query on u.tsv @@ query.tsq
  join meetings m on m.id = u.meeting_id
  join speakers s on s.id = u.speaker_id
  where m.status = 'ready'
  order by ts_rank(u.tsv, query.tsq) desc, m.started_at desc, u.start_ms
  limit max_results;
$$;

-- Public bucket for meeting audio and video files.
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;
