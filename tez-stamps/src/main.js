// tez-stamps — the passport office.
// Landing renders live registry state from the indexer alone (light).
// The wallet stack loads lazily: on connect click, or when a previous
// Beacon session / remembered visitor exists. ?view=<address> renders any
// passport read-only. Revisits: last address is remembered in localStorage.
import { loadStampTypes, walletHolds, loadNouns, recentPassports } from "./board.js";

const NETWORK = import.meta.env.VITE_NETWORK || "shadownet";
const TZKT_UI = NETWORK === "mainnet" ? "https://tzkt.io" : "https://shadownet.tzkt.io";
const LAST_KEY = "stampz:last-address";

const $ = (id) => document.getElementById(id);
const short = (a) => `${a.slice(0, 7)}…${a.slice(-4)}`;
const viewParam = new URLSearchParams(location.search).get("view");

let walletMod = null; // lazy
const loadWallet = async () => (walletMod ??= await import("./wallet.js"));

// ---------- landing board (no wallet needed) ----------
async function renderLanding() {
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
  $("landing").hidden = true;
  $("connect").hidden = true;
  $("welcome-back").hidden = true;
  $("passport").hidden = false;
  showProfileBar(address, viewOnly);

  const types = await loadStampTypes();
  const grid = $("stamps");
  const claimable = $("claimable");
  grid.innerHTML = ""; claimable.innerHTML = "";

  for (const t of types) {
    const held = await walletHolds(address, t.id);
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

  const shelf = $("nouns");
  shelf.innerHTML = `<p class="noun-empty">Checking the vault…</p>`;
  const nouns = await loadNouns(address);
  shelf.innerHTML = "";
  for (const n of nouns) {
    const fig = document.createElement("figure");
    fig.className = "noun-card";
    fig.innerHTML = `${n.svg}<figcaption>${n.name}</figcaption>`;
    shelf.appendChild(fig);
  }
  if (!nouns.length) {
    shelf.innerHTML = `<p class="noun-empty">No nouns yet — earn stamps, then mint your portrait.</p>`;
  }
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
