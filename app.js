/* =====================================================================
   1. SETTINGS + STATE
   ===================================================================== */
const CATS = ["Tops", "Bottoms", "Dresses", "Layers", "Shoes", "Accessories"];

// Stacking order (bigger number = drawn on top). This is what makes layering work.
const Z = { Bottoms: 1, Dresses: 2, Shoes: 2, Tops: 3, Layers: 4, Accessories: 5 };

// Where each category lands on the stage the first time. All numbers are PERCENTAGES of the
// stage: x = distance from left, y = distance from top, w = width. (Height follows the image.)
const START = {
  Tops: { x: 27, y: 20, w: 46 },      Bottoms: { x: 30, y: 46, w: 40 },
  Dresses: { x: 27, y: 20, w: 46 },   Layers: { x: 21, y: 18, w: 58 },
  Shoes: { x: 30, y: 86, w: 40 },     Accessories: { x: 66, y: 45, w: 20 },
};
const TOL = 45;   // background-removal strength: higher removes more colors similar to the background

// Sample clothes drawn as SVG shapes (transparent backgrounds, like real cut-out PNGs).
const art = (vb, d, fill) => "data:image/svg+xml;utf8=" + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}"><path d="${d}" fill="${fill}"/></svg>`);
const SHAPE = {
  tee:   ["0 0 100 90", "M30 5L10 20L18 35L28 30V85H72V30L82 35L90 20L70 5Q50 18 30 5Z"],
  jeans: ["0 0 60 100", "M5 0H55L58 100H35L30 30L25 100H2Z"],
  skirt: ["0 0 70 80", "M15 0H55L68 80H2Z"],
  dress: ["0 0 80 140", "M22 0Q40 14 58 0L66 22L56 28L66 140H14L24 28L14 22Z"],
  shoes: ["0 0 100 30", "M2 8H28L34 20L40 26H2ZM60 26L66 20L72 8H98V26Z"],
  bag:   ["0 0 40 50", "M5 18H35V48H5ZM13 18V14Q13 6 20 6Q27 6 27 14V18H24V14Q24 9 20 9Q16 9 16 14V18Z"],
};
const sample = (id, name, cat, tag, shape, color) =>
  ({ id, name, cat, tag, img: art(...SHAPE[shape], color), place: { ...START[cat] } });

let items = [
  sample(1, "Everyday tee",       "Tops",        "Everyday  Cream",    "tee",   "#f2c230"),
  sample(2, "Favorite blouse",    "Tops",        "Going out  Lavender","tee",   "#b9a6e0"),
  sample(3, "Straight-leg jeans", "Bottoms",     "Everyday  Denim",    "jeans", "#7f93b8"),
  sample(4, "Midi skirt",         "Bottoms",     "Going out  Black",   "skirt", "#2b2b30"),
  sample(5, "Sunday dress",       "Dresses",     "Weekend  Lilac",     "dress", "#c9b3ec"),
  sample(6, "Cozy cardigan",      "Layers",      "Everyday  Cream",    "tee",   "#e8d9bd"),
  sample(7, "Everyday sneakers",  "Shoes",       "Everyday  White",    "shoes", "#f4f4f4"),
  sample(8, "Little shoulder bag","Accessories", "Going out  Brown",   "bag",   "#8a5a3c"),
];
let worn = { Tops: 1, Bottoms: 3, Shoes: 7 };    // category -> item id (one item per category)
let tab = { closet: "All", studio: "All" };
let query = "", nextId = 9;
let myPhoto = null;                  // your full-body photo, as a data URL
let selectedId = null;               // item currently being adjusted in the studio
let drag = null;                     // info about an in-progress drag
let pendingCanvas = null, pendingImg = null, pendingName = "";   // add-item pop-up

const $  = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const byId = (id) => items.find((i) => i.id === id);
const wornItems = () => Object.values(worn).map(byId).filter(Boolean);
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/* =====================================================================
   2. RENDERING (state in -> HTML out)
   ===================================================================== */
const thumb = (i) => `<img class="swatch" src="${i.img}" alt="${i.name}">`;

function tabsHTML(view) {
  return ["All", ...CATS].map((c) => {
    const n = c === "All" ? items.length : items.filter((i) => i.cat === c).length;
    return `<button class="tab ${tab[view] === c ? "active" : ""}" data-action="tab" data-view="${view}" data-cat="${c}">${c === "All" ? "All items" : c} ${n}</button>`;
  }).join("");
}

function visible(view) {
  return items.filter((i) => (tab[view] === "All" || i.cat === tab[view]) &&
    (view !== "closet" || i.name.toLowerCase().includes(query)));
}

function cardHTML(i, view) {
  const on = worn[i.cat] === i.id;
  const button = view === "closet"
    ? `<button class="link" data-action="delete" data-id="${i.id}" aria-label="Remove ${i.name}">Remove</button>`
    : `<button class="btn ${on ? "" : "ghost"}" data-action="wear" data-id="${i.id}">${on ? "✓ Wearing" : "+ Wear"}</button>`;
  return `<article class="card ${view === "studio" && on ? "on" : ""}">${thumb(i)}
    <span class="small">${i.cat}</span><strong>${i.name}</strong><span class="small">${i.tag}</span>${button}</article>`;
}

// The stage = your photo + one <img class="layer"> per worn item, positioned by its saved percentages.
function stageHTML() {
  const base = myPhoto ? `<img class="photo" src="${myPhoto}" alt="Photo of Michelle">`
                       : `<div class="empty">Click “Change photo” to add a full-body photo of yourself</div>`;
  const layers = wornItems().map((i) => `<img class="layer" data-id="${i.id}" src="${i.img}" alt="${i.name}" draggable="false"
    style="left:${i.place.x}%;top:${i.place.y}%;width:${i.place.w}%;z-index:${Z[i.cat]}">`).join("");
  return base + layers;
}

function updateFit() {
  const it = byId(selectedId);
  $$(".layer").forEach((l) => l.classList.toggle("selected", Number(l.dataset.id) === selectedId));
  $("#fit-name").textContent = it ? it.name : "Nothing selected";
  $("#size").disabled = $("#reset-fit").disabled = !it;
  if (it) $("#size").value = it.place.w;
}

function render() {
  if (!wornItems().some((i) => i.id === selectedId)) selectedId = null;
  $("#grid-closet").innerHTML = visible("closet").map((i) => cardHTML(i, "closet")).join("")
    || `<p class="small">Nothing matches. Try another search or add a new item.</p>`;
  $("#grid-studio").innerHTML = visible("studio").map((i) => cardHTML(i, "studio")).join("");
  $$(".tabs").forEach((t) => (t.innerHTML = tabsHTML(t.dataset.view)));

  const chips = wornItems().map((i) => `<div class="chip">${thumb(i)}
    <span><span class="small">${i.cat}</span><br><strong>${i.name}</strong></span>
    <button data-action="unwear" data-id="${i.id}" aria-label="Take off ${i.name}">×</button></div>`).join("");
  $$(".equipped").forEach((e) => (e.innerHTML = chips || `<p class="small">Nothing on yet. Open the outfit studio to pick pieces.</p>`));

  $("#closet-blurb").textContent = `View all ${items.length} items. Add pieces or remove what you no longer wear.`;
  $("#counts").textContent = `${items.length} items in your closet  ${wornItems().length} items on your photo`;
  $("#studio-count").textContent = `${wornItems().length} items`;
  $$(".stage").forEach((s) => (s.innerHTML = stageHTML()));
  updateFit();
  save();
}

/* =====================================================================
   3. CLICKS (one listener for the whole page)
   ===================================================================== */
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  const id = Number(el.dataset.id), action = el.dataset.action;

  if (action === "add") return openAddDialog();
  if (action === "photo") return $("#me-input").click();
  if (action === "pick-item") return $("#item-photo").click();

  if (action === "tab") tab[el.dataset.view] = el.dataset.cat;
  if (action === "clear") worn = {};
  if (action === "unwear") delete worn[byId(id).cat];
  if (action === "reset-fit") { const it = byId(selectedId); it.place = { ...START[it.cat] }; }
  if (action === "wear") {
    const item = byId(id);
    if (worn[item.cat] === id) delete worn[item.cat];
    else {
      worn[item.cat] = id;
      selectedId = id;                                        // jump straight into adjusting it
      if (item.cat === "Dresses") { delete worn.Tops; delete worn.Bottoms; }
      if (item.cat === "Tops" || item.cat === "Bottoms") delete worn.Dresses;
    }
  }
  if (action === "delete") {
    items = items.filter((i) => i.id !== id);
    for (const c in worn) if (worn[c] === id) delete worn[c];
  }
  render();
});

$("#search").addEventListener("input", (e) => { query = e.target.value.toLowerCase(); render(); });

/* =====================================================================
   4. FITTING: drag to move, slider to resize
   ===================================================================== */
const studio = $("#stage-studio");
studio.addEventListener("pointerdown", (e) => {
  const layer = e.target.closest(".layer");
  if (!layer) { selectedId = null; return updateFit(); }
  const it = byId(Number(layer.dataset.id)), r = studio.getBoundingClientRect();
  selectedId = it.id;
  // remember where inside the item you grabbed it, so it doesn't jump to your cursor
  drag = { it, layer, r, dx: ((e.clientX - r.left) / r.width) * 100 - it.place.x,
                          dy: ((e.clientY - r.top) / r.height) * 100 - it.place.y };
  layer.setPointerCapture(e.pointerId);
  updateFit();
});
studio.addEventListener("pointermove", (e) => {
  if (!drag) return;
  const { it, layer, r } = drag;
  it.place.x = clamp(((e.clientX - r.left) / r.width) * 100 - drag.dx, -40, 100);
  it.place.y = clamp(((e.clientY - r.top) / r.height) * 100 - drag.dy, -40, 100);
  layer.style.left = it.place.x + "%"; layer.style.top = it.place.y + "%";
});
studio.addEventListener("pointerup", () => { drag = null; render(); });   // redraw so Home matches

$("#size").addEventListener("input", (e) => {
  const it = byId(selectedId);
  if (!it) return;
  it.place.w = Number(e.target.value);
  $$(`.layer[data-id="${it.id}"]`).forEach((l) => (l.style.width = it.place.w + "%"));
  save();
});

/* =====================================================================
   5. IMAGES: load, shrink, cut out the background
   ===================================================================== */
// File -> canvas, scaled down so huge phone photos don't slow the page.
function toCanvas(file, max) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = reject;
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c);
    };
    img.src = URL.createObjectURL(file);
  });
}

// Non-AI background removal. Take the top-left pixel as "the background color", then
// flood outward from the photo's edges, erasing connected pixels that are close to that color.
// Flooding from the edges (not everywhere) keeps a white shirt's inside from being erased.
function cutOut(src) {
  const w = src.width, h = src.height, c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, w, h), d = img.data;

  if (d[3] >= 10) {                                   // skip if the PNG is already transparent
    const bg = d.slice(0, 3), seen = new Uint8Array(w * h), stack = [];
    const push = (x, y) => {
      const i = y * w + x, p = i * 4;
      if (!seen[i] && Math.hypot(d[p] - bg[0], d[p + 1] - bg[1], d[p + 2] - bg[2]) < TOL) { seen[i] = 1; stack.push(i); }
    };
    for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
    for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
    while (stack.length) {
      const i = stack.pop(), x = i % w, y = (i - x) / w;
      d[i * 4 + 3] = 0;                                // alpha 0 = fully transparent
      if (x > 0) push(x - 1, y); if (x < w - 1) push(x + 1, y);
      if (y > 0) push(x, y - 1); if (y < h - 1) push(x, y + 1);
    }
  }
  ctx.putImageData(img, 0, 0);

  // Trim empty space so the item's edges touch its box. Then width% on the stage matches the garment.
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++)
    if (d[(y * w + x) * 4 + 3] > 0) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  if (x1 < 0) return src;                              // everything got erased; keep the original
  const out = document.createElement("canvas");
  out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
  out.getContext("2d").drawImage(c, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

// Your photo
$("#me-input").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  myPhoto = (await toCanvas(file, 900)).toDataURL("image/jpeg", 0.85);
  e.target.value = "";
  render();
});

/* =====================================================================
   6. ADD-ITEM POP-UP
   ===================================================================== */
const dialog = $("#add-dialog");
$("#cat-options").innerHTML = CATS.map((c) =>
  `<label class="choice"><input type="radio" name="cat" value="${c}" required> ${c}</label>`).join("");

function openAddDialog() {
  $("#add-form").reset();
  pendingCanvas = pendingImg = null;
  $("#photo-preview").hidden = true;
  $("#photo-name").textContent = "No photo chosen";
  $("#form-error").textContent = "";
  dialog.showModal();
}
$("#cancel-add").addEventListener("click", () => dialog.close());

function updatePreview() {
  if (!pendingCanvas) return;
  const out = $("#remove-bg").checked ? cutOut(pendingCanvas) : pendingCanvas;
  pendingImg = out.toDataURL("image/png");             // PNG keeps the transparency
  $("#photo-preview").src = pendingImg;
  $("#photo-preview").hidden = false;
  $("#photo-name").textContent = pendingName;
}
$("#item-photo").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  pendingName = file.name;
  pendingCanvas = await toCanvas(file, 500);
  updatePreview();
});
$("#remove-bg").addEventListener("change", updatePreview);

$("#add-form").addEventListener("submit", (e) => {
  e.preventDefault();
  if (!pendingImg) { $("#form-error").textContent = "Choose a photo of the item first."; return; }
  const cat = new FormData(e.target).get("cat");
  items.push({ id: nextId++, name: $("#item-name").value.trim(), cat, tag: "", img: pendingImg, place: { ...START[cat] } });
  dialog.close();
  render();
});

/* =====================================================================
   7. NAVIGATION + START
   ===================================================================== */
function showView() {
  const name = location.hash.slice(1) || "home";
  $$(".view").forEach((v) => v.classList.toggle("active", v.id === "view-" + name));
  $$("[data-link]").forEach((a) => a.classList.toggle("active", a.dataset.link === name));
}
window.addEventListener("hashchange", showView);

/* =====================================================================
   8. SAVING (IndexedDB: a database built into your browser)
   ===================================================================== */
// IndexedDB stores JavaScript objects (including big photo strings) under a key, like a labeled drawer.
// We keep ONE drawer called "state" holding everything we want to remember.
const dbReady = new Promise((resolve, reject) => {
  const req = indexedDB.open("avatar-closet", 1);
  req.onupgradeneeded = () => req.result.createObjectStore("kv");   // runs only the first time
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

async function dbGet(key) {
  const db = await dbReady;
  return new Promise((resolve, reject) => {
    const q = db.transaction("kv").objectStore("kv").get(key);
    q.onsuccess = () => resolve(q.result);
    q.onerror = () => reject(q.error);
  });
}
async function dbSet(key, value) {
  const db = await dbReady;
  return new Promise((resolve, reject) => {
    const t = db.transaction("kv", "readwrite");
    t.objectStore("kv").put(value, key);
    t.oncomplete = resolve;
    t.onerror = () => reject(t.error);
  });
}

// Debounce: wait 300ms after the last change, so dragging doesn't write dozens of times.
let saveTimer;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => dbSet("state", { items, worn, myPhoto, nextId }).catch(console.error), 300);
}

// On start: load saved data FIRST, then draw. (If we drew first, we'd save the starter
// closet over your real one.)
async function load() {
  try {
    const saved = await dbGet("state");
    if (saved) ({ items, worn, myPhoto, nextId } = saved);
  } catch (err) { console.error("Could not load saved data", err); }
  showView();
  render();
}
load();
