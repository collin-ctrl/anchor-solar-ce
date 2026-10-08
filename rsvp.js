// GET  /api/rsvp  -> seats left
// POST /api/rsvp  -> save a sign-up
const { Redis } = require("@upstash/redis");
const store = require("./_store");

function client() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("Database not connected. Add Upstash Redis under the project's Storage tab.");
  return new Redis({ url, token });
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const redis = client();
    if (req.method === "GET") return res.status(200).json(await store.counts(redis));
    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const out = await store.add(redis, body);
      return res.status(out.error === "invalid" ? 400 : 200).json(out);
    }
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, error: "method" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "server" });
  }
};
module.exports.client = client;
