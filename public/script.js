const DATA = {
  panel: Array.from({ length: 10 }, (_, i) => {
    const gb = i + 1;
    return { id: `panel-${gb}gb`, name: `PANEL ${gb}GB`, price: gb * 1000, ram: `${gb}GB`, cpu: `${gb}GB`, tag: "Panel" };
  }).concat([{ id: "panel-unlimited", name: "PANEL UNLIMITED", price: 12000, ram: "UNLIMITED", cpu: "UNLIMITED", tag: "Best" }]),
  vps: [
    { id: "vps-mini", name: "VPS MINI", price: 15000, ram: "8GB", cpu: "4 vCPU", tag: "VPS" },
    { id: "vps-standard", name: "VPS STANDARD", price: 20000, ram: "16GB", cpu: "4 vCPU", tag: "VPS" },
    { id: "vps-pro", name: "VPS PRO", price: 25000, ram: "16GB", cpu: "8 vCPU", tag: "VPS PRO" },
  ],
  bot: [{ id: "bot-sewa", name: "SEWA BOT WA", price: 20000, note: "Aktif 24 Jam", tag: "Bot" }]
};

const $ = (s) => document.querySelector(s);
const rupiah = (n) => "Rp" + (Number(n) || 0).toLocaleString("id-ID");

function cardHtml(type, pkg) {
  const content = type === "bot" ? `<div class="muted small">${pkg.note}</div>` : `
    <ul class="ul">
      <li>RAM ${pkg.ram}</li>
      <li>CPU ${pkg.cpu}</li>
      <li>Garansi 30 Hari</li>
    </ul>`;
  return `
    <div class="card">
      <div class="tag">${pkg.tag}</div>
      <h3>${pkg.name}</h3>
      ${content}
      <div class="price">${rupiah(pkg.price)}</div>
      <button class="btn primary btn-buy" data-type="${type}" data-id="${pkg.id}">Beli Sekarang</button>
    </div>`;
}

function render() {
  if ($("#panelGrid")) $("#panelGrid").innerHTML = DATA.panel.map(p => cardHtml("panel", p)).join("");
  if ($("#vpsGrid")) $("#vpsGrid").innerHTML = DATA.vps.map(p => cardHtml("vps", p)).join("");
  if ($("#botGrid")) $("#botGrid").innerHTML = DATA.bot.map(p => cardHtml("bot", p)).join("");
}
render();

// Modal Logic
const overlay = $("#checkoutOverlay"), modal = $("#checkoutModal"), form = $("#checkoutForm");
let selected = null;

function openModal(type, pkg) {
  selected = { type, pkg };
  form.reset();
  $("#errorBox").textContent = "";
  $("#rowUsername").classList.toggle("hidden", type !== "panel");
  $("#rowEmail").classList.toggle("hidden", type === "bot");
  $("#rowPhone").classList.toggle("hidden", type !== "bot");
  $("#modalTitle").textContent = `Checkout ${type.toUpperCase()}`;
  $("#sumPackage").textContent = pkg.name;
  $("#sumPrice").textContent = rupiah(pkg.price);
  overlay.classList.remove("hidden");
  modal.classList.remove("hidden");
}

function closeModal() { overlay.classList.add("hidden"); modal.classList.add("hidden"); }

$("#closeModal").onclick = closeModal;
$("#cancelBtn").onclick = closeModal;
overlay.onclick = closeModal;

document.addEventListener("click", (e) => {
  if (e.target.classList.contains("btn-buy")) {
    const type = e.target.dataset.type;
    const pkg = DATA[type].find(p => p.id === e.target.dataset.id);
    if (pkg) openModal(type, pkg);
  }
});

// Submit Form
form.onsubmit = async (e) => {
  e.preventDefault();
  const fd = new FormData(form), customer = {};
  if (selected.type === "panel") { customer.username = fd.get("username"); customer.email = fd.get("email"); }
  else if (selected.type === "vps") { customer.email = fd.get("email"); }
  else { customer.phone = fd.get("phone"); }

  try {
    const resp = await fetch("/api/create-payment", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productType: selected.type, packageId: selected.pkg.id, customer })
    });
    const data = await resp.json();
    if (data.ok) window.location.href = data.payment_url;
    else $("#errorBox").textContent = data.error || "Gagal membuat pembayaran.";
  } catch { $("#errorBox").textContent = "Terjadi kesalahan server."; }
};

// History Logic
$("#btnHistoryEmail").onclick = async () => {
  const email = $("#hisEmailOnly").value.trim();
  if (!email) return;
  $("#historyEmailWrap").innerHTML = "Memuat...";
  try {
    const resp = await fetch(`/api/get-orders-by-email?email=${email}`);
    const data = await resp.json();
    if (!data.ok || !data.data.length) { $("#historyEmailWrap").innerHTML = "Tidak ada history."; return; }
    $("#historyEmailWrap").innerHTML = `<div class="tableScroll"><table class="table">
      <thead><tr><th>ID</th><th>Produk</th><th>Status</th><th>Tanggal</th></tr></thead>
      <tbody>${data.data.map(r => `<tr><td>${r.order_id}</td><td>${r.package_name}</td><td><span class="badge ${r.status}">${r.status}</span></td><td>${new Date(r.created_at).toLocaleDateString()}</td></tr>`).join("")}</tbody>
    </table></div>`;
  } catch { $("#historyEmailWrap").innerHTML = "Gagal memuat history."; }
};

// Navbar & Footer
$("#navToggle").onclick = () => $("#nav").classList.toggle("open");
$("#year").textContent = new Date().getFullYear();
