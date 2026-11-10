// POST /api/member → 새 입장자에게 번호 발급 {no, token}
const { redis, hash, newToken, send, wrap } = require('../_redis');

module.exports = wrap(async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'method' });
  const no = Number(await redis('INCR', 'dc:next'));
  const token = newToken();
  await redis('SET', `dc:member:${hash(token)}`, String(no));
  send(res, 200, { no, token });
});
