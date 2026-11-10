/* 소리: Web Audio로 직접 합성 (음원 파일 없음)
   - bell(): 은은한 종소리
   - crunch(): 눈 밟는 소리
   - fire.level(0~1): 모닥불 장작 타는 소리 (가까울수록 크게) */
window.Sound = (() => {
  let ctx = null, out = null;

  // 짧은 잔향용 임펄스 응답
  function makeReverb(ac, seconds = 2.6) {
    const len = ac.sampleRate * seconds;
    const buf = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    const conv = ac.createConvolver();
    conv.buffer = buf;
    return conv;
  }

  // 브라우저 자동재생 정책 때문에 사용자 입력(탭/클릭/키) 안에서 호출해야 함
  function unlock() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    out = ctx.createGain();
    out.gain.value = 0.22;                 // 전체 볼륨: 은은하게
    const dry = ctx.createGain(); dry.gain.value = 0.55;
    const wet = ctx.createGain(); wet.gain.value = 0.45;
    const rev = makeReverb(ctx);
    out.connect(dry).connect(ctx.destination);
    out.connect(rev).connect(wet).connect(ctx.destination);
    ctx.addEventListener('statechange', () => { if (ready()) music._maybeBegin(); });
    music._maybeBegin();
  }

  const ready = () => !!ctx && ctx.state === 'running';

  // 종의 배음(비정수 배음 비율)과 각 배음의 감쇠 시간
  const PARTIALS = [
    [0.5,  0.35, 3.2],   // [비율, 크기, 감쇠(초)]
    [1.0,  1.00, 2.6],
    [1.19, 0.45, 2.0],
    [1.56, 0.30, 1.6],
    [2.0,  0.40, 1.4],
    [2.51, 0.22, 1.0],
    [3.01, 0.15, 0.7],
    [4.17, 0.08, 0.45],
  ];
  const NOTES = [1318.5, 1568.0, 1760.0, 1975.5, 2093.0]; // E6 G6 A6 B6 C7

  function bell(strength = 1) {
    if (!ready()) return;
    const now = ctx.currentTime + 0.01;
    const base = NOTES[Math.floor(Math.random() * NOTES.length)] * (1 + (Math.random() - 0.5) * 0.004);
    const level = Math.min(1, Math.max(0.15, strength));
    for (const [ratio, amp, decay] of PARTIALS) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = base * ratio;
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(amp * level * 0.12, now + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, now + decay);
      osc.connect(g).connect(out);
      osc.start(now);
      osc.stop(now + decay + 0.05);
    }
  }

  // 눈 밟는 소리: 짧은 노이즈를 대역통과 필터로 걸러 "뽀득"
  let noiseBuf = null;
  function crunch() {
    if (!ready()) return;
    if (!noiseBuf) {
      const len = Math.floor(ctx.sampleRate * 0.2);
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (Math.random() < 0.3 ? 1 : 0.35);
    }
    const now = ctx.currentTime + 0.005;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1400 + Math.random() * 900;
    bp.Q.value = 0.9;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.35, now + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    src.connect(bp).connect(g).connect(out);
    src.start(now, Math.random() * 0.02);
    src.stop(now + 0.18);
  }

  /* 나무문 경첩이 끼이익 하는 소리
     경첩의 '붙었다 미끄러졌다(stick-slip)'를 빠른 딸깍임 열로 만들고, 문판의 울림(공명)을 입힘 */
  function creak(duration = 1.3) {
    if (!ready()) return;
    const sr = ctx.sampleRate, len = Math.floor(sr * duration);
    const buf = ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    let phase = 0, last = 0;
    const seed = Math.random() * 10;
    for (let i = 0; i < len; i++) {
      const t = i / len;
      // 딸깍임 속도: 느리게 시작 → 빨라졌다 → 끝에서 다시 느려짐 (+ 흔들림)
      const rate = 38 + 95 * Math.sin(Math.PI * Math.pow(t, 0.8)) + 18 * Math.sin(t * 23 + seed) + 9 * Math.sin(t * 61);
      phase += rate / sr;
      if (phase >= 1) { phase -= 1; last = 1 + Math.random() * 0.5; }
      last *= 0.9965;                                          // 딸깍마다 짧게 울리고 사라짐
      const env = Math.min(1, t * 9) * Math.min(1, (1 - t) * 5) * (0.75 + 0.25 * Math.sin(t * 17 + seed));
      d[i] = last * env * (Math.random() < 0.5 ? 1 : 0.85);
    }
    const now = ctx.currentTime + 0.01;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = 0.5;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 350;
    src.connect(hp);
    for (const [f, q, a] of [[620, 9, 1], [1150, 12, 0.8], [1900, 14, 0.45], [2900, 10, 0.2]]) {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.Q.value = q;
      bp.frequency.setValueAtTime(f * 0.92, now);
      bp.frequency.linearRampToValueAtTime(f * 1.08, now + duration * 0.6);    // 문이 열리며 음이 살짝 올라감
      bp.frequency.linearRampToValueAtTime(f, now + duration);
      const ga = ctx.createGain(); ga.gain.value = a;
      hp.connect(bp).connect(ga).connect(g);
    }
    g.connect(out);
    src.start(now);
  }

  // 문이 닫힐 때 '쿵' + 걸쇠 딸깍
  function thud() {
    if (!ready()) return;
    const now = ctx.currentTime + 0.01;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(120, now);
    o.frequency.exponentialRampToValueAtTime(55, now + 0.25);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.9, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    o.connect(g).connect(out);
    o.start(now); o.stop(now + 0.4);
    crunch();                                     // 나무가 부딪는 짧은 잡음
    const c = ctx.createOscillator(), cg = ctx.createGain();
    c.type = 'square'; c.frequency.value = 2400;
    cg.gain.setValueAtTime(0, now + 0.06);
    cg.gain.linearRampToValueAtTime(0.08, now + 0.062);
    cg.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
    c.connect(cg).connect(out);
    c.start(now + 0.05); c.stop(now + 0.1);
  }

  /* ───────── 배경 음악: 잔잔한 보사노바 (직접 만든 곡, Web Audio 합성) ─────────
     - 나일론 기타 컴핑(엇박 리듬) + 엄지 베이스 + 셰이커·림샷 + 비브라폰 멜로디
     - 16마디를 반복, 멜로디는 한 번 걸러 한 번만 나와서 덜 지루하게 */
  const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const freq = (n) => {
    const m = /^([A-G])(#|b)?(\d)$/.exec(n);
    const midi = SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (Number(m[3]) + 1) * 12;
    return 440 * Math.pow(2, (midi - 69) / 12);
  };

  const STEP = 0.112;                 // 16분음표 길이(초) — 약 134 BPM
  // 마디별 화음: [베이스 근음, 5음, 기타 보이싱]
  const BARS = [
    ['C2', 'G2', 'C3 G3 B3 E4'],     // Cmaj7
    ['A1', 'E2', 'A2 G3 C4 E4'],     // Am7
    ['D2', 'A2', 'D3 F3 C4 E4'],     // Dm9
    ['G1', 'D2', 'G2 F3 B3 E4'],     // G13
    ['E2', 'B2', 'E3 B3 D4 G4'],     // Em7
    ['A1', 'E2', 'A2 C#3 G3 Bb3'],   // A7(b9)
    ['D2', 'A2', 'D3 F3 C4 E4'],     // Dm9
    ['G1', 'D2', 'G2 F3 B3 D4'],     // G7
    ['F2', 'C3', 'F3 A3 C4 E4'],     // Fmaj7
    ['F2', 'C3', 'F3 Ab3 C4 D4'],    // Fm6
    ['E2', 'B2', 'E3 B3 D4 G4'],     // Em7
    ['A1', 'E2', 'A2 C#3 G3 Bb3'],   // A7(b9)
    ['D2', 'A2', 'D3 F3 C4 E4'],     // Dm9
    ['G1', 'D2', 'G2 F3 B3 E4'],     // G13
    ['C2', 'G2', 'C3 E3 B3 D4'],     // Cmaj9
    ['C2', 'G2', 'C3 E3 A3 D4'],     // C6/9
  ].map(([r, f, v]) => ({ root: freq(r), fifth: freq(f), voicing: v.split(' ').map(freq) }));

  // 멜로디 (음:16분음표 개수, R은 쉼표) — 마디마다 16칸
  const MELODY = `R:2 E5:2 G5:3 E5:1 D5:4 C5:4 | B4:6 A4:2 G4:8 | R:2 F4:2 A4:2 C5:2 E5:6 D5:2 | D5:3 C5:3 B4:2 E5:8 |
    R:4 G4:2 B4:2 D5:3 B4:1 G4:4 | Bb4:6 A4:2 C#5:8 | D5:3 E5:3 F5:2 A5:6 G5:2 | F5:4 E5:4 D5:8 |
    R:2 C5:2 E5:2 A5:2 G5:8 | R:2 Ab4:2 C5:2 F5:2 D5:8 | R:2 B4:2 D5:2 G5:2 E5:8 | C#5:3 E5:3 G5:2 Bb5:8 |
    A5:4 F5:4 E5:4 D5:4 | E5:6 D5:2 B4:8 | R:4 D5:4 E5:8 | R:16`
    .split('|').map((bar) => {
      const notes = []; let at = 0;
      for (const tok of bar.trim().split(/\s+/)) {
        const [n, len] = tok.split(':');
        if (n !== 'R') notes.push({ at, len: Number(len), f: freq(n) });
        at += Number(len);
      }
      return notes;
    });

  // 리듬 패턴 (16칸 중 소리 나는 자리)
  const COMP = [[0, 3, 6, 10, 12], [2, 6, 8, 12, 14]];      // 기타: 두 마디가 한 쌍
  const BASS = [[0, 'root', 6], [6, 'fifth', 2], [8, 'fifth', 6], [14, 'root', 2]];
  const CLAVE = [0, 3, 6, 10, 13];                          // 림샷

  const music = (() => {
    let gain = null, wanted = false, playing = false, muted = false;
    let bar = 0, loop = 0, nextBar = 0, timer = null, noise = null;
    const human = () => (Math.random() - 0.5) * 0.012;      // 사람이 치는 듯 살짝 어긋나게

    function pluck(f, when, dur, vel) {                      // 나일론 기타 한 줄
      const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
      o1.type = 'triangle'; o2.type = 'sawtooth';
      o1.frequency.value = f; o2.frequency.value = f; o2.detune.value = 4;
      const mix2 = ctx.createGain(); mix2.gain.value = 0.18;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.Q.value = 0.6;
      lp.frequency.setValueAtTime(Math.min(4200, f * 7), when);
      lp.frequency.exponentialRampToValueAtTime(Math.max(300, f * 1.6), when + 0.25);
      const g = ctx.createGain();
      const end = when + dur;
      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(vel, when + 0.004);
      g.gain.exponentialRampToValueAtTime(vel * 0.35, when + 0.18);
      g.gain.setValueAtTime(vel * 0.35, end);
      g.gain.exponentialRampToValueAtTime(0.0001, end + 0.09);   // 손바닥으로 살짝 뮤트
      o1.connect(lp); o2.connect(mix2).connect(lp);
      lp.connect(g).connect(gain);
      o1.start(when); o2.start(when);
      o1.stop(end + 0.12); o2.stop(end + 0.12);
    }

    function strum(voicing, when, dur, vel) {
      voicing.forEach((f, i) => pluck(f, when + i * 0.011, dur, vel * (i === 0 ? 0.8 : 1)));
    }

    function bass(f, when, dur) {                            // 엄지로 치는 낮은 줄
      const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
      o.type = 'triangle'; o.frequency.value = f;
      lp.type = 'lowpass'; lp.frequency.value = 520;
      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(0.32, when + 0.008);
      g.gain.exponentialRampToValueAtTime(0.12, when + 0.3);
      g.gain.setValueAtTime(0.12, when + dur);
      g.gain.exponentialRampToValueAtTime(0.0001, when + dur + 0.08);
      o.connect(lp).connect(g).connect(gain);
      o.start(when); o.stop(when + dur + 0.1);
    }

    function vibes(f, when, dur) {                           // 비브라폰 멜로디
      const g = ctx.createGain();
      const len = Math.min(2.2, dur + 0.6);
      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(0.085, when + 0.01);
      g.gain.exponentialRampToValueAtTime(0.03, when + dur);
      g.gain.exponentialRampToValueAtTime(0.0001, when + len);
      const trem = ctx.createGain(); trem.gain.value = 1;     // 은은한 떨림
      const lfo = ctx.createOscillator(), depth = ctx.createGain();
      lfo.frequency.value = 5.2; depth.gain.value = 0.18;
      lfo.connect(depth).connect(trem.gain);
      g.connect(trem).connect(gain);
      for (const [mul, amp] of [[1, 1], [4, 0.08], [10, 0.02]]) {
        const o = ctx.createOscillator(), a = ctx.createGain();
        o.type = 'sine'; o.frequency.value = f * mul; a.gain.value = amp;
        o.connect(a).connect(g);
        o.start(when); o.stop(when + len + 0.05);
      }
      lfo.start(when); lfo.stop(when + len + 0.05);
    }

    function hit(when, { hp, q = 0.8, vel, len }) {          // 셰이커·림샷용 잡음 조각
      if (!noise) {
        const n = Math.floor(ctx.sampleRate * 0.2);
        noise = ctx.createBuffer(1, n, ctx.sampleRate);
        const d = noise.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      }
      const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      src.buffer = noise;
      f.type = 'bandpass'; f.frequency.value = hp; f.Q.value = q;
      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(vel, when + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, when + len);
      src.connect(f).connect(g).connect(gain);
      src.start(when, Math.random() * 0.1); src.stop(when + len + 0.02);
    }

    function scheduleBar(t) {
      const b = BARS[bar];
      COMP[bar % 2].forEach((s) => strum(b.voicing, t + s * STEP + human(), STEP * 1.6, 0.05));
      BASS.forEach(([s, which, len]) => bass(b[which], t + s * STEP, len * STEP * 0.9));
      for (let s = 0; s < 16; s++) {
        hit(t + s * STEP + human(), { hp: 6500, vel: s % 4 === 2 ? 0.05 : 0.022, len: 0.06 });
      }
      CLAVE.forEach((s) => hit(t + s * STEP, { hp: 1800, q: 6, vel: 0.12, len: 0.035 }));
      if (loop % 2 === 0) {
        MELODY[bar].forEach((n) => vibes(n.f, t + n.at * STEP + human(), n.len * STEP));
      }
      bar = (bar + 1) % BARS.length;
      if (bar === 0) loop++;
    }

    function tick() {
      if (!ready()) return;
      if (nextBar < ctx.currentTime - 0.1) nextBar = ctx.currentTime + 0.1;   // 탭이 멈췄다 돌아오면 다시 맞춤
      while (nextBar < ctx.currentTime + 0.8) {
        scheduleBar(nextBar);
        nextBar += 16 * STEP;
      }
    }

    function begin() {
      if (playing) return;
      playing = true;
      gain = ctx.createGain();
      gain.gain.value = 0;
      gain.gain.linearRampToValueAtTime(muted ? 0 : 0.55, ctx.currentTime + 3);   // 서서히 들어옴
      gain.connect(out);
      nextBar = ctx.currentTime + 0.6;
      timer = setInterval(tick, 150);
      tick();
    }

    // 탭이 숨겨지면 멈췄다가 돌아오면 이어서
    document.addEventListener('visibilitychange', () => {
      if (!ctx) return;
      if (document.hidden) ctx.suspend(); else ctx.resume();
    });

    return {
      start() { wanted = true; this._maybeBegin(); },
      _maybeBegin() { if (wanted && ready()) begin(); },
      toggle() {
        muted = !muted;
        if (gain) {
          gain.gain.cancelScheduledValues(ctx.currentTime);
          gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
          gain.gain.linearRampToValueAtTime(muted ? 0 : 0.55, ctx.currentTime + 0.6);
        }
        return !muted;
      },
      get muted() { return muted; },
    };
  })();

  // 첫 입력 때 자동으로 오디오 활성화
  const onFirstInput = () => {
    unlock();
    document.dispatchEvent(new Event('sound:unlocked'));
    removeEventListener('pointerdown', onFirstInput);
    removeEventListener('keydown', onFirstInput);
  };
  addEventListener('pointerdown', onFirstInput);
  addEventListener('keydown', onFirstInput);

  /* 모닥불: 실제 장작이 타닥타닥 튀는 소리
     - 아주 짧은 '탁' 소리(수 ms짜리 잡음 조각)를 불규칙하게, 가끔 두세 번 연달아 터뜨림
     - 가끔 조금 더 큰 '딱' (낮은 울림 없이)
     - 바람 같은 깔림 소리(지속 잡음)는 넣지 않음
     미리 몇 초 길이로 만들어 두고, 길이가 다른 두 개를 겹쳐 반복해 같은 패턴이 들리지 않게 함 */
  const fire = (() => {
    let bus = null, target = 0;
    function crackleBuffer(seconds, seed) {
      const sr = ctx.sampleRate, len = Math.floor(sr * seconds);
      const buf = ctx.createBuffer(1, len, sr);
      const d = buf.getChannelData(0);
      let x = seed;
      const rnd = () => { x = (x * 16807) % 2147483647; return x / 2147483647; };
      const burst = (at, amp, tau) => {
        const n = Math.min(len - at, Math.floor(sr * tau * 7));
        let lp = 0;
        for (let i = 0; i < n; i++) {
          const env = Math.exp(-i / (sr * tau));
          const w = rnd() * 2 - 1;
          lp += (w - lp) * 0.55;                       // 너무 날카로운 고음만 살짝 깎음
          d[at + i] += (w - lp * 0.4) * env * amp;
        }
      };
      let t = 0.05;
      while (t < seconds - 0.1) {
        const big = rnd() < 0.06;
        const amp = big ? 0.5 + rnd() * 0.25 : 0.08 + Math.pow(rnd(), 2.2) * 0.5;
        burst(Math.floor(t * sr), amp, big ? 0.002 + rnd() * 0.002 : 0.0006 + rnd() * 0.0018);
        // 타닥타닥: 가끔 짧은 간격으로 몇 번 이어서
        if (rnd() < 0.3) {
          const k = 1 + Math.floor(rnd() * 3);
          let tt = t;
          for (let j = 0; j < k; j++) {
            tt += 0.015 + rnd() * 0.05;
            burst(Math.floor(tt * sr), amp * (0.4 + rnd() * 0.6), 0.0005 + rnd() * 0.0012);
          }
        }
        t += 0.06 + Math.pow(rnd(), 1.6) * 0.45;
      }
      return buf;
    }
    function setup() {
      bus = ctx.createGain(); bus.gain.value = 0;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 700;   // '텅·통' 하는 낮은 울림은 잘라냄
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7000;
      bus.connect(hp).connect(lp).connect(ctx.destination);
      [[7.3, 11], [10.9, 29]].forEach(([sec, seed]) => {
        const src = ctx.createBufferSource();
        src.buffer = crackleBuffer(sec, seed);
        src.loop = true;
        const g = ctx.createGain(); g.gain.value = 0.7;
        src.connect(g).connect(bus);
        src.start(ctx.currentTime + 0.05, Math.random() * sec);
      });
    }
    return {
      level(v) {
        if (!ready()) return;
        if (!bus) setup();
        v = Math.max(0, Math.min(1, v));
        if (Math.abs(v - target) > 0.01) {
          target = v;
          bus.gain.setTargetAtTime(v * 0.22, ctx.currentTime, 0.25);
        }
      },
    };
  })();

  return { unlock, bell, crunch, creak, thud, music, fire, get ready() { return ready(); } };
})();
