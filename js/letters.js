/* 편지 카드 (눈사람 모양 편지지)
   - 앞면: 사진 + 랜덤 질문 / 뒷면: 답변 쓰는 칸
   - 다 쓰면 "트리에 달기" → 트리에 걸린 카드는 다시 눌러서 볼 수 있음
   - 저장은 club.js(공유 서버)가 맡고, 여기서는 화면만 다룸 */
import { memberName, getMe, isMine } from './club.js';

export const QUESTIONS = {
  Friends: [
    {
      category: '기억하고 싶은 순간',
      items: [
        '올해 친구와 함께했던 순간 중 다시 돌아가고 싶은 하루가 있나요?',
        '별것 아닌 일이었지만 유독 오래 기억에 남는 친구와의 대화가 있나요?',
        '올해 친구와 함께한 일 중 가장 예상 밖으로 즐거웠던 경험은?',
        '사진으로 남기지는 못했지만 마음속에 간직하고 있는 순간이 있나요?',
      ],
    },
    {
      category: '고마웠던 마음',
      items: [
        '올해 나에게 가장 큰 힘이 되어준 친구는 누구였나요? 어떤 순간이었나요?',
        '친구에게 무심코 들었던 말 중 아직도 기억에 남는 말이 있나요?',
        '올해 누군가의 작은 배려 덕분에 하루가 좋아졌던 경험을 이야기해 주세요.',
        '평소에는 쑥스러워서 하지 못했지만 꼭 전하고 싶은 말이 있나요?',
      ],
    },
    {
      category: '관계 속의 나',
      items: [
        '올해 친구들과 지내면서 새롭게 발견한 나의 모습은 무엇인가요?',
        '누군가와 가까워지거나 멀어지는 과정에서 배운 것이 있나요?',
        '예전과 비교했을 때 친구를 대하는 나의 태도는 어떻게 달라졌나요?',
        '올해 나에게 좋은 친구란 어떤 사람인지 다시 생각하게 된 계기가 있었나요?',
      ],
    },
    {
      category: '조금은 특별한 질문',
      items: [
        '올해의 나를 가장 잘 아는 친구 한 명을 꼽는다면 누구인가요? 그 친구는 나의 어떤 모습을 알고 있을까요?',
        '친구와 함께했던 일 중 다른 사람에게는 설명하기 어렵지만 우리에게는 특별한 추억이 있나요?',
        '올해 누군가에게 먼저 손을 내밀었던 순간이 있나요?',
        '시간이 지나도 꼭 이어가고 싶은 관계가 있다면, 그 이유는 무엇인가요?',
      ],
    },
    {
      category: '앞으로의 관계',
      items: [
        '내년에는 친구들과 어떤 새로운 추억을 만들고 싶나요?',
        '올해 더 자주 만나지 못해 아쉬웠던 사람이 있나요?',
        '소중한 사람들에게 앞으로 어떤 친구로 기억되고 싶나요?',
        '내년의 어느 날, 친구와 함께 꼭 해보고 싶은 일이 있나요?',
      ],
    },
  ],
};

export const PHOTOS = { Friends: 'assets/friends.webp' };
const MAX_LEN = 300;

function randomQuestion(tree, except) {
  const groups = QUESTIONS[tree];
  for (let i = 0; i < 20; i++) {
    const g = groups[Math.floor(Math.random() * groups.length)];
    const q = g.items[Math.floor(Math.random() * g.items.length)];
    if (q !== except) return { category: g.category, question: q };
  }
  return { category: groups[0].category, question: groups[0].items[0] };
}

/* ───────── 모달 ───────── */
const modal = document.querySelector('.letter-modal');
const letter = modal.querySelector('.letter');
const photo = modal.querySelector('.letter__photo');
const tagCat = modal.querySelector('.js-cat');
const tagTree = modal.querySelector('.js-tree');
const qFront = modal.querySelector('.letter__q');
const qBack = modal.querySelector('.letter__q-small');
const answer = modal.querySelector('.letter__answer');
const answerView = modal.querySelector('.letter__answer-view');
const count = modal.querySelector('.letter__count span');
const dateEl = modal.querySelector('.letter__date');
const fromEl = modal.querySelector('.letter__from');
const btn = {
  close: modal.querySelector('.js-close'),
  reroll: modal.querySelector('.js-reroll'),
  toBack: modal.querySelector('.js-to-back'),
  toFront: modal.querySelector('.js-to-front'),
  hang: modal.querySelector('.js-hang'),
  flip: modal.querySelector('.js-flip'),
  remove: modal.querySelector('.js-remove'),
};

let mode = null;          // 'write' | 'view'
let tree = 'Friends';
let current = null;       // { category, question } 또는 저장된 카드
let onHang = null, onRemove = null;
const drafts = {};        // 트리별 작성 중이던 카드 (닫았다 다시 열어도 유지)

export const isOpen = () => !modal.hidden;

function setSide(back) {
  letter.classList.toggle('is-flipped', back);
  modal.dataset.side = back ? 'back' : 'front';
  if (back && mode === 'write') setTimeout(() => answer.focus({ preventScroll: true }), 450);
}

function fill(card) {
  tagTree.textContent = tree;
  tagCat.textContent = card.category;
  qFront.textContent = card.question;
  qBack.textContent = card.question;
  photo.src = PHOTOS[tree];
}

function updateCount() {
  count.textContent = answer.value.length;
  btn.hang.disabled = answer.value.trim().length === 0;
}

function open() {
  modal.hidden = false;
  requestAnimationFrame(() => modal.classList.add('is-open'));
  document.dispatchEvent(new Event('letter:open'));
}

export function close() {
  if (!isOpen()) return;
  if (mode === 'write') drafts[tree] = { ...current, answer: answer.value };
  modal.classList.remove('is-open');
  answer.blur();
  setTimeout(() => { modal.hidden = true; document.dispatchEvent(new Event('letter:close')); }, 350);
}

/** 새 카드 쓰기 */
export function openWriter(treeName, hangCallback) {
  tree = treeName;
  mode = 'write';
  modal.dataset.mode = 'write';
  onHang = hangCallback;
  const d = drafts[tree];
  current = d ? { category: d.category, question: d.question } : randomQuestion(tree);
  fill(current);
  answer.value = d ? d.answer : '';
  answer.hidden = false;
  answerView.hidden = true;
  dateEl.textContent = '';
  fromEl.textContent = `From. ${memberName(getMe()?.no)}`;
  updateCount();
  setSide(false);
  open();
}

/** 트리에 걸린 카드 보기 (답변 면부터) */
export function openViewer(treeName, card, removeCallback) {
  tree = treeName;
  mode = 'view';
  modal.dataset.mode = 'view';
  onRemove = removeCallback;
  current = card;
  fill(card);
  answer.hidden = true;
  answerView.hidden = false;
  answerView.textContent = card.answer;
  const d = new Date(card.createdAt);
  dateEl.textContent = isNaN(d) ? '' : `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
  fromEl.textContent = `From. ${memberName(card.member)}`;
  btn.remove.hidden = !isMine(card);                      // 내가 건 카드만 떼어낼 수 있음
  setSide(false);
  open();
  setTimeout(() => setSide(true), 500);    // 펼치자마자 뒤집혀 답변이 보이게
}

/* ───────── 이벤트 ───────── */
answer.maxLength = MAX_LEN;
answer.addEventListener('input', updateCount);
btn.close.addEventListener('click', close);
modal.querySelector('.letter-modal__backdrop').addEventListener('click', close);
btn.reroll.addEventListener('click', () => {
  current = randomQuestion(tree, current.question);
  fill(current);
  letter.classList.remove('is-rerolled');
  void letter.offsetWidth;
  letter.classList.add('is-rerolled');
});
btn.toBack.addEventListener('click', () => setSide(true));
btn.toFront.addEventListener('click', () => setSide(false));
btn.flip.addEventListener('click', () => setSide(!letter.classList.contains('is-flipped')));
modal.querySelector('.letter__face--front').addEventListener('click', () => setSide(true));

btn.hang.addEventListener('click', async () => {
  const text = answer.value.trim();
  if (!text || btn.hang.disabled) return;
  const draft = { tree, category: current.category, question: current.question, answer: text };
  btn.hang.disabled = true;
  try {
    await onHang(draft);                          // 저장이 끝나야 날려 보냄
  } catch {
    btn.hang.disabled = false;
    alert('카드를 걸지 못했어요. 잠시 후 다시 시도해 주세요.');
    return;
  }
  delete drafts[tree];
  answer.value = '';
  mode = null;
  letter.classList.add('is-hanging');           // 작아지며 날아가는 연출
  setTimeout(() => {
    letter.classList.remove('is-hanging');
    modal.classList.remove('is-open');
    modal.hidden = true;
    document.dispatchEvent(new Event('letter:close'));
  }, 650);
});

btn.remove.addEventListener('click', async () => {
  if (!current || !confirm('이 카드를 트리에서 떼어낼까요?')) return;
  const removed = current;
  try { await onRemove(removed); } catch { alert('카드를 떼지 못했어요. 잠시 후 다시 시도해 주세요.'); return; }
  close();
});

addEventListener('keydown', (e) => {
  if (!isOpen()) return;
  if (e.key === 'Escape') close();
  e.stopPropagation();
}, true);
