/* Vercel 서버 함수 공용: Upstash Redis(REST) + 응답 도우미
   (파일 이름이 _ 로 시작하면 Vercel이 함수로 공개하지 않음)

   Redis 키
   - dc:next                  다음 멤버 번호 (INCR)
   - dc:member:<토큰 해시>     멤버 번호 (토큰 자체는 저장 안 함)
   - dc:cards:<트리>          해시: 카드 id → 카드 JSON
   - dc:slots:<트리>          해시: 자리 번호 → 카드 id (같은 자리에 두 장이 걸리지 않게) */
const crypto = require('crypto');

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

const TREES = new Set(['Friends', 'Family', 'Growth', 'Feeling', 'Wish']);
const MAX_ANSWER = 300;
const MAX_SLOTS = 200;

async function redis(...cmd) {
  const res = await fetch(URL_, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || `redis ${res.status}`);
  return data.result;
}

const hash = (token) => crypto.createHash('sha256').update(String(token || '')).digest('hex');
const newToken = () => crypto.randomBytes(18).toString('base64url');
const newId = () => crypto.randomBytes(6).toString('hex');

const memberOf = async (token) => {
  if (!token) return null;
  const no = await redis('GET', `dc:member:${hash(token)}`);
  return no ? Number(no) : null;
};

function send(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}

function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch { return null; }
}

// 저장소가 아직 연결되지 않았으면 503 → 화면은 '혼자 모드'로 동작
function wrap(handler) {
  return async (req, res) => {
    if (!URL_ || !TOKEN) return send(res, 503, { error: 'storage not connected' });
    try { await handler(req, res); } catch (e) { console.error(e); send(res, 500, { error: 'server error' }); }
  };
}

module.exports = { redis, hash, newToken, newId, memberOf, send, body, wrap, TREES, MAX_ANSWER, MAX_SLOTS };
