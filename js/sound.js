/* 소리: Web Audio로 직접 합성 (음원 파일 없음)
   - bell(): 은은한 종소리
   - crunch(): 눈 밟는 소리 */
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

  /* ───────── 배경 캐럴 (오르골 소리로 합성) ─────────
     저작권이 만료된 전통 캐럴: Silent Night(1818), Jingle Bells(1857) */
  const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const freq = (n) => {
    const m = /^([A-G])(#|b)?(\d)$/.exec(n);
    const midi = SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (Number(m[3]) + 1) * 12;
    return 440 * Math.pow(2, (midi - 69) / 12);
  };
  const CHORDS = {
    C: ['C3', 'E3', 'G3'], F: ['F3', 'A3', 'C4'], G: ['G2', 'B2', 'D3'],
    G7: ['G2', 'B2', 'F3'], D7: ['D3', 'F#3', 'C4'],
  };
  const SONGS = [
    {
      name: 'Silent Night', unit: 0.27, bar: 6,       // 6/8, 8분음표 단위
      melody: `G4:3 A4:1 G4:2 E4:6 G4:3 A4:1 G4:2 E4:6
               D5:4 D5:2 B4:6 C5:4 C5:2 G4:6
               A4:4 A4:2 C5:3 B4:1 A4:2 G4:3 A4:1 G4:2 E4:6
               A4:4 A4:2 C5:3 B4:1 A4:2 G4:3 A4:1 G4:2 E4:6
               D5:4 D5:2 F5:3 D5:1 B4:2 C5:6 E5:6
               C5:3 G4:1 E4:2 G4:3 F4:1 D4:2 C4:12`,
      chords: 'C C C C G G C C F F C C F F C C G G C C C G7 C C',
    },
    {
      name: 'Jingle Bells', unit: 0.19, bar: 8,       // 4/4, 8분음표 단위
      melody: `E5:2 E5:2 E5:4 E5:2 E5:2 E5:4 E5:2 G5:2 C5:3 D5:1 E5:8
               F5:2 F5:2 F5:3 F5:1 F5:2 E5:2 E5:2 E5:1 E5:1 E5:2 D5:2 D5:2 E5:2 D5:4 G5:4
               E5:2 E5:2 E5:4 E5:2 E5:2 E5:4 E5:2 G5:2 C5:3 D5:1 E5:8
               F5:2 F5:2 F5:2 F5:2 F5:2 E5:2 E5:2 E5:1 E5:1 G5:2 G5:2 F5:2 D5:2 C5:8`,
      chords: 'C C C C F C D7 G7 C C C C F C G7 C',
    },
  ];

  const music = (() => {
    let gain = null, wanted = false, playing = false, muted = false;
    let songIdx = 0, events = [], evIdx = 0, songEnd = 0, timer = null;

    function chime(f, when, vel) {                   // 오르골 한 음
      const g = ctx.createGain();
      const decay = Math.max(0.8, 2.2 - (f - 260) / 600);
      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(vel, when + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, when + decay);
      g.connect(gain);
      for (const [mul, amp] of [[1, 1], [2, 0.22], [3.01, 0.07], [4.2, 0.03]]) {
        const o = ctx.createOscillator();
        const a = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = f * mul;
        a.gain.value = amp;
        o.connect(a).connect(g);
        o.start(when);
        o.stop(when + decay + 0.05);
      }
    }

    function pad(notes, when, dur) {                 // 부드러운 화음 배경
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 700;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(0.05, when + 0.5);
      g.gain.setValueAtTime(0.05, when + dur - 0.1);
      g.gain.linearRampToValueAtTime(0, when + dur + 0.6);
      lp.connect(g).connect(gain);
      for (const n of notes) {
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = freq(n);
        o.detune.value = (Math.random() - 0.5) * 8;
        o.connect(lp);
        o.start(when);
        o.stop(when + dur + 0.7);
      }
      // 마디 첫 박의 낮은 베이스
      const b = ctx.createOscillator();
      const bg = ctx.createGain();
      b.type = 'sine';
      b.frequency.value = freq(notes[0]) / 2;
      bg.gain.setValueAtTime(0, when);
      bg.gain.linearRampToValueAtTime(0.16, when + 0.02);
      bg.gain.exponentialRampToValueAtTime(0.0001, when + Math.min(2.2, dur + 0.4));
      b.connect(bg).connect(gain);
      b.start(when);
      b.stop(when + 2.4);
    }

    function load(song, start) {
      events = [];
      let t = start;
      for (const tok of song.melody.trim().split(/\s+/)) {
        const [n, len] = tok.split(':');
        events.push({ t, kind: 'note', f: freq(n), vel: 0.16 + Math.random() * 0.03 });
        t += Number(len) * song.unit;
      }
      const barDur = song.bar * song.unit;
      song.chords.split(' ').forEach((c, i) => {
        events.push({ t: start + i * barDur, kind: 'chord', notes: CHORDS[c], dur: barDur });
      });
      events.sort((a, b) => a.t - b.t);
      evIdx = 0;
      songEnd = Math.max(t, start + song.chords.split(' ').length * barDur);
    }

    function tick() {
      if (!ready()) return;
      const horizon = ctx.currentTime + 0.6;
      while (evIdx < events.length && events[evIdx].t < horizon) {
        const e = events[evIdx++];
        if (e.t < ctx.currentTime - 0.05) continue;    // 늦은 음은 건너뜀
        if (e.kind === 'note') chime(e.f, e.t, e.vel);
        else pad(e.notes, e.t, e.dur);
      }
      if (evIdx >= events.length && ctx.currentTime > songEnd - 0.6) {
        songIdx = (songIdx + 1) % SONGS.length;
        load(SONGS[songIdx], Math.max(songEnd, ctx.currentTime) + 2.5);   // 곡 사이 쉼
      }
    }

    function begin() {
      if (playing) return;
      playing = true;
      gain = ctx.createGain();
      gain.gain.value = 0;
      gain.gain.linearRampToValueAtTime(muted ? 0 : 0.55, ctx.currentTime + 3);   // 서서히 들어옴
      gain.connect(out);
      load(SONGS[songIdx], ctx.currentTime + 1.2);
      timer = setInterval(tick, 120);
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

  return { unlock, bell, crunch, creak, thud, music, get ready() { return ready(); } };
})();
