// public/script.js

const DATA = {
  panel: Array.from({ length: 10 }, (_, i) => {
    const gb = i + 1;
    return {
      id: `panel-${gb}gb`,
      name: `PAKET PANEL ${gb}GB`,
      price: gb * 1000,
      ram: `${gb}GB`,
      cpu: `${gb}GB`,
      tag: "Panel"
    };
  }).concat([
    { id: "panel-unlimited", name: "PAKET PANEL UNLIMITED", price: 12000, ram: "UNLIMITED", cpu: "UNLIMITED", tag: "Best" }
  ]),
  vps: [
    { id: "vps-mini", name: "VPS MINI", price: 15000, ram: "8GB", cpu: "4 vCPU", tag: "VPS" },
    { id: "vps-standard", name: "VPS STANDARD", price: 20000, ram: "16GB", cpu: "4 vCPU", tag: "VPS" },
    { id: "vps-pro", name: "VPS PRO", price: 25000, ram: "16GB", cpu: "8 vCPU", tag: "VPS PRO" },
  ],
  bot: [
    { id: "bot-sewa", name: "SEWA BOT WHATSAPP", price: 20000, note: "Isi nomor telepon untuk aktivasi", tag: "Bot" }
  ]
};

const $ = (s) => document.querySelector(s);

function rupiah(n) {
  return "Rp" + (Number(n) || 0).toLocaleString("id-ID");
}

function cardHtml(type, pkg) {
  const list = type === "panel"
    ? `<ul class="ul">
        <li>RAM ${pkg.ram}</li>
        <li>CPU ${pkg.cpu}</li>
        <li>GARANSI 30 HARI</li>
        <li>SUPPORT 24/7</li>
        <li>SERVER PRIVATE</li>
      </ul>`
    : type === "vps"
      ? `<ul class="ul">
          <li>${pkg.ram} RAM</li>
          <li>${pkg.cpu}</li>
          <li>Root Access</li>
        </ul>`
      : `<div class="muted small" style="margin-top:10px">${pkg.note || ""}</div>`;

  return `
    <div class="card">
      <div class="cardInner">
        <div class="cardTop">
          <h3>${pkg.name}</h3>
          <div class="tag">${pkg.tag || "OK"}</div>
        </div>

        ${list}

        <div class="price">${rupiah(pkg.price)}/bulan</div>
        <div class="cardActions">
          <button class="btn primary full" data-buy="1" data-type="${type}" data-id="${pkg.id}">
            Beli Sekarang
          </button>
        </div>
      </div>
    </div>
  `;
}

function render() {
  const panelGrid = $("#panelGrid");
  const vpsGrid = $("#vpsGrid");
  const botGrid = $("#botGrid");

  if (panelGrid) panelGrid.innerHTML = DATA.panel.map(p => cardHtml("panel", p)).join("");
  if (vpsGrid) vpsGrid.innerHTML = DATA.vps.map(p => cardHtml("vps", p)).join("");
  if (botGrid) botGrid.innerHTML = DATA.bot.map(p => cardHtml("bot", p)).join("");
}
render();

// ===== Navbar active + mobile =====
const nav = $("#nav");
const navToggle = $("#navToggle");
navToggle?.addEventListener("click", () => nav.classList.toggle("open"));

const sections = ["home", "panel", "vps", "bot", "history", "contact"]
  .map(id => document.getElementById(id))
  .filter(Boolean);

function setActiveNav() {
  const y = window.scrollY + 140;
  let current = "home";
  for (const s of sections) {
    if (s.offsetTop <= y) current = s.id;
  }
  document.querySelectorAll(".nav a").forEach(a => {
    const href = a.getAttribute("href") || "";
    a.classList.toggle("active", href === `#${current}`);
  });
}
window.addEventListener("scroll", setActiveNav);
setActiveNav();

const yearEl = $("#year");
if (yearEl) yearEl.textContent = String(new Date().getFullYear());

// ===== Modal Checkout =====
const overlay = $("#checkoutOverlay");
const modal = $("#checkoutModal");
const form = $("#checkoutForm");
const closeModalBtn = $("#closeModal");
const cancelBtn = $("#cancelBtn");
const errorBox = $("#errorBox");

const rowUsername = $("#rowUsername");
const rowEmail = $("#rowEmail");
const rowPhone = $("#rowPhone");

const modalTitle = $("#modalTitle");
const modalSubtitle = $("#modalSubtitle");
const sumPackage = $("#sumPackage");
const sumPrice = $("#sumPrice");

let selected = null;

function openModal(type, pkg) {
  selected = { type, pkg };
  if (errorBox) errorBox.textContent = "";
  form?.reset();

  rowUsername?.classList.add("hidden");
  rowEmail?.classList.add("hidden");
  rowPhone?.classList.add("hidden");

  if (type === "panel") {
    rowUsername?.classList.remove("hidden");
    rowEmail?.classList.remove("hidden");
    if (modalSubtitle) modalSubtitle.textContent = "Isi Username Panel + Email aktif, lalu bayar QRIS otomatis.";
  } else if (type === "vps") {
    rowEmail?.classList.remove("hidden");
    if (modalSubtitle) modalSubtitle.textContent = "Isi Email, lalu bayar QRIS otomatis.";
  } else {
    rowPhone?.classList.remove("hidden");
    if (modalSubtitle) modalSubtitle.textContent = "Isi Nomor Telepon, lalu bayar QRIS otomatis.";
  }

  if (modalTitle) modalTitle.textContent = `Checkout ${type.toUpperCase()}`;
  if (sumPackage) sumPackage.textContent = pkg.name;
  if (sumPrice) sumPrice.textContent = `${rupiah(pkg.price)}/bulan`;

  overlay?.classList.remove("hidden");
  modal?.classList.remove("hidden");
}

function closeModal() {
  overlay?.classList.add("hidden");
  modal?.classList.add("hidden");
  selected = null;
}

closeModalBtn?.addEventListener("click", closeModal);
cancelBtn?.addEventListener("click", closeModal);
overlay?.addEventListener("click", closeModal);

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-buy='1']");
  if (!btn) return;

  const type = btn.getAttribute("data-type");
  const id = btn.getAttribute("data-id");
  const pkg = (DATA[type] || []).find(x => x.id === id);
  if (!pkg) return;

  openModal(type, pkg);
});

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!selected) return;

  if (errorBox) errorBox.textContent = "";
  const fd = new FormData(form);
  const customer = {};

  if (selected.type === "panel") {
    customer.username = (fd.get("username") || "").trim();
    customer.email = (fd.get("email") || "").trim();
  } else if (selected.type === "vps") {
    customer.email = (fd.get("email") || "").trim();
  } else {
    customer.phone = (fd.get("phone") || "").trim();
  }

  try {
    const resp = await fetch("/api/create-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productType: selected.type,
        packageId: selected.pkg.id,
        customer
      })
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.ok) {
      if (errorBox) errorBox.textContent = data.error || "Gagal membuat pembayaran.";
      return;
    }

    window.location.href = data.payment_url;
  } catch (err) {
    if (errorBox) errorBox.textContent = "Error jaringan / server. Coba lagi.";
  }
});

// ===== History Helpers =====
function statusBadge(s) {
  const st = String(s || "pending").toLowerCase();
  return `<span class="badge ${st}">${st}</span>`;
}

// ===== USER HISTORY by EMAIL (TABLE SCROLL) =====
const hisEmailOnly = $("#hisEmailOnly");
const btnHistoryEmail = $("#btnHistoryEmail");
const historyEmailInfo = $("#historyEmailInfo");
const historyEmailWrap = $("#historyEmailWrap");

btnHistoryEmail?.addEventListener("click", async () => {
  historyEmailInfo.textContent = "";
  historyEmailWrap.innerHTML = "";

  const email = (hisEmailOnly.value || "").trim().toLowerCase();
  if (!email) {
    historyEmailInfo.textContent = "Masukkan email dulu.";
    return;
  }

  try {
    const resp = await fetch(`/api/get-orders-by-email?email=${encodeURIComponent(email)}`);
    const data = await resp.json().catch(() => ({}));

    if (!resp.ok || !data.ok) {
      historyEmailInfo.textContent = data.error || "Gagal ambil history.";
      return;
    }

    const rows = data.data || [];
    if (!rows.length) {
      historyEmailInfo.textContent = "Belum ada history untuk email ini.";
      return;
    }

    historyEmailInfo.textContent = `Ditemukan ${rows.length} order untuk ${email}.`;

    historyEmailWrap.innerHTML = `
      <div class="tableScroll">
        <table class="table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Produk</th>
              <th>Paket</th>
              <th>Harga</th>
              <th>Status</th>
              <th>Tanggal</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td>${r.order_id}</td>
                <td>${r.product_type}</td>
                <td>${r.package_name}</td>
                <td>Rp${(r.amount || 0).toLocaleString("id-ID")}</td>
                <td>${statusBadge(r.status)}</td>
                <td>${r.created_at ? new Date(r.created_at).toLocaleString("id-ID") : "-"}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  } catch (e) {
    historyEmailInfo.textContent = "Error jaringan/server.";
  }
});

// ===== ADMIN HISTORY (ALL) only if ?key= exists (TABLE SCROLL) =====
const adminShell = $("#adminShell");
const historyInfo = $("#historyInfo");
const historyTableWrap = $("#historyTableWrap");
const refreshHistory = $("#refreshHistory");

async function loadAdminHistory() {
  if (!adminShell) return;

  const key = new URLSearchParams(location.search).get("key") || "";
  if (!key) {
    adminShell.style.display = "none";
    return;
  }

  adminShell.style.display = "block";
  if (historyInfo) historyInfo.textContent = "Memuat history admin...";
  if (historyTableWrap) historyTableWrap.innerHTML = "";

  try {
    const resp = await fetch(`/api/get-orders-all?key=${encodeURIComponent(key)}`);
    const data = await resp.json().catch(() => ({}));

    if (!resp.ok || !data.ok) {
      if (historyInfo) historyInfo.textContent = data.error || "Gagal load history admin.";
      return;
    }

    const rows = data.data || [];
    if (historyInfo) historyInfo.textContent = `Menampilkan ${rows.length} order terbaru (admin).`;

    if (!rows.length) {
      if (historyTableWrap) historyTableWrap.innerHTML = "";
      return;
    }

    historyTableWrap.innerHTML = `
      <div class="tableScroll">
        <table class="table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Produk</th>
              <th>Paket</th>
              <th>Harga</th>
              <th>Status</th>
              <th>Dibuat</th>
              <th>Dibayar</th>
              <th>Selesai</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td>${r.order_id}</td>
                <td>${r.product_type}</td>
                <td>${r.package_name}</td>
                <td>Rp${(r.amount || 0).toLocaleString("id-ID")}</td>
                <td>${statusBadge(r.status)}</td>
                <td>${r.created_at ? new Date(r.created_at).toLocaleString("id-ID") : "-"}</td>
                <td>${r.paid_at ? new Date(r.paid_at).toLocaleString("id-ID") : "-"}</td>
                <td>${r.done_at ? new Date(r.done_at).toLocaleString("id-ID") : "-"}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  } catch (e) {
    if (historyInfo) historyInfo.textContent = "Error jaringan/server.";
  }
}

refreshHistory?.addEventListener("click", loadAdminHistory);
loadAdminHistory();
