// tez-cast — a personal page for any Tezos wallet, and the tower it casts
// from. Routes: "/" = the wire (global feed) · "/?a=tz1…" = personal page.
// All reads are indexer JSON (tz.js); the wallet stack loads only to cast.
import {
  getAccount, getBalanceHistory, getActivity, getTokens,
  getCasts, getCastCount, getStamps, getNouns, getPostcards,
  POSTCARD_BGS, INDEXER,
} from "./tz.js";

const app = document.getElementById("app");
const LAST_KEY = "tezcast:last-address";
let walletMod = null;
const loadWallet = async () => (walletMod ??= await import("./wallet.js"));
let me = null; // connected address, if any

// ---- tiny helpers ----
const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const short = (a) => `${a.slice(0, 7)}…${a.slice(-4)}`;
const fmt = (n, d = 2) => Number(n).toLocaleString("en-US", { maximumFractionDigits: d });
const ago = (t) => {
  const s = (Date.now() - new Date(t).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${(s / 60) | 0}m ago`;
  if (s < 86400) return `${(s / 3600) | 0}h ago`;
  if (s < 86400 * 30) return `${(s / 86400) | 0}d ago`;
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};
const isTz = (s) => /^(tz[1-4]|KT1)[1-9A-HJ-NP-Za-km-z]{33}$/.test(s);
const pageURL = (a) => `?a=${a}`;

const KINDS = ["note", "link", "art"];
const castBody = (c) => {
  const b = c.body;
  if (c.kind === 1 && /^https?:\/\/\S+$/.test(b))
    return `<a href="${esc(b)}" target="_blank" rel="noopener">${esc(b)}</a>`;
  if (c.kind === 2 && /^data:image\/(svg\+xml|png|jpeg|gif|webp)[;,]/.test(b))
    return `<img src="${esc(b)}" alt="cast art" loading="lazy" />`;
  return esc(b);
};

const castItem = (c, { withAuthor = true } = {}) => `
  <div class="cast-item">
    <div class="meta">
      <span class="tag ${KINDS[c.kind] || "note"}">${KINDS[c.kind] || "note"}</span>
      ${withAuthor ? `<a href="${pageURL(c.author)}">${short(c.author)}</a>` : ""}
      <span>${ago(c.at)}</span>
      <span class="id">№ ${c.id}</span>
    </div>
    <div class="body">${castBody(c)}</div>
  </div>`;

const avatarFor = (addr, nouns) =>
  nouns?.length ? nouns[0].svg
    : `<img src="https://noun-api.com/beta/pfp?name=${addr}&size=320" alt="" loading="lazy" />`;

// ---- nav ----
const navHTML = () => `
  <nav>
    <a class="wordmark" href="./"><span class="antenna">📡</span> TEZ—CAST</a>
    <div class="nav-actions">
      ${me ? `
        <a class="addr-chip" href="${pageURL(me)}" title="my page">${short(me)}</a>
        <button class="btn-ghost" id="disconnect">sign off</button>
      ` : `<button class="btn-primary" id="connect">connect</button>`}
    </div>
  </nav>`;

function wireNav() {
  document.getElementById("connect")?.addEventListener("click", async () => {
    const w = await loadWallet();
    const addr = await w.connect();
    if (addr) {
      me = addr;
      localStorage.setItem(LAST_KEY, addr);
      location.href = pageURL(addr);
    }
  });
  document.getElementById("disconnect")?.addEventListener("click", async () => {
    const w = await loadWallet();
    await w.disconnect();
    localStorage.removeItem(LAST_KEY);
    me = null;
    route();
  });
}

// ---- charts ----
function sparklineSVG(hist) {
  if (hist.length < 2) return "";
  const vs = hist.map((h) => h.v);
  const min = Math.min(...vs), max = Math.max(...vs);
  const span = max - min || 1;
  const W = 640, H = 120, P = 6;
  const pts = hist.map((h, i) => {
    const x = P + (i / (hist.length - 1)) * (W - 2 * P);
    const y = H - P - ((h.v - min) / span) * (H - 2 * P);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const [lx, ly] = pts[pts.length - 1].split(",");
  return `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="balance history">
      <defs>
        <linearGradient id="fillg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="rgba(0,229,255,0.25)"/>
          <stop offset="100%" stop-color="rgba(0,229,255,0)"/>
        </linearGradient>
      </defs>
      <polygon points="${P},${H - P} ${pts.join(" ")} ${W - P},${H - P}" fill="url(#fillg)"/>
      <polyline points="${pts.join(" ")}" fill="none" stroke="#00e5ff" stroke-width="2"
        style="filter: drop-shadow(0 0 6px rgba(0,229,255,0.6))"/>
      <circle cx="${lx}" cy="${ly}" r="4" fill="#ffd700"/>
    </svg>`;
}

const heatHTML = (buckets) => {
  const max = Math.max(...buckets, 1);
  return `<div class="heat">${buckets.map((n) =>
    `<div class="day ${n >= max * 0.7 && n > 0 ? "hot" : ""}" style="height:${Math.max(3, (n / max) * 100)}%" title="${n} ops"></div>`
  ).join("")}</div>`;
};

// ---- views ----
async function renderWire() {
  document.title = "tez-cast — your wallet, broadcasting";
  app.innerHTML = navHTML() + `<div class="loading">TUNING THE WIRE</div>`;
  wireNav();

  const casts = await getCasts({ limit: 30 });
  const authors = [...new Set(casts.map((c) => c.author))].slice(0, 8);

  app.innerHTML = navHTML() + `
    <div class="hero">
      <h1>Your wallet,<br/>broadcasting.</h1>
      <div class="tagline">PERSONAL PAGES · ON-CHAIN · FOREVER</div>
      <p class="lede">Every Tezos address is already a story — balance, activity,
      stamps, nouns. tez-cast gives it a page and a transmitter. Cast something;
      it can never be taken down.</p>
      <div class="lookup">
        <input id="lookup" placeholder="tz1… paste any address" spellcheck="false"/>
        <button class="btn-ghost" id="go">view</button>
      </div>
    </div>

    ${authors.length ? `
    <section>
      <div class="section-title">Broadcasters <span class="sub">ON THE AIR</span></div>
      <div class="broadcasters">${authors.map((a) => `
        <a class="broadcaster" href="${pageURL(a)}">
          <img src="https://noun-api.com/beta/pfp?name=${a}&size=72" alt=""/>
          <div><div class="who">${short(a)}</div>
          <div class="n">${casts.filter((c) => c.author === a).length} recent</div></div>
        </a>`).join("")}
      </div>
    </section>` : ""}

    <section>
      <div class="section-title">The Wire <span class="sub">LATEST CASTS, ALL TOWERS</span></div>
      ${casts.length ? casts.map((c) => castItem(c)).join("")
        : `<div class="empty">dead air — be the first to cast</div>`}
    </section>

    <div class="signature">Michael Hoydich — El Segundo, 2026</div>
    <span class="location-tag">33.9192 N / 118.4165 W — EL SEGUNDO, CA</span>`;

  wireNav();
  const input = document.getElementById("lookup");
  const go = () => { const v = input.value.trim(); if (isTz(v)) location.href = pageURL(v); };
  document.getElementById("go").addEventListener("click", go);
  input.addEventListener("keydown", (e) => e.key === "Enter" && go());
}

async function renderPage(addr) {
  document.title = `${short(addr)} — tez-cast`;
  app.innerHTML = navHTML() + `<div class="loading">RAISING THE ANTENNA</div>`;
  wireNav();

  const acct = await getAccount(addr);
  if (!acct) {
    app.innerHTML = navHTML() + `<div class="empty" style="margin-top:60px">no signal at ${esc(addr)}</div>`;
    wireNav();
    return;
  }

  const [hist, activity, casts, castCount, stamps, nouns, postcards, tokens] =
    await Promise.all([
      getBalanceHistory(addr, acct), getActivity(addr),
      getCasts({ author: addr, limit: 50 }), getCastCount(addr),
      getStamps(addr), getNouns(addr), getPostcards(addr), getTokens(addr),
    ]);

  const mine = me === addr;
  const vitals = [
    { num: `${fmt(acct.balance)}<small> ꜩ</small>`, label: "balance", accent: "var(--neon-gold)" },
    { num: fmt(acct.ops, 0), label: "operations", accent: "var(--neon-cyan)" },
    { num: String(stamps.length), label: "stamps", accent: "var(--neon-orange)" },
    { num: fmt(castCount, 0), label: "casts", accent: "var(--neon-pink)" },
  ];

  app.innerHTML = navHTML() + `
    <div class="identity">
      <div class="avatar">${avatarFor(addr, nouns)}</div>
      <div>
        <h1>${acct.alias ? `<span class="alias">${esc(acct.alias)}</span>` : short(addr)}</h1>
        <div class="tz" id="copy-addr" title="copy">${addr}</div>
        <div class="since">${acct.firstSeen
          ? `ON CHAIN SINCE ${new Date(acct.firstSeen).toLocaleDateString("en-US", { month: "long", year: "numeric" }).toUpperCase()}`
          : (stamps.length || nouns.length || postcards.length)
            ? "PURE PASSPORT — IDENTITY WITHOUT A SINGLE OP"
            : "NOT YET SEEN ON CHAIN"}</div>
      </div>
    </div>

    <section class="vitals">
      ${vitals.map((v) => `
        <div class="vital" style="--accent:${v.accent}">
          <div class="num">${v.num}</div>
          <div class="label">${v.label}</div>
        </div>`).join("")}
    </section>

    ${hist.length > 1 ? `
    <section>
      <div class="section-title">Balance <span class="sub">LIFETIME</span></div>
      <div class="chart-card">
        ${sparklineSVG(hist)}
        <div class="chart-meta">
          <span>${new Date(hist[0].t).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span>
          <span>peak ${fmt(Math.max(...hist.map((h) => h.v)))} ꜩ</span>
          <span>now</span>
        </div>
      </div>
    </section>` : ""}

    ${activity.some((n) => n > 0) ? `
    <section>
      <div class="section-title">Pulse <span class="sub">OPS · LAST 8 WEEKS</span></div>
      <div class="chart-card">${heatHTML(activity)}</div>
    </section>` : ""}

    <section>
      <div class="section-title">Casts <span class="sub">${castCount} EVER</span></div>
      ${mine ? `
      <div class="composer">
        <textarea id="cast-body" maxlength="280" placeholder="say something permanent…"></textarea>
        <div class="row">
          <div class="kinds">
            ${KINDS.map((k, i) => `<span class="kind ${i === 0 ? "on" : ""}" data-kind="${i}">${k}</span>`).join("")}
          </div>
          <span class="count"><span id="chars">0</span>/280</span>
          <button class="btn-primary" id="cast-send">cast 📡</button>
        </div>
        <div class="status" id="cast-status"></div>
      </div><br/>` : ""}
      ${casts.length ? casts.map((c) => castItem(c, { withAuthor: false })).join("")
        : `<div class="empty">${mine ? "your tower is silent — cast the first" : "this tower is silent"}</div>`}
    </section>

    ${stamps.length ? `
    <section>
      <div class="section-title">Stamps <span class="sub">SOULBOUND · <a href="https://stampz.xyz" style="color:inherit">STAMPZ.XYZ</a></span></div>
      <div class="shelf">${stamps.map((s) => `
        <div class="piece">
          ${s.thumb ? `<img src="${esc(s.thumb)}" alt=""/>` : ""}
          <div class="name">${esc(s.name)}</div>
        </div>`).join("")}
      </div>
    </section>` : ""}

    ${nouns.length ? `
    <section>
      <div class="section-title">Nouns <span class="sub">ON-CHAIN ART</span></div>
      <div class="shelf">${nouns.map((n) => `
        <div class="piece">${n.svg}<div class="name">Tez Noun ${n.id}</div></div>`).join("")}
      </div>
    </section>` : ""}

    ${postcards.length ? `
    <section>
      <div class="section-title">Postcards <span class="sub">RECEIVED</span></div>
      ${postcards.map((p) => `
        <div class="postcard" style="background:${POSTCARD_BGS[p.background]?.css || POSTCARD_BGS[5].css}">
          <div class="stamp-art">${p.svg}</div>
          <div>
            <div class="note">"${esc(p.note)}"</div>
            <div class="from">from <a href="${pageURL(p.from)}" style="color:inherit">${short(p.from)}</a> · ${ago(p.at)}</div>
          </div>
        </div>`).join("")}
    </section>` : ""}

    ${tokens.length ? `
    <section>
      <div class="section-title">Holdings <span class="sub">TOKENS</span></div>
      <div class="holdings">${tokens.map((t) =>
        `<span class="holding"><b>${fmt(t.amount, 4)}</b> ${esc(t.name)}</span>`).join("")}
      </div>
    </section>` : ""}

    <div class="signature">Michael Hoydich — El Segundo, 2026</div>
    <span class="location-tag">33.9192 N / 118.4165 W — EL SEGUNDO, CA</span>`;

  wireNav();
  document.getElementById("copy-addr")?.addEventListener("click", () =>
    navigator.clipboard?.writeText(addr));

  if (mine) {
    let kind = 0;
    const body = document.getElementById("cast-body");
    const chars = document.getElementById("chars");
    body.addEventListener("input", () => (chars.textContent = body.value.length));
    document.querySelectorAll(".kind").forEach((el) =>
      el.addEventListener("click", () => {
        kind = Number(el.dataset.kind);
        document.querySelectorAll(".kind").forEach((k) => k.classList.toggle("on", k === el));
      }));
    document.getElementById("cast-send").addEventListener("click", async () => {
      const text = body.value.trim();
      if (!text) return;
      const w = await loadWallet();
      const ok = await w.publishCast({ kind, body: text }, document.getElementById("cast-status"));
      if (ok) setTimeout(() => renderPage(addr), 1200);
    });
  }
}

// ---- router ----
async function route() {
  const addr = new URLSearchParams(location.search).get("a");
  if (addr && isTz(addr)) await renderPage(addr);
  else await renderWire();
}

// Resume a Beacon session only if one exists (localStorage remembers) —
// otherwise the wallet stack never loads.
(async () => {
  if (localStorage.getItem(LAST_KEY)) {
    try {
      const w = await loadWallet();
      me = (await w.getActiveAccount())?.address || null;
      if (!me) localStorage.removeItem(LAST_KEY);
    } catch { /* read-only is fine */ }
  }
  route();
})();
