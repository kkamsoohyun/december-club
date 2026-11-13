/* 트리별 카드 모양
   - Friends: 눈사람 편지지 (앞뒤 같은 종이)
   - Family : 체크무늬 지붕 집 카드 / 뒷면은 민무늬 (지붕까지 몸통 종이로)
   - Growth : 진저브레드 모양 크림색 편지지 (앞뒤 같은 종이)
   - Feeling: 빨간 테두리 크리스마스 양말 카드 (앞뒤 같은 종이)
   - Wish   : 빨간 테두리 별 모양 카드 (앞뒤 같은 종이)
   뒷면 이미지는 앞면 그림을 손봐서 만든다 */

export const CARD_STYLES = {
  Friends: { front: 'assets/letter.webp', back: 'assets/letter.webp', w: 1047, h: 1362 },
  Family:  { front: 'assets/family.webp', back: 'plain-roof', w: 962, h: 812 },
  Growth:  { front: 'assets/growth.webp', back: 'assets/growth.webp', w: 1016, h: 1235, crop: [52, 65, 1016, 1235] },
  Feeling: { front: 'assets/feeling.webp', back: 'assets/feeling.webp', w: 972, h: 1450 },
  Wish:    { front: 'assets/wish.webp', back: 'assets/wish.webp', w: 1177, h: 1137 },
};

// 저장되는 트리 이름(키)과 화면에 보이는 이름 — Feeling 트리는 'Discovery'로 보여 줌 (저장된 카드는 그대로)
const TREE_LABELS = { Feeling: 'Discovery' };
export const treeLabel = (tree) => TREE_LABELS[tree] || tree;

export const cardStyle = (tree) => CARD_STYLES[tree] || CARD_STYLES.Friends;

const loadImg = (src) => new Promise((res) => {
  const im = new Image();
  im.onload = () => res(im);
  im.onerror = () => res(null);
  im.src = src;
});

// 집 카드 뒷면: 가장자리 분홍 테두리는 남기고, 지붕 안쪽은 몸통 종이결로 채움
function plainRoof(im) {
  const W = im.width, H = im.height;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.drawImage(im, 0, 0);
  const img = g.getImageData(0, 0, W, H);
  const d = img.data;
  const src = new Uint8ClampedArray(d);

  // 테두리 근처 판별: 알파를 R 픽셀만큼 깎아(최솟값 필터) 안쪽만 남김
  const R = 11;
  const a = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) a[i] = src[i * 4 + 3] > 200 ? 1 : 0;
  const tmp = new Uint8Array(W * H), inner = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let v = 1;
      for (let k = -R; k <= R && v; k++) { const xx = x + k; if (xx < 0 || xx >= W || !a[y * W + xx]) v = 0; }
      tmp[y * W + x] = v;
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let v = 1;
      for (let k = -R; k <= R && v; k++) { const yy = y + k; if (yy < 0 || yy >= H || !tmp[yy * W + x]) v = 0; }
      inner[y * W + x] = v;
    }
  }

  // 몸통 종이 영역 (테두리 안쪽)
  const BX0 = Math.round(W * 0.2), BX1 = Math.round(W * 0.8);
  const BY0 = Math.round(H * 0.53), BY1 = Math.round(H * 0.95);
  const BW = BX1 - BX0, BH = BY1 - BY0;
  const roofEnd = Math.round(H * 0.5);
  const pink = [236, 153, 147];

  for (let y = 0; y < roofEnd; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (src[i + 3] === 0) continue;
      if (!inner[y * W + x]) {
        // 테두리 띠: 분홍 선은 그대로, 그 안쪽으로 비친 무늬는 종이로
        const dr = src[i] - pink[0], dg = src[i + 1] - pink[1], db = src[i + 2] - pink[2];
        if (src[i + 3] < 250 || dr * dr + dg * dg + db * db < 1600) continue;
      }
      // 거울처럼 접어서 이음매 없이 종이결을 가져옴
      let sx = x % (BW * 2), sy = y % (BH * 2);
      if (sx >= BW) sx = BW * 2 - 1 - sx;
      if (sy >= BH) sy = BH * 2 - 1 - sy;
      const j = ((BY0 + sy) * W + (BX0 + sx)) * 4;
      d[i] = src[j]; d[i + 1] = src[j + 1]; d[i + 2] = src[j + 2]; d[i + 3] = src[i + 3];
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

function cropped(im, crop) {
  if (!crop) return im;
  const [x, y, w, h] = crop;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d').drawImage(im, x, y, w, h, 0, 0, w, h);
  return c;
}

const toUrl = (cv, fallback) => new Promise((res) => cv.toBlob((b) => res(b ? URL.createObjectURL(b) : fallback)));

const cache = {};
/** { front: Image|Canvas, back: Image|Canvas, frontUrl, backUrl, w, h } */
export function cardImages(tree) {
  const s = cardStyle(tree);
  const key = s.front;
  if (!cache[key]) {
    cache[key] = (async () => {
      const raw = await loadImg(s.front);
      if (!raw) return { front: null, back: null, frontUrl: s.front, backUrl: s.front, w: s.w, h: s.h };
      const front = cropped(raw, s.crop);
      const frontUrl = s.crop ? await toUrl(front, s.front) : s.front;
      let back = front, backUrl = frontUrl;
      if (s.back === 'plain-roof') back = plainRoof(front);
      if (back !== front) backUrl = await toUrl(back, frontUrl);
      return { front, back, frontUrl, backUrl, w: s.w, h: s.h };
    })();
  }
  return cache[key];
}
