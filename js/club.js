/* 클럽 멤버 번호와 공유 카드
   - 처음 입장하면 Club Member 01, 02 … 순서대로 번호를 받고, 닉네임을 정함
   - 닉네임을 아직 모르는 멤버는 'Club Member 01'처럼 번호로 보임
   - 저장소: Supabase(config.js에 키가 있으면) → server.py(/api) → 이 브라우저만(혼자 모드)
   - 이 브라우저는 번호를 기억해서 다시 와도 같은 번호
   - 카드는 서버에 저장되어 모든 멤버가 같은 트리를 봄
   - 서버 없이(정적 호스팅) 열면 이 브라우저 안에서만 저장되는 '혼자 모드'로 동작 */

import { SUPABASE } from './config.js';

const ME_KEY = 'december-club.member';
const SB = SUPABASE.url && SUPABASE.anonKey ? SUPABASE.url.replace(/\/+$/, '') : null;
const LOCAL_KEY = (tree) => `december-club.cards.${tree}`;

let me = null;              // { no, token, local, nickname }
let online = false;
const names = new Map();    // 번호 → 닉네임

export const memberName = (no) => names.get(Number(no)) || `Club Member ${String(no ?? 0).padStart(2, '0')}`;
export const needsNickname = () => !me?.nickname;
export const NICK_MAX = 12;
export const cleanNickname = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, NICK_MAX);
export const getMe = () => me;
export const isOnline = () => online;
export const isMine = (card) => !!me && (online ? card.member === me.no : true);

const read = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 저장 불가 환경 */ } };

// Supabase REST: rpc(함수) 호출과 카드 읽기
async function sb(path, body) {
  const res = await fetch(`${SB}/rest/v1/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      apikey: SUPABASE.anonKey,
      // 예전 방식 anon 키(eyJ…)만 Authorization 에도 넣음 — 새 방식(sb_publishable_…)은 apikey 만
      ...(SUPABASE.anonKey.startsWith('eyJ') ? { Authorization: `Bearer ${SUPABASE.anonKey}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) { const e = new Error(data?.message || res.status); e.status = res.status; throw e; }
  return data;
}
const fromRow = (r) => ({
  id: r.id, tree: r.tree, category: r.category, question: r.question,
  answer: r.answer, member: r.member, slot: r.slot, createdAt: r.created_at,
});

// server.py 의 /api 를 쓰는 경우
async function api(method, url, body) {
  if (SB) return sbApi(method, url, body);
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  if (!(res.headers.get('content-type') || '').includes('json')) throw new Error('no api');
  const data = await res.json();
  if (!res.ok) { const e = new Error(data.error || res.status); e.status = res.status; throw e; }
  return data;
}

// 같은 /api 호출을 Supabase 함수로 바꿔 주는 어댑터 (위쪽 코드는 그대로 씀)
async function sbApi(method, url, body) {
  if (url === '/api/member/check') {
    const no = await sb('rpc/check_member', { p_token: body.token });
    if (!no) { const e = new Error('unknown'); e.status = 404; throw e; }
    return { no };
  }
  if (url === '/api/member') {
    const [row] = await sb('rpc/join_club', {});
    return { no: row.no, token: row.token };
  }
  if (url.startsWith('/api/cards?tree=')) {
    const tree = decodeURIComponent(url.split('=')[1]);
    const rows = await sb(`cards?select=*&tree=eq.${encodeURIComponent(tree)}&order=created_at`);
    return { cards: rows.map(fromRow) };
  }
  if (url === '/api/cards' && method === 'POST') {
    const [row] = await sb('rpc/hang_card', {
      p_token: body.token, p_tree: body.tree, p_category: body.category,
      p_question: body.question, p_answer: body.answer, p_slot: body.slot ?? null,
    });
    return { card: fromRow(row) };
  }
  if (url === '/api/member/name') {
    return { name: await sb('rpc/set_nickname', { p_token: body.token, p_name: body.name }) };
  }
  if (url === '/api/members/names') {
    const rows = await sb('rpc/member_names', {});
    return { names: Object.fromEntries(rows.map((r) => [r.no, r.nickname])) };
  }
  if (url === '/api/cards' && method === 'DELETE') {
    const ok = await sb('rpc/remove_card', { p_token: body.token, p_id: body.id });
    if (!ok) { const e = new Error('not yours'); e.status = 403; throw e; }
    return { ok };
  }
  throw new Error('unknown route');
}

/** 입장: 번호 받기 (이미 받았으면 그대로) */
export async function join() {
  const saved = read(ME_KEY);
  try {
    let ok = false;
    if (saved?.token && !saved.local) {
      try {
        await api('POST', '/api/member/check', { token: saved.token });
        me = saved; online = true; ok = true;
      } catch (e) { if (e.status !== 404) throw e; }      // 서버 기록이 지워졌으면 새로 받음
    }
    if (!ok) {
      const { no, token } = await api('POST', '/api/member', {});
      me = { no, token }; online = true;
      write(ME_KEY, me);
    }
  } catch {
    online = false;
    me = saved?.local ? saved : { no: 1, local: true };
    write(ME_KEY, me);
  }
  if (me.nickname) names.set(me.no, me.nickname);
  if (online) await refreshNames();
  // 다른 기기에서 정한 닉네임이 서버에 있으면 그걸 씀
  if (!me.nickname && names.has(me.no)) { me.nickname = names.get(me.no); write(ME_KEY, me); }
  return me;
}

/** 닉네임 정하기/바꾸기 → 정해진 이름 */
export async function setNickname(raw) {
  const name = cleanNickname(raw);
  if (!name) throw new Error('empty');
  let saved = name;
  if (online) {
    try { saved = (await api('POST', '/api/member/name', { token: me.token, name })).name || name; }
    catch (e) { if (e.status === 403 || e.status === 400) throw e; }   // 서버에 닉네임 기능이 아직 없으면 이 브라우저에만
  }
  me.nickname = saved;
  names.set(me.no, saved);
  write(ME_KEY, me);
  return saved;
}

/** 모든 멤버의 닉네임 다시 받기 → 바뀐 게 있으면 true */
let namesMissing = false;   // 서버에 닉네임 기능이 아직 없으면 다시 묻지 않음
export async function refreshNames() {
  if (!online || namesMissing) return false;
  let got;
  try { got = (await api('GET', '/api/members/names')).names || {}; }
  catch (e) { if (e.status === 404) namesMissing = true; return false; }
  let changed = false;
  for (const [no, name] of Object.entries(got)) {
    if (names.get(Number(no)) !== name) { names.set(Number(no), name); changed = true; }
  }
  if (me?.nickname && !(me.no in got)) names.set(me.no, me.nickname);   // 서버에 아직 없으면 내 것은 그대로
  return changed;
}

export async function fetchCards(tree) {
  if (online) {
    try { return (await api('GET', `/api/cards?tree=${encodeURIComponent(tree)}`)).cards; }
    catch { return null; }                                 // 잠깐 끊겼으면 이번엔 건너뜀
  }
  return read(LOCAL_KEY(tree)) || [];
}

/** 카드 걸기 → 저장된 카드(번호·자리 확정)를 돌려줌 */
export async function addCard(draft) {
  if (online) return (await api('POST', '/api/cards', { ...draft, token: me.token })).card;
  const card = {
    ...draft,
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    member: me.no,
    createdAt: new Date().toISOString(),
  };
  const cards = read(LOCAL_KEY(draft.tree)) || [];
  cards.push(card);
  write(LOCAL_KEY(draft.tree), cards);
  return card;
}

export async function removeCard(card) {
  if (online) {
    await api('DELETE', '/api/cards', { id: card.id, token: me.token });
    return;
  }
  write(LOCAL_KEY(card.tree), (read(LOCAL_KEY(card.tree)) || []).filter((c) => c.id !== card.id));
}
