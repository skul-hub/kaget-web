async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

function parseUrlEncoded(str) {
  const out = {};
  const params = new URLSearchParams(str);
  for (const [k, v] of params.entries()) out[k] = v;
  return out;
}

function json(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

async function sendTelegramWithButton(text, orderId) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return { ok: false, error: "Telegram env missing" };

  const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: [
          [{ text: "✅ Tandai Selesai", callback_data: `done:${orderId}` }]
        ]
      }
    }),
  });

  const data = await resp.json().catch(() => ({}));
  return { ok: resp.ok, data };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed" });

  try {
    const raw = await readRawBody(req);
    const ct = String(req.headers["content-type"] || "").toLowerCase();

    let body = {};
    if (ct.includes("application/json")) body = raw ? JSON.parse(raw) : {};
    else if (ct.includes("application/x-www-form-urlencoded")) body = parseUrlEncoded(raw || "");
    else {
      try { body = raw ? JSON.parse(raw) : {}; }
      catch { body = parseUrlEncoded(raw || ""); }
    }

    const order_id = body.order_id || body.orderId;
    const amount = body.amount || body.total;
    const status = String(body.status || "").toLowerCase();
    const project = body.project || body.project_slug || body.projectSlug;
    const payment_method = body.payment_method || body.paymentMethod || "qris";
    const completed_at = body.completed_at || body.completedAt || new Date().toISOString();

    if (!order_id) return json(res, 400, { ok: false, error: "order_id missing" });

    // kalau webhook ngirim status, tapi bukan completed, skip
    if (status && status !== "completed") return json(res, 200, { ok: true, ignored: true, status });

    // Update Supabase -> paid
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) return json(res, 500, { ok: false, error: "Supabase env missing" });

    // Get order for detail notif
    const getResp = await fetch(
      `${supabaseUrl}/rest/v1/orders?order_id=eq.${encodeURIComponent(order_id)}&select=*`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    );
    const orders = getResp.ok ? await getResp.json() : [];
    const order = orders?.[0];

    // Patch to paid (idempotent)
    await fetch(
      `${supabaseUrl}/rest/v1/orders?order_id=eq.${encodeURIComponent(order_id)}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          status: "paid",
          paid_at: completed_at,
        }),
      }
    );

    const customer = order?.customer || {};
    const customerText =
      order?.product_type === "panel"
        ? `• Username Panel: ${customer.username || "-"}\n• Email: ${customer.email || "-"}`
        : order?.product_type === "vps"
          ? `• Email: ${customer.email || "-"}`
          : `• Phone: ${customer.phone || "-"}`;

    const msg = [
      "✅ <b>PEMBAYARAN BERHASIL - SKULLHOSTING</b>",
      "",
      `<b>Order ID:</b> ${order_id}`,
      `<b>Produk:</b> ${order?.product_type || "-"}`,
      `<b>Paket:</b> ${order?.package_name || "-"}`,
      `<b>Nominal:</b> ${amount ? `Rp${amount}` : `Rp${order?.amount || "-"}`}`,
      `<b>Metode:</b> ${payment_method}`,
      project ? `<b>Project:</b> ${project}` : "",
      "",
      "<b>Data Customer:</b>",
      customerText,
      "",
      `<b>Status:</b> paid`,
      `<b>Waktu:</b> ${completed_at}`,
    ].filter(Boolean).join("\n");

    const tg = await sendTelegramWithButton(msg, order_id);
    if (!tg.ok) {
      return json(res, 200, { ok: true, warning: "telegram_failed", telegram: tg.data });
    }

    return json(res, 200, { ok: true });
  } catch (e) {
    return json(res, 500, { ok: false, error: "Server error", detail: String(e?.message || e) });
  }
}
