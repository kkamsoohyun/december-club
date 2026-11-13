-- December Club — 공감(좋아요) 기능 추가 (supabase.sql 을 이미 실행한 프로젝트에 이것만 실행)
-- Supabase 대시보드 → SQL Editor → New query 에 붙여 넣고 Run

-- 누가 어떤 카드에 공감했는지 (한 사람당 카드 하나에 한 번)
create table if not exists public.card_likes (
  card_id     uuid   not null references public.cards(id) on delete cascade,
  member      bigint not null references public.members(no) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (card_id, member)
);
-- 표는 밖에서 직접 못 보고, 아래 함수로만 (누가 눌렀는지는 공개하지 않고 개수만)
alter table public.card_likes enable row level security;
revoke all on public.card_likes from anon, authenticated;

-- 한 트리의 카드별 공감 수 + 내가 눌렀는지
create or replace function public.like_counts(p_tree text, p_token text default null)
returns table (card_id uuid, likes bigint, mine boolean)
language sql stable security definer set search_path = public as $$
  with me as (select no from members where token_hash = _hash(p_token))
  select l.card_id, count(*)::bigint, coalesce(bool_or(l.member = (select no from me)), false)
    from card_likes l join cards c on c.id = l.card_id
   where c.tree = p_tree
   group by l.card_id
$$;

-- 공감 누르기/취소 (내 카드에는 못 누름) → 바뀐 공감 수와 내 상태
create or replace function public.toggle_like(p_token text, p_card uuid)
returns table (likes bigint, mine boolean)
language plpgsql security definer set search_path = public as $$
declare
  m bigint;
  owner bigint;
begin
  select no into m from members where token_hash = _hash(p_token);
  if m is null then raise exception 'unknown member' using errcode = '28000'; end if;
  select c.member into owner from cards c where c.id = p_card;
  if owner is null then raise exception 'no card' using errcode = 'P0002'; end if;
  if owner = m then raise exception 'own card' using errcode = '22023'; end if;
  if exists (select 1 from card_likes l where l.card_id = p_card and l.member = m) then
    delete from card_likes l where l.card_id = p_card and l.member = m;
  else
    insert into card_likes (card_id, member) values (p_card, m);
  end if;
  return query
    select count(*)::bigint, coalesce(bool_or(l.member = m), false) from card_likes l where l.card_id = p_card;
end $$;

grant execute on function public.like_counts(text, text) to anon, authenticated;
grant execute on function public.toggle_like(text, uuid) to anon, authenticated;

-- API 가 새 표·함수를 바로 알아보도록
notify pgrst, 'reload schema';
