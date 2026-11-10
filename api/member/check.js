// POST /api/member/check {token} → 내 번호 다시 확인 {no}
const { memberOf, send, body, wrap } = require('../_redis');

module.exports = wrap(async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'method' });
  const data = body(req);
  if (!data) return send(res, 400, { error: 'bad json' });
  const no = await memberOf(data.token);
  return no ? send(res, 200, { no }) : send(res, 404, { error: 'unknown' });
});
