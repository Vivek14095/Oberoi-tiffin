const prices = { Breakfast: 60, Dinner: 70, Combo: 130 };
const week = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const indiaWeekday = new Intl.DateTimeFormat('en-IN', {timeZone: 'Asia/Kolkata', weekday: 'long'});
const indiaDate = new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Kolkata', dateStyle: 'short'});
const json = (data, status = 200, headers = {}) => Response.json(data, {
  status, headers: { 'Cache-Control': 'no-store', ...headers },
});
const fail = (message, status = 400) => json({ error: message }, status);
const tidy = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const phoneNumber = (value) => {
  const digits = tidy(value, 25).replace(/[\s()+-]/g, '');
  const national = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
  return /^[6-9][0-9]{9}$/.test(national) ? '+91' + national : '';
};
const hash = async (value) => Array.from(
  new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))),
  (byte) => byte.toString(16).padStart(2, '0'),
).join('');
function deliveryDetails(body, verifiedPhone) {
  const name = tidy(body.name, 80);
  const phone = phoneNumber(body.phone) || verifiedPhone;
  const address = tidy(body.address, 350);
  const pin = Array.isArray(body.pin) && body.pin.length === 2 &&
    body.pin.every(Number.isFinite) && Math.abs(body.pin[0]) <= 90 && Math.abs(body.pin[1]) <= 180
    ? body.pin.map((value) => Number(value.toFixed(6))) : null;
  return { name, phone, address, pin };
}
async function limit(db, key, duration, maximum) {
  const bucket = Math.floor(Date.now() / duration);
  const result = await db.prepare(`INSERT INTO otp_limits (key, bucket, count) VALUES (?, ?, 1)
    ON CONFLICT(key) DO UPDATE SET bucket = excluded.bucket,
    count = CASE WHEN otp_limits.bucket = excluded.bucket THEN otp_limits.count + 1 ELSE 1 END
    RETURNING count`).bind(await hash(key), bucket).first();
  return result.count <= maximum;
}
function readItems(source, expectedDay, expectedDate) {
  if (!Array.isArray(source) || !source.length || source.length > 21) return null;
  const items = [];
  for (const item of source) {
    if (!item || !Object.hasOwn(prices, item.kind) || item.day !== expectedDay || item.date !== expectedDate ||
        !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20) return null;
    const side = item.kind === 'Breakfast' ? '' : item.side;
    if (item.kind !== 'Breakfast' && !['Rice + 3 chapatis', '5 chapatis'].includes(side)) return null;
    items.push({ kind: item.kind, day: week[item.day], side, quantity: item.quantity });
  }
  if (items.reduce((sum, item) => sum + item.quantity, 0) > 30) return null;
  return items;
}
async function guestTracking(request, db, path, body) {
  if (!db) return fail('Tracking is temporarily unavailable.', 503);
  const now = Date.now();
  const id = tidy(body.id, 40);
  if (!/^DBB-[A-F0-9]{16}$/.test(id)) return fail('Invalid tracking reference.');
  const tokenPattern = /^[a-f0-9]{64}$/;
  if (path === '/api/guest/create') {
    if (!tokenPattern.test(body.viewer) || !tokenPattern.test(body.rider) || body.viewer === body.rider) return fail('Invalid tracking keys.');
    const date = new Date(now);
    if (!readItems(body.items, week.indexOf(indiaWeekday.format(date)), indiaDate.format(date))) return fail('Choose items from today’s menu only.');
    const source = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (!await limit(db, 'guest:' + source, 600000, 12)) return fail('Too many tracking requests. Please try later.', 429);
    const pin = deliveryDetails(body, '').pin;
    await db.batch([
      db.prepare('DELETE FROM guest_tracking WHERE created < ?').bind(now - 172800000),
      db.prepare('INSERT INTO guest_tracking (id, viewer, rider, destination, created) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING')
        .bind(id, await hash(body.viewer), await hash(body.rider), pin ? JSON.stringify(pin) : null, now),
    ]);
    const match = await db.prepare('SELECT id FROM guest_tracking WHERE id = ? AND viewer = ?').bind(id, await hash(body.viewer)).first();
    return match ? json({ok:true}) : fail('Could not create tracking.', 409);
  }
  if (!tokenPattern.test(body.token)) return fail('Tracking link is invalid.', 404);
  const key = await hash(body.token);
  const row = await db.prepare('SELECT * FROM guest_tracking WHERE id = ? AND created >= ?').bind(id, now - 172800000).first();
  if (!row || (key !== row.viewer && key !== row.rider)) return fail('Tracking link is invalid or expired.', 404);
  if (path === '/api/guest/track') return json({
    id, status: row.status, updated: row.updated, destination: JSON.parse(row.destination), start: JSON.parse(row.first_pin),
    rider: JSON.parse(row.latest_pin), canShare: key === row.rider,
  });
  if (path !== '/api/guest/location' || key !== row.rider) return fail('Only the rider link can share updates.', 403);
  if (row.status === 'delivered') return fail('This delivery is closed.', 409);
  if (body.delivered === true) {
    await db.prepare("UPDATE guest_tracking SET status = 'delivered', latest_pin = NULL, first_pin = NULL, destination = NULL, updated = ? WHERE id = ? AND status <> 'delivered'").bind(now,id).run();
    return json({ok:true});
  }
  const pin = deliveryDetails(body, '').pin;
  if (!pin) return fail('A GPS reading is required.');
  const value = JSON.stringify(pin);
  await db.prepare("UPDATE guest_tracking SET status = 'out_for_delivery', first_pin = COALESCE(first_pin, ?), latest_pin = ?, updated = ? WHERE id = ? AND status <> 'delivered' AND (updated IS NULL OR updated <= ?)")
    .bind(value,value,now,id,now - 3500).run();
  return json({ok:true});
}
async function api(request, env, path) {
  const method = request.method;
  if (!['GET', 'POST'].includes(method)) return fail('Method unavailable.', 405);
  let body = {};
  if (method === 'POST') {
    if (request.headers.get('Sec-Fetch-Site') === 'cross-site' ||
        !request.headers.get('Content-Type')?.startsWith('application/json')) return fail('Request origin rejected.', 403);
    try {
      const raw = await request.text();
      if (raw.length > 12000) return fail('Request too large.', 413);
      body = JSON.parse(raw);
      if (!body || typeof body !== 'object' || Array.isArray(body)) return fail('Invalid request.');
    } catch { return fail('Invalid request.'); }
  }
  const db = env.DB;
  if (method === 'POST' && path.startsWith('/api/guest/')) return guestTracking(request, db, path, body);
  return fail('Page unavailable.', 404);
}
export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    try {
      if (pathname.startsWith('/api/')) return await api(request, env, pathname);
      if (!['GET', 'HEAD'].includes(request.method)) return fail('Method unavailable.', 405);
      const path = pathname === '/' ? '/index.html' : pathname;
      if (!Object.hasOwn(assets, path)) return fail('Page unavailable.', 404);
      const types = { html:'text/html; charset=utf-8', css:'text/css; charset=utf-8', js:'text/javascript; charset=utf-8', jpg:'image/jpeg' };
      return new Response(request.method === 'HEAD' ? null : Uint8Array.from(atob(assets[path]), c => c.charCodeAt(0)), {
        headers: { 'Content-Type': types[path.split('.').pop()], 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' },
      });
    } catch {
      return fail('The service is temporarily unavailable. Please try again.', 503);
    }
  },
};
