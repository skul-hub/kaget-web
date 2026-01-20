const DATA = {
  panel: [
    { id:"panel-1gb",  name:"PAKET PANEL 1GB",  price:1000,  ram:"1GB",  cpu:"1GB" },
    { id:"panel-2gb",  name:"PAKET PANEL 2GB",  price:2000,  ram:"2GB",  cpu:"2GB" },
    { id:"panel-3gb",  name:"PAKET PANEL 3GB",  price:3000,  ram:"3GB",  cpu:"3GB" },
    { id:"panel-4gb",  name:"PAKET PANEL 4GB",  price:4000,  ram:"4GB",  cpu:"4GB" },
    { id:"panel-5gb",  name:"PAKET PANEL 5GB",  price:5000,  ram:"5GB",  cpu:"5GB" },
    { id:"panel-6gb",  name:"PAKET PANEL 6GB",  price:6000,  ram:"6GB",  cpu:"6GB" },
    { id:"panel-7gb",  name:"PAKET PANEL 7GB",  price:7000,  ram:"7GB",  cpu:"7GB" },
    { id:"panel-8gb",  name:"PAKET PANEL 8GB",  price:8000,  ram:"8GB",  cpu:"8GB" },
    { id:"panel-9gb",  name:"PAKET PANEL 9GB",  price:9000,  ram:"9GB",  cpu:"9GB" },
    { id:"panel-10gb", name:"PAKET PANEL 10GB", price:10000, ram:"10GB", cpu:"10GB" },
    { id:"panel-unlimited", name:"PAKET PANEL UNLIMITED", price:12000, ram:"UNLIMITED", cpu:"UNLIMITED" },
  ],
  vps: [
    { id:"vps-mini", name:"VPS MINI", price:15000, ram:"8GB", cpu:"4 vCPU" },
    { id:"vps-standard", name:"VPS STANDARD", price:20000, ram:"16GB", cpu:"4 vCPU" },
    { id:"vps-pro", name:"VPS PRO", price:25000, ram:"16GB", cpu:"8 vCPU" },
  ],
  bot: [
    { id:"bot-sewa", name:"SEWA BOT WHATSAPP", price:20000, note:"Isi nomor telepon untuk aktivasi" }
  ]
};

const $ = (s) => document.querySelector(s);
const panelGrid = $("#panelGrid");
const vpsGrid = $("#vpsGrid");
const botGrid = $("#botGrid");

function rupiah(n){
  return "Rp" + (Number(n)||0).toLocaleString("id-ID");
}

function cardHtml(type, pkg){
  const buy = `<button class="btn primary" data-buy="1" data-type="${type}" data-id="${pkg.id}">Beli Sekarang</button>`;
  if(type === "panel"){
    return `
      <div class="card">
        <h3>${pkg.name}</h3>
        <ul class="ul">
          <li>RAM ${pkg.ram}</li>
          <li>CPU ${pkg.cpu}</li>
          <li>GARANSI 30 HARI</li>
          <li>SUPPORT 24/7</li>
          <li>SERVER PRIVATE</li>
        </ul>
        <div class="price">${rupiah(pkg.price)}/bulan</div>
        ${buy}
      </div>
    `;
  }
  if(type === "vps"){
    return `
      <div class="card">
        <h3>${pkg.name}</h3>
        <ul class="ul">
          <li>${pkg.ram} RAM</li>
          <li>${pkg.cpu}</li>
          <li>Root Access</li>
        </ul>
        <div class="price">${rupiah(pkg.price)}/bulan</div>
        ${buy}
      </div>
    `;
  }
  return `
    <div class="card">
      <h3>${pkg.name}</h3>
      <div class="muted">${pkg.note || ""}</div>
      <div class="price">${rupiah(pkg.price)}/bulan</div>
      ${buy}
    </div>
  `;
}

function render(){
  panelGrid.innerHTML = DATA.panel.map(p => cardHtml("panel", p)).join("");
  vpsGrid.innerHTML = DATA.vps.map(p => cardHtml("vps", p)).join("");
  botGrid.innerHTML = DATA.bot.map(p => cardHtml("bot", p)).join("");
}
render();

// Modal refs
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

function openModal(type, pkg){
  selected = { type, pkg };
  errorBox.textContent = "";
  form.reset();

  rowUsername.classList.add("hidden");
  rowEmail.classList.add("hidden");
  rowPhone.classList.add("hidden");

  if(type === "panel"){
    rowUsername.classList.remove("hidden");
    rowEmail.classList.remove("hidden");
    modalSubtitle.textContent = "Isi Username Panel + Email aktif, lalu QRIS otomatis (Pakasir).";
  } else if(type === "vps"){
    rowEmail.classList.remove("hidden");
    modalSubtitle.textContent = "Isi Email, lalu QRIS otomatis (Pakasir).";
  } else {
    rowPhone.classList.remove("hidden");
    modalSubtitle.textContent = "Isi Nomor Telepon, lalu QRIS otomatis (Pakasir).";
  }

  modalTitle.textContent = `Checkout ${type.toUpperCase()}`;
  sumPackage.textContent = pkg.name;
  sumPrice.textContent = `${rupiah(pkg.price)}/bulan`;

  overlay.classList.remove("hidden");
  modal.classList.remove("hidden");
}

function closeModal(){
  overlay.classList.add("hidden");
  modal.classList.add("hidden");
  selected = null;
}

closeModalBtn.addEventListener("click", closeModal);
cancelBtn.addEventListener("click", closeModal);
overlay.addEventListener("click", closeModal);

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-buy='1']");
  if(!btn) return;

  const type = btn.getAttribute("data-type");
  const id = btn.getAttribute("data-id");
  const pkg = (DATA[type] || []).find(x => x.id === id);
  if(!pkg) return;

  openModal(type, pkg);
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if(!selected) return;

  errorBox.textContent = "";

  const fd = new FormData(form);
  const customer = {};

  if(selected.type === "panel"){
    customer.username = (fd.get("username") || "").trim();
    customer.email = (fd.get("email") || "").trim();
  } else if(selected.type === "vps"){
    customer.email = (fd.get("email") || "").trim();
  } else {
    customer.phone = (fd.get("phone") || "").trim();
  }

  try{
    const resp = await fetch("/api/create-payment", {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({
        productType: selected.type,
        packageId: selected.pkg.id,
        customer
      })
    });

    const data = await resp.json().catch(() => ({}));
    if(!resp.ok || !data.ok){
      errorBox.textContent = data.error || "Gagal membuat pembayaran.";
      return;
    }

    window.location.href = data.payment_url;
  } catch(err){
    errorBox.textContent = "Error jaringan / server. Coba lagi.";
  }
});
