export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  const path = req.url.replace(/^\/api\/kt/, "") || "/";
  const base = (process.env.VITE_KUTETAILOR_API_URL ?? "https://platform.kutetailor.com/api").replace(/\/$/, "");
  const url = `${base}${path}`;

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined;

  const headers = {};
  const forward = ["content-type", "authorization", "accept", "accept-language"];
  for (const h of forward) {
    if (req.headers[h]) headers[h] = req.headers[h];
  }

  const r = await fetch(url, { method: req.method, headers, body });
  const text = await r.text();
  res.setHeader("Content-Type", r.headers.get("content-type") || "application/json");
  res.status(r.status).send(text);
}
