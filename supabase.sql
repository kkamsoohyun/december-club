-- December Club — Supabase 설정
-- Supabase 대시보드 → SQL Editor → New query 에 전부 붙여 넣고 Run 한 번.
-- (여러 번 실행해도 안전하게 만들어 둠)

-- 멤버: 입장 순서대로 1, 2, 3 … (Club Member 01, 02 …)
create table if not exists public.members (
  no          bigint generated always as identity primary key,
  token_hash  text not null unique,             -- 본인 확인용 토큰의 해시 (토큰 자체는 저장 안 함)
  created_at  timestamptz not null default now()
);

-- 트리에 걸린 카드
create table if not exists public.cards (
  id          uuid primary key default gen_random_uuid(),
  tree        text not null check (tree in ('Friends', 'Family', 'Growth', 'Feeling', 'Wish')),
  category    text not null default '' check (char_length(category) <= 60),
  question    text not null default '' check (char_length(question) <= 200),
  answer      text not null check (char_length(answer) between 1 and 300),
  member      bigint not null references public.members(no) on delete cascade,
  slot        int not null check (slot between 0 and 999),
  created_at  timestamptz not null default now(),
  unique (tree, slot)
);
create index if not exists cards_tree_idx on public.cards (tree);

-- 보안: 카드는 누구나 읽기만, 쓰기·지우기는 아래 함수로만. 멤버 표는 밖에서 못 봄.
alter table public.members enable row level security;
alter table public.cards   enable row level security;
drop policy if exists "cards are public" on public.cards;
create policy "cards are public" on public.cards for select to anon, authenticated using (true);
revoke insert, update, delete on public.cards from anon, authenticated;
revoke all on public.members from anon, authenticated;

create or replace function public._hash(p_token text) returns text
language sql immutable as $$ select encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex') $$;

-- 입장: 새 번호와 토큰 발급
create or replace function public.join_club()
returns table (no bigint, token text)
language plpgsql security definer set search_path = public as $$
declare
  t text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  return query insert into members (token_hash) values (_hash(t)) returning members.no, t;
end $$;

-- 다시 방문: 토큰으로 내 번호 확인 (없으면 null)
create or replace function public.check_member(p_token text)
returns bigint
language sql stable security definer set search_path = public as $$
  select no from members where token_hash = _hash(p_token)
$$;

-- 카드 걸기: 원하는 자리가 이미 찼으면 가장 앞의 빈 자리로
create or replace function public.hang_card(p_token text, p_tree text, p_category text, p_question text, p_answer text, p_slot int)
returns setof public.cards
language plpgsql security definer set search_path = public as $$
declare
  m bigint;
  s int := p_slot;
begin
  select no into m from members where token_hash = _hash(p_token);
  if m is null then raise exception 'unknown member' using errcode = '28000'; end if;
  if s is null or s < 0 or s > 999 or exists (select 1 from cards where tree = p_tree and slot = s) then
    select min(g) into s from generate_series(0, 999) g
     where not exists (select 1 from cards where tree = p_tree and slot = g);
  end if;
  return query insert into cards (tree, category, question, answer, member, slot)
    values (p_tree, left(coalesce(p_category, ''), 60), left(coalesce(p_question, ''), 200), left(btrim(p_answer), 300), m, s)
    returning *;
end $$;

-- 카드 떼기: 내가 건 카드만
create or replace function public.remove_card(p_token text, p_id uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  m bigint;
begin
  select no into m from members where token_hash = _hash(p_token);
  delete from cards where id = p_id and member = m;
  return found;
end $$;

revoke all on function public._hash(text) from public, anon, authenticated;
grant execute on function public.join_club() to anon, authenticated;
grant execute on function public.check_member(text) to anon, authenticated;
grant execute on function public.hang_card(text, text, text, text, text, int) to anon, authenticated;
grant execute on function public.remove_card(text, uuid) to anon, authenticated;

-- ───────── 닉네임 ─────────
-- 입장할 때 정한 이름 (1~12자). 토큰을 가진 본인만 바꿀 수 있고, 누구나 번호→이름 목록만 볼 수 있음
alter table public.members add column if not exists nickname text
  check (nickname is null or char_length(nickname) between 1 and 12);

create or replace function public.set_nickname(p_token text, p_name text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  n text := left(btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')), 12);
begin
  if char_length(n) < 1 then raise exception 'empty nickname' using errcode = '22023'; end if;
  update members set nickname = n where token_hash = _hash(p_token);
  if not found then raise exception 'unknown member' using errcode = '28000'; end if;
  return n;
end $$;

create or replace function public.member_names()
returns table (no bigint, nickname text)
language sql stable security definer set search_path = public as $$
  select no, nickname from members where nickname is not null
$$;

grant execute on function public.set_nickname(text, text) to anon, authenticated;
grant execute on function public.member_names() to anon, authenticated;
