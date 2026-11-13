-- December Club — 닉네임 기능 추가 (supabase.sql 을 이미 실행한 프로젝트에 이것만 실행)
-- Supabase 대시보드 → SQL Editor → New query 에 붙여 넣고 Run

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

-- API 가 새 칸·함수를 바로 알아보도록
notify pgrst, 'reload schema';
