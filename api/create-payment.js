import crypto from "crypto";

const PACKAGES = {
  panel: [
    { id: "panel-1gb", name: "PAKET PANEL 1GB", amount: 1000, ram: "1GB", cpu: "1GB" },
    { id: "panel-2gb", name: "PAKET PANEL 2GB", amount: 2000, ram: "2GB", cpu: "2GB" },
    { id: "panel-3gb", name: "PAKET PANEL 3GB", amount: 3000, ram: "3GB", cpu: "3GB" },
    { id: "panel-4gb", name: "PAKET PANEL 4GB", amount: 4000, ram: "4GB", cpu: "4GB" },
    { id: "panel-5gb", name: "PAKET PANEL 5GB", amount: 5000, ram: "5GB", cpu: "5GB" },
    { id: "panel-6gb", name: "PAKET PANEL 6GB", amount: 6000, ram: "6GB", cpu: "6GB" },
    { id: "panel-7gb", name: "PAKET PANEL 7GB", amount: 7000, ram: "7GB", cpu: "7GB" },
    { id: "panel-8gb", name: "PAKET PANEL 8GB", amount: 8000, ram: "8GB", cpu: "8GB" },
    { id: "panel-9gb", name: "PAKET PANEL 9GB", amount: 9000, ram: "9GB", cpu: "9GB" },
    { id: "panel-10gb", name: "PAKET PANEL 10GB", amount: 10000, ram: "10GB", cpu: "10GB" },
    { id: "panel-unlimited", name: "PAKET PANEL UNLIMITED", amount: 12000, ram: "UNLIMITED", cpu: "UNLIMITED" },
  ],
  vps: [
    { id: "vps-mini", name: "VPS MINI", amount: 15000, ram: "8GB", cpu: "4 vCPU" },
    { id: "vps-standard", name: "VPS STANDARD", amount: 20000, ram: "16GB", cpu: "4 vCPU" },
    { id: "vps-pro", name: "VPS PRO", amount: 25000, ram: "16GB", cpu: "8 vCPU" },
  ],
  bot: [
    { id: "bot-sewa", name: "SEWA BOT WHATSAPP", amount: 20000 },
  ],
};

function json(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

function makeOrderId(prefix) {
  const rand = crypto.randomBytes(5).toString("hex").toUpperCase();
  const t = Date.now().toString().slice(-6);
  return `${prefix}-${t}${rand}`;
}

function isEmail(s) {
  return typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed" });

  try {
    const { productType, packageId, customer } = req.body || {};

    if (!["panel", "vps", "bot"].includes(productType)) {
      return json(res, 400, { ok: false, error: "productType invalid" });
    }

    const pkg = (PACKAGES[productType] || []).find(p => p.id === packageId);
    if (!pkg) return json(res, 400, { ok: false, error: "packageId invalid" });

    // Validate input per product
    if (productType === "panel") {
      if (!customer?.username || String(customer.username).trim().length < 3) {
        return json(res, 400, { ok: false, error: "Username panel wajib diisi (min 3 karakter)" });
      }
      if (!isEmail(customer?.email)) {
        return json(res, 400, { ok: false, error: "Email aktif wajib diisi" });
      }
    }

    if (productType === "vps") {
      if (!isEmail(customer?.email)) {
        return json(res, 400, { ok: false, error: "Email wajib diisi" });
      }
    }

    if (productType === "bot") {
      if (!customer?.phone || String(customer.phone).trim().length < 8) {
        return json(res, 400, { ok: false, error: "Nomor telepon wajib diisi" });
      }
    }

    const orderId = makeOrderId(productType.toUpperCase());

    // Save order to Supabase (pending)
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return json(res, 500, { ok: false, error: "Supabase env missing" });
    }

    const insertResp = await fetch(`${supabaseUrl}/rest/v1/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify([{
        order_id: orderId,
        product_type: productType,
        package_name: pkg.name,
        amount: pkg.amount,
        status: "pending",
        customer: customer || {},
      }]),
    });

    if (!insertResp.ok) {
      const errText = await insertResp.text();
      return json(res, 500, { ok: false, error: "Supabase insert failed", detail: errText });
    }

    // Build Pakasir payment URL (QRIS)
    const slug = process.env.PAKASIR_PROJECT_SLUG;
    if (!slug) return json(res, 500, { ok: false, error: "PAKASIR_PROJECT_SLUG missing" });

    const siteUrl = process.env.SITE_URL || "";
    const redirectUrl = siteUrl ? `${siteUrl}/?paid=1&order_id=${encodeURIComponent(orderId)}` : "";

    const paymentUrl =
      `https://app.pakasir.com/pay/${encodeURIComponent(slug)}/${pkg.amount}` +
      `?order_id=${encodeURIComponent(orderId)}` +
      `&qris_only=1` +
      (redirectUrl ? `&redirect=${encodeURIComponent(redirectUrl)}` : "");

    return json(res, 200, { ok: true, order_id: orderId, payment_url: paymentUrl });
  } catch (e) {
    return json(res, 500, { ok: false, error: "Server error", detail: String(e?.message || e) });
  }
}
