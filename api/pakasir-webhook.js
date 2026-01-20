// api/pakasir-webhook.js

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

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

async function sendTelegramWithButton(text, orderId) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    return { ok: false, error: "Telegram env missing" };
  }

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
  // ✅ biar kalau dibuka di browser keliatan "ready"
  if (req.method === "GET") {
    return sendJson(res, 200, {
      ok: true,
      msg: "Webhook ready. Waiting POST from Pakasir.",
    });
  }

  if (req.method !== "POST") {
    return sendJson(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    // 1) Baca raw body & parse sesuai content-type
    const raw = await readRawBody(req);
    const ct = String(req.headers["content-type"] || "").toLowerCase();

    let body = {};
    if (ct.includes("application/json")) {
      body = raw ? JSON.parse(raw) : {};
    } else if (ct.includes("application/x-www-form-urlencoded")) {
      body = parseUrlEncoded(raw || "");
    } else {
      // fallback
      try {
        body = raw ? JSON.parse(raw) : {};
      } catch {
        body = parseUrlEncoded(raw || "");
      }
    }

    // 2) Normalize field (kadang beda naming)
    const order_id =
      body.order_id || body.orderId || body.orderID || body.orderid;

    const amount =
      body.amount || body.total || body.jumlah || body.price;

    const statusRaw = body.status || body.payment_status || body.state || "";
    const status = String(statusRaw).toLowerCase();

    const project =
      body.project || body.project_slug || body.projectSlug || body.slug;

    const payment_method =
      body.payment_method || body.paymentMethod || body.method || "qris";

    const completed_at =
      body.completed_at || body.completedAt || body.paid_at || body.paidAt;

    if (!order_id) {
      return sendJson(res, 400, {
        ok: false,
        error: "order_id missing",
        got: body,
      });
    }

    // 3) Kalau status ada tapi bukan completed => ignore (anggap belum paid)
    // (kalau Pakasir tidak kirim status, kita tetap proses sebagai paid)
    if (status && status !== "completed" && status !== "paid" && status !== "success") {
      return sendJson(res, 200, { ok: true, ignored: true, status });
    }

    // 4) Supabase env
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return sendJson(res, 500, { ok: false, error: "Supabase env missing" });
    }

    // 5) Ambil order untuk detail notif (optional)
    const getResp = await fetch(
      `${supabaseUrl}/rest/v1/orders?order_id=eq.${encodeURIComponent(order_id)}&select=*`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      }
    );

    const orders = getResp.ok ? await getResp.json() : [];
    const order = orders?.[0];

    // 6) Update order -> paid (idempotent)
    const paidAt = completed_at || new Date().toISOString();

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
          paid_at: paidAt,
        }),
      }
    );

    // 7) Compose telegram message
    const customer = order?.customer || {};
    const customerText =
      order?.product_type === "panel"
        ? `• Username Panel: ${customer.username || "-"}\n• Email: ${customer.email || "-"}`
        : order?.product_type === "vps"
          ? `• Email: ${customer.email || "-"}`
          : `• Phone: ${customer.phone || "-"}`;

    const nominal =
      amount ? `Rp${amount}` : (order?.amount ? `Rp${order.amount}` : "-");

    const msg = [
      "✅ <b>PEMBAYARAN BERHASIL - SKULLHOSTING</b>",
      "",
      `<b>Order ID:</b> ${order_id}`,
      `<b>Produk:</b> ${order?.product_type || "-"}`,
      `<b>Paket:</b> ${order?.package_name || "-"}`,
      `<b>Nominal:</b> ${nominal}`,
      `<b>Status:</b> paid`,
      `<b>Metode:</b> ${payment_method}`,
      project ? `<b>Project:</b> ${project}` : "",
      "",
      "<b>Data Customer:</b>",
      customerText,
      "",
      `<b>Waktu:</b> ${paidAt}`,
    ].filter(Boolean).join("\n");

    const tg = await sendTelegramWithButton(msg, order_id);

    // 8) Response
    if (!tg.ok) {
      return sendJson(res, 200, {
        ok: true,
        warning: "telegram_failed",
        order_id,
        telegram: tg.data || tg.error,
      });
    }

    return sendJson(res, 200, {
      ok: true,
      order_id,
      updated: "paid",
    });

  } catch (e) {
    return sendJson(res, 500, {
      ok: false,
      error: "Server error",
      detail: String(e?.message || e),
    });
  }
}
