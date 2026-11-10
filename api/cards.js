/* GET    /api/cards?tree=Friends   그 트리에 걸린 카드 목록
   POST   /api/cards                카드 걸기 {token, tree, category, question, answer, slot}
   DELETE /api/cards {id, token}    내가 건 카드 떼기 */
const { redis, hash, newId, memberOf, send, body, wrap, TREES, MAX_ANSWER, MAX_SLOTS } = require('./_redis');

const pub = ({ tokenHash, ...card }) => card;          // 본인 확인용 해시는 밖으로 안 내보냄

module.exports = wrap(async (req, res) => {
  if (req.method === 'GET') {
    const tree = req.query?.tree;
    if (!TREES.has(tree)) return send(res, 400, { error: 'bad tree' });
    const all = (await redis('HVALS', `dc:cards:${tree}`)) || [];
    const cards = all.map((s) => pub(JSON.parse(s))).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return send(res, 200, { cards });
  }

  const data = body(req);
  if (!data) return send(res, 400, { error: 'bad json' });

  if (req.method === 'POST') {
    const tree = data.tree;
    const answer = String(data.answer || '').trim().slice(0, MAX_ANSWER);
    if (!TREES.has(tree) || !answer) return send(res, 400, { error: 'bad card' });
    const member = await memberOf(data.token);
    if (!member) return send(res, 403, { error: 'unknown member' });

    const id = newId();
    // 원하는 자리를 먼저 잡아 보고, 이미 찼으면 가장 앞의 빈 자리 (동시에 걸어도 겹치지 않게 HSETNX)
    let slot = Number.isInteger(data.slot) && data.slot >= 0 && data.slot < MAX_SLOTS ? data.slot : null;
    let got = slot !== null && (await redis('HSETNX', `dc:slots:${tree}`, String(slot), id)) === 1;
    for (let tries = 0; !got && tries < 5; tries++) {
      const used = new Set(((await redis('HKEYS', `dc:slots:${tree}`)) || []).map(Number));
      slot = 0;
      while (used.has(slot)) slot++;
      got = (await redis('HSETNX', `dc:slots:${tree}`, String(slot), id)) === 1;
    }
    if (!got) return send(res, 409, { error: 'busy, try again' });

    const card = {
      id, tree,
      category: String(data.category || '').slice(0, 60),
      question: String(data.question || '').slice(0, 200),
      answer, member, slot,
      createdAt: new Date().toISOString(),
      tokenHash: hash(data.token),
    };
    await redis('HSET', `dc:cards:${tree}`, id, JSON.stringify(card));
    return send(res, 200, { card: pub(card) });
  }

  if (req.method === 'DELETE') {
    const id = String(data.id || '');
    for (const tree of TREES) {
      const raw = await redis('HGET', `dc:cards:${tree}`, id);
      if (!raw) continue;
      const card = JSON.parse(raw);
      if (card.tokenHash !== hash(data.token)) return send(res, 403, { error: 'not yours' });
      await redis('HDEL', `dc:cards:${tree}`, id);
      await redis('HDEL', `dc:slots:${tree}`, String(card.slot));
      return send(res, 200, { ok: true });
    }
    return send(res, 404, { error: 'no card' });
  }

  send(res, 405, { error: 'method' });
});
