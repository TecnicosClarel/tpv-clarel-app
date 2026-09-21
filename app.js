"use strict";

const JOTFORM_URL = "https://www.jotform.com/261071471505046";
const DB_NAME = "tpvClarelDB";
const DB_VERSION = 1;
const STORE = "registros";

/* ---------------- IndexedDB helper ---------------- */

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbGetAll() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result.sort((a, b) => b.createdAt - a.createdAt));
    req.onerror = () => reject(req.error);
  });
}

async function dbPut(record) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).put(record);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbDelete(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/* ---------------- DOM refs ---------------- */

const viewList = document.getElementById("view-list");
const viewForm = document.getElementById("view-form");
const recordList = document.getElementById("record-list");
const emptyMsg = document.getElementById("empty-msg");
const form = document.getElementById("record-form");
const detailBar = document.getElementById("detail-bar");
const detailTitle = document.getElementById("detail-title");
const detailSub = document.getElementById("detail-sub");

let records = [];
let selectedId = null;

const FIELD_IDS = [
  "numeroTienda", "direccion", "poblacion", "fecha",
  "estadoInstalacion", "motivoInterrupcion", "comoRealiza",
  "caja1-tpv", "caja1-pantalla", "caja1-visor", "caja1-impresora",
  "caja2-tpv", "caja2-pantalla", "caja2-visor", "caja2-impresora",
  "caja3-tpv", "caja3-pantalla", "caja3-visor", "caja3-impresora",
  "horaInicio", "horaFin", "nombreTecnico", "nombreEmpleado",
];

/* ---------------- Navigation ---------------- */

function showList() {
  viewForm.hidden = true;
  viewList.hidden = false;
  renderList();
}

function showForm(record) {
  viewList.hidden = true;
  viewForm.hidden = false;
  detailBar.hidden = true;
  document.getElementById("btn-delete").hidden = !record;
  fillForm(record || {});
}

/* ---------------- Rendering ---------------- */

function renderList() {
  recordList.innerHTML = "";
  emptyMsg.hidden = records.length > 0;
  detailBar.hidden = true;
  selectedId = null;

  for (const r of records) {
    const li = document.createElement("li");
    li.className = "record-item";
    li.dataset.id = r.id;
    const titulo = `Tienda ${r.numeroTienda || "-"} — ${r.poblacion || ""}`;
    const sub = `${r.fecha || ""} · ${r.nombreTecnico || ""}`;
    li.innerHTML = `<div class="r-title"></div><div class="r-sub"></div>`;
    li.querySelector(".r-title").textContent = titulo;
    li.querySelector(".r-sub").textContent = sub;
    li.addEventListener("click", () => selectRecord(r.id));
    recordList.appendChild(li);
  }
}

function selectRecord(id) {
  selectedId = id;
  const r = records.find((x) => x.id === id);
  document.querySelectorAll(".record-item").forEach((el) => {
    el.classList.toggle("selected", Number(el.dataset.id) === id);
  });
  detailTitle.textContent = `Tienda ${r.numeroTienda || "-"} — ${r.poblacion || ""}`;
  detailSub.textContent = `${r.fecha || ""} · ${r.nombreTecnico || ""}`;
  detailBar.hidden = false;
}

/* ---------------- Form <-> record ---------------- */

function fillForm(r) {
  document.getElementById("f-id").value = r.id ?? "";
  for (const key of FIELD_IDS) {
    const el = document.getElementById("f-" + key);
    if (!el) continue;
    if (key.startsWith("caja")) {
      const [caja, campo] = key.split("-");
      el.value = (r[caja] && r[caja][campo]) || "";
    } else {
      el.value = r[key] || "";
    }
  }
}

function readForm() {
  const r = { };
  const idVal = document.getElementById("f-id").value;
  if (idVal) r.id = Number(idVal);

  r.caja1 = {}; r.caja2 = {}; r.caja3 = {};
  for (const key of FIELD_IDS) {
    const el = document.getElementById("f-" + key);
    if (!el) continue;
    if (key.startsWith("caja")) {
      const [caja, campo] = key.split("-");
      r[caja][campo] = el.value.trim();
    } else {
      r[key] = el.value.trim();
    }
  }
  r.createdAt = Date.now();
  return r;
}

/* ---------------- JotForm prefill URL ---------------- */

// JotForm solo reconoce el "nombre único" del campo (sin el prefijo qN_) y
// espera los espacios como %20, no como "+" -- por eso no usamos URLSearchParams
// (que codifica espacios como "+") sino encodeURIComponent a mano.
function buildJotformUrl(r) {
  const pairs = [];
  const add = (key, value) => {
    if (value === undefined || value === null || value === "") return;
    pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
  };

  add("numeroDe", r.numeroTienda);
  add("direccion", r.direccion);
  add("poblacion", r.poblacion);

  if (r.fecha) {
    const [y, m, d] = r.fecha.split("-");
    add("fecha[day]", d);
    add("fecha[month]", m);
    add("fecha[year]", y);
  }

  add("estadoDe", r.estadoInstalacion);
  add("motivoDe", r.motivoInterrupcion);
  add("comoSe", r.comoRealiza);

  const cajas = [
    { obj: r.caja1, tpv: "numeroDe14", pantalla: "numeroDe15", visor: "comoEsta", impresora: "comoEsta21" },
    { obj: r.caja2, tpv: "numeroDe23", pantalla: "numeroDe24", visor: "comoEsta25", impresora: "comoEsta26" },
    { obj: r.caja3, tpv: "numeroDe29", pantalla: "numeroDe30", visor: "comoEsta31", impresora: "comoEsta32" },
  ];
  for (const c of cajas) {
    if (!c.obj) continue;
    add(c.tpv, c.obj.tpv);
    add(c.pantalla, c.obj.pantalla);
    add(c.visor, c.obj.visor);
    add(c.impresora, c.obj.impresora);
  }

  if (r.horaInicio) {
    const [hh, mm] = r.horaInicio.split(":");
    add("hora[timeInput]", `${hh}:${mm}`);
    add("hora[hourSelect]", hh);
    add("hora[minuteSelect]", mm);
  }
  if (r.horaFin) {
    const [hh, mm] = r.horaFin.split(":");
    add("horaDe[timeInput]", `${hh}:${mm}`);
    add("horaDe[hourSelect]", hh);
    add("horaDe[minuteSelect]", mm);
  }

  add("escribaUna37", r.nombreTecnico);
  add("nombreDel", r.nombreEmpleado);

  return JOTFORM_URL + "?" + pairs.join("&");
}

/* ---------------- Events ---------------- */

document.getElementById("btn-new").addEventListener("click", () => showForm(null));

document.getElementById("btn-back").addEventListener("click", () => {
  showList();
});

document.getElementById("btn-edit").addEventListener("click", () => {
  const r = records.find((x) => x.id === selectedId);
  if (r) showForm(r);
});

document.getElementById("btn-delete").addEventListener("click", async () => {
  const id = Number(document.getElementById("f-id").value);
  if (!id) return;
  if (!confirm("¿Eliminar este registro?")) return;
  await dbDelete(id);
  records = await dbGetAll();
  showList();
});

document.getElementById("btn-open-jotform").addEventListener("click", () => {
  const r = records.find((x) => x.id === selectedId);
  if (!r) return;
  const url = buildJotformUrl(r);
  window.open(url, "_blank", "noopener");
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const r = readForm();
  await dbPut(r);
  records = await dbGetAll();
  showList();
});

/* ---------------- Escaner de codigo de barras ---------------- */

const scannerOverlay = document.getElementById("scanner-overlay");
const scannerVideo = document.getElementById("scanner-video");
const scannerStatus = document.getElementById("scanner-status");

let barcodeReader = null;
let scannerTargetInput = null;

async function openScanner(targetId) {
  scannerTargetInput = document.getElementById(targetId);
  if (!scannerTargetInput) return;

  if (!window.ZXing) {
    alert("No se pudo cargar el lector de códigos de barras. Comprueba tu conexión a internet e inténtalo de nuevo.");
    return;
  }

  scannerStatus.textContent = "Apunta al código de barras...";
  scannerOverlay.hidden = false;
  barcodeReader = new ZXing.BrowserMultiFormatReader();

  try {
    await barcodeReader.decodeFromConstraints(
      { video: { facingMode: { ideal: "environment" } } },
      scannerVideo,
      (result) => {
        if (result) {
          scannerTargetInput.value = result.getText();
          closeScanner();
        }
      }
    );
  } catch (err) {
    scannerStatus.textContent = "No se pudo acceder a la cámara. Revisa los permisos del navegador.";
  }
}

function closeScanner() {
  if (barcodeReader) {
    barcodeReader.reset();
    barcodeReader = null;
  }
  scannerOverlay.hidden = true;
  scannerTargetInput = null;
}

document.querySelectorAll(".btn-scan").forEach((btn) => {
  btn.addEventListener("click", () => openScanner(btn.dataset.target));
});

document.getElementById("btn-scanner-cancel").addEventListener("click", closeScanner);

/* ---------------- Init ---------------- */

(async function init() {
  records = await dbGetAll();
  showList();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  }
})();
