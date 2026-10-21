-- Dreamplish database schema.
-- New Supabase project: SQL Editor → paste this whole file → Run (once, on the empty project).
-- After changing it, run the change on the live database and regenerate the types: npm run db:types.

-- ─── Types and helpers ──────────────────────────────────────────────────────

create type public.job_status as enum ('saved', 'applied', 'interview', 'offer', 'rejected');
create type public.gen_status as enum ('pending', 'generating', 'ready', 'failed');

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─── Tables ─────────────────────────────────────────────────────────────────

-- One per auth user (created by handle_new_user). cv_file_*: the original CV in the "cvs" bucket.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text check (char_length(name) <= 100),
  cv_text text check (char_length(cv_text) <= 50000),
  cv_file_path text,
  cv_file_name text check (char_length(cv_file_name) <= 200),
  cv_file_type text check (cv_file_type in ('docx', 'pdf', 'txt')),
  locale text not null default 'en' check (locale in ('en', 'ar')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Shared across users, deduplicated by normalized name (see get_or_create_company).
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  normalized_name text not null unique,
  website text check (website ~* '^https?://'),
  industry text check (char_length(industry) <= 100),
  created_at timestamptz not null default now()
);

-- A user's board columns. Each counts as one of the five core statuses (category), so filters and
-- email updates keep working. Core columns can be renamed or hidden, not deleted.
create table public.board_stages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text check (char_length(trim(name)) between 1 and 40), -- null = the translated default name
  name_i18n jsonb, -- {"en", "ar"} for name; null = not translated yet, {} = translation failed
  preset text check (preset in ('assessment')), -- built-in non-core column
  category public.job_status not null,
  color text not null default 'gray' check (color in ('gray', 'blue', 'teal', 'green', 'amber', 'orange', 'red', 'purple', 'pink')),
  position double precision not null default 0,
  is_core boolean not null default false,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index board_stages_core_idx on public.board_stages (user_id, category) where is_core;
create index board_stages_user_idx on public.board_stages (user_id, position);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete restrict,
  title text not null check (char_length(title) between 1 and 200),
  link text check (link ~* '^https?://' and char_length(link) <= 2000),
  status public.job_status not null default 'saved',
  stage_id uuid references public.board_stages (id) on delete set null, -- null = the core column of status
  stage_detail text check (char_length(stage_detail) <= 80), -- interview/assessment type, e.g. "Coding test"
  date_applied date,
  applied_via text check (applied_via in ('linkedin', 'company_website', 'email', 'whatsapp', 'referral', 'job_board', 'recruiter', 'in_person', 'other')),
  applied_via_detail text check (char_length(applied_via_detail) <= 200),
  notes text check (char_length(notes) <= 10000),
  job_description text check (char_length(job_description) <= 30000),
  analysis jsonb, -- match report
  tailored_cv jsonb,
  source text not null default 'manual' check (source in ('manual', 'email')),
  position double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index jobs_user_status_position_idx on public.jobs (user_id, status, position);
create index jobs_company_idx on public.jobs (company_id);
create index jobs_stage_idx on public.jobs (stage_id);

-- Written by triggers on jobs (and the functions below), never directly by the client. The column
-- label is copied so renaming a column later doesn't rewrite history.
create table public.job_status_history (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  from_status public.job_status,
  to_status public.job_status not null,
  to_stage_id uuid references public.board_stages (id) on delete set null,
  to_stage_label text check (char_length(to_stage_label) <= 60),
  step_kind text check (step_kind in ('call', 'assessment', 'interview')), -- a step logged by hand or from email
  step_type text check (char_length(step_type) <= 80),
  note text check (char_length(note) <= 500),
  changed_at timestamptz not null default now()
);
create index job_status_history_job_idx on public.job_status_history (job_id, changed_at);

-- One cached brief per company, written by the worker. JSON shapes: lib/briefing/types.ts.
create table public.company_briefs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.companies (id) on delete cascade,
  status public.gen_status not null default 'pending',
  summary jsonb,
  news jsonb,
  projects jsonb,
  "values" jsonb,
  skills jsonb,
  salary_range jsonb,
  watchouts jsonb,
  role_insights jsonb,
  links jsonb,
  sources jsonb not null default '[]'::jsonb,
  roles text[] not null default '{}', -- roles the salary estimates were requested for
  provider text, -- which AI produced it ("mock" = sample data)
  search_suggestions text, -- Google's widget, shown with Google-grounded results
  error text,
  attempts int not null default 0,
  locked_at timestamptz,
  requested_at timestamptz not null default now(),
  generated_at timestamptz
);
create index company_briefs_status_idx on public.company_briefs (status, requested_at);

create table public.interview_preps (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.jobs (id) on delete cascade,
  questions jsonb not null,
  talking_points jsonb not null,
  locale text not null default 'en' check (locale in ('en', 'ar')),
  generated_at timestamptz not null default now()
);

-- Per-user limits (briefs; AI tools, email sync, paid searches, link reads — see lib/rate-limit.ts). Server only.
create table public.brief_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index brief_requests_user_created_idx on public.brief_requests (user_id, created_at desc);

create table public.ai_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('analyze', 'tailor', 'prep', 'email_sync', 'email_reread', 'find_description', 'link_lookup')),
  created_at timestamptz not null default now()
);
create index ai_requests_user_created_idx on public.ai_requests (user_id, created_at desc);

-- Connected mailboxes (one per provider). Server only: the encrypted refresh token never reaches the
-- browser. delta_link: Outlook inbox delta link, or the Gmail history id.
create table public.email_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null default 'outlook' check (provider in ('outlook', 'gmail')),
  account_email text,
  refresh_token_encrypted text not null,
  delta_link text,
  sent_delta_link text,
  last_synced_at timestamptz,
  status text not null default 'active' check (status in ('active', 'error')),
  error text,
  created_at timestamptz not null default now(),
  constraint email_connections_user_provider_key unique (user_id, provider)
);

-- Job emails found by sync, with the suggested action. Only extracted fields are stored, never full emails.
create table public.email_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  message_id text not null,
  received_at timestamptz not null,
  direction text not null default 'received' check (direction in ('received', 'sent')),
  sender text,
  subject text,
  web_link text,
  kind text not null check (kind in ('applied', 'interview', 'assessment', 'offer', 'rejected')),
  company text,
  role text,
  detail text check (char_length(detail) <= 80),
  job_link text check (job_link ~* '^https?://' and char_length(job_link) <= 2000),
  job_description text check (char_length(job_description) <= 30000),
  applied_via text check (applied_via in ('linkedin', 'company_website', 'email', 'whatsapp', 'referral', 'job_board', 'recruiter', 'in_person', 'other')),
  confidence text not null default 'medium' check (confidence in ('low', 'medium', 'high')),
  job_id uuid references public.jobs (id) on delete set null,
  action text not null check (action in ('create', 'update', 'none')),
  proposed_status public.job_status,
  state text not null default 'pending' check (state in ('pending', 'accepted', 'ignored')),
  created_at timestamptz not null default now(),
  unique (user_id, message_id)
);
create index email_events_user_state_idx on public.email_events (user_id, state, received_at desc);

-- ─── Row Level Security ─────────────────────────────────────────────────────
-- Tables without policies (brief_requests, ai_requests, email_connections) are server only.

alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.board_stages enable row level security;
alter table public.jobs enable row level security;
alter table public.job_status_history enable row level security;
alter table public.company_briefs enable row level security;
alter table public.interview_preps enable row level security;
alter table public.brief_requests enable row level security;
alter table public.ai_requests enable row level security;
alter table public.email_connections enable row level security;
alter table public.email_events enable row level security;

create policy "profiles: read own" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "profiles: update own" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- Companies and briefs are readable only through one of your jobs, so nobody can list where others applied.
create policy "companies: read linked" on public.companies
  for select to authenticated using (
    exists (select 1 from public.jobs j where j.company_id = companies.id and j.user_id = (select auth.uid()))
  );
create policy "company_briefs: read linked" on public.company_briefs
  for select to authenticated using (
    exists (select 1 from public.jobs j where j.company_id = company_briefs.company_id and j.user_id = (select auth.uid()))
  );

create policy "board_stages: read own" on public.board_stages
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "board_stages: insert own" on public.board_stages
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "board_stages: update own" on public.board_stages
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
-- The fixed columns (core five and Assessment) can't be deleted.
create policy "board_stages: delete own custom" on public.board_stages
  for delete to authenticated using ((select auth.uid()) = user_id and not is_core and preset is null);

create policy "jobs: read own" on public.jobs
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "jobs: insert own" on public.jobs
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "jobs: update own" on public.jobs
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "jobs: delete own" on public.jobs
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Append-only for clients; dates are edited through set_status_change_date().
create policy "job_status_history: read own" on public.job_status_history
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "job_status_history: insert own" on public.job_status_history
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.jobs j where j.id = job_id and j.user_id = (select auth.uid()))
  );

create policy "interview_preps: read own" on public.interview_preps
  for select to authenticated using (
    exists (select 1 from public.jobs j where j.id = interview_preps.job_id and j.user_id = (select auth.uid()))
  );
create policy "interview_preps: insert own" on public.interview_preps
  for insert to authenticated with check (
    exists (select 1 from public.jobs j where j.id = interview_preps.job_id and j.user_id = (select auth.uid()))
  );
create policy "interview_preps: update own" on public.interview_preps
  for update to authenticated using (
    exists (select 1 from public.jobs j where j.id = interview_preps.job_id and j.user_id = (select auth.uid()))
  );

create policy "email_events: read own" on public.email_events
  for select to authenticated using ((select auth.uid()) = user_id);

-- ─── Profiles and companies ─────────────────────────────────────────────────

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name, locale)
  values (
    new.id,
    left(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), 100),
    case when new.raw_user_meta_data ->> 'locale' = 'ar' then 'ar' else 'en' end
  );
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger jobs_updated_at before update on public.jobs
  for each row execute function public.set_updated_at();

-- Finds or creates a company by normalized name without exposing the whole table.
create function public.get_or_create_company(p_name text, p_website text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := regexp_replace(trim(p_name), '\s+', ' ', 'g');
  v_norm text := lower(v_name);
  v_site text := nullif(trim(p_website), '');
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if v_name is null or char_length(v_name) = 0 or char_length(v_name) > 200 then
    raise exception 'invalid company name' using errcode = '22023';
  end if;
  if v_site is not null and v_site !~* '^https?://' then
    v_site := null;
  end if;

  insert into public.companies (name, normalized_name, website)
  values (v_name, v_norm, v_site)
  on conflict (normalized_name) do update
    set website = coalesce(public.companies.website, excluded.website)
  returning id into v_id;

  return v_id;
end;
$$;

-- ─── Board columns ──────────────────────────────────────────────────────────

-- A core column can't change what it counts as.
create function public.board_stages_guard()
returns trigger
language plpgsql
as $$
begin
  if old.is_core and (new.category <> old.category or not new.is_core) then
    raise exception 'core stages keep their category' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger board_stages_guard before update on public.board_stages
  for each row execute function public.board_stages_guard();

-- A column's label: its custom name, or the preset key ('assessment'); null for core columns.
create function public.stage_label(p_stage_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(nullif(trim(s.name), ''), s.preset) from public.board_stages s where s.id = p_stage_id;
$$;

-- ─── Status history ─────────────────────────────────────────────────────────

-- When an application on a given day happened. Same day the job was added → the time it was added;
-- otherwise midday UTC, which keeps the same calendar date in almost every time zone.
create function public.applied_at(p_date date, p_created timestamptz)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select case
    when p_date is null then p_created
    when p_date = (p_created at time zone 'utc')::date then p_created
    else (p_date + time '12:00') at time zone 'utc'
  end;
$$;

-- The history row that stands for the application: the first "Applied" row, or the job's very first
-- row when it was created as Saved / Applied. (A job created straight into Interview has none.)
create function public.application_row(p_job_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.job_status_history
  where job_id = p_job_id and (to_status = 'applied' or (from_status is null and to_status in ('saved', 'applied')))
  order by (to_status = 'applied') desc, changed_at
  limit 1;
$$;

-- A row for every new job (dated on its Date applied) and every change of status, column, or
-- interview/assessment type set by email (a new round). add_job_step() and set_status_change_date()
-- switch this off (dreamplish.skip_history) for their own updates.
create function public.log_job_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_label text;
  v_kind text;
begin
  if coalesce(current_setting('dreamplish.skip_history', true), '') = 'on' then
    return new;
  end if;
  v_label := public.stage_label(new.stage_id);
  v_kind := case
    when new.stage_detail is null then null
    when v_label = 'assessment' then 'assessment'
    when new.status = 'interview' then 'interview'
  end;
  if tg_op = 'INSERT' then
    insert into public.job_status_history (job_id, user_id, from_status, to_status, to_stage_id, to_stage_label, step_kind, step_type, changed_at)
    values (new.id, new.user_id, null, new.status, new.stage_id, v_label, v_kind, new.stage_detail,
            public.applied_at(new.date_applied, coalesce(new.created_at, now())));
  elsif new.status is distinct from old.status
     or new.stage_id is distinct from old.stage_id
     or (new.stage_detail is not null and new.stage_detail is distinct from old.stage_detail) then
    insert into public.job_status_history (job_id, user_id, from_status, to_status, to_stage_id, to_stage_label, step_kind, step_type)
    values (new.id, new.user_id, old.status, new.status, new.stage_id, v_label, v_kind, new.stage_detail);
  end if;
  return new;
end;
$$;

-- Date applied changed, or the job just moved to Applied: move the application row to that date.
create function public.sync_application_date()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row uuid;
begin
  if coalesce(current_setting('dreamplish.skip_history', true), '') = 'on' or new.date_applied is null then
    return new;
  end if;
  if new.date_applied is distinct from old.date_applied or (new.status = 'applied' and old.status is distinct from 'applied') then
    v_row := public.application_row(new.id);
    if v_row is not null then
      update public.job_status_history set changed_at = public.applied_at(new.date_applied, new.created_at) where id = v_row;
    end if;
  end if;
  return new;
end;
$$;

-- Triggers fire in name order: the application-date sync runs after the row a move just created.
create trigger jobs_status_history after insert or update of status, stage_id, stage_detail on public.jobs
  for each row execute function public.log_job_status();
create trigger jobs_status_history_application_date after update of date_applied, status on public.jobs
  for each row execute function public.sync_application_date();

-- Edit when a change happened (logged after the fact) and its note: own rows only, not in the future,
-- not before the job was created unless allowed. Moving the application point also sets Date applied
-- (p_local_date = the date as the user picked it, in their time zone).
create function public.set_status_change_date(
  p_id uuid,
  p_changed_at timestamptz,
  p_note text default null,
  p_allow_before_created boolean default false,
  p_local_date date default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job_id uuid;
  v_created timestamptz;
begin
  select j.id, j.created_at into v_job_id, v_created
  from public.job_status_history h
  join public.jobs j on j.id = h.job_id
  where h.id = p_id and h.user_id = auth.uid() and j.user_id = auth.uid();

  if not found then
    raise exception 'not found' using errcode = '42501';
  end if;
  if p_changed_at > now() + interval '5 minutes' then
    raise exception 'future_date' using errcode = '22023';
  end if;
  if p_changed_at < v_created - interval '1 day' and not p_allow_before_created then
    raise exception 'before_created' using errcode = '22023';
  end if;
  if p_note is not null and char_length(p_note) > 500 then
    raise exception 'note_too_long' using errcode = '22023';
  end if;

  update public.job_status_history
  set changed_at = p_changed_at, note = nullif(trim(p_note), '')
  where id = p_id;

  -- The application point moved: Date applied follows (without re-dating the row it just set).
  if p_id = public.application_row(v_job_id) then
    perform set_config('dreamplish.skip_history', 'on', true);
    update public.jobs
    set date_applied = coalesce(p_local_date, (p_changed_at at time zone 'utc')::date)
    where id = v_job_id;
    perform set_config('dreamplish.skip_history', 'off', true);
  end if;
end;
$$;

-- Log a Call, Assessment or Interview by hand. Assessment and Interview also move the job to that
-- column (unless it's already there: another round); a Call never moves it. One history row.
create function public.add_job_step(
  p_job_id uuid,
  p_kind text,
  p_type text,
  p_changed_at timestamptz default now(),
  p_note text default null,
  p_allow_before_created boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.jobs%rowtype;
  v_type text := nullif(trim(p_type), '');
  v_note text := nullif(trim(p_note), '');
  v_assessment uuid;
  v_status public.job_status;
  v_stage uuid;
  v_id uuid;
begin
  select * into v_job from public.jobs where id = p_job_id and user_id = auth.uid();
  if not found then
    raise exception 'not found' using errcode = '42501';
  end if;
  if p_kind is null or p_kind not in ('call', 'assessment', 'interview') then
    raise exception 'bad_kind' using errcode = '22023';
  end if;
  if v_type is null then
    raise exception 'type_required' using errcode = '22023';
  end if;
  if char_length(v_type) > 80 or (v_note is not null and char_length(v_note) > 400) then
    raise exception 'too_long' using errcode = '22023';
  end if;
  if p_changed_at > now() + interval '5 minutes' then
    raise exception 'future_date' using errcode = '22023';
  end if;
  if p_changed_at < v_job.created_at - interval '1 day' and not p_allow_before_created then
    raise exception 'before_created' using errcode = '22023';
  end if;

  -- Where the job ends up. Already in the right kind of column = stays put (another round).
  select id into v_assessment from public.board_stages
  where user_id = v_job.user_id and preset = 'assessment' limit 1;
  v_status := v_job.status;
  v_stage := v_job.stage_id;
  if p_kind = 'interview' and not (v_job.status = 'interview' and v_job.stage_id is distinct from v_assessment) then
    v_status := 'interview';
    v_stage := null;
  elsif p_kind = 'assessment' and v_job.stage_id is distinct from v_assessment then
    v_status := 'interview';
    v_stage := v_assessment; -- null if the user has no Assessment column: the Interview column
  end if;

  perform set_config('dreamplish.skip_history', 'on', true);
  update public.jobs set status = v_status, stage_id = v_stage, stage_detail = v_type where id = p_job_id;
  perform set_config('dreamplish.skip_history', 'off', true);

  insert into public.job_status_history
    (job_id, user_id, from_status, to_status, to_stage_id, to_stage_label, step_kind, step_type, note, changed_at)
  values
    (v_job.id, v_job.user_id, v_job.status, v_status, v_stage, public.stage_label(v_stage), p_kind, v_type, v_note, p_changed_at)
  returning id into v_id;
  return v_id;
end;
$$;

-- ─── Company briefs ─────────────────────────────────────────────────────────

-- Atomically claim the next brief to generate: pending ones, or ones stuck generating for 10+ minutes
-- (the server stopped mid-run). At most 3 attempts.
create function public.claim_brief(p_company_id uuid default null)
returns setof public.company_briefs
language sql
security definer
set search_path = ''
as $$
  update public.company_briefs b
  set status = 'generating', locked_at = now(), attempts = b.attempts + 1
  where b.id = (
    select id from public.company_briefs
    where (status = 'pending' or (status = 'generating' and locked_at < now() - interval '10 minutes'))
      and attempts < 3
      and (p_company_id is null or company_id = p_company_id)
    order by requested_at
    for update skip locked
    limit 1
  )
  returning b.*;
$$;

-- ─── Function access ────────────────────────────────────────────────────────

revoke all on function public.get_or_create_company(text, text) from public, anon;
grant execute on function public.get_or_create_company(text, text) to authenticated;
revoke all on function public.set_status_change_date(uuid, timestamptz, text, boolean, date) from public, anon;
grant execute on function public.set_status_change_date(uuid, timestamptz, text, boolean, date) to authenticated;
revoke all on function public.add_job_step(uuid, text, text, timestamptz, text, boolean) from public, anon;
grant execute on function public.add_job_step(uuid, text, text, timestamptz, text, boolean) to authenticated;
-- Internal helpers, used only inside the functions above (Supabase grants new functions to signed-in users).
revoke all on function public.stage_label(uuid) from public, anon, authenticated;
revoke all on function public.application_row(uuid) from public, anon, authenticated;
revoke all on function public.claim_brief(uuid) from public, anon, authenticated;
grant execute on function public.claim_brief(uuid) to service_role;

-- ─── CV files ───────────────────────────────────────────────────────────────

-- Private bucket, one folder per user ({user_id}/original.docx), max 5 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cvs', 'cvs', false, 5242880,
        array['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']);

create policy "cvs: read own" on storage.objects
  for select to authenticated using (bucket_id = 'cvs' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "cvs: insert own" on storage.objects
  for insert to authenticated with check (bucket_id = 'cvs' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "cvs: update own" on storage.objects
  for update to authenticated using (bucket_id = 'cvs' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "cvs: delete own" on storage.objects
  for delete to authenticated using (bucket_id = 'cvs' and (storage.foldername(name))[1] = (select auth.uid())::text);
