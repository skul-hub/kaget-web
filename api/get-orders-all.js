// api/get-orders-all.js

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

export default async function handler(req, res) {
  if (req.method !== "GET") return sendJson(res, 405, { ok: false, error: "Method not allowed" });

  try {
    const adminKey = process.env.ADMIN_KEY || "";
    const url = new URL(req.url, `http://${req.headers.host}`);
    const key = (url.searchParams.get("key") || "").trim();

    if (adminKey && key !== adminKey) {
      return sendJson(res, 401, { ok: false, error: "Unauthorized (admin key salah)" });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return sendJson(res, 500, { ok: false, error: "Supabase env missing" });
    }

    const fetchUrl =
      `${supabaseUrl}/rest/v1/orders` +
      `?select=order_id,product_type,package_name,amount,status,created_at,paid_at,done_at` +
      `&order=created_at.desc` +
      `&limit=50`;

    const resp = await fetch(fetchUrl, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    });

    if (!resp.ok) {
      const t = await resp.text();
      return sendJson(res, 500, { ok: false, error: "Supabase fetch failed", detail: t });
    }

    const rows = await resp.json();
    return sendJson(res, 200, { ok: true, data: rows });
  } catch (e) {
    return sendJson(res, 500, { ok: false, error: "Server error", detail: String(e?.message || e) });
  }
}
