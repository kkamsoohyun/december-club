/* 십자수 글자: 올이 풀린 천 조각(아이다 천) 위에 빨간 실로 X자 수를 놓은 그림을 canvas 로 만듦
   - 글자를 필기체로 그린 뒤 칸마다 글자가 덮였는지 보고, 덮인 칸에 X 한 땀씩 놓음 */

const FABRIC = '#f4ecd9', GAP = '#ddcfb2', THREAD = 'rgba(244, 236, 217, 0.9)';

export async function crossStitch(text, { size = 120, cell = 7 } = {}) {
  const font = `${size}px Lobster, 'Snell Roundhand', cursive`;
  try { await document.fonts.load(font, text); } catch { /* 글꼴을 못 불러오면 대체 글꼴로 */ }

  const measure = document.createElement('canvas').getContext('2d');
  measure.font = font;
  const tw = Math.ceil(measure.measureText(text).width);
  const padX = 30, padY = 22, fray = 14;
  const cols = Math.ceil((tw + padX * 2) / cell);
  const rows = Math.ceil((size * 1.15 + padY * 2) / cell);
  const pw = cols * cell, ph = rows * cell;
  const W = pw + fray * 2, H = ph + fray * 2;

  // 1) 글자 모양(마스크)
  const mask = document.createElement('canvas');
  mask.width = pw; mask.height = ph;
  const mx = mask.getContext('2d');
  mx.font = font; mx.textAlign = 'center'; mx.textBaseline = 'middle'; mx.fillStyle = '#000';
  mx.fillText(text, pw / 2, ph / 2 + size * 0.04);
  const md = mx.getImageData(0, 0, pw, ph).data;
  const covered = (c, r) => {
    let n = 0;                                     // 칸 안 5곳을 찍어 절반 넘게 덮였으면 수를 놓음
    for (const [fx, fy] of [[0.5, 0.5], [0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
      const x = Math.floor((c + fx) * cell), y = Math.floor((r + fy) * cell);
      if (md[(y * pw + x) * 4 + 3] > 110) n++;
    }
    return n >= 3;
  };

  // 2) 그림
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cv = document.createElement('canvas');
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  cv.style.width = `${W}px`;
  const g = cv.getContext('2d');
  g.scale(dpr, dpr);
  let seed = 20251225;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  g.lineCap = 'round';

  // 풀린 올: 네 가장자리에서 바깥으로 삐져나온 실
  g.strokeStyle = THREAD;
  const threads = (len, along) => {
    for (let i = cell / 2; i < len; i += cell) {
      if (rnd() < 0.15) continue;
      along(i, 3 + rnd() * (fray - 2), (rnd() - 0.5) * 3);
    }
  };
  g.lineWidth = 1.3;
  threads(pw, (i, l, j) => { line(g, fray + i, fray + 2, fray + i + j, fray - l); line(g, fray + i, fray + ph - 2, fray + i + j, fray + ph + l); });
  threads(ph, (i, l, j) => { line(g, fray + 2, fray + i, fray - l, fray + i + j); line(g, fray + pw - 2, fray + i, fray + pw + l, fray + i + j); });

  // 천 조각: 가장자리가 살짝 울퉁불퉁한 사각형
  g.save();
  g.beginPath();
  const edge = [];
  for (let x = 0; x <= pw; x += cell) edge.push([x, (rnd() - 0.5) * 3]);
  for (let y = cell; y <= ph; y += cell) edge.push([pw + (rnd() - 0.5) * 3, y]);
  for (let x = pw - cell; x >= 0; x -= cell) edge.push([x, ph + (rnd() - 0.5) * 3]);
  for (let y = ph - cell; y > 0; y -= cell) edge.push([(rnd() - 0.5) * 3, y]);
  edge.forEach(([x, y], i) => (i ? g.lineTo : g.moveTo).call(g, fray + x, fray + y));
  g.closePath();
  g.fillStyle = GAP;
  g.fill();
  g.clip();

  // 아이다 천 짜임: 칸마다 도톰한 실 덩어리, 모서리에 작은 구멍
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = fray + c * cell, y = fray + r * cell;
      g.fillStyle = FABRIC;
      g.fillRect(x + 0.7, y + 0.7, cell - 1.4, cell - 1.4);
      g.fillStyle = 'rgba(255, 255, 255, 0.35)';
      g.fillRect(x + 1.2, y + 1.2, cell - 3, 1);
    }
  }
  // 가장자리로 갈수록 살짝 누렇게
  const vg = g.createRadialGradient(W / 2, H / 2, Math.min(pw, ph) * 0.35, W / 2, H / 2, Math.max(pw, ph) * 0.62);
  vg.addColorStop(0, 'rgba(120, 90, 50, 0)');
  vg.addColorStop(1, 'rgba(120, 90, 50, 0.16)');
  g.fillStyle = vg;
  g.fillRect(0, 0, W, H);

  // 3) 십자수: 아래 / 를 먼저, 위에 \ 를 겹쳐 놓음
  const w = cell * 0.44, a = 0.9, b = cell - 0.9;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!covered(c, r)) continue;
      const x = fray + c * cell, y = fray + r * cell;
      g.lineWidth = w;
      g.strokeStyle = 'rgba(70, 0, 8, 0.35)';                     // 실 그림자
      line(g, x + a + 0.6, y + b + 0.9, x + b + 0.6, y + a + 0.9);
      line(g, x + a + 0.6, y + a + 0.9, x + b + 0.6, y + b + 0.9);
      g.strokeStyle = '#a7111f';                                  // 아래 땀
      line(g, x + a, y + b, x + b, y + a);
      g.strokeStyle = '#d8232f';                                  // 위 땀
      line(g, x + a, y + a, x + b, y + b);
      g.lineWidth = w * 0.32;                                     // 실 윤기
      g.strokeStyle = 'rgba(255, 150, 140, 0.55)';
      line(g, x + a + 0.5, y + a - 0.3, x + b - 0.6, y + b - 1.2);
    }
  }
  g.restore();
  return cv;
}

function line(g, x1, y1, x2, y2) {
  g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
}
