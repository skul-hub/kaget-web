// api/debug-webhook.js
async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

function json(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

export default async function handler(req, res) {
  const raw = await readRawBody(req);
  return json(res, 200, {
    ok: true,
    method: req.method,
    content_type: req.headers["content-type"] || null,
    raw_body: raw || null,
    headers: {
      "user-agent": req.headers["user-agent"] || null,
    },
  });
}
