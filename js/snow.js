/* 화면 전체에 내리는 눈 (인트로와 눈길 장면 공용) */
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const layers = [
    // 뒤: 더 작고 느리고 많음 / 앞: 조금 크고 드문드문
    { el: document.querySelector('.snow--back'),  density: 0.00011, r: [0.6, 1.6], v: [0.25, 0.7], a: [0.35, 0.75] },
    { el: document.querySelector('.snow--front'), density: 0.000025, r: [1.2, 2.4], v: [0.6, 1.2], a: [0.55, 0.9] },
  ];
  const rand = (min, max) => min + Math.random() * (max - min);
  let W = 0, H = 0, dpr = 1;

  // 눈길 장면에서 카메라가 움직이면 눈도 살짝 따라 밀림
  window.SnowDrift = { dx: 0 };

  function makeFlake(L, anywhere) {
    return {
      x: Math.random() * W,
      y: anywhere ? Math.random() * H : -5,
      r: rand(...L.r),
      vy: rand(...L.v),
      a: rand(...L.a),
      sway: rand(0.2, 0.7),
      phase: Math.random() * Math.PI * 2,
      freq: rand(0.004, 0.012),
    };
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    for (const L of layers) {
      L.el.width = W * dpr; L.el.height = H * dpr;
      L.ctx = L.el.getContext('2d');
      L.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(W * H * L.density);
      L.flakes = Array.from({ length: count }, () => makeFlake(L, true));
    }
  }

  function draw(t) {
    if (window.SnowDrift.paused) return;
    const drift = window.SnowDrift.dx;
    window.SnowDrift.dx = 0;
    for (const [i, L] of layers.entries()) {
      const { ctx } = L;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#fff';
      const par = i === 0 ? 0.7 : 1.3;
      for (const f of L.flakes) {
        if (!reduce) {
          f.y += f.vy;
          f.x += Math.sin(t * f.freq * 0.06 + f.phase) * f.sway * 0.5 - drift * par;
          if (f.y > H + 5) Object.assign(f, makeFlake(L, false));
          if (f.x > W + 5) f.x = -5; else if (f.x < -5) f.x = W + 5;
        }
        ctx.globalAlpha = f.a;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (!reduce) requestAnimationFrame(draw);
  }

  addEventListener('resize', resize);
  resize();
  requestAnimationFrame(draw);
})();
