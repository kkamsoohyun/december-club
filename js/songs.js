/* 음악 우체통: 연말에 함께 듣고 싶은 노래를 서로 추천하는 목록
   - 우체통을 누르면 열림. 노래 제목·가수·한 줄 이유를 적어 넣으면 모두에게 보임
   - 내가 넣은 노래만 뺄 수 있음 */

import * as club from './club.js';
import { t } from './i18n.js';

const form = document.querySelector('.songs');
const list = form.querySelector('.songs__list');
const count = form.querySelector('.songs__count');
const err = form.querySelector('.songs__err');
const go = form.querySelector('.songs__go');
const fields = { title: form.elements.title, artist: form.elements.artist, note: form.elements.note };

let songs = [];
let state = 'idle';           // loading | ready | error
let onClose = null;
let loadSeq = 0;              // 늦게 도착한 옛 목록이 새 목록을 덮지 않도록

export const isOpen = () => !form.hidden;

const msg = (key) => {
  const li = document.createElement('li');
  li.className = 'is-msg';
  li.textContent = t(key);
  return li;
};

function render() {
  list.replaceChildren();
  count.textContent = state === 'ready' && songs.length ? t('songs.count', { n: songs.length }) : '';
  if (state === 'loading') return list.append(msg('songs.loading'));
  if (state === 'error') return list.append(msg('songs.err'));
  if (!songs.length) return list.append(msg('songs.empty'));
  for (const s of songs) {
    const li = document.createElement('li');
    const head = document.createElement('div');
    head.className = 'song__head';
    const name = document.createElement('span');
    name.className = 'song__name';
    const b = document.createElement('b');
    b.textContent = s.title;
    name.append(b);
    if (s.artist) {
      const a = document.createElement('span');
      a.className = 'song__artist';
      a.textContent = ` · ${s.artist}`;
      name.append(a);
    }
    head.append(name);
    li.append(head);
    if (s.note) {
      const p = document.createElement('p');
      p.className = 'song__note';
      p.textContent = s.note;
      li.append(p);
    }
    const foot = document.createElement('div');
    foot.className = 'song__foot';
    const from = document.createElement('span');
    from.className = 'song__from';
    from.textContent = t('songs.from', { name: club.memberName(s.member) });
    const listen = document.createElement('a');
    listen.className = 'song__listen';
    listen.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${s.title} ${s.artist || ''}`.trim())}`;
    listen.target = '_blank';
    listen.rel = 'noopener noreferrer';
    listen.textContent = t('songs.listen');
    foot.append(from, listen);
    if (club.isMySong(s)) {
      const rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'song__remove';
      rm.textContent = t('songs.remove');
      rm.addEventListener('click', () => remove(s, rm));
      foot.append(rm);
    }
    li.append(foot);
    list.append(li);
  }
}

async function load(quiet = false) {
  const seq = ++loadSeq;
  if (!quiet) { state = 'loading'; render(); }
  try {
    await club.refreshNames?.();
    const fresh = await club.fetchSongs();
    if (seq !== loadSeq) return;
    songs = fresh;
    state = 'ready';
  } catch { if (seq !== loadSeq) return; if (!quiet) state = 'error'; }
  if (isOpen()) render();
}

async function remove(song, btn) {
  btn.disabled = true;
  try {
    await club.removeSong(song);
    songs = songs.filter((s) => s.id !== song.id);
    render();
  } catch { btn.disabled = false; }
}

/** 열기 (닫히면 done 호출) */
export function open(done) {
  if (isOpen()) return;
  onClose = done;
  err.textContent = club.isOnline() ? '' : t('songs.solo');
  for (const f of Object.values(fields)) f.value = '';
  go.disabled = false;
  form.hidden = false;
  load();
  window.Sound?.swish?.(0.4);
}
export function close() {
  if (!isOpen()) return;
  form.hidden = true;
  onClose?.();
  onClose = null;
}

// 입력 중에는 캐릭터가 걷지 않도록 키를 여기서 멈춤
for (const ev of ['keydown', 'keyup']) form.addEventListener(ev, (e) => { if (e.key !== 'Escape') e.stopPropagation(); });
form.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
form.addEventListener('pointerdown', (e) => { if (e.target === form) close(); });
form.querySelector('.songs__x').addEventListener('click', close);
document.addEventListener('lang:change', () => { if (isOpen()) render(); });

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = fields.title.value.trim();
  if (!title) { err.textContent = t('songs.needTitle'); fields.title.focus(); return; }
  go.disabled = true;
  err.textContent = '';
  try {
    const song = await club.addSong({ title, artist: fields.artist.value, note: fields.note.value });
    loadSeq++;                                         // 불러오던 목록은 버리고
    songs = [song, ...songs.filter((s) => s.id !== song.id)];
    state = 'ready';
    for (const f of Object.values(fields)) f.value = '';
    render();
    list.scrollTop = 0;
    load(true);                                        // 그 사이 다른 멤버가 넣은 곡까지 다시 받아 옴
    window.Sound?.swish?.(0.5);
  } catch (ex) {
    err.textContent = t(/too many/.test(ex.message) ? 'songs.tooMany' : 'songs.fail');
  }
  go.disabled = false;
});
