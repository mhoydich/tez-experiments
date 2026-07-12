// tez-rally — the rating desk.
// Landing renders the ladder + match log from the indexer alone (light).
// The wallet stack loads lazily: on connect click, or when a previous
// Beacon session / remembered visitor exists. ?view=<address> renders any
// player card read-only. Revisits: last address is remembered in localStorage.
import { loadLadder, loadMatches, playerOf, loadCourts, bookOf, trajectoryOf } from "./board.js";

const NETWORK = import.meta.env.VITE_NETWORK || "shadownet";
const TZKT_UI = NETWORK === "mainnet" ? "https://tzkt.io" : "https://shadownet.tzkt.io";
const LAST_KEY = "rally:last-address";
const ADDR_RE = /^tz[123][A-Za-z0-9]{33}$/;

const $ = (id) => document.getElementById(id);
const short = (a) => `${a.slice(0, 7)}…${a.slice(-4)}`;
const fmt = (milli) => (milli / 1000).toFixed(3);
const fmtDate = (iso) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const whoLink = (a) => `<a href="/?view=${a}">${short(a)}</a>`;
const viewParam = new URLSearchParams(location.search).get("view");
let currentAddress = null;

let walletMod = null; // lazy
const loadWallet = async () => (walletMod ??= await import("./wallet.js"));

// ---------- ladder + match log (no wallet needed) ----------
async function renderBoard() {
  const [ladder, matches] = await Promise.all([loadLadder(), loadMatches()]);

  const ol = $("ladder");
  ol.innerHTML = ladder.length ? "" :
    `<li class="empty">Nobody on the ladder yet — declare first.</li>`;
  for (const p of ladder.slice(0, 20)) {
    const li = document.createElement("li");
    li.innerHTML = `<span class="who">${whoLink(p.address)}</span>
      <span class="num">${fmt(p.rating)}</span>
      <span class="rec">${p.wins}W–${p.matches - p.wins}L${p.matches === 0 ? " · self-declared" : ""}</span>`;
    ol.appendChild(li);
  }

  const ul = $("matches");
  const done = matches.filter((m) => m.finalized);
  ul.innerHTML = done.length ? "" :
    `<li class="empty">No matches on the record yet.</li>`;
  for (const m of done.slice(0, 10)) {
    ul.appendChild(matchRow(m));
  }
}

function matchRow(m, { mine = null } = {}) {
  const aWon = m.scoreA > m.scoreB;
  const [wTeam, wScore, lTeam, lScore] = aWon
    ? [m.teamA, m.scoreA, m.teamB, m.scoreB]
    : [m.teamB, m.scoreB, m.teamA, m.scoreA];
  const names = (t) => t.map(whoLink).join(" / ");
  const li = document.createElement("li");
  const sigs = `${m.confirmations.length}/${m.teamA.length + m.teamB.length} signed`;
  const tape = m.videoHash
    ? ` · <span class="tape" title="sha256 ${m.videoHash}">🎞 tape anchored</span>` : "";
  li.innerHTML = `
    <p class="scoreline">${names(wTeam)} <span class="score">${wScore}–${lScore}</span> ${names(lTeam)}</p>
    <p class="match-meta">#${m.id} · ${m.teamA.length === 1 ? "singles" : "doubles"}
      · ${m.venue} · ${fmtDate(m.proposedAt)}${m.finalized ? "" : ` · ${sigs}`}${tape}</p>`;
  if (mine && !m.finalized && !m.confirmations.includes(mine)) {
    const b = document.createElement("button");
    b.className = "ghost countersign";
    b.textContent = "Countersign this result";
    b.onclick = async () => {
      const w = await loadWallet();
      if (await w.confirmMatch(m.id, $("status"))) refresh();
    };
    li.appendChild(b);
  }
  return li;
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

// ---------- the desk ----------
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
    $("status").textContent = "Viewing a player card — connect your own wallet from the home page.";
  }
}

async function renderDesk(address, { viewOnly = false } = {}) {
  currentAddress = address;
  $("connect").hidden = true;
  $("welcome-back").hidden = true;
  $("desk").hidden = false;
  showProfileBar(address, viewOnly);

  const p = await playerOf(address);
  $("card").hidden = !p;
  if (p) {
    $("card-rating").textContent = fmt(p.rating);
    $("card-declared").textContent = fmt(p.declared);
    $("card-record").textContent = `${p.wins}W–${p.matches - p.wins}L · ${p.matches} matches`;
    const tier = $("card-tier");
    if (p.matches === 0) {
      tier.textContent = "self-declared";
      tier.className = "tier-badge self";
    } else {
      tier.textContent = `peer-verified · ${p.matches} countersigned`;
      tier.className = "tier-badge";
    }
  }

  // trajectory sparkline + form, replayed live from the match log
  $("card-spark").hidden = true;
  $("card-form-line").hidden = true;
  if (p && p.matches > 0) {
    trajectoryOf(address).then((t) => {
      if (!t || t.points.length < 2) return;
      $("card-spark").innerHTML = sparkline(t.points);
      $("card-spark").hidden = false;
      $("card-form").textContent = t.form.join(" ");
      $("card-form-line").hidden = false;
    });
  }

  // declare form: shown until the ladder owns your number
  const canDeclare = !viewOnly && (!p || p.matches === 0);
  $("declare-form").hidden = !canDeclare;
  $("report-form").hidden = viewOnly || !p;

  $("stamp-btn").hidden = viewOnly;
  renderBook(address);

  // pending signatures involving this player
  const all = await loadMatches(50);
  const pending = all.filter((m) =>
    !m.finalized && [...m.teamA, ...m.teamB].includes(address));
  const ul = $("pending");
  ul.innerHTML = pending.length ? "" :
    `<li class="empty">Nothing waiting on a signature.</li>`;
  for (const m of pending) {
    ul.appendChild(matchRow(m, { mine: viewOnly ? null : address }));
  }
}

const refresh = () => Promise.all([renderDesk(currentAddress), renderBoard()]);

// tiny inline SVG polyline — declared seed to current rating
function sparkline(points) {
  const w = 240, h = 44, pad = 5;
  const min = Math.min(...points), max = Math.max(...points);
  const span = Math.max(max - min, 50);
  const x = (i) => pad + (i * (w - 2 * pad)) / (points.length - 1);
  const y = (v) => h - pad - ((v - min) * (h - 2 * pad)) / span;
  const pts = points.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const last = points[points.length - 1];
  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="rating trajectory ${fmt(points[0])} to ${fmt(last)}">
    <polyline points="${pts}" fill="none" stroke="var(--court)" stroke-width="2" />
    <circle cx="${x(points.length - 1).toFixed(1)}" cy="${y(last).toFixed(1)}" r="3" fill="var(--court)" />
  </svg>
  <span class="spark-label">${fmt(points[0])} → ${fmt(last)} over ${points.length - 1} match${points.length === 2 ? "" : "es"}</span>`;
}

// ---------- the passport book ----------
async function renderBook(address) {
  const [courts, book] = await Promise.all([loadCourts(), bookOf(address)]);
  const ul = $("passport");
  ul.innerHTML = courts.length ? "" :
    `<li>No courts in the book yet.</li>`;
  for (const c of courts) {
    const pg = book.get(c.id);
    const li = document.createElement("li");
    li.className = pg ? "stamped" : "";
    li.innerHTML = pg
      ? `<span class="court-name">${c.name}</span>
         <span class="stamp-count">×${pg.count} stamped</span>
         <span class="stamp-date">since ${fmtDate(pg.firstAt)}</span>`
      : `<span class="court-name">${c.name}</span>
         <span class="stamp-count">unstamped</span>`;
    ul.appendChild(li);
  }
}

$("stamp-btn").addEventListener("click", () => {
  const status = $("status");
  if (!navigator.geolocation) {
    status.textContent = "This browser won't share a location.";
    return;
  }
  status.textContent = "Where are you? Asking the browser…";
  navigator.geolocation.getCurrentPosition(async (pos) => {
    status.textContent = "Checking the fence…";
    let j;
    try {
      const r = await fetch("/api/geostamp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          address: currentAddress,
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
        }),
      });
      j = await r.json();
      if (!r.ok) {
        status.textContent = j.nearest
          ? `Nearest court is ${j.nearest.name}, ${(j.nearest.distance_m / 1000).toFixed(1)} km away — go play first.`
          : (j.error || "The fence said no.");
        return;
      }
    } catch {
      status.textContent = "Couldn't reach the geoconfirm oracle.";
      return;
    }
    status.textContent = `At ${j.name} (${j.distance_m} m inside the fence) — sign to ink it.`;
    const w = await loadWallet();
    if (await w.stampCourt(j.venue, j.sig, status)) renderBook(currentAddress);
  }, () => {
    status.textContent = "Location denied — the passport needs to see the court.";
  }, { enableHighAccuracy: true, timeout: 12000 });
});

// ---------- forms ----------
(function initDeclare() {
  const sel = $("declare-rating");
  for (let r = 2000; r <= 8000; r += 250) {
    const o = document.createElement("option");
    o.value = r;
    o.textContent = fmt(r);
    if (r === 3500) o.selected = true;
    sel.appendChild(o);
  }
  $("declare-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const w = await loadWallet();
    if (await w.declare(Number(sel.value), $("status"))) refresh();
  });
})();

(function initReport() {
  const isDoubles = () =>
    document.querySelector('input[name="format"]:checked').value === "doubles";
  for (const r of document.querySelectorAll('input[name="format"]')) {
    r.addEventListener("change", () => {
      $("partner-field").hidden = !isDoubles();
      $("opp2-field").hidden = !isDoubles();
    });
  }
  $("venue").addEventListener("change", () => {
    $("venue-other-field").hidden = $("venue").value !== "__other";
  });
  $("report-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const status = $("status");
    const addr = (id) => $(id).value.trim();
    const teamA = [currentAddress];
    const teamB = [addr("opp1")];
    if (isDoubles()) { teamA.push(addr("partner")); teamB.push(addr("opp2")); }
    for (const a of [...teamA, ...teamB]) {
      if (!ADDR_RE.test(a)) { status.textContent = `Not a tz address: ${a || "(empty)"}`; return; }
    }
    const venue = $("venue").value === "__other"
      ? (addr("venue-other") || "elsewhere") : $("venue").value;
    let videoHash = null;
    const tape = $("tape").files[0];
    if (tape) {
      status.textContent = "Hashing the tape…";
      const digest = await crypto.subtle.digest("SHA-256", await tape.arrayBuffer());
      videoHash = [...new Uint8Array(digest)]
        .map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    const w = await loadWallet();
    const ok = await w.proposeMatch({
      teamA, teamB,
      scoreA: Number($("score-us").value),
      scoreB: Number($("score-them").value),
      venue, videoHash,
    }, status);
    if (ok) { $("report-form").reset(); $("partner-field").hidden = true; $("opp2-field").hidden = true; refresh(); }
  });
})();

// ---------- connect / boot ----------
async function connectFlow() {
  $("status").textContent = "Opening wallet…";
  const w = await loadWallet();
  try {
    const address = await w.connect();
    if (address) {
      localStorage.setItem(LAST_KEY, address);
      $("status").textContent = "";
      renderDesk(address);
    }
  } catch (e) {
    $("status").textContent = e?.message || "Connection cancelled.";
  }
}

$("connect").addEventListener("click", connectFlow);

$("disconnect").addEventListener("click", async () => {
  const w = await loadWallet();
  await w.disconnect();
  $("desk").hidden = true;
  $("connect").hidden = false;
  $("status").textContent = "Logged out.";
  renderWelcomeBack();
});

async function boot() {
  renderBoard();
  if (viewParam) {
    renderDesk(viewParam, { viewOnly: true });
    return;
  }
  renderWelcomeBack();
  // Resume an existing Beacon session (only pay the wallet download if
  // there is a session to resume — localStorage remembers that for us).
  if (localStorage.getItem(LAST_KEY)) {
    const w = await loadWallet();
    const account = await w.getActiveAccount();
    if (account) renderDesk(account.address);
  }
}

boot();
