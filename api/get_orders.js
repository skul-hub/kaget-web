// api/get-orders.js

function json(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

export default async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { ok: false, error: "Method not allowed" });

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) return json(res, 500, { ok: false, error: "Supabase env missing" });

    const url = new URL(req.url, `http://${req.headers.host}`);
    const email = (url.searchParams.get("email") || "").trim().toLowerCase();
    const phone = (url.searchParams.get("phone") || "").trim();
    const username = (url.searchParams.get("username") || "").trim();

    if (!email && !phone && !username) {
      return json(res, 400, { ok: false, error: "Isi email / phone / username untuk lihat history" });
    }

    // Filter by customer->>email OR customer->>phone OR customer->>username
    // Supabase REST filter jsonb: customer->>email=eq.xxx
    let filters = [];
    if (email) filters.push(`customer->>email=eq.${encodeURIComponent(email)}`);
    if (phone) filters.push(`customer->>phone=eq.${encodeURIComponent(phone)}`);
    if (username) filters.push(`customer->>username=eq.${encodeURIComponent(username)}`);

    // OR filters, example: or=(a.eq.1,b.eq.2)
    // Build or=(customer->>email.eq.xxx,customer->>phone.eq.xxx,customer->>username.eq.xxx)
    const or = filters.map(f => f.replace("=eq.", ".eq.")).join(",");

    const fetchUrl =
      `${supabaseUrl}/rest/v1/orders` +
      `?select=order_id,product_type,package_name,amount,status,created_at,paid_at,done_at,customer` +
      `&or=(${or})` +
      `&order=created_at.desc` +
      `&limit=20`;

    const resp = await fetch(fetchUrl, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    });

    if (!resp.ok) {
      const t = await resp.text();
      return json(res, 500, { ok: false, error: "Supabase fetch failed", detail: t });
    }

    const rows = await resp.json();

    // Biar email/phone tidak kepapasan, kita balikin customer minimal
    const safe = rows.map(r => ({
      order_id: r.order_id,
      product_type: r.product_type,
      package_name: r.package_name,
      amount: r.amount,
      status: r.status,
      created_at: r.created_at,
      paid_at: r.paid_at,
      done_at: r.done_at,
      customer: {
        email: r.customer?.email || null,
        phone: r.customer?.phone || null,
        username: r.customer?.username || null
      }
    }));

    return json(res, 200, { ok: true, data: safe });
  } catch (e) {
    return json(res, 500, { ok: false, error: "Server error", detail: String(e?.message || e) });
  }
}
