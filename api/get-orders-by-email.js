// api/get-orders-by-email.js

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

export default async function handler(req, res) {
  if (req.method !== "GET") return sendJson(res, 405, { ok: false, error: "Method not allowed" });

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const email = (url.searchParams.get("email") || "").trim().toLowerCase();

    if (!email) return sendJson(res, 400, { ok: false, error: "Email wajib diisi" });

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return sendJson(res, 500, { ok: false, error: "Supabase env missing" });
    }

    // Filter by JSONB field: customer->>email
    const fetchUrl =
      `${supabaseUrl}/rest/v1/orders` +
      `?select=order_id,product_type,package_name,amount,status,created_at,paid_at,done_at,customer` +
      `&customer->>email=eq.${encodeURIComponent(email)}` +
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

    // Ringkas: jangan kirim customer detail
    const safe = rows.map((r) => ({
      order_id: r.order_id,
      product_type: r.product_type,
      package_name: r.package_name,
      amount: r.amount,
      status: r.status,
      created_at: r.created_at,
      paid_at: r.paid_at || null,
      done_at: r.done_at || null,
    }));

    return sendJson(res, 200, { ok: true, data: safe });
  } catch (e) {
    return sendJson(res, 500, { ok: false, error: "Server error", detail: String(e?.message || e) });
  }
}
