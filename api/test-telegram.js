// api/test-telegram.js
function json(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

export default async function handler(req, res) {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) return json(res, 500, { ok:false, error:"Telegram env missing" });

    const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: "✅ TEST NOTIF SKULLHOSTING: Telegram nyambung!",
      }),
    });

    const data = await resp.json().catch(() => ({}));
    return json(res, 200, { ok: resp.ok, telegram: data });
  } catch (e) {
    return json(res, 500, { ok:false, error:String(e?.message||e) });
  }
}
