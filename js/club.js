/* 클럽 멤버 번호와 공유 카드
   - 처음 입장하면 서버(server.py)가 Club Member 01, 02 … 순서대로 번호를 줌
   - 이 브라우저는 번호를 기억해서 다시 와도 같은 번호
   - 카드는 서버에 저장되어 모든 멤버가 같은 트리를 봄
   - 서버 없이(정적 호스팅) 열면 이 브라우저 안에서만 저장되는 '혼자 모드'로 동작 */

const ME_KEY = 'december-club.member';
const LOCAL_KEY = (tree) => `december-club.cards.${tree}`;

let me = null;              // { no, token, local }
let online = false;

export const memberName = (no) => `Club Member ${String(no ?? 0).padStart(2, '0')}`;
export const getMe = () => me;
export const isOnline = () => online;
export const isMine = (card) => !!me && (online ? card.member === me.no : true);

const read = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 저장 불가 환경 */ } };

async function api(method, url, body) {
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

/** 입장: 번호 받기 (이미 받았으면 그대로) */
export async function join() {
  const saved = read(ME_KEY);
  try {
    if (saved?.token && !saved.local) {
      try {
        await api('POST', '/api/member/check', { token: saved.token });
        me = saved; online = true; return me;
      } catch (e) { if (e.status !== 404) throw e; }      // 서버 기록이 지워졌으면 새로 받음
    }
    const { no, token } = await api('POST', '/api/member', {});
    me = { no, token }; online = true;
    write(ME_KEY, me);
  } catch {
    online = false;
    me = saved?.local ? saved : { no: 1, local: true };
    write(ME_KEY, me);
  }
  return me;
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
