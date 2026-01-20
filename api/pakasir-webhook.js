function json(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

async function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed" });

  try {
    const body = req.body || {};
    const { amount, order_id, project, status, payment_method, completed_at } = body;

    // minimal validation
    if (!order_id || !amount || !project) {
      return json(res, 400, { ok: false, error: "Invalid webhook payload" });
    }

    // Optional: cek slug project sama
    const expectedProject = process.env.PAKASIR_PROJECT_SLUG;
    if (expectedProject && project !== expectedProject) {
      return json(res, 400, { ok: false, error: "Project mismatch" });
    }

    // Kalau bukan completed, ignore (biar aman)
    if (status && String(status).toLowerCase() !== "completed") {
      return json(res, 200, { ok: true, ignored: true });
    }

    // Verifikasi ke Pakasir (biar webhook palsu tidak masuk)
    const apiKey = process.env.PAKASIR_API_KEY;
    if (!apiKey) return json(res, 500, { ok: false, error: "PAKASIR_API_KEY missing" });

    const verifyUrl =
      `https://app.pakasir.com/api/transactiondetail` +
      `?project=${encodeURIComponent(project)}` +
      `&amount=${encodeURIComponent(amount)}` +
      `&order_id=${encodeURIComponent(order_id)}` +
      `&api_key=${encodeURIComponent(apiKey)}`;

    const verifyResp = await fetch(verifyUrl);
    if (!verifyResp.ok) {
      const t = await verifyResp.text();
      return json(res, 500, { ok: false, error: "Verify failed", detail: t });
    }

    const verifyData = await verifyResp.json();
    const tx = verifyData?.transaction;

    if (!tx || String(tx.status).toLowerCase() !== "completed") {
      return json(res, 200, { ok: true, ignored: true, reason: "verify not completed" });
    }

    // Supabase update + get order
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return json(res, 500, { ok: false, error: "Supabase env missing" });
    }

    const getResp = await fetch(
      `${supabaseUrl}/rest/v1/orders?order_id=eq.${encodeURIComponent(order_id)}&select=*`,
      {
        headers: {
          "apikey": supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`,
        },
      }
    );

    const orders = getResp.ok ? await getResp.json() : [];
    const order = orders?.[0];

    await fetch(
      `${supabaseUrl}/rest/v1/orders?order_id=eq.${encodeURIComponent(order_id)}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "apikey": supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          status: "completed",
          completed_at: tx.completed_at || completed_at || new Date().toISOString(),
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
      `<b>Nominal:</b> Rp${amount}`,
      `<b>Metode:</b> ${payment_method || tx.payment_method || "qris"}`,
      `<b>Status:</b> completed`,
      "",
      "<b>Data Customer:</b>",
      customerText,
      "",
      `<b>Waktu:</b> ${tx.completed_at || completed_at || "-"}`,
    ].join("\n");

    await sendTelegram(msg);

    return json(res, 200, { ok: true });
  } catch (e) {
    return json(res, 500, { ok: false, error: "Server error", detail: String(e?.message || e) });
  }
}
