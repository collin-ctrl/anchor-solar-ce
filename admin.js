// POST /api/admin  { pin }  -> full RSVP list
const { client } = require("./rsvp");
const store = require("./_store");

const PIN = process.env.ADMIN_PIN || "1003";

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method" });
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  if (String(body.pin || "") !== PIN) {
    await new Promise(r => setTimeout(r, 600)); // slow down guessing
    return res.status(401).json({ ok: false, error: "pin" });
  }
  try {
    return res.status(200).json(await store.list(client()));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "server" });
  }
};
