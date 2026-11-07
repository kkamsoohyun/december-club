/* 인트로: 실에 매달려 대롱대롱 흔들리는 카드 + 흔들릴 때마다 종소리
   3초 뒤 카드가 위로 끌려 올라가며 사라지고 'intro:done' 이벤트 발생 */
(() => {
  const INTRO_MS = 3000;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const drop = document.querySelector('.drop');
  const pend = document.querySelector('.pendulum');
  const card = document.querySelector('.card');
  const hint = document.querySelector('.hint--intro');

  // 실 길이: 카드가 화면 세로 중앙에 오도록
  function layout() {
    const h = card.getBoundingClientRect().height || innerHeight * 0.69;
    const len = Math.max(24, (innerHeight - h) / 2 - 6);
    pend.style.setProperty('--thread-len', len + 'px');
  }
  card.complete ? layout() : card.addEventListener('load', layout);
  addEventListener('resize', layout);

  /* ── 대롱대롱 (감쇠 진자 + 가끔 부는 바람) ── */
  const DEG = Math.PI / 180;
  const PERIOD = 3.2;                       // 한 번 왕복(초)
  const w0 = (2 * Math.PI) / PERIOD;
  const DAMP = 0.06;                        // 감쇠비
  const BELL_MIN = 0.9 * DEG;               // 이 각도 이상 흔들릴 때만 종소리

  let theta = 2.2 * DEG;                    // 처음엔 살짝 기운 상태에서 시작
  let vel = 0;
  let lastSign = 0;
  let peak = 0;
  let nextGust = performance.now() + 4000;
  let last = performance.now();
  let running = true;

  function step(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    if (now > nextGust) {
      vel += (Math.random() < 0.5 ? -1 : 1) * (1.4 + Math.random() * 2.2) * DEG;
      nextGust = now + 5000 + Math.random() * 5000;
    }

    // 아주 미세한 상시 흔들림 (종소리 기준 아래)
    const breeze = Math.sin(now / 1900) * 0.15 * DEG;

    const acc = -w0 * w0 * (theta - breeze) - 2 * DAMP * w0 * vel;
    vel += acc * dt;
    theta += vel * dt;

    peak = Math.max(peak, Math.abs(theta));

    // 진자가 끝까지 갔다가 방향을 바꾸는 순간 = 종이 울리는 순간
    const sign = Math.sign(vel);
    if (sign !== 0 && lastSign !== 0 && sign !== lastSign) {
      if (peak > BELL_MIN) Sound.bell((peak - BELL_MIN) / (3 * DEG) + 0.25);
      peak = 0;
    }
    if (sign !== 0) lastSign = sign;

    pend.style.transform = `rotate(${theta}rad)`;
    requestAnimationFrame(step);
  }
  if (!reduce) requestAnimationFrame((t) => { last = t; step(t); });

  document.addEventListener('sound:unlocked', () => hint.classList.add('is-hidden'));

  // 카드를 톡 치면 더 크게 흔들림
  card.addEventListener('pointerdown', (e) => {
    const r = card.getBoundingClientRect();
    const side = e.clientX < r.left + r.width / 2 ? 1 : -1;
    vel += side * (3 + Math.random()) * DEG;
    setTimeout(() => Sound.bell(0.9), 30);
  });

  /* ── 3초 뒤 퇴장 ── */
  function leave() {
    hint.classList.add('is-hidden');
    Sound.bell(0.7);
    drop.classList.add('is-leaving');
    window.__introDone = true;
    document.dispatchEvent(new Event('intro:done'));
    setTimeout(() => {
      running = false;
      drop.remove();
      hint.remove();
    }, 1500);
  }
  const start = () => setTimeout(leave, INTRO_MS);
  card.complete ? start() : card.addEventListener('load', start, { once: true });
})();
