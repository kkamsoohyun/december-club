/* 한국어 / English 전환
   - 처음엔 브라우저 언어를 따르고(한국어면 ko, 아니면 en), 오른쪽 위 KO·EN 버튼으로 바꾸면 기억함
   - HTML 은 data-i18n="키"(글자), data-i18n-attr="속성=키, 속성=키"(aria-label·title·placeholder)로 표시
   - 바꾸면 'lang:change' 이벤트 → 열린 카드·트리에 걸린 카드 글자도 다시 그림 */

const KEY = 'december-club.lang';

const STRINGS = {
  ko: {
    'scene': '달밤의 눈 덮인 숲길을 목도리와 털모자를 쓴 캐릭터가 걷는 3D 장면',
    'hint.intro': '♪ 눌러서 종소리 듣기',
    'hint.keys': 'WASD / ← ↑ → ↓ 걷기 · 드래그로 둘러보기 · R 눈 굴리기 · F 눈 던지기',
    'hint.touch': '왼쪽을 끌어 걷기 · 오른쪽을 끌어 둘러보기',
    'btn.throw': '눈 던지기 (F)',
    'btn.roll': '눈 굴리기 (R)',
    'btn.music': '음악 켜기/끄기 (M)',
    'btn.lang': 'Switch to English',
    'letter': '편지 카드',
    'close': '닫기',
    'card.front': '카드 앞면',
    'card.back': '카드 뒷면',
    'flipHint': '↻ 눌러서 뒤집기',
    'answer': '답변',
    'answer.placeholder': '여기에 답을 적어 주세요',
    'act.reroll': '↻ 다른 질문',
    'act.toBack': '뒤집어서 답하기',
    'act.toFront': '← 앞면',
    'act.hang': '✦ 트리에 달기',
    'act.flip': '↻ 뒤집기',
    'act.remove': '떼어내기',
    'act.others': '💬 같은 질문의 답',
    'act.othersN': '💬 같은 질문의 답 {n}',
    'answers': '같은 질문에 대한 다른 답',
    'me': ' (나)',
    'err.hang': '카드를 걸지 못했어요. 잠시 후 다시 시도해 주세요.',
    'err.remove': '카드를 떼지 못했어요. 잠시 후 다시 시도해 주세요.',
    'confirm.remove': '이 카드를 트리에서 떼어낼까요?',
    'near.stand': '🔥 일어나기',
    'near.doorClose': '🚪 문 닫기',
    'near.doorOpen': '🚪 문 열기',
    'near.sit': '🔥 의자에 앉아 불 쬐기',
    'near.write': '✦ {tree} 트리에 카드 쓰기',
    'offline': '서버 없이 열려 이 브라우저에만 저장돼요',
    'welcome': 'Welcome, {name}',
    'like': '♡ 공감',
    'like.n': '♡ 공감 {n}',
    'liked.n': '♥ 공감 {n}',
    'like.mine': '♥ {n}명이 공감했어요',
    'like.title': '이 회고에 공감하기',
    'err.like': '공감을 남기지 못했어요. 잠시 후 다시 시도해 주세요.',
    'burn.btn': '🔥 걱정 태우기',
    'worry.title': '태워 버리고 싶은 고민이나 걱정',
    'worry.placeholder': '여기에 적고 불 속에 던져 보세요',
    'worry.note': '어디에도 저장되지 않고, 불과 함께 사라져요',
    'worry.go': '🔥 불에 던지기',
    'worry.cancel': '그만두기',
    'worry.done': '걱정이 불꽃과 함께 하늘로 날아갔어요',
    'nick.title': '닉네임을 정해 주세요',
    'nick.desc': '트리에 거는 카드와 캐릭터 머리 위에 이 이름이 보여요',
    'nick.placeholder': '최대 12자',
    'nick.go': '입장하기',
    'nick.save': '바꾸기',
    'nick.cancel': '취소',
    'nick.change': '닉네임 바꾸기',
    'nick.empty': '닉네임을 한 글자 이상 적어 주세요',
    'nick.fail': '저장하지 못했어요. 잠시 후 다시 시도해 주세요.',
    'dday.note': '{year}년 새해까지 {days}일 남았어요',
    'newyear.note': '{year}년, 새해 복 많이 받으세요',
  },
  en: {
    'scene': 'A 3D scene of a character in a scarf and knit hat walking a snowy forest path under the moon',
    'hint.intro': '♪ tap to hear the bells',
    'hint.keys': 'WASD / ← ↑ → ↓ to walk · drag to look around · R to roll a snowball · F to throw',
    'hint.touch': 'drag left side to walk · right side to look',
    'btn.throw': 'Throw a snowball (F)',
    'btn.roll': 'Roll a snowball (R)',
    'btn.music': 'Music on/off (M)',
    'btn.lang': '한국어로 보기',
    'letter': 'Letter card',
    'close': 'Close',
    'card.front': 'Card front',
    'card.back': 'Card back',
    'flipHint': '↻ tap to flip',
    'answer': 'Answer',
    'answer.placeholder': 'Write your answer here',
    'act.reroll': '↻ Another question',
    'act.toBack': 'Flip to answer',
    'act.toFront': '← Front',
    'act.hang': '✦ Hang it on the tree',
    'act.flip': '↻ Flip',
    'act.remove': 'Take it down',
    'act.others': '💬 Others\' answers',
    'act.othersN': '💬 Others\' answers ({n})',
    'answers': 'Other answers to the same question',
    'me': ' (me)',
    'err.hang': 'Couldn\'t hang your card. Please try again in a moment.',
    'err.remove': 'Couldn\'t take the card down. Please try again in a moment.',
    'confirm.remove': 'Take this card down from the tree?',
    'near.stand': '🔥 Stand up',
    'near.doorClose': '🚪 Close the door',
    'near.doorOpen': '🚪 Open the door',
    'near.sit': '🔥 Sit by the fire',
    'near.write': '✦ Write a card for the {tree} tree',
    'offline': 'Running without a server — cards are saved only in this browser',
    'welcome': 'Welcome, {name}',
    'like': '♡ Relate',
    'like.n': '♡ Relate {n}',
    'liked.n': '♥ Relate {n}',
    'like.mine': '♥ {n} related to this',
    'like.title': 'I relate to this',
    'err.like': 'Couldn\'t save your reaction. Please try again in a moment.',
    'burn.btn': '🔥 Burn a worry',
    'worry.title': 'A worry you want to burn away',
    'worry.placeholder': 'Write it here, then toss it into the fire',
    'worry.note': 'It isn\'t saved anywhere. It disappears with the flames',
    'worry.go': '🔥 Toss it in',
    'worry.cancel': 'Never mind',
    'worry.done': 'Your worry drifted up into the sky with the sparks',
    'nick.title': 'Choose a nickname',
    'nick.desc': 'It shows on the cards you hang and above your character',
    'nick.placeholder': 'Up to 12 characters',
    'nick.go': 'Enter',
    'nick.save': 'Change',
    'nick.cancel': 'Cancel',
    'nick.change': 'Change nickname',
    'nick.empty': 'Please enter at least one character',
    'nick.fail': 'Couldn\'t save it. Please try again in a moment.',
    'dday.note': '{days} {dayWord} until {year}',
    'newyear.note': 'Happy New Year {year}!',
  },
};

function detect() {
  try { const saved = localStorage.getItem(KEY); if (saved === 'ko' || saved === 'en') return saved; } catch { /* 저장 불가 */ }
  return /^ko\b/i.test(navigator.language || '') ? 'ko' : 'en';
}

let lang = detect();
export const getLang = () => lang;

/** 문장 꺼내기: t('near.write', { tree: 'Friends' }) */
export function t(key, vars = {}) {
  const s = STRINGS[lang][key] ?? STRINGS.ko[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => (k === 'dayWord' ? (vars.days === 1 ? 'day' : 'days') : String(vars[k] ?? '')));
}

function applyDom(root = document) {
  document.documentElement.lang = lang;
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll('[data-i18n-attr]')) {
    for (const pair of el.dataset.i18nAttr.split(',')) {
      const [attr, key] = pair.split('=').map((x) => x.trim());
      el.setAttribute(attr, t(key));
    }
  }
  const btn = document.querySelector('.lang');
  if (btn) btn.dataset.lang = lang;
}

export function setLang(next) {
  if (next === lang || !STRINGS[next]) return;
  lang = next;
  try { localStorage.setItem(KEY, lang); } catch { /* 저장 불가 */ }
  applyDom();
  document.dispatchEvent(new Event('lang:change'));
}

applyDom();
document.querySelector('.lang')?.addEventListener('click', (e) => {
  e.stopPropagation();                                   // 인트로 카드 클릭으로 번지지 않게
  setLang(lang === 'ko' ? 'en' : 'ko');
});
