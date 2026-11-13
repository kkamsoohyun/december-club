/* 회고 모아보기: 한 멤버가 다섯 트리에 걸어 둔 카드(질문과 답)를 한곳에서 읽기
   - 트리별로 묶고, 안에서는 쓴 순서대로
   - 내 회고: 글로 복사하기, 링크로 공유하며 친구 초대하기 (?from=내 번호)
   - 친구가 그 링크로 오면 먼저 내 회고를 보여 주고, '나도 참여하기'로 클럽에 들어오게 함 */

import * as club from './club.js';
import { tr } from './letters.js';
import { treeLabel } from './cards.js';
import { t, getLang } from './i18n.js';

const TREES = ['Friends', 'Family', 'Growth', 'Feeling', 'Wish'];

const btn = document.querySelector('.mine-btn');
const panel = document.querySelector('.mine');
const body = panel.querySelector('.mine__body');
const sub = panel.querySelector('.mine__sub');
const title = panel.querySelector('.mine__title');
const copyBtn = panel.querySelector('.mine__copy');
const shareBtn = panel.querySelector('.mine__share');
const joinBtn = panel.querySelector('.mine__join');

let cards = [];
let state = 'idle';            // loading | ready | error
let seq = 0;
let owner = null;              // 지금 보고 있는 회고의 주인 번호
let onClose = null;
const SHARE_KEY = 'from';
const isMineView = () => owner === club.getMe()?.no;
const ownerName = () => club.memberName(owner);

/** 공유 링크로 들어왔으면 그 멤버 번호 (주소창에서는 지워서 새로 고침 때 다시 뜨지 않게) */
export function sharedFrom() {
  const url = new URL(location.href);
  const no = Number(url.searchParams.get(SHARE_KEY));
  if (!url.searchParams.has(SHARE_KEY)) return null;
  url.searchParams.delete(SHARE_KEY);
  history.replaceState(history.state, '', url.pathname + url.search + url.hash);
  return Number.isInteger(no) && no > 0 ? no : null;
}
const shareUrl = () => `${location.origin}${location.pathname}?${SHARE_KEY}=${club.getMe()?.no}`;

export const isOpen = () => !panel.hidden;
export const showButton = () => btn.classList.add('is-on');

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const dateOf = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(getLang() === 'en' ? 'en-US' : 'ko-KR', { month: 'short', day: 'numeric' });
};
const byTree = () => TREES.map((tree) => [tree, cards.filter((c) => c.tree === tree)]).filter(([, list]) => list.length);

function render() {
  const own = isMineView();
  const name = ownerName();
  body.replaceChildren();
  title.textContent = own ? t('mine.title') : t('mine.titleOf', { name });
  copyBtn.hidden = !(own && state === 'ready' && cards.length);
  shareBtn.hidden = !(own && club.isOnline());
  joinBtn.hidden = own;
  joinBtn.textContent = t(club.needsNickname() ? 'mine.join' : 'mine.goTrees');
  const n = state === 'ready' ? cards.length : 0;
  sub.textContent = own ? (n ? t('mine.count', { n }) : '') : t('mine.invite', { name });
  if (state !== 'ready' || !cards.length) {
    const key = state === 'loading' ? 'mine.loading' : state === 'error' ? 'mine.err' : own ? 'mine.empty' : 'mine.emptyOf';
    body.append(el('p', 'mine__msg', t(key, { name })));
    return;
  }
  for (const [tree, list] of byTree()) {
    const sec = el('section', 'mine__tree');
    sec.dataset.tree = tree;
    const h = el('h3', 'mine__treeName', treeLabel(tree));
    h.append(el('span', 'mine__n', ` ${list.length}`));
    sec.append(h);
    for (const c of list) {
      const item = el('article', 'mine__item');
      const meta = el('div', 'mine__meta');
      if (c.category) meta.append(el('span', 'mine__cat', tr(c.category)));
      meta.append(el('span', 'mine__date', dateOf(c.createdAt)));
      item.append(meta, el('p', 'mine__q', tr(c.question)), el('p', 'mine__a', c.answer));
      sec.append(item);
    }
    body.append(sec);
  }
}

async function load() {
  const my = ++seq;
  state = 'loading';
  render();
  try {
    const [all] = await Promise.all([Promise.all(TREES.map((tree) => club.fetchCards(tree))), club.refreshNames().catch(() => {})]);
    if (my !== seq) return;
    if (all.some((list) => list == null)) throw new Error('offline');
    const own = isMineView();
    cards = all.flat().filter((c) => (own ? club.isMine(c) : c.member === owner))
      .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
    state = 'ready';
  } catch { if (my === seq) state = 'error'; }
  if (my === seq && isOpen()) render();
}

/** 열기: member 를 주면 그 멤버의 회고 (없으면 내 것). 닫히면 풀리는 Promise */
export function open(member) {
  if (isOpen()) return Promise.resolve();
  owner = member ?? club.getMe()?.no ?? null;
  cards = [];
  panel.hidden = false;
  panel.toggleAttribute('data-guest', !isMineView());
  copyBtn.textContent = t('mine.copy');
  shareBtn.textContent = t('mine.share');
  load();
  setTimeout(() => (isMineView() ? panel.querySelector('.mine__x') : joinBtn).focus(), 50);
  return new Promise((resolve) => { onClose = resolve; });
}
export function close() {
  if (!isOpen()) return;
  panel.hidden = true;
  onClose?.();
  onClose = null;
}

function asText() {
  const lines = [title.textContent, ''];
  for (const [tree, list] of byTree()) {
    lines.push(`[${treeLabel(tree)}]`);
    for (const c of list) lines.push(`Q. ${tr(c.question)}`, `A. ${c.answer}`, '');
  }
  return lines.join('\n').trim();
}

copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(asText());
    copyBtn.textContent = t('mine.copied');
  } catch { copyBtn.textContent = t('mine.copyFail'); }
  setTimeout(() => { copyBtn.textContent = t('mine.copy'); }, 1800);
});
shareBtn.addEventListener('click', async () => {
  const url = shareUrl();
  const name = club.memberName(club.getMe()?.no);
  const data = { title: t('mine.shareTitle', { name }), text: t('mine.shareText', { name }), url };
  try {
    if (navigator.share && matchMedia('(pointer: coarse)').matches) { await navigator.share(data); return; }
    await navigator.clipboard.writeText(`${data.text}\n${url}`);
    shareBtn.textContent = t('mine.linkCopied');
  } catch (e) {
    if (e?.name === 'AbortError') return;                 // 공유 창을 그냥 닫음
    shareBtn.textContent = t('mine.copyFail');
  }
  setTimeout(() => { shareBtn.textContent = t('mine.share'); }, 2200);
});
joinBtn.addEventListener('click', close);
for (const ev of ['keydown', 'keyup']) panel.addEventListener(ev, (e) => { if (e.key !== 'Escape') e.stopPropagation(); });
addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen()) { e.stopPropagation(); close(); } }, true);
panel.addEventListener('pointerdown', (e) => { if (e.target === panel) close(); });
panel.querySelector('.mine__x').addEventListener('click', close);
document.addEventListener('lang:change', () => { if (isOpen()) { copyBtn.textContent = t('mine.copy'); shareBtn.textContent = t('mine.share'); render(); } });
// 카드를 새로 걸거나 떼면 다음에 열 때 다시 불러오므로 따로 캐시하지 않음
