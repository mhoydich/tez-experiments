// tez-stamps — the passport office.
// Landing renders live registry state from the indexer alone (light).
// The wallet stack loads lazily: on connect click, or when a previous
// Beacon session / remembered visitor exists. ?view=<address> renders any
// passport read-only. Revisits: last address is remembered in localStorage.
import { loadStampTypes, walletHolds, loadNouns, recentPassports,
         loadPostcards, POSTCARD_BGS } from "./board.js";
import { getCasts, getCast, getCastCount, topCasters, topStamped,
         getAccount, getBalanceHistory, getActivity, getRallyPlayer,
         KINDS } from "./cast.js";

const NETWORK = import.meta.env.VITE_NETWORK || "shadownet";
const TZKT_UI = NETWORK === "mainnet" ? "https://tzkt.io" : "https://shadownet.tzkt.io";
const QUALIFYING_STAMP = 0; // First Steps — gates the personal mint
const LAST_KEY = "stampz:last-address";

const $ = (id) => document.getElementById(id);
const short = (a) => `${a.slice(0, 7)}…${a.slice(-4)}`;
const fmtDate = (iso) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const viewParam = new URLSearchParams(location.search).get("view");
const castParam = new URLSearchParams(location.search).get("cast");
const wireParam = new URLSearchParams(location.search).has("wire");
let currentAddress = null;

const fmt = (n, d = 2) => Number(n).toLocaleString("en-US", { maximumFractionDigits: d });
const ago = (t) => {
  const s = (Date.now() - new Date(t).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${(s / 60) | 0}m ago`;
  if (s < 86400) return `${(s / 3600) | 0}h ago`;
  if (s < 86400 * 30) return `${(s / 86400) | 0}d ago`;
  return fmtDate(t);
};

// ---------- cast rendering ----------
function castBodyHTML(c) {
  const b = c.body;
  if (c.kind === 1 && /^https?:\/\/\S+$/.test(b))
    return `<a href="${escapeHTML(b)}" target="_blank" rel="noopener">${escapeHTML(b)}</a>`;
  if (c.kind === 2 && /^data:image\/(svg\+xml|png|jpeg|gif|webp)[;,]/.test(b))
    return `<img src="${escapeHTML(b)}" alt="cast art" loading="lazy" />`;
  return escapeHTML(b);
}

function castItemHTML(c, { withAuthor = true, single = false } = {}) {
  return `<div class="cast-item${single ? " single" : ""}">
    <div class="meta">
      <span class="ctag ${KINDS[c.kind] || "note"}">${KINDS[c.kind] || "note"}</span>
      ${withAuthor ? `<a href="/?view=${c.author}">${short(c.author)}</a>` : ""}
      <span>${ago(c.at)}</span>
      <a href="/?cast=${c.id}" title="permalink">№ ${c.id}</a>
    </div>
    <div class="cbody">${castBodyHTML(c)}</div>
  </div>`;
}

// ---------- charts ----------
function sparklineSVG(hist) {
  if (hist.length < 2) return "";
  const vs = hist.map((h) => h.v);
  const min = Math.min(...vs), max = Math.max(...vs);
  const span = max - min || 1;
  const W = 320, H = 84, P = 5;
  const pts = hist.map((h, i) => {
    const x = P + (i / (hist.length - 1)) * (W - 2 * P);
    const y = H - P - ((h.v - min) / span) * (H - 2 * P);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const [lx, ly] = pts[pts.length - 1].split(",");
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="balance history">
    <defs><linearGradient id="bfill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(15,97,255,0.14)"/>
      <stop offset="100%" stop-color="rgba(15,97,255,0)"/>
    </linearGradient></defs>
    <polygon points="${P},${H - P} ${pts.join(" ")} ${W - P},${H - P}" fill="url(#bfill)"/>
    <polyline points="${pts.join(" ")}" fill="none" stroke="#0f61ff" stroke-width="1.5"/>
    <circle cx="${lx}" cy="${ly}" r="3" fill="#b3402a"/>
  </svg>`;
}

const heatHTML = (buckets) => {
  const max = Math.max(...buckets, 1);
  return `<div class="heat">${buckets.map((n) =>
    `<div class="day ${n >= max * 0.7 && n > 0 ? "hot" : ""}" style="height:${Math.max(4, (n / max) * 100)}%" title="${n} ops"></div>`
  ).join("")}</div>`;
};

let walletMod = null; // lazy
const loadWallet = async () => (walletMod ??= await import("./wallet.js"));

// ---------- landing board (no wallet needed) ----------
async function renderLanding() {
  // The machinery — every contract this office reads and writes.
  const contracts = [
    ["stamps registry", import.meta.env.VITE_REGISTRY_ADDRESS],
    ["nouns", import.meta.env.VITE_NOUNS_ADDRESS],
    ["postcards", import.meta.env.VITE_POSTCARDS_ADDRESS],
    ["cast tower", import.meta.env.VITE_CAST_ADDRESS],
    ["rally rating desk", import.meta.env.VITE_RALLY_ADDRESS],
  ].filter(([, a]) => a);
  $("machinery").innerHTML = contracts.map(([n, a]) =>
    `<li><span>${n}</span><a href="${TZKT_UI}/${a}" target="_blank" rel="noopener">${short(a)}</a></li>`
  ).join("") + `<li><span class="count-chip">all CC0 · no admin on the tower ·
    standalone reader at</span> <a href="https://tez-cast.pages.dev" target="_blank" rel="noopener">tez-cast.pages.dev</a></li>`;

  const types = await loadStampTypes();
  const board = $("board");
  board.innerHTML = "";
  for (const t of types) {
    const li = document.createElement("li");
    li.className = "stamp held";
    li.innerHTML = `${t.thumb ? `<img src="${t.thumb}" alt="${t.name}" loading="lazy" />` : ""}
      <div><strong>${t.name}</strong><span>${t.description}</span>
      <span class="count">${t.total} issued · ${t.gate} gate</span></div>`;
    board.appendChild(li);
  }

  const recent = await recentPassports(6);
  const ul = $("recent");
  ul.innerHTML = recent.length ? "" : "<li>Nobody yet — be the first.</li>";
  for (const a of recent) {
    const li = document.createElement("li");
    li.innerHTML = `<a href="/?view=${a}">${short(a)}</a>`;
    ul.appendChild(li);
  }

  const latest = await loadNouns(null, 1);
  if (latest.length) {
    $("latest-noun").innerHTML = `
      <figure class="noun-card">${latest[0].svg}
        <figcaption>${latest[0].name} · <a href="/?view=${latest[0].owner}">${short(latest[0].owner)}</a></figcaption>
      </figure>`;
  }

  // The wire — latest casts across every tower.
  const casts = await getCasts({ limit: 8 });
  $("wire").innerHTML = casts.length
    ? casts.map((c) => castItemHTML(c)).join("")
    : `<p class="noun-empty">Dead air — open your passport and cast the first.</p>`;

  // Lineage boards.
  const [stamped, casters] = await Promise.all([topStamped(5), topCasters(5)]);
  $("top-stamped").innerHTML = stamped.length ? "" : "<li>Nobody yet.</li>";
  for (const r of stamped) {
    const li = document.createElement("li");
    li.innerHTML = `<a href="/?view=${r.address}">${short(r.address)}</a>
      <span class="count-chip">· ${r.count} stamp${r.count === 1 ? "" : "s"}</span>`;
    $("top-stamped").appendChild(li);
  }
  $("top-casters").innerHTML = casters.length ? "" : "<li>All towers silent.</li>";
  for (const r of casters) {
    const li = document.createElement("li");
    li.innerHTML = `<a href="/?view=${r.address}">${short(r.address)}</a>
      <span class="count-chip">· ${r.count} cast${r.count === 1 ? "" : "s"}</span>`;
    $("top-casters").appendChild(li);
  }
}

// ---------- welcome back ----------
function renderWelcomeBack() {
  const last = localStorage.getItem(LAST_KEY);
  if (!last || viewParam) return;
  $("welcome-back").hidden = false;
  $("wb-address").textContent = short(last);
  $("wb-resume").onclick = () => connectFlow();
  $("wb-peek").href = `/?view=${last}`;
}

// ---------- passport ----------
function showProfileBar(address, viewOnly) {
  $("address").textContent = address;
  $("tzkt-link").href = `${TZKT_UI}/${address}`;
  $("share-link").href = `${location.origin}/?view=${address}`;
  $("copy-address").onclick = () =>
    navigator.clipboard.writeText(address).then(() => {
      $("copy-address").textContent = "copied";
      setTimeout(() => ($("copy-address").textContent = "copy"), 1200);
    });
  $("disconnect").hidden = viewOnly;
  if (viewOnly) {
    $("status").textContent = "Viewing a passport — connect your own wallet from the home page.";
  }
}

async function renderPassport(address, { viewOnly = false } = {}) {
  currentAddress = address;
  $("landing").hidden = true;
  $("connect").hidden = true;
  $("welcome-back").hidden = true;
  $("passport").hidden = false;
  showProfileBar(address, viewOnly);
  renderTower(address, viewOnly); // vitals + charts + casts, concurrently
  renderRally(address, viewOnly); // pickleball rating card, concurrently

  // Feature: mail a noun to the passport you're viewing.
  const mailBtn = $("mail-viewed");
  const myAddr = localStorage.getItem(LAST_KEY);
  mailBtn.hidden = !(viewOnly && myAddr && myAddr !== address);
  mailBtn.onclick = async () => {
    $("status").textContent = "Fetching your nouns…";
    const mine = await loadNouns(myAddr);
    if (!mine.length) {
      $("status").textContent = "You need a noun to mail — earn stamps and mint one on your passport.";
      return;
    }
    $("status").textContent = "";
    openSendDialog(mine[0], { to: address, myNouns: mine });
  };

  const types = await loadStampTypes();
  const grid = $("stamps");
  const claimable = $("claimable");
  grid.innerHTML = ""; claimable.innerHTML = "";

  let holdsQualifying = false;
  for (const t of types) {
    const held = await walletHolds(address, t.id);
    if (held && t.id === QUALIFYING_STAMP) holdsQualifying = true;
    if (held) {
      const li = document.createElement("li");
      li.className = "stamp held";
      li.innerHTML = `${t.thumb ? `<img src="${t.thumb}" alt="${t.name}" />` : ""}
        <div><strong>${t.name}</strong><span>${t.description ?? ""}</span></div>`;
      grid.appendChild(li);
    } else if (t.gate === "open" && !viewOnly) {
      const b = document.createElement("button");
      b.className = "claim";
      b.textContent = `Claim: ${t.name}`;
      b.onclick = async () => {
        const w = await loadWallet();
        if (await w.claimOpen(t.id, $("status"))) renderPassport(address);
      };
      claimable.appendChild(b);
    }
  }
  if (!grid.children.length) {
    grid.innerHTML = `<li class="stamp empty">No stamps yet — go do something.</li>`;
  }

  // Mint button appears once you hold the qualifying stamp (contract also
  // enforces this — the button just saves a wasted signature).
  const mintBtn = $("mint-noun");
  mintBtn.hidden = viewOnly || !holdsQualifying;
  mintBtn.onclick = async () => {
    const w = await loadWallet();
    if (await w.mintPersonal($("status"))) renderPassport(address);
  };

  const shelf = $("nouns");
  shelf.innerHTML = `<p class="noun-empty">Checking the vault…</p>`;
  const nouns = await loadNouns(address);
  // Identity: your first noun is your portrait; visitors without one get
  // a deterministic Noun from the official CC0 trait set.
  const av = $("passport-avatar");
  av.hidden = false;
  av.innerHTML = nouns.length ? nouns[0].svg
    : `<img src="https://noun-api.com/beta/pfp?name=${address}&size=144" alt="" loading="lazy" />`;
  shelf.innerHTML = "";
  for (const n of nouns) {
    const fig = document.createElement("figure");
    fig.className = "noun-card";
    fig.innerHTML = `${n.svg}<figcaption>${n.name}</figcaption>`;
    if (!viewOnly) {
      const mail = document.createElement("button");
      mail.className = "mail-btn"; mail.type = "button"; mail.textContent = "✉ mail";
      mail.onclick = () => openSendDialog(n);
      fig.appendChild(mail);
    }
    shelf.appendChild(fig);
  }
  if (!nouns.length) {
    shelf.innerHTML = `<p class="noun-empty">No nouns yet — earn stamps, then mint your portrait.</p>`;
  }

  // The postcard builder, out in the open.
  const sendBtn = $("send-postcard");
  sendBtn.hidden = viewOnly || !nouns.length;
  sendBtn.onclick = () => openSendDialog(nouns[0], { myNouns: nouns });

  // Postcards received — the community wall.
  const wall = $("postcards");
  wall.innerHTML = `<p class="noun-empty">Checking the mailbox…</p>`;
  const cards = await loadPostcards(address);
  wall.innerHTML = "";
  for (const c of cards) {
    const div = document.createElement("div");
    div.className = "postcard";
    const bg = POSTCARD_BGS[c.background] || POSTCARD_BGS[0];
    div.innerHTML = `
      <div class="stamp-window" style="background:${bg.css}">${c.svg}</div>
      <div class="body">
        <p class="note">${escapeHTML(c.note) || "—"}</p>
        <p class="meta">Noun ${c.noun} · from <a href="/?view=${c.from}">${short(c.from)}</a> · ${fmtDate(c.sentAt)}</p>
      </div>`;
    wall.appendChild(div);
  }
  if (!cards.length) {
    wall.innerHTML = `<p class="noun-empty">No postcards yet — nouns arrive here with a note.</p>`;
  }
}

const escapeHTML = (s) => s.replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ---------- draggable panes: arrange your own passport ----------
// HTML5 drag & drop, vanilla: grab a section by its ⠿ handle, drop it where
// it reads best. Order persists in this browser via localStorage. Arrow keys
// on a focused handle move the pane too (and cover touch-less reordering).
const PANE_KEY = "stampz:pane-order";

function savePaneOrder() {
  localStorage.setItem(PANE_KEY, JSON.stringify(
    [...$("panes").children].map((p) => p.dataset.pane)));
}

function applyPaneOrder() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(PANE_KEY) || "null"); } catch { /* fresh */ }
  if (!Array.isArray(saved)) return;
  const wrap = $("panes");
  for (const name of saved) {
    const el = wrap.querySelector(`[data-pane="${name}"]`);
    if (el) wrap.appendChild(el);
  }
}

function initPanes() {
  const wrap = $("panes");
  wrap.querySelectorAll(".pane").forEach((pane) => {
    const label = pane.querySelector(".section-label");
    const h = document.createElement("button");
    h.type = "button"; h.className = "pane-handle";
    h.title = "drag to rearrange (or arrow keys)";
    h.setAttribute("aria-label", `move ${pane.dataset.pane} section`);
    h.textContent = "⠿";
    label.prepend(h);

    // draggable only while the grip is held — text selection stays normal
    h.addEventListener("mousedown", () => (pane.draggable = true));
    pane.addEventListener("dragstart", (e) => {
      pane.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", pane.dataset.pane);
    });
    pane.addEventListener("dragend", () => {
      pane.draggable = false;
      pane.classList.remove("dragging");
      savePaneOrder();
    });
    h.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      e.preventDefault();
      if (e.key === "ArrowUp" && pane.previousElementSibling)
        wrap.insertBefore(pane, pane.previousElementSibling);
      if (e.key === "ArrowDown" && pane.nextElementSibling)
        wrap.insertBefore(pane.nextElementSibling, pane);
      savePaneOrder();
      h.focus();
    });
  });

  // live reorder while dragging — the drop preview IS the drop
  wrap.addEventListener("dragover", (e) => {
    e.preventDefault();
    const dragging = wrap.querySelector(".dragging");
    if (!dragging) return;
    const after = [...wrap.querySelectorAll(".pane:not(.dragging)")].find((p) => {
      const r = p.getBoundingClientRect();
      return e.clientY < r.top + r.height / 2;
    });
    if (after) wrap.insertBefore(dragging, after);
    else wrap.appendChild(dragging);
  });
  wrap.addEventListener("drop", (e) => e.preventDefault());

  $("reset-panes").addEventListener("click", () => {
    localStorage.removeItem(PANE_KEY);
    const order = ["vitals", "stamps", "nouns", "postcards", "rally", "broadcast"];
    for (const name of order) wrap.appendChild(wrap.querySelector(`[data-pane="${name}"]`));
  });

  applyPaneOrder();
}
initPanes();

// ---------- rally: pickleball rating card + declaration ----------
const milliFmt = (m) => (m / 1000).toFixed(3);

async function renderRally(address, viewOnly) {
  const box = $("rally");
  const p = await getRallyPlayer(address);

  const card = p ? `
    <ul class="vitals rally-card">
      <li><span class="num">${milliFmt(p.rating)}</span><span class="vlabel">rating</span></li>
      <li><span class="num">${milliFmt(p.declared)}</span><span class="vlabel">declared</span></li>
      <li><span class="num">${p.wins}–${p.matches - p.wins}</span><span class="vlabel">record</span></li>
    </ul>
    <p class="noun-empty">${p.matches > 0
      ? "Earned — this number only moves through countersigned matches."
      : "A claim, not a record — it hardens once opponents countersign matches."}
      Report matches at <a href="https://tez-rally.pages.dev" target="_blank" rel="noopener">tez-rally</a>.</p>`
    : viewOnly
      ? `<p class="noun-empty">No player card — this passport hasn't declared a level.</p>`
      : "";

  const canDeclare = !viewOnly && (!p || p.matches === 0);
  const declareUI = canDeclare ? `
    <div class="rally-declare">
      <input id="rally-level" type="number" min="2" max="8" step="0.05"
             placeholder="4.25" inputmode="decimal" />
      <button id="rally-declare-btn" class="ghost" type="button">
        ${p ? "Re-declare my level" : "Declare my level"}</button>
    </div>
    <p class="noun-empty">Self-declare 2.000–8.000 (DUPR-ish). Mints a soulbound
      player card; free to adjust until your first finalized match.</p>` : "";

  box.innerHTML = card + declareUI;
  if (canDeclare) {
    $("rally-declare-btn").onclick = async () => {
      const v = parseFloat($("rally-level").value);
      if (!(v >= 2 && v <= 8)) { $("status").textContent = "Levels run 2.000–8.000."; return; }
      const w = await loadWallet();
      if (await w.declareRally(Math.round(v * 1000), $("status"))) renderRally(address, viewOnly);
    };
  }
}

// ---------- wallet vitals + broadcast (the tower) ----------
async function renderTower(address, viewOnly) {
  const acct = await getAccount(address);
  const [hist, activity, casts, castCount] = await Promise.all([
    getBalanceHistory(address, acct), getActivity(address),
    getCasts({ author: address, limit: 30 }), getCastCount(address),
  ]);

  const aliasEl = $("alias");
  aliasEl.hidden = !acct?.alias;
  if (acct?.alias) aliasEl.textContent = acct.alias;

  const since = acct?.firstSeen
    ? new Date(acct.firstSeen).toLocaleDateString("en-US", { month: "short", year: "numeric" })
    : "pure passport";
  $("vitals").innerHTML = [
    [`${fmt(acct?.balance ?? 0)}<small> ꜩ</small>`, "balance"],
    [fmt(acct?.ops ?? 0, 0), "operations"],
    [String(castCount), "casts"],
    [since, "on chain since"],
  ].map(([num, label]) =>
    `<li><span class="num">${num}</span><span class="vlabel">${label}</span></li>`
  ).join("");

  const bWrap = $("balance-chart");
  bWrap.hidden = hist.length < 2;
  if (hist.length >= 2) {
    $("balance-card").innerHTML = sparklineSVG(hist) + `
      <div class="chart-meta">
        <span>${fmtDate(hist[0].t)}</span>
        <span>peak ${fmt(Math.max(...hist.map((h) => h.v)))} ꜩ</span>
        <span>now</span>
      </div>`;
  }
  const pWrap = $("pulse-chart");
  const hasPulse = activity.some((n) => n > 0);
  pWrap.hidden = !hasPulse;
  if (hasPulse) $("pulse-card").innerHTML = heatHTML(activity);

  $("cast-count").textContent = String(castCount);
  $("composer").hidden = viewOnly;
  $("casts").innerHTML = casts.length
    ? casts.map((c) => castItemHTML(c, { withAuthor: false })).join("")
    : `<p class="noun-empty">${viewOnly ? "This tower is silent." : "Your tower is silent — cast the first."}</p>`;
}

// ---------- send-a-postcard dialog ----------
let sendState = { noun: null, background: 0 };

// The builder shows the postcard exactly as it will hang on their wall.
function pvUpdate(noun) {
  if (noun) {
    $("pv-window").innerHTML = noun.svg;
    $("pv-meta").textContent = `Noun ${noun.id} · from you · today`;
  }
  $("pv-window").style.background = POSTCARD_BGS[sendState.background].css;
}

function openSendDialog(noun, { to = "", myNouns = null } = {}) {
  sendState = { noun: noun.id, background: 0 };
  const pickField = $("send-noun-field");
  const pick = $("send-noun-pick");
  if (myNouns && myNouns.length > 1) {
    pickField.hidden = false;
    pick.innerHTML = myNouns.map((n) => `<option value="${n.id}">${n.name}</option>`).join("");
    pick.value = String(noun.id);
    pick.onchange = () => {
      const sel = myNouns.find((n) => n.id === Number(pick.value));
      if (sel) { sendState.noun = sel.id; pvUpdate(sel); }
    };
  } else {
    pickField.hidden = true;
  }
  $("send-to").value = to;
  $("send-note").value = "";
  $("note-count").textContent = "0";
  $("pv-note").textContent = "wish you were here…";
  const picker = $("bg-picker");
  picker.innerHTML = "";
  POSTCARD_BGS.forEach((bg, i) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "bg-swatch"; b.title = bg.name;
    b.style.background = bg.css;
    b.setAttribute("aria-pressed", i === 0 ? "true" : "false");
    b.onclick = () => {
      sendState.background = i;
      [...picker.children].forEach((c, j) => c.setAttribute("aria-pressed", j === i ? "true" : "false"));
      pvUpdate();
    };
    picker.appendChild(b);
  });
  pvUpdate(noun);
  $("send-dialog").showModal();
}

$("send-note").addEventListener("input", (e) => {
  $("note-count").textContent = String(e.target.value.length);
  $("pv-note").textContent = e.target.value.trim() || "wish you were here…";
});

$("send-form").addEventListener("submit", async (e) => {
  if (e.submitter?.value !== "send") return; // cancel just closes
  e.preventDefault();
  const to_ = $("send-to").value.trim();
  if (!/^tz[123][A-Za-z0-9]{33}$/.test(to_)) { $("send-to").focus(); return; }
  const note = $("send-note").value.trim();
  $("send-dialog").close();
  const w = await loadWallet();
  const ok = await w.sendPostcard({ to_, noun: sendState.noun, background: sendState.background, note }, $("status"));
  if (ok) renderPassport(currentAddress, { viewOnly: !!viewParam });
});

// ---------- composer (broadcast) ----------
let castKind = 0;
{
  const kinds = $("kinds");
  KINDS.forEach((k, i) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "kind"; b.textContent = k;
    b.setAttribute("aria-pressed", i === 0 ? "true" : "false");
    b.onclick = () => {
      castKind = i;
      [...kinds.children].forEach((c, j) =>
        c.setAttribute("aria-pressed", j === i ? "true" : "false"));
    };
    kinds.appendChild(b);
  });
}
$("cast-body").addEventListener("input", (e) => {
  $("cast-chars").textContent = String(e.target.value.length);
});
$("cast-send").addEventListener("click", async () => {
  const body = $("cast-body").value.trim();
  if (!body) return;
  const w = await loadWallet();
  const ok = await w.publishCast({ kind: castKind, body }, $("status"));
  if (ok) {
    $("cast-body").value = "";
    $("cast-chars").textContent = "0";
    renderTower(currentAddress, false);
  }
});

// ---------- the wire — public broadcast page (?wire) ----------
let wireTimer = null;
async function renderWirePage() {
  document.title = "the wire — stampz";
  $("landing").hidden = true;
  $("connect").hidden = true;
  $("welcome-back").hidden = true;
  $("wire-page").hidden = false;

  const [casts, casters] = await Promise.all([getCasts({ limit: 50 }), topCasters(12)]);
  $("wire-broadcasters").innerHTML = casters.length ? casters.map((r) => `
    <a class="broadcaster" href="/?view=${r.address}">
      <img src="https://noun-api.com/beta/pfp?name=${r.address}&size=68" alt="" loading="lazy"/>
      <span><span class="who">${short(r.address)}</span><br/>
      <span class="count-chip">${r.count} cast${r.count === 1 ? "" : "s"}</span></span>
    </a>`).join("") : `<p class="noun-empty">No broadcasters yet.</p>`;
  $("wire-all").innerHTML = casts.length
    ? casts.map((c) => castItemHTML(c)).join("")
    : `<p class="noun-empty">Dead air — open your passport and cast the first.</p>`;

  // A broadcast page should feel live: re-check quietly, redraw on news.
  const topId = casts[0]?.id ?? -1;
  clearInterval(wireTimer);
  wireTimer = setInterval(async () => {
    const fresh = await getCasts({ limit: 1 });
    if ((fresh[0]?.id ?? -1) !== topId) renderWirePage();
  }, 45000);
}

// ---------- single cast permalink ----------
async function renderCastView(id) {
  $("landing").hidden = true;
  $("connect").hidden = true;
  $("welcome-back").hidden = true;
  $("cast-view").hidden = false;
  const c = await getCast(id);
  $("cast-single").innerHTML = c
    ? castItemHTML(c, { single: true })
    : `<p class="noun-empty">No cast № ${escapeHTML(id)} — yet.</p>`;
  document.title = c ? `cast № ${c.id} — stampz` : "cast — stampz";
}

async function connectFlow() {
  $("status").textContent = "Opening wallet…";
  const w = await loadWallet();
  try {
    const address = await w.connect();
    if (address) {
      localStorage.setItem(LAST_KEY, address);
      $("status").textContent = "";
      renderPassport(address);
    }
  } catch (e) {
    $("status").textContent = e?.message || "Connection cancelled.";
  }
}

// ---------- boot ----------
async function boot() {
  if (wireParam) {
    renderWirePage();
    return;
  }
  if (castParam) {
    renderCastView(castParam);
    return;
  }
  if (viewParam) {
    renderPassport(viewParam, { viewOnly: true });
    return;
  }
  renderLanding();
  renderWelcomeBack();
  // Resume an existing Beacon session (only pay the wallet download if
  // there is a session to resume — localStorage remembers that for us).
  if (localStorage.getItem(LAST_KEY)) {
    const w = await loadWallet();
    const account = await w.getActiveAccount();
    if (account) renderPassport(account.address);
  }
}

$("connect").addEventListener("click", connectFlow);

// ---------- passport lookup ----------
$("lookup-go").addEventListener("click", () => {
  const v = $("lookup").value.trim();
  if (/^(tz[1-4]|KT1)[1-9A-HJ-NP-Za-km-z]{33}$/.test(v)) location.href = `/?view=${v}`;
  else $("status").textContent = "That doesn't look like a Tezos address.";
});
$("lookup").addEventListener("keydown", (e) => {
  if (e.key === "Enter") $("lookup-go").click();
});

$("disconnect").addEventListener("click", async () => {
  const w = await loadWallet();
  await w.disconnect();
  $("passport").hidden = true;
  $("landing").hidden = false;
  $("connect").hidden = false;
  $("status").textContent = "Logged out.";
  renderWelcomeBack();
});

boot();
