/* 편지 카드 (Friends: 눈사람 편지지 / Family: 체크 지붕 집 카드 / Growth: 진저브레드 편지지)
   - 앞면: 사진 + 랜덤 질문 / 뒷면: 답변 쓰는 칸
   - 다 쓰면 "트리에 달기" → 트리에 걸린 카드는 다시 눌러서 볼 수 있음
   - 저장은 club.js(공유 서버)가 맡고, 여기서는 화면만 다룸 */
import { memberName, getMe, isMine, fetchCards } from './club.js';
import { cardStyle, cardImages, CARD_STYLES } from './cards.js';
import { t, getLang } from './i18n.js';
import { QUESTIONS_EN } from './questions-en.js';

// 카드 앞뒤 그림은 만드는 데 시간이 조금 걸려서, 페이지가 한가할 때 미리 준비
const idle = window.requestIdleCallback || ((f) => setTimeout(f, 1200));
idle(() => Object.keys(CARD_STYLES).reduce((p, t) => p.then(() => cardImages(t)), Promise.resolve()));

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
  Family: [
    {
      category: '함께한 시간',
      items: [
        '올해 가족과 함께한 순간 중 가장 따뜻했던 장면은 무엇인가요?',
        '평범한 하루였지만 유난히 기억에 남는 가족과의 식탁이 있나요?',
        '올해 가족과 함께 처음 해본 일이 있다면 무엇인가요?',
        '가족과 나눈 대화 중 오래 마음에 남은 한마디가 있나요?',
      ],
    },
    {
      category: '고마운 마음',
      items: [
        '올해 가족에게 가장 고마웠던 순간은 언제였나요?',
        '말로 표현하지 못했지만 가족에게 꼭 전하고 싶은 고마움이 있나요?',
        '힘들 때 가족 덕분에 버틸 수 있었던 순간이 있었나요?',
        '가족이 나를 위해 해준 작은 일 중 기억에 남는 것이 있나요?',
      ],
    },
    {
      category: '조금 더 알게 된 가족',
      items: [
        '올해 가족의 새로운 모습을 발견한 적이 있나요?',
        '가족과 닮았다고 느낀 나의 모습이 있나요?',
        '예전에는 이해하지 못했지만 이제는 알 것 같은 가족의 마음이 있나요?',
        '가족에게 내가 어떤 존재인지 느꼈던 순간이 있었나요?',
      ],
    },
    {
      category: '우리 집의 작은 이야기',
      items: [
        '우리 가족만 아는 웃긴 이야기나 습관이 있나요?',
        '집에서 가장 좋아하는 자리나 시간은 언제인가요?',
        '우리 집의 연말 풍경을 한 장면으로 그린다면 어떤 모습인가요?',
        '가족을 떠올리면 생각나는 냄새나 소리, 음식이 있나요?',
      ],
    },
    {
      category: '내년의 우리',
      items: [
        '내년에는 가족과 어떤 추억을 만들고 싶나요?',
        '가족에게 내년에는 더 자주 해주고 싶은 말이나 행동이 있나요?',
        '가족과 함께 꼭 가보고 싶은 곳이 있나요?',
        '몇 년 뒤 우리 가족이 어떤 모습이었으면 좋겠나요?',
      ],
    },
  ],
  Growth: [
    {
      category: '달라진 나',
      items: [
        '올해의 나는 작년의 나와 무엇이 가장 달라졌나요?',
        '올해 처음으로 해본 일 중 가장 용기가 필요했던 것은 무엇인가요?',
        '예전에는 어려웠지만 이제는 조금 편해진 일이 있나요?',
        '올해 새로 생긴 좋은 습관이 있다면 무엇인가요?',
      ],
    },
    {
      category: '넘어지고 일어서기',
      items: [
        '올해 가장 힘들었던 순간은 언제였고, 어떻게 지나왔나요?',
        '실패라고 생각했지만 돌아보니 배움이 된 일이 있나요?',
        '포기하고 싶었지만 끝까지 해낸 일이 있나요?',
        '스스로를 다독여 준 나만의 방법이 있었나요?',
      ],
    },
    {
      category: '배우고 깨달은 것',
      items: [
        '올해 배운 것 중 가장 오래 남을 것 같은 한 가지는 무엇인가요?',
        '누군가에게서 배운 태도나 말 중 마음에 새긴 것이 있나요?',
        '올해 생각이 바뀐 일이 있다면 무엇인가요?',
        '나에 대해 새롭게 알게 된 점이 있나요?',
      ],
    },
    {
      category: '나를 칭찬하기',
      items: [
        '올해 스스로에게 가장 칭찬해 주고 싶은 순간은 언제인가요?',
        '아무도 몰랐지만 나는 알고 있는 나의 노력이 있나요?',
        '올해의 나에게 상을 준다면 어떤 이름의 상을 주고 싶나요?',
        '작지만 꾸준히 해낸 일이 있다면 무엇인가요?',
      ],
    },
    {
      category: '내년의 성장',
      items: [
        '내년에는 어떤 모습으로 한 뼘 더 자라고 싶나요?',
        '내년에 새로 배워 보고 싶은 것이 있나요?',
        '내년의 나에게 꼭 지켜 주었으면 하는 약속이 있나요?',
        '1년 뒤의 나에게 어떤 말을 듣고 싶나요?',
      ],
    },
  ],
  Feeling: [
    {
      category: '올해의 감정',
      items: [
        '올해를 하나의 감정으로 표현한다면 어떤 감정인가요?',
        '올해 가장 많이 웃었던 순간은 언제였나요?',
        '올해 가장 많이 울컥했던 순간이 있나요?',
        '올해 나를 가장 자주 찾아온 기분은 무엇이었나요?',
      ],
    },
    {
      category: '마음이 따뜻했던 순간',
      items: [
        '올해 마음이 몽글몽글해졌던 순간이 있나요?',
        '누군가의 말 한마디에 하루가 환해졌던 적이 있나요?',
        '올해 "아, 행복하다" 하고 느낀 순간은 언제였나요?',
        '생각만 해도 미소가 지어지는 올해의 장면이 있나요?',
      ],
    },
    {
      category: '조금 힘들었던 마음',
      items: [
        '올해 마음이 무거웠던 날, 나를 버티게 해준 것은 무엇이었나요?',
        '올해 털어놓지 못하고 혼자 삼켰던 마음이 있나요?',
        '불안하거나 걱정될 때 나는 어떻게 마음을 달랬나요?',
        '올해 내 마음을 가장 많이 흔든 일은 무엇이었나요?',
      ],
    },
    {
      category: '지금 이 순간의 마음',
      items: [
        '이 카드를 쓰는 지금, 내 마음은 어떤 날씨인가요?',
        '요즘 나를 설레게 하는 것이 있나요?',
        '지금 가장 듣고 싶은 말은 무엇인가요?',
        '요즘 내 마음을 편안하게 해주는 것은 무엇인가요?',
      ],
    },
    {
      category: '마음 전하기',
      items: [
        '올해 고맙다고 말하지 못한 마음을 지금 전해 볼까요?',
        '미안했던 마음이 남아 있는 사람이 있나요?',
        '올해의 나에게 "수고했어" 말고 해주고 싶은 말이 있나요?',
        '내년의 나는 어떤 마음으로 하루를 보냈으면 좋겠나요?',
      ],
    },
  ],
  Wish: [
    {
      category: '내년의 소원',
      items: [
        '내년의 나에게 딱 하나의 소원을 빈다면 무엇인가요?',
        '내년 이맘때, 어떤 일이 이루어져 있으면 가장 기쁠까요?',
        '내년에 꼭 한 번 해보고 싶은 일이 있나요?',
        '내년을 한 단어로 정한다면 어떤 단어로 채우고 싶나요?',
      ],
    },
    {
      category: '소중한 사람을 위한 소원',
      items: [
        '내가 아끼는 사람에게 꼭 이루어졌으면 하는 소원이 있나요?',
        '이 카드를 읽을 클럽 멤버들에게 빌어주고 싶은 소원은?',
        '가족이나 친구가 내년에는 덜 아팠으면, 덜 힘들었으면 하는 일이 있나요?',
        '누군가의 소원을 대신 이뤄줄 수 있다면 누구의 어떤 소원인가요?',
      ],
    },
    {
      category: '작고 확실한 소원',
      items: [
        '거창하지 않아도, 내년에 자주 누리고 싶은 작은 행복은 무엇인가요?',
        '내년의 평범한 하루가 어떤 모습이었으면 좋겠나요?',
        '내년에 더 자주 하고 싶은 일과 덜 하고 싶은 일은?',
        '내년에 나에게 선물하고 싶은 것이 있나요?',
      ],
    },
    {
      category: '오래 품어온 꿈',
      items: [
        '오래전부터 마음속에 품고 있던 꿈이 있나요?',
        '언젠가 꼭 가보고 싶은 곳이 있다면 어디인가요?',
        '10년 뒤의 나는 어떤 모습이었으면 좋겠나요?',
        '아직 아무에게도 말하지 않은 바람이 있다면 살짝 적어볼까요?',
      ],
    },
    {
      category: '세상을 향한 소원',
      items: [
        '내가 사는 세상이 내년에는 조금 더 이렇게 바뀌었으면 하는 점이 있나요?',
        '모두에게 하나씩 나눠줄 수 있다면 어떤 마음을 나눠주고 싶나요?',
        '내년에는 내가 누군가에게 어떤 소원이 되어주고 싶나요?',
        '크리스마스의 기적이 하나 일어난다면 어떤 일이었으면 좋겠나요?',
      ],
    },
  ],
};

export const PHOTOS = { Friends: 'assets/friends.webp' };

// 카드에는 한국어 원문(분류·질문)을 저장하고, 영어로 볼 때만 바꿔 보여 줌
const EN = new Map();
for (const [treeName, groups] of Object.entries(QUESTIONS)) {
  groups.forEach((g, i) => {
    const [cat, items] = QUESTIONS_EN[treeName]?.[i] || [];
    if (cat) EN.set(g.category, cat);
    g.items.forEach((q, j) => { if (items?.[j]) EN.set(q, items[j]); });
  });
}
/** 질문·분류 글자를 지금 언어로 (모르는 글은 그대로) */
export const tr = (text) => (getLang() === 'en' ? EN.get(text) ?? text : text);
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
const faceFront = modal.querySelector('.letter__face--front');
const faceBack = modal.querySelector('.letter__face--back');
const btn = {
  close: modal.querySelector('.js-close'),
  reroll: modal.querySelector('.js-reroll'),
  toBack: modal.querySelector('.js-to-back'),
  toFront: modal.querySelector('.js-to-front'),
  hang: modal.querySelector('.js-hang'),
  flip: modal.querySelector('.js-flip'),
  remove: modal.querySelector('.js-remove'),
  others: modal.querySelector('.js-others'),
};
const answersEl = modal.querySelector('.answers');
const answersQ = modal.querySelector('.answers__q');
const answersList = modal.querySelector('.answers__list');

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
  tagCat.textContent = tr(card.category);
  qFront.textContent = tr(card.question);
  qBack.textContent = tr(card.question);
  photo.hidden = !PHOTOS[tree];
  if (PHOTOS[tree]) photo.src = PHOTOS[tree];
  applyStyle(tree);
  loadOthers();
}

/* 같은 질문에 다른 사람들이 쓴 답 — 트리에 걸린 카드 중 질문이 같은 것 */
let others = [];
async function loadOthers() {
  const q = current?.question, tn = tree, self = mode === 'view' ? current?.id : null;
  others = [];
  btn.others.hidden = true;
  const cards = (await fetchCards(tn)) || [];
  if (current?.question !== q || tree !== tn) return;         // 그 사이 질문이 바뀌었으면 버림
  others = cards.filter((c) => c.question === q && c.id !== self)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  btn.others.textContent = t('act.othersN', { n: others.length });
  btn.others.hidden = others.length === 0;
}
function showOthers() {
  answersQ.textContent = tr(current.question);
  answersList.replaceChildren(...others.map((c) => {
    const li = document.createElement('li');
    const p = document.createElement('p');
    p.textContent = c.answer;                                  // 글자 그대로 (HTML로 해석하지 않음)
    const small = document.createElement('small');
    const d = new Date(c.createdAt);
    small.textContent = `From. ${memberName(c.member)}${isMine(c) ? t('me') : ''}${isNaN(d) ? '' : ` · ${d.getMonth() + 1}. ${d.getDate()}.`}`;
    li.append(p, small);
    return li;
  }));
  answersEl.hidden = false;
  answersList.scrollTop = 0;
}
const hideOthers = () => { answersEl.hidden = true; };

// 트리마다 카드 모양(종이·비율)이 다름
function applyStyle(name) {
  const s = cardStyle(name);
  modal.dataset.tree = name;
  letter.style.setProperty('--ar', `${s.w} / ${s.h}`);
  letter.style.setProperty('--ar-n', String(s.w / s.h));
  const first = s.crop ? 'none' : `url('${s.front}')`;     // 잘라 쓰는 그림은 준비될 때까지 비워 둠
  faceFront.style.backgroundImage = first;
  faceBack.style.backgroundImage = first;
  cardImages(name).then((im) => {
    if (modal.dataset.tree !== name) return;
    faceFront.style.backgroundImage = `url('${im.frontUrl}')`;
    faceBack.style.backgroundImage = `url('${im.backUrl}')`;
  });
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
  hideOthers();
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
btn.others.addEventListener('click', showOthers);
modal.querySelector('.answers__close').addEventListener('click', hideOthers);
answersEl.addEventListener('click', (e) => { if (e.target === answersEl) hideOthers(); });
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
    alert(t('err.hang'));
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
  if (!current || !confirm(t('confirm.remove'))) return;
  const removed = current;
  try { await onRemove(removed); } catch { alert(t('err.remove')); return; }
  close();
});

// 언어를 바꾸면 열려 있는 카드 글자도 바로 바꿈
document.addEventListener('lang:change', () => {
  if (!isOpen() || !current) return;
  tagCat.textContent = tr(current.category);
  qFront.textContent = qBack.textContent = tr(current.question);
  if (!answersEl.hidden) showOthers();
  if (!btn.others.hidden) btn.others.textContent = t('act.othersN', { n: others.length });
});

addEventListener('keydown', (e) => {
  if (!isOpen()) return;
  if (e.key === 'Escape') { if (!answersEl.hidden) hideOthers(); else close(); }
  e.stopPropagation();
}, true);
