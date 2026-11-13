-- December Club — 음악 우체통: 연말에 함께 듣고 싶은 노래 추천 (supabase.sql 을 이미 실행한 프로젝트에 이것만 실행)
-- Supabase 대시보드 → SQL Editor → New query 에 붙여 넣고 Run

create table if not exists public.song_recs (
  id          uuid primary key default gen_random_uuid(),
  member      bigint not null references public.members(no) on delete cascade,
  title       text   not null check (char_length(title) between 1 and 60),
  artist      text   not null default '' check (char_length(artist) <= 40),
  note        text   not null default '' check (char_length(note) <= 80),
  created_at  timestamptz not null default now()
);
create index if not exists song_recs_created on public.song_recs (created_at desc);
-- 표는 밖에서 직접 못 건드리고, 아래 함수로만
alter table public.song_recs enable row level security;
revoke all on public.song_recs from anon, authenticated;

-- 추천 목록 (최신순, 최대 300곡)
create or replace function public.list_songs()
returns table (id uuid, member bigint, title text, artist text, note text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select id, member, title, artist, note, created_at from song_recs order by created_at desc limit 300
$$;

-- 노래 추천하기 (한 사람당 10곡까지)
create or replace function public.add_song(p_token text, p_title text, p_artist text, p_note text)
returns table (id uuid, member bigint, title text, artist text, note text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  m bigint;
  t text := left(btrim(regexp_replace(coalesce(p_title, ''), '\s+', ' ', 'g')), 60);
  a text := left(btrim(regexp_replace(coalesce(p_artist, ''), '\s+', ' ', 'g')), 40);
  n text := left(btrim(regexp_replace(coalesce(p_note, ''), '\s+', ' ', 'g')), 80);
begin
  select no into m from members where token_hash = _hash(p_token);
  if m is null then raise exception 'unknown member' using errcode = '28000'; end if;
  if char_length(t) < 1 then raise exception 'empty title' using errcode = '22023'; end if;
  if (select count(*) from song_recs s where s.member = m) >= 10 then
    raise exception 'too many songs' using errcode = '22023';
  end if;
  return query
    insert into song_recs as s (member, title, artist, note) values (m, t, a, n)
    returning s.id, s.member, s.title, s.artist, s.note, s.created_at;
end $$;

-- 내가 추천한 노래 빼기
create or replace function public.remove_song(p_token text, p_id uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
declare m bigint;
begin
  select no into m from members where token_hash = _hash(p_token);
  if m is null then return false; end if;
  delete from song_recs s where s.id = p_id and s.member = m;
  return found;
end $$;

grant execute on function public.list_songs() to anon, authenticated;
grant execute on function public.add_song(text, text, text, text) to anon, authenticated;
grant execute on function public.remove_song(text, uuid) to anon, authenticated;

-- API 가 새 표·함수를 바로 알아보도록
notify pgrst, 'reload schema';
