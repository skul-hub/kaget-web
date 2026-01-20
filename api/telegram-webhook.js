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

async function tg(method, payload) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const resp = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return resp.json().catch(() => ({}));
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { ok: false });

  try {
    const raw = await readRawBody(req);
    const update = raw ? JSON.parse(raw) : {};

    const adminChatId = String(process.env.TELEGRAM_CHAT_ID || "");
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!adminChatId || !supabaseUrl || !supabaseKey) {
      return json(res, 500, { ok: false, error: "ENV missing" });
    }

    // callback query button
    const cb = update.callback_query;
    if (cb) {
      const fromChatId = String(cb.message?.chat?.id || "");
      const data = String(cb.data || "");
      const cbId = cb.id;

      if (fromChatId !== adminChatId) {
        await tg("answerCallbackQuery", { callback_query_id: cbId, text: "Bukan admin.", show_alert: true });
        return json(res, 200, { ok: true });
      }

      if (data.startsWith("done:")) {
        const orderId = data.slice("done:".length).trim();
        if (!orderId) {
          await tg("answerCallbackQuery", { callback_query_id: cbId, text: "Order ID kosong", show_alert: true });
          return json(res, 200, { ok: true });
        }

        // update to done
        await fetch(
          `${supabaseUrl}/rest/v1/orders?order_id=eq.${encodeURIComponent(orderId)}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({
              status: "done",
              done_at: new Date().toISOString(),
            }),
          }
        );

        await tg("answerCallbackQuery", { callback_query_id: cbId, text: "✅ Ditandai SELESAI", show_alert: false });

        // edit button jadi SELESAI
        await tg("editMessageReplyMarkup", {
          chat_id: cb.message.chat.id,
          message_id: cb.message.message_id,
          reply_markup: { inline_keyboard: [[{ text: "✅ SELESAI", callback_data: "noop" }]] },
        });

        return json(res, 200, { ok: true });
      }

      await tg("answerCallbackQuery", { callback_query_id: cbId, text: "Perintah tidak dikenal", show_alert: false });
      return json(res, 200, { ok: true });
    }

    // optional command /done ORDERID
    const msg = update.message;
    if (msg?.text) {
      const chatId = String(msg.chat?.id || "");
      if (chatId !== adminChatId) return json(res, 200, { ok: true });

      const text = msg.text.trim();
      if (text.startsWith("/done")) {
        const orderId = text.split(" ")[1];
        if (!orderId) {
          await tg("sendMessage", { chat_id: chatId, text: "Pakai: /done ORDER_ID" });
          return json(res, 200, { ok: true });
        }

        await fetch(
          `${supabaseUrl}/rest/v1/orders?order_id=eq.${encodeURIComponent(orderId)}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({
              status: "done",
              done_at: new Date().toISOString(),
            }),
          }
        );

        await tg("sendMessage", { chat_id: chatId, text: `✅ Order ${orderId} ditandai SELESAI.` });
      }
    }

    return json(res, 200, { ok: true });
  } catch (e) {
    return json(res, 500, { ok: false, error: String(e?.message || e) });
  }
}
