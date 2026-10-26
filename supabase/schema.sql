-- Poop Pool schema for Supabase.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- Safe to re-run: functions and policies are replaced, tables are created if missing.
--
-- Privacy model:
--   * Raw sessions are only readable by their owner.
--   * Pool mates only ever see aggregates, via pool_leaderboard().
--   * Earnings are only uploaded (and shown) when a person turns on share_money.
--   * Salary never leaves the device.

-- ── TABLES ──

create table if not exists public.profiles (
  id           uuid primary key references auth.users on delete cascade,
  display_name text not null default 'Mystery Pooper' check (char_length(display_name) between 1 and 24),
  emoji        text not null default '💩' check (char_length(emoji) between 1 and 8),
  share_money  boolean not null default false,
  created_at   timestamptz not null default now()
);

create table if not exists public.sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  local_id   text not null,
  started_at timestamptz not null,
  secs       integer not null check (secs between 5 and 86400),
  earned     numeric(10,2) check (earned >= 0),
  created_at timestamptz not null default now(),
  unique (user_id, local_id)
);
create index if not exists sessions_user_started on public.sessions (user_id, started_at);

create table if not exists public.pools (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 40),
  owner_id    uuid not null default auth.uid() references auth.users on delete cascade,
  invite_code text not null unique,
  created_at  timestamptz not null default now()
);

create table if not exists public.pool_members (
  pool_id   uuid not null references public.pools on delete cascade,
  user_id   uuid not null references auth.users on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (pool_id, user_id)
);
create index if not exists pool_members_user on public.pool_members (user_id);

-- ── HELPERS ──

-- Security definer so policies can check membership without recursing into
-- pool_members' own policy.
create or replace function public.is_pool_member(p_pool uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from pool_members where pool_id = p_pool and user_id = auth.uid());
$$;

create or replace function public.is_pool_mate(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from pool_members a join pool_members b on a.pool_id = b.pool_id
    where a.user_id = auth.uid() and b.user_id = p_user
  );
$$;

-- 6 characters, no easily-confused letters or digits.
create or replace function public.new_invite_code()
returns text language plpgsql volatile set search_path = public as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from pools where invite_code = code);
  end loop;
  return code;
end;
$$;

-- ── ROW LEVEL SECURITY ──

alter table public.profiles     enable row level security;
alter table public.sessions     enable row level security;
alter table public.pools        enable row level security;
alter table public.pool_members enable row level security;

drop policy if exists "profiles: read self and pool mates" on public.profiles;
create policy "profiles: read self and pool mates" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_pool_mate(id));
drop policy if exists "profiles: insert self" on public.profiles;
create policy "profiles: insert self" on public.profiles
  for insert to authenticated with check (id = auth.uid());
drop policy if exists "profiles: update self" on public.profiles;
create policy "profiles: update self" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "sessions: own rows only" on public.sessions;
create policy "sessions: own rows only" on public.sessions
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Pools are created, joined and left through the functions below.
drop policy if exists "pools: members read" on public.pools;
create policy "pools: members read" on public.pools
  for select to authenticated using (public.is_pool_member(id));
drop policy if exists "pools: owner renames" on public.pools;
create policy "pools: owner renames" on public.pools
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "pools: owner deletes" on public.pools;
create policy "pools: owner deletes" on public.pools
  for delete to authenticated using (owner_id = auth.uid());

drop policy if exists "pool_members: members read" on public.pool_members;
create policy "pool_members: members read" on public.pool_members
  for select to authenticated using (public.is_pool_member(pool_id));
drop policy if exists "pool_members: leave or owner removes" on public.pool_members;
create policy "pool_members: leave or owner removes" on public.pool_members
  for delete to authenticated using (
    user_id = auth.uid()
    or exists (select 1 from public.pools p where p.id = pool_id and p.owner_id = auth.uid())
  );

-- ── FUNCTIONS CALLED BY THE APP ──

create or replace function public.create_pool(p_name text)
returns public.pools language plpgsql security definer set search_path = public as $$
declare
  pool pools;
begin
  if auth.uid() is null then raise exception 'Log in first'; end if;
  if (select count(*) from pools where owner_id = auth.uid()) >= 10 then
    raise exception 'You already run 10 pools. Calm down.';
  end if;
  insert into pools (name, owner_id, invite_code)
    values (trim(p_name), auth.uid(), new_invite_code())
    returning * into pool;
  insert into pool_members (pool_id, user_id) values (pool.id, auth.uid());
  return pool;
end;
$$;

-- What an invite link shows before joining. Works logged out.
create or replace function public.pool_preview(p_code text)
returns table (pool_id uuid, name text, owner_name text, member_count integer)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, coalesce(pr.display_name, 'A mate'),
         (select count(*)::int from pool_members m where m.pool_id = p.id)
  from pools p left join profiles pr on pr.id = p.owner_id
  where p.invite_code = upper(trim(p_code));
$$;

create or replace function public.join_pool(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  pid uuid;
begin
  if auth.uid() is null then raise exception 'Log in first'; end if;
  select id into pid from pools where invite_code = upper(trim(p_code));
  if pid is null then raise exception 'That invite code has been flushed'; end if;
  if exists (select 1 from pool_members where pool_id = pid and user_id = auth.uid()) then
    return pid;
  end if;
  if (select count(*) from pool_members where pool_id = pid) >= 25 then
    raise exception 'This pool is full (25 max)';
  end if;
  insert into pool_members (pool_id, user_id) values (pid, auth.uid());
  return pid;
end;
$$;

create or replace function public.regenerate_invite_code(p_pool uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  code text;
begin
  update pools set invite_code = new_invite_code()
    where id = p_pool and owner_id = auth.uid()
    returning invite_code into code;
  if code is null then raise exception 'Only the pool owner can do that'; end if;
  return code;
end;
$$;

-- Ranked by bog time. A single session counts for at most 60 minutes, and
-- earnings only show for people who opted in.
create or replace function public.pool_leaderboard(p_pool uuid, p_since timestamptz default null)
returns table (
  user_id uuid, display_name text, emoji text,
  total_secs integer, session_count integer, longest_secs integer,
  earned numeric, flagged_count integer, is_me boolean
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_pool_member(p_pool) then raise exception 'Not in this pool'; end if;
  return query
  select m.user_id,
         coalesce(pr.display_name, 'Mystery Pooper'),
         coalesce(pr.emoji, '💩'),
         coalesce(sum(least(s.secs, 3600)), 0)::int,
         count(s.id)::int,
         coalesce(max(least(s.secs, 3600)), 0)::int,
         case when coalesce(pr.share_money, false) then coalesce(sum(s.earned), 0) end,
         count(s.id) filter (where s.secs > 3600)::int,
         m.user_id = auth.uid()
  from pool_members m
  left join profiles pr on pr.id = m.user_id
  left join sessions s on s.user_id = m.user_id
                      and (p_since is null or s.started_at >= p_since)
  where m.pool_id = p_pool
  group by m.user_id, pr.display_name, pr.emoji, pr.share_money
  order by 4 desc, 5 desc;
end;
$$;

revoke execute on function public.new_invite_code() from public, anon, authenticated;
grant execute on function public.pool_preview(text) to anon, authenticated;
grant execute on function public.create_pool(text), public.join_pool(text),
  public.regenerate_invite_code(uuid), public.pool_leaderboard(uuid, timestamptz)
  to authenticated;

-- ── GOLDEN THRONE (arcade unlock) ──
-- One row per person who has unlocked the Bog Arcade. People can read their own
-- row; only server code (the stripe-webhook function, using the service role)
-- writes. Sources: stripe (web), apple / google (store apps, later),
-- founder (signed up before the paywall launched), gift.

create table if not exists public.entitlements (
  user_id    uuid not null references auth.users on delete cascade,
  product    text not null default 'golden_throne',
  source     text not null check (source in ('stripe', 'apple', 'google', 'founder', 'gift')),
  txn_id     text unique,
  created_at timestamptz not null default now(),
  primary key (user_id, product)
);

alter table public.entitlements enable row level security;

drop policy if exists "entitlements: read own" on public.entitlements;
create policy "entitlements: read own" on public.entitlements
  for select to authenticated using (user_id = auth.uid());

-- ── GAME STATS ──
-- Anonymous arcade usage, so we can see which games are popular. The app writes
-- one 'open' row when a game opens (locked = it hit the paywall) and 'time' rows
-- with seconds played. No user or device id. Anyone can insert; nobody can read
-- through the API. Look at it in SQL Editor: select * from game_popularity;

create table if not exists public.game_events (
  id     bigint generated always as identity primary key,
  at     timestamptz not null default now(),
  game   text not null check (game ~ '^[a-z0-9-]{1,30}$'),
  kind   text not null check (kind in ('open', 'time')),
  locked boolean not null default false,
  secs   integer check (secs between 0 and 10800)
);
create index if not exists game_events_at on public.game_events (at);

alter table public.game_events enable row level security;

drop policy if exists "game_events: anyone can add" on public.game_events;
create policy "game_events: anyone can add" on public.game_events
  for insert to anon, authenticated with check (true);
revoke all on public.game_events from anon, authenticated;
grant insert on public.game_events to anon, authenticated;

-- Last 30 days per game, most played first. Change the interval to look further back.
create or replace view public.game_popularity with (security_invoker = true) as
select game,
       count(*) filter (where kind = 'open')                    as opens,
       count(*) filter (where kind = 'open' and locked)         as paywall_hits,
       round(coalesce(sum(secs), 0) / 60.0)::int                as minutes_played,
       round(coalesce(sum(secs), 0) / 60.0
             / nullif(count(*) filter (where kind = 'open' and not locked), 0), 1) as avg_minutes_per_play
from public.game_events
where at > now() - interval '30 days'
group by game
order by minutes_played desc, opens desc;
revoke all on public.game_popularity from anon, authenticated;
