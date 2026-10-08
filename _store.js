// Shared RSVP logic. Takes any Redis client with the Upstash REST API shape.
const CAPACITY = parseInt(process.env.CAPACITY || "20", 10);
const K = {
  list: "solarce:rsvps",        // list of JSON records, in sign-up order
  emails: "solarce:emails",     // hash: email -> status (prevents double sign-ups)
  seats: "solarce:confirmed",   // counter of confirmed seats
};

function clean(v, max) {
  return String(v == null ? "" : v).replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);
}
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function counts(redis) {
  const confirmed = Math.min(Number((await redis.get(K.seats)) || 0), CAPACITY);
  return { ok: true, cap: CAPACITY, confirmed, left: Math.max(0, CAPACITY - confirmed) };
}

async function add(redis, body) {
  const d = body || {};
  if (d.website) return { ok: true, status: "Confirmed" };  // honeypot: bots fill hidden field
  const rec = {
    name: clean(d.name, 120),
    email: clean(d.email, 160).toLowerCase(),
    license: clean(d.license, 40),
    dietary: clean(d.dietary, 300),
  };
  if (rec.name.length < 2 || !EMAIL_RE.test(rec.email) || rec.license.length < 3) {
    return { ok: false, error: "invalid" };
  }
  // Claim the email first so two quick submits can't both get in
  const fresh = await redis.hsetnx(K.emails, rec.email, "pending");
  if (!fresh) {
    const prev = await redis.hget(K.emails, rec.email);
    return { ok: true, duplicate: true, status: prev === "Waitlist" ? "Waitlist" : "Confirmed" };
  }
  const n = await redis.incr(K.seats);
  let status = "Confirmed";
  if (n > CAPACITY) { status = "Waitlist"; await redis.decr(K.seats); }
  rec.status = status;
  rec.time = new Date().toISOString();
  await redis.rpush(K.list, JSON.stringify(rec));
  await redis.hset(K.emails, { [rec.email]: status });
  return { ok: true, status };
}

async function list(redis) {
  const raw = await redis.lrange(K.list, 0, -1);
  const rows = raw.map(r => (typeof r === "string" ? JSON.parse(r) : r));
  return { ok: true, cap: CAPACITY, rows };
}

module.exports = { counts, add, list, CAPACITY, K };
