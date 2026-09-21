// Builds public/paddle-calendar/index.html from public/paddle-calendar/data.json.
// The page is a single static file like /tonight/ and /paddle-fund/: the
// ledger is pre-rendered so it reads without JavaScript, and the inline
// script only filters rows. data.json is the same dataset pointcast.xyz
// serves at /paddle-calendar.json — edit the data, then run:
//   node scripts/build-paddle-calendar.mjs

import { readFileSync, writeFileSync } from "node:fs";

const dir = new URL("../public/paddle-calendar/", import.meta.url);
const data = JSON.parse(readFileSync(new URL("data.json", dir), "utf8"));
const { meta, releases, anchors, ahead, signals, forecasts, trends, grit, moves, companies, undated, method } = data;

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const host = (url) => new URL(url).hostname.replace(/^www\./, "");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
// Validated with the dataviz palette checker on a white card.
const BUILDS = {
  foam: { label: "Full foam (Gen 4)", short: "FOAM", color: "#1e7a52" },
  hybrid: { label: "Honeycomb + foam (Gen 3)", short: "GEN 3", color: "#0f61ff" },
  poly: { label: "Polymer honeycomb", short: "POLY", color: "#b8482e" },
  rib: { label: "Carbon rib", short: "RIB", color: "#7a3fa0" },
  unknown: { label: "Not stated", short: "N/S", color: "#8a8883" },
};
const FUND_CAP = 200;
const price = (r) => r.msrpLabel || (r.msrp == null ? "price n/a" : `$${Number.isInteger(r.msrp) ? r.msrp : r.msrp.toFixed(2)}`);
const tier = (m) => (m == null ? "none" : m <= 120 ? "floor" : m < 230 ? "middle" : "top");
const chip = (r) => r.short;
const shortDate = (iso) => `${MONTHS[+iso.slice(5, 7) - 1]} ${+iso.slice(8, 10)}`;
const KIND = { rule: "rule", legal: "legal", deal: "money", event: "tour", market: "market", release: "drop" };
const BASIS = { rule: "rests on a rule", pattern: "rests on a pattern", inference: "inference", legal: "rests on a case", open: "open question" };
const src = (url) => `<a href="${esc(url)}" rel="noopener">${esc(host(url))} ↗</a>`;

const priced = releases.filter((r) => r.msrp != null).map((r) => r.msrp).sort((a, b) => a - b);
const S = {
  releases: releases.length,
  brands: new Set(releases.map((r) => r.brand)).size,
  foam: releases.filter((r) => r.build === "foam").length,
  median: priced[Math.floor(priced.length / 2)],
  underCap: releases.filter((r) => r.msrp != null && r.msrp <= FUND_CAP).length,
};
const builds = Object.keys(BUILDS).filter((b) => releases.some((r) => r.build === b));
const brands = [...new Set(releases.map((r) => r.brand))].sort((a, b) => a.localeCompare(b));
const legend = (key) => `<ul class="legend" aria-label="Build type">${builds.map((b) => `<li><i style="background:${BUILDS[b].color}"></i>${esc(BUILDS[b][key])}</li>`).join("")}</ul>`;

// ── the year at a glance ────────────────────────────────────────────
const busiest = Math.max(...MONTHS.map((_, i) => releases.filter((r) => +r.date.slice(5, 7) === i + 1 && r.date.startsWith("2026")).length));
const yearHtml = MONTHS.map((m, i) => {
  const key = `2026-${String(i + 1).padStart(2, "0")}`;
  const rs = releases.filter((r) => r.date.startsWith(key));
  const ws = anchors.filter((a) => a.date.startsWith(key));
  const as = ahead.filter((a) => a.date.startsWith(key) && a.kind !== "release");
  return `<div class="mo${key === meta.asOf.slice(0, 7) ? " mo-now" : ""}">
    <div class="mo-name"><b>${m}</b><span class="mo-bar" aria-hidden="true"><i style="width:${(rs.length / busiest) * 100}%"></i></span><small>${rs.length || "·"}</small></div>
    <div class="mo-chips">${rs.map((r) => `<a class="chip${r.status === "upcoming" ? " chip-soon" : ""}" href="#${r.id}" style="--b:${BUILDS[r.build].color}" title="${esc(r.dateLabel)} · ${esc(price(r))}">${esc(chip(r))}</a>`).join("")}${ws.map((a) => `<span class="chip chip-wire">${KIND[a.kind]} · ${esc(a.title)}</span>`).join("")}${as.map((a) => `<span class="chip chip-ahead">${esc(a.dateLabel)} · ${esc(a.title)}</span>`).join("")}</div>
  </div>`;
}).join("\n");

// ── the price ladder ────────────────────────────────────────────────
const W = 1000, H = 380, L = 56, R = 18, T = 20, B = 40;
const t0 = Date.UTC(2026, 0, 1), t1 = Date.UTC(2026, 11, 31);
const x = (iso) => (L + ((Date.parse(`${iso}T00:00:00Z`) - t0) / (t1 - t0)) * (W - L - R)).toFixed(1);
const yMin = 60, yMax = 350;
const y = (usd) => (T + (1 - (usd - yMin) / (yMax - yMin)) * (H - T - B)).toFixed(1);
const dots = releases.filter((r) => r.msrp != null);
const labelled = new Set(["joola-rally-rocket", "spartus-spitfire", "joola-power-fx", "selkirk-omni"]);
const ladderSvg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Scatter of ${dots.length} paddle releases by launch date and list price, from $99 to $329.95.">
  <rect x="${L}" y="${y(FUND_CAP)}" width="${W - L - R}" height="${(y(yMin) - y(FUND_CAP)).toFixed(1)}" class="l-fund"/>
  ${[100, 200, 300].map((usd) => `<line x1="${L}" x2="${W - R}" y1="${y(usd)}" y2="${y(usd)}" class="l-grid"/><text x="${L - 10}" y="${+y(usd) + 4}" text-anchor="end" class="l-tick">$${usd}</text>`).join("")}
  ${MONTHS.map((m, i) => `<text x="${x(`2026-${String(i + 1).padStart(2, "0")}-15`)}" y="${H - 14}" text-anchor="middle" class="l-tick">${m}</text>`).join("")}
  <line x1="${x(meta.asOf)}" x2="${x(meta.asOf)}" y1="${T}" y2="${H - B}" class="l-now"/><text x="${+x(meta.asOf) + 6}" y="${T + 10}" class="l-tick">today</text>
  <text x="${L + 8}" y="${+y(yMin) - 8}" class="l-tick">shaded: under the Paddle Fund's $200</text>
  ${dots.map((r) => { const c = BUILDS[r.build].color, soon = r.status === "upcoming"; return `<a href="#${r.id}" class="dot" data-tip="${esc(`${r.brand} ${r.model}|${price(r)} · ${r.dateLabel}|${BUILDS[r.build].label}`)}"><circle cx="${x(r.date)}" cy="${y(r.msrp)}" r="16" fill="transparent"/><circle cx="${x(r.date)}" cy="${y(r.msrp)}" r="6.5" fill="${soon ? "#fff" : c}" stroke="${soon ? c : "#fff"}" stroke-width="2"/></a>`; }).join("")}
  ${dots.filter((r) => labelled.has(r.id)).map((r) => `<text x="${+x(r.date) + 11}" y="${+y(r.msrp) + 4}" class="l-label">${esc(chip(r))} ${esc(price(r).split(" ")[0])}</text>`).join("")}
</svg>`;

// ── the ledger ──────────────────────────────────────────────────────
const certs = (r) => [
  r.usap === "yes" && "USAP ✓", r.usap === "no" && "not USAP · tour only", r.usap === "split" && "USAP: 16mm only", r.usap === "pending" && "USAP pending",
  r.upaa === "yes" && "UPA-A ✓", r.upaa === "split" && "UPA-A: pro version", r.upaa === "pending" && "UPA-A pending",
].filter(Boolean);
const rows = [...releases.map((r) => ({ date: r.date, r })), ...anchors.map((a) => ({ date: a.date, a }))].sort((p, q) => p.date.localeCompare(q.date));
const keyOf = (d) => (d < "2026-01-01" ? "before" : d.slice(0, 7));
const ledgerHtml = [...new Set(rows.map((row) => keyOf(row.date)))].map((key) => {
  const mine = rows.filter((row) => keyOf(row.date) === key);
  const label = key === "before" ? "Before the year" : `${MONTH_NAMES[+key.slice(5) - 1]} ${key.slice(0, 4)}`;
  return `<div class="month" data-month>
  <h2 class="month-name">${label}<small data-month-count>${mine.filter((row) => row.r).length || ""}</small></h2>
  ${mine.map(({ r, a }) => a ? `<article class="wire" data-wire>
    <p class="when">${key === "before" ? `${shortDate(a.date)}, ${a.date.slice(0, 4)}` : shortDate(a.date)}<b>${KIND[a.kind]}</b></p>
    <div><h3>${esc(a.title)}</h3><p>${esc(a.body)} ${src(a.source)}</p></div>
  </article>` : `<article class="rel${r.status === "upcoming" ? " rel-soon" : ""}" id="${r.id}" data-release data-brand="${esc(r.brand)}" data-build="${r.build}" data-tier="${tier(r.msrp)}" data-fund="${r.msrp != null && r.msrp <= FUND_CAP ? 1 : 0}" style="--b:${BUILDS[r.build].color}">
    <p class="when">${esc(r.dateLabel)}<b class="usd">${esc(price(r))}</b></p>
    <div>
      <h3><span>${esc(r.brand)}</span> ${esc(r.model)}</h3>
      <p class="meta">${esc([r.thickness, r.shapes, r.pro && `Pro: ${r.pro}`].filter(Boolean).join("  ·  "))}</p>
      <p class="take">${esc(r.take)}</p>
      <p class="tech"><b>Build.</b> ${esc(r.tech)}${r.specs ? ` <b>Measured.</b> ${esc(r.specs)}.` : ""}${r.certNote ? ` <b>Cert.</b> ${esc(r.certNote)}` : ""}</p>
      <p class="tags"><span class="tag tag-build">${BUILDS[r.build].short}</span>${r.status === "upcoming" ? '<span class="tag tag-soon">not out yet</span>' : ""}${r.status === "limited" ? '<span class="tag">limited run</span>' : ""}${certs(r).map((c) => `<span class="tag">${esc(c)}</span>`).join("")}<span class="tag tag-conf tag-${r.confidence}">${r.confidence} confidence · date to the ${r.precision}</span>${r.sources.map(src).join("")}</p>
    </div>
  </article>`).join("\n  ")}
</div>`;
}).join("\n");

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>The 2026 Paddle Calendar — every release, dated and sourced · Rally</title>
  <meta name="description" content="Every pickleball paddle release of 2026 on one calendar: ${S.releases} launches from ${S.brands} brands, dated, priced and sourced, with the rules and lawsuits between them, company files, and a labeled forecast through spring 2027." />
  <meta property="og:title" content="The 2026 Paddle Calendar" />
  <meta property="og:description" content="${S.releases} paddle launches, ${S.brands} brands, every date sourced. Plus what is coming next and why." />
  <meta name="twitter:card" content="summary" />
  <link rel="canonical" href="https://tez-rally.pages.dev/paddle-calendar/" />
  <link rel="alternate" type="application/json" href="./data.json" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&display=swap" rel="stylesheet" />
  <style>
    /* Same passport-office family as the Rally front desk. */
    :root {
      --paper: #f2efe9; --ink: #241f1c; --court: #1e7a52; --tezos-blue: #0f61ff;
      --line: #d8d2c6; --muted: #6b6259; --ball: #e9d94a; --clay: #b8482e; --wash: #eef5f0;
      --mono: ui-monospace, "SF Mono", Menlo, monospace;
      --display: "Cormorant Garamond", Georgia, serif;
    }
    @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
    * { box-sizing: border-box; }
    [hidden] { display: none !important; }
    html { scroll-behavior: smooth; }
    body { margin: 0; min-height: 100dvh; background: var(--paper); color: var(--ink);
      font-family: Georgia, "Times New Roman", serif; line-height: 1.5;
      background-image: radial-gradient(var(--line) 1px, transparent 1px); background-size: 28px 28px; padding: 2rem 0; }
    a { color: var(--court); }
    .office { width: min(1120px, 94vw); margin: 0 auto; background: #fff; border: 1.5px solid var(--ink);
      padding: 1.2rem 1.2rem 2.5rem; box-shadow: 10px 10px 0 var(--court); }
    .site-nav { display: flex; align-items: center; justify-content: space-between; gap: 1rem;
      border-bottom: 1.5px solid var(--ink); padding-bottom: 0.8rem; flex-wrap: wrap; }
    .nav-mark { font-family: var(--display); font-weight: 700; font-size: 1.9rem; line-height: 1; color: var(--ink);
      text-decoration: none; text-transform: lowercase; }
    .site-nav nav { display: flex; gap: 0.5rem 1.1rem; flex-wrap: wrap; }
    .site-nav nav a { font-family: var(--mono); font-size: 0.72rem; letter-spacing: 0.12em; text-transform: uppercase;
      color: var(--ink); text-decoration: none; }
    .site-nav nav a:hover { color: var(--court); text-decoration: underline; }
    .eyebrow { font-family: var(--mono); font-size: 0.72rem; letter-spacing: 0.18em; text-transform: uppercase;
      color: var(--court); margin: 0 0 0.8rem; }
    h1 { font-family: var(--display); font-weight: 600; font-size: clamp(2.8rem, 8vw, 5.4rem); line-height: 0.92;
      letter-spacing: -0.015em; margin: 0 0 1rem; text-wrap: balance; }
    h1 em, h2 em { font-style: italic; color: var(--court); }
    h2.sec-title { font-family: var(--display); font-weight: 600; font-size: clamp(1.7rem, 4vw, 2.4rem); line-height: 1; margin: 0 0 0.9rem; }
    .hero { padding: 2.6rem 0 1.2rem; max-width: 860px; }
    .deck { font-size: 1.12rem; margin: 0; max-width: 64ch; }
    section { padding-top: 2.8rem; scroll-margin-top: 0.5rem; }
    .sec-head { display: flex; justify-content: space-between; align-items: baseline; gap: 1rem; flex-wrap: wrap; }
    .note { max-width: 66ch; color: var(--muted); font-size: 0.95rem; margin: 0.9rem 0 0; }

    .math { display: grid; grid-template-columns: repeat(4, 1fr); border: 1.5px solid var(--ink); margin: 1.4rem 0 0; }
    .math div { padding: 1rem 1.1rem; border-right: 1.5px solid var(--ink); }
    .math div:last-child { border-right: 0; background: var(--ball); }
    .math b { display: block; font-family: var(--display); font-size: clamp(1.6rem, 4vw, 2.3rem); line-height: 1; font-weight: 700; font-variant-numeric: lining-nums tabular-nums; }
    .math span { font-family: var(--mono); font-size: 0.68rem; letter-spacing: 0.08em; text-transform: uppercase; }

    .legend { display: flex; flex-wrap: wrap; gap: 0.2rem 0.9rem; margin: 0 0 0.8rem; padding: 0; list-style: none;
      font-family: var(--mono); font-size: 0.66rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
    .legend i { display: inline-block; width: 9px; height: 9px; margin-right: 6px; }

    .year { border-top: 1.5px solid var(--ink); }
    .mo { display: grid; grid-template-columns: 128px 1fr; gap: 0.9rem; padding: 0.55rem 0; border-bottom: 1px solid var(--line); align-items: start; }
    .mo-now { background: var(--wash); }
    .mo-name { display: grid; grid-template-columns: 34px 1fr 16px; gap: 8px; align-items: center; padding: 4px 0 0 6px;
      font-family: var(--mono); font-size: 0.72rem; letter-spacing: 0.1em; text-transform: uppercase; }
    .mo-bar { height: 4px; background: var(--line); } .mo-bar i { display: block; height: 100%; background: var(--court); }
    .mo-name small { color: var(--muted); text-align: right; }
    .mo-chips { display: flex; flex-wrap: wrap; gap: 5px; }
    .chip { display: inline-block; padding: 3px 8px 3px 7px; border: 1px solid var(--line); border-left: 4px solid var(--b, var(--line));
      font-size: 0.8rem; line-height: 1.3; color: var(--ink); background: #fff; text-decoration: none; }
    a.chip:hover { background: var(--wash); }
    .chip-soon { border-style: dashed; border-left-style: solid; }
    .chip-wire { border: 0; padding: 4px 2px; font-family: var(--mono); font-size: 0.64rem; color: var(--muted); background: none; }
    .chip-ahead { border: 1px dashed var(--line); font-family: var(--mono); font-size: 0.68rem; color: var(--muted); background: none; }

    .ladder { position: relative; margin: 0; border: 1.5px solid var(--ink); padding: 8px 4px 0; }
    .ladder svg { display: block; width: 100%; height: auto; }
    .l-grid { stroke: var(--line); stroke-width: 1; } .l-now { stroke: var(--muted); stroke-width: 1; stroke-dasharray: 3 4; }
    .l-fund { fill: #fbf7d4; } .l-tick { font: 11px var(--mono); fill: var(--muted); } .l-label { font: 600 13px Georgia, serif; fill: var(--ink); }
    .dot:focus { outline: none; } .dot:hover circle:last-child, .dot:focus circle:last-child { stroke: var(--ink); }
    .ladder figcaption { padding: 0.7rem 0.8rem 0.8rem; border-top: 1px solid var(--line); font-size: 0.88rem; color: var(--muted); }
    .tip { position: absolute; transform: translate(-50%, calc(-100% - 6px)); min-width: 150px; max-width: 230px; padding: 8px 10px;
      background: var(--ink); color: #fff; pointer-events: none; z-index: 2; font-size: 0.8rem; line-height: 1.3; }
    .tip strong { display: block; } .tip span, .tip small { display: block; margin-top: 3px; font-family: var(--mono); font-size: 0.68rem; }
    .tip small { opacity: 0.7; text-transform: uppercase; letter-spacing: 0.06em; }

    .filters { position: sticky; top: 0; z-index: 3; display: flex; flex-wrap: wrap; gap: 0.6rem 1rem; align-items: end;
      padding: 0.7rem 0.8rem; margin: 0 0 0.4rem; border: 1.5px solid var(--ink); background: var(--ink); color: #fff; }
    .filters label { display: grid; gap: 4px; font-family: var(--mono); font-size: 0.64rem; letter-spacing: 0.12em; text-transform: uppercase; }
    .filters select { min-width: 150px; padding: 0.4rem 0.5rem; border: 1px solid #fff; border-radius: 0; background: #fff;
      font: 0.9rem Georgia, serif; color: var(--ink); }
    .filters .check { display: flex; align-items: center; gap: 7px; padding-bottom: 0.5rem; }
    .filters input { accent-color: var(--ball); width: 15px; height: 15px; margin: 0; }
    .filters output { margin-left: auto; padding-bottom: 0.45rem; font-family: var(--mono); font-size: 0.72rem; letter-spacing: 0.1em;
      text-transform: uppercase; color: var(--ball); font-variant-numeric: tabular-nums; }

    .month-name { display: flex; align-items: baseline; gap: 0.6rem; margin: 2.2rem 0 0; padding-bottom: 0.45rem;
      border-bottom: 1.5px solid var(--ink); font-family: var(--display); font-weight: 600; font-size: 1.9rem; line-height: 1; }
    .month-name small { font-family: var(--mono); font-size: 0.7rem; font-weight: 400; color: var(--muted); }
    .rel, .wire { display: grid; grid-template-columns: 170px 1fr; gap: 1.1rem; padding: 1.1rem 0; border-bottom: 1px solid var(--line); scroll-margin-top: 6rem; }
    .rel { border-left: 4px solid var(--b); padding-left: 0.9rem; }
    .rel-soon { background: repeating-linear-gradient(135deg, transparent 0 10px, var(--wash) 10px 11px); }
    .rel:target { background: #fbf7d4; }
    .when { margin: 3px 0 0; font-family: var(--mono); font-size: 0.68rem; line-height: 1.5; letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted); }
    .when b { display: block; margin-top: 4px; letter-spacing: 0.14em; color: var(--court); }
    .when b.usd { margin-top: 6px; font-family: var(--display); font-size: 1.5rem; line-height: 1; font-weight: 700; letter-spacing: 0;
      text-transform: none; color: var(--ink); font-variant-numeric: lining-nums tabular-nums; }
    .rel h3 { margin: 0; font-family: var(--display); font-weight: 600; font-size: 1.6rem; line-height: 1.05; }
    .rel h3 span { color: var(--muted); }
    .meta { margin: 0.3rem 0 0; font-family: var(--mono); font-size: 0.72rem; color: var(--muted); white-space: pre-wrap; }
    .take { margin: 0.6rem 0 0; max-width: 68ch; font-size: 1.02rem; }
    .tech { margin: 0.45rem 0 0; max-width: 72ch; font-size: 0.9rem; color: #4a433d; }
    .tags { display: flex; flex-wrap: wrap; gap: 6px 8px; align-items: center; margin: 0.7rem 0 0; font-family: var(--mono); font-size: 0.64rem;
      letter-spacing: 0.06em; text-transform: uppercase; }
    .tag { padding: 3px 6px; border: 1px solid var(--line); color: #4a433d; }
    .tag-build { border-color: var(--b); background: var(--b); color: #fff; }
    .tag-soon { border-color: var(--ink); color: var(--ink); } .tag-conf { border-style: dashed; } .tag-low { color: var(--clay); border-color: var(--clay); }
    .tags a { text-transform: none; letter-spacing: 0; }
    .wire { padding: 0.75rem 0 0.75rem 1.1rem; background: #faf8f3; }
    .wire h3 { margin: 0; font-size: 1rem; font-weight: 700; line-height: 1.3; }
    .wire div p { margin: 0.25rem 0 0; max-width: 72ch; font-size: 0.9rem; color: #4a433d; }
    .wire a, .trend a, .grit a { white-space: nowrap; }
    .empty { padding: 2rem 0; color: var(--muted); }

    .rows { border-top: 1.5px solid var(--ink); }
    .row { display: grid; grid-template-columns: 300px 1fr; gap: 1rem; align-items: baseline; padding: 0.75rem 0; border-bottom: 1px solid var(--line);
      color: var(--ink); text-decoration: none; }
    a.row:hover { background: var(--wash); }
    .row strong { font-size: 0.98rem; } .row span { font-size: 0.92rem; color: #4a433d; } .row em { font-style: normal; font-weight: 700; color: var(--ink); }
    .road-row { display: grid; grid-template-columns: 170px 64px 1fr; gap: 0.9rem; align-items: baseline; padding: 0.65rem 0;
      border-bottom: 1px solid var(--line); font-size: 0.94rem; color: #4a433d; }
    .road-row strong { color: var(--ink); }
    .road-row > span:first-child, .road-row b { font-family: var(--mono); font-size: 0.68rem; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); }
    .road-row b { letter-spacing: 0.14em; color: var(--court); }
    .road-release, .road-rule { background: #fbf7d4; } .road-release > span:first-child, .road-rule > span:first-child { padding-left: 8px; }
    .road-row.is-past { opacity: 0.45; }
    .sub { margin-top: 2.4rem; }

    .calls { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
    .call { border: 1.5px solid var(--ink); padding: 1rem; }
    .call-when { display: flex; justify-content: space-between; gap: 10px; margin: 0 0 0.6rem; font-family: var(--mono); font-size: 0.64rem;
      letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); }
    .call-when b { color: var(--court); text-align: right; }
    .call h3 { margin: 0 0 0.45rem; font-family: var(--display); font-weight: 600; font-size: 1.5rem; line-height: 1.05; }
    .call p:last-child { margin: 0; font-size: 0.94rem; color: #4a433d; }

    .trend { display: grid; grid-template-columns: 64px 1fr; gap: 1.1rem; padding: 1.3rem 0; border-bottom: 1px solid var(--line); }
    .trend:first-of-type { border-top: 1.5px solid var(--ink); }
    .trend-n { margin: 0; font-family: var(--display); font-weight: 700; font-size: 2.2rem; line-height: 0.9; color: var(--court); font-variant-numeric: lining-nums; }
    .trend h3 { margin: 0 0 0.4rem; font-family: var(--display); font-weight: 600; font-size: 1.7rem; line-height: 1.05; }
    .trend p { margin: 0; max-width: 70ch; }
    .grit { max-width: 620px; margin: 1rem 0 0; padding: 0.9rem; border: 1px solid var(--line); }
    .grit-row { display: grid; grid-template-columns: 190px 1fr 44px; gap: 10px; align-items: center; padding: 4px 0; font-size: 0.88rem; }
    .grit-track { height: 10px; background: var(--line); } .grit-track i { display: block; height: 100%; background: var(--court); }
    .grit-track i.base { background: var(--muted); }
    .grit-row b { font-family: var(--mono); font-size: 0.74rem; text-align: right; }
    .grit figcaption { margin-top: 0.6rem; font-size: 0.8rem; color: var(--muted); }

    .cos { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
    .co { border: 1px solid var(--ink); padding: 1rem; }
    .co h3 { margin: 0; font-family: var(--display); font-weight: 700; font-size: 1.6rem; line-height: 1; }
    .co-facts { margin: 0.35rem 0 0; font-family: var(--mono); font-size: 0.68rem; color: var(--muted); }
    .co-story { margin: 0.6rem 0 0.7rem; font-size: 0.94rem; }
    .co dl { display: grid; grid-template-columns: 64px 1fr; gap: 4px 10px; margin: 0; padding-top: 0.6rem; border-top: 1px solid var(--line); font-size: 0.82rem; }
    .co dt { font-family: var(--mono); font-size: 0.62rem; line-height: 2; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
    .co dd { margin: 0; color: #4a433d; }

    .method { max-width: 70ch; margin: 0; padding-left: 1.2rem; } .method li { padding: 0.25rem 0; }
    .fund-strip { display: grid; grid-template-columns: auto auto 1fr; align-items: baseline; gap: 0.5rem 1.2rem; margin: 1.6rem 0 0;
      padding: 0.9rem 1.2rem; border: 1.5px solid var(--ink); background: var(--ball); color: var(--ink); text-decoration: none; font-size: 0.92rem; }
    .fund-strip:hover { box-shadow: 4px 4px 0 var(--ink); transform: translate(-1px, -1px); }
    .fund-strip b { font: 700 1.7rem/1 var(--display); }
    .fund-tag { font-family: var(--mono); font-size: 0.68rem; letter-spacing: 0.16em; text-transform: uppercase; }
    footer { display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap; margin-top: 2.4rem; padding-top: 0.9rem;
      border-top: 1.5px solid var(--ink); font-family: var(--mono); font-size: 0.7rem; letter-spacing: 0.06em; color: var(--muted); }
    footer a { color: var(--muted); }

    @media (max-width: 800px) {
      body { padding: 0.6rem 0; } .office { padding: 0.9rem 0.8rem 2rem; box-shadow: 5px 5px 0 var(--court); }
      .math { grid-template-columns: 1fr 1fr; } .math div:nth-child(2) { border-right: 0; } .math div:nth-child(-n+2) { border-bottom: 1.5px solid var(--ink); }
      .mo { grid-template-columns: 1fr; gap: 6px; } .mo-name { grid-template-columns: 34px 90px 16px; }
      .rel, .wire { grid-template-columns: 1fr; gap: 0.3rem; } .when b, .when b.usd { display: inline; margin-left: 10px; } .when b.usd { font-size: 1.2rem; }
      .row, .road-row, .calls, .cos, .trend, .fund-strip { grid-template-columns: 1fr; } .row, .road-row { gap: 0.15rem; } .trend { gap: 0.3rem; }
      .filters { position: static; } .filters label:not(.check) { flex: 1 1 140px; } .filters select { min-width: 0; width: 100%; } .filters output { margin-left: 0; }
      .grit-row { grid-template-columns: 130px 1fr 40px; } .l-label { display: none; }
    }
  </style>
</head>
<body>
  <main class="office">
    <header class="site-nav">
      <a class="nav-mark" href="/" aria-label="Rally home">rally</a>
      <nav aria-label="Primary navigation">
        <a href="#year">The year</a>
        <a href="#ledger">The ledger</a>
        <a href="#ahead">What's next</a>
        <a href="#companies">Company files</a>
        <a href="/paddle-fund/">Paddle fund</a>
        <a href="/#your-number">Your number</a>
      </nav>
    </header>

    <div class="hero">
      <p class="eyebrow">the paddle calendar · as of ${esc(shortDate(meta.asOf))}, ${meta.asOf.slice(0, 4)} · every date sourced</p>
      <h1>Every paddle of 2026, <em>on one calendar.</em></h1>
      <p class="deck">${S.releases} launches from ${S.brands} brands, dated, priced and sourced. The rules, lawsuits and signings
        that shaped them run alongside. Then the company files, ten trends, and a forecast through next spring
        that says what each call rests on.</p>
    </div>

    <div class="math" aria-label="The year in four numbers">
      <div><b>${S.releases}</b><span>releases tracked · ${S.brands} brands</span></div>
      <div><b>${S.foam} of ${S.releases}</b><span>are full-foam builds</span></div>
      <div><b>$${S.median}</b><span>median list price at launch</span></div>
      <div><b id="next-drop">Sep 30</b><span id="next-drop-note">next drop · JOOLA POWER FX</span></div>
    </div>

    <section id="year" aria-labelledby="year-title">
      <div class="sec-head"><h2 class="sec-title" id="year-title">The year <em>at a glance.</em></h2>${legend("label")}</div>
      <div class="year">
${yearHtml}
      </div>
      <p class="note">March was the peak: seven launches in four weeks. July was the quietest month. August and September
        filled back up ahead of the October 1 spin-test deadline, and two more dated drops land in the next ten days.</p>
    </section>

    <section id="prices" aria-labelledby="prices-title">
      <div class="sec-head"><h2 class="sec-title" id="prices-title">The price <em>ladder.</em></h2>${legend("short")}</div>
      <figure class="ladder">
        ${ladderSvg}
        <div class="tip" id="ladder-tip" hidden></div>
        <figcaption>List price at launch, by date. Hollow dots have not shipped yet; multi-model launches plot at their headline
          price. The shaded band is what one turn in <a href="/paddle-fund/">the Paddle Fund</a> buys: ${S.underCap} of this year's
          ${S.releases} releases fit under $200. Every dot is a row in the ledger below.</figcaption>
      </figure>
    </section>

    <section id="ledger" aria-labelledby="ledger-title">
      <h2 class="sec-title" id="ledger-title">The ledger, <em>month by month.</em></h2>
      <form class="filters" id="filters" aria-label="Filter the ledger">
        <label>Brand<select name="brand"><option value="">All ${S.brands}</option>${brands.map((b) => `<option>${esc(b)}</option>`).join("")}</select></label>
        <label>Build<select name="build"><option value="">Any</option>${builds.map((b) => `<option value="${b}">${esc(BUILDS[b].label)}</option>`).join("")}</select></label>
        <label>Price<select name="tier"><option value="">Any</option><option value="floor">Floor · $120 and under</option><option value="middle">Middle · $121 – $229</option><option value="top">Top · $230 and up</option></select></label>
        <label class="check"><input type="checkbox" name="fund" /> Under $200</label>
        <label class="check"><input type="checkbox" name="wire" checked /> Show the news</label>
        <output id="filter-count" aria-live="polite">${S.releases} releases</output>
      </form>
${ledgerHtml}
      <p class="empty" id="filter-empty" hidden>Nothing on the calendar matches that. Loosen a filter.</p>

      <p class="eyebrow sub">on shelves this year, date not pinned</p>
      <div class="rows">
        ${undated.map((u) => `<a class="row" href="${esc(u.source)}" rel="noopener"><strong>${esc(u.brand)} ${esc(u.model)}</strong><span>${esc(u.note)} ↗</span></a>`).join("\n        ")}
      </div>
    </section>

    <section id="ahead" aria-labelledby="ahead-title">
      <h2 class="sec-title" id="ahead-title">What's next: <em>the road to spring.</em></h2>
      <div class="rows">
        ${ahead.map((a) => `<div class="road-row road-${a.kind}" data-ahead="${a.date}" data-ahead-kind="${a.kind}" data-ahead-title="${esc(a.title)}"><span>${esc(a.dateLabel)}</span><b>${KIND[a.kind]}</b><span><strong>${esc(a.title)}</strong>${a.body ? ` — ${esc(a.body)}` : ""}</span></div>`).join("\n        ")}
      </div>

      <p class="eyebrow sub">certified, not yet launched · names on the approval lists</p>
      <div class="rows">
        ${signals.map((s) => `<div class="row"><strong>${esc(s.brand)} ${esc(s.model)}</strong><span>${esc(s.signal)}</span></div>`).join("\n        ")}
      </div>
      <p class="note">An approval gives you the name, not the launch date or the reason to buy. Treat these as a watchlist.</p>

      <p class="eyebrow sub">the forecast · each call says what it rests on</p>
      <div class="calls">
        ${forecasts.map((f) => `<article class="call"><p class="call-when">${esc(f.window)}<b>${BASIS[f.basis]}</b></p><h3>${esc(f.call)}</h3><p>${esc(f.body)}</p></article>`).join("\n        ")}
      </div>
    </section>

    <section id="trends" aria-labelledby="trends-title">
      <h2 class="sec-title" id="trends-title">Ten trends, <em>read off the calendar.</em></h2>
      ${trends.map((t) => `<article class="trend"><p class="trend-n">${t.n}</p><div><h3>${esc(t.title)}</h3><p>${esc(t.body)} ${src(t.source)}</p>${t.n === "02" ? `<figure class="grit">${grit.rows.map((g) => `<div class="grit-row"><span>${esc(g.surface)}</span><span class="grit-track"><i${g.retained < 85 ? ' class="base"' : ""} style="width:${g.retained}%"></i></span><b>${g.retained}%</b></div>`).join("")}<figcaption>${esc(grit.note)} ${src(grit.source)}</figcaption></figure>` : ""}</div></article>`).join("\n      ")}
    </section>

    <section id="moves" aria-labelledby="moves-title">
      <h2 class="sec-title" id="moves-title">Signing season: <em>who changed paddles.</em></h2>
      <div class="rows">
        ${moves.map((m) => `<div class="row"><strong>${esc(m.player)}</strong><span>${m.from ? `${esc(m.from)} → ` : "→ "}<em>${esc(m.to)}</em>${m.note ? ` · ${esc(m.note)}` : ""}</span></div>`).join("\n        ")}
      </div>
      <p class="note">Most paddle contracts end December 31. The next round of these lands in the first two weeks of January.</p>
    </section>

    <section id="companies" aria-labelledby="companies-title">
      <h2 class="sec-title" id="companies-title">Company files: <em>${companies.length} brands.</em></h2>
      <div class="cos">
        ${companies.map((c) => { const theirs = releases.filter((r) => r.brand === c.brand); return `<article class="co"><h3>${esc(c.brand)}</h3><p class="co-facts">${esc([c.hq, c.founded && `est. ${c.founded}`, c.owner].filter(Boolean).join(" · "))}</p><p class="co-story">${esc(c.story)}</p><dl>${c.lines ? `<dt>Lines</dt><dd>${esc(c.lines)}</dd>` : ""}${c.pros ? `<dt>Pros</dt><dd>${esc(c.pros)}</dd>` : ""}${c.cadence ? `<dt>Cadence</dt><dd>${esc(c.cadence)}</dd>` : ""}${theirs.length ? `<dt>2026</dt><dd>${theirs.map((r) => `<a href="#${r.id}">${esc(r.model.split(/[:(]/)[0].trim())}</a>`).join(" · ")}</dd>` : ""}</dl></article>`; }).join("\n        ")}
      </div>
    </section>

    <section id="method" aria-labelledby="method-title">
      <h2 class="sec-title" id="method-title">How to <em>read this.</em></h2>
      <ol class="method">${method.map((m) => `<li>${esc(m)}</li>`).join("")}</ol>
      <a class="fund-strip" href="/paddle-fund/">
        <span class="fund-tag">playable concept</span>
        <b>The Paddle Fund</b>
        <span>${S.underCap} of this year's releases fit under $200. Ten seats × $20 buys one every week →</span>
      </a>
    </section>

    <footer>
      <span>The 2026 Paddle Calendar · compiled ${meta.asOf} · CC0 · <a href="./data.json">data.json</a></span>
      <span><a href="/">tez-rally.pages.dev</a> · <a href="https://pointcast.xyz/paddle-calendar" rel="noopener">pointcast.xyz/paddle-calendar</a></span>
    </footer>
  </main>

  <script>
    // Filters: the ledger is pre-rendered; this only hides rows.
    (function () {
      var form = document.getElementById("filters");
      var releases = [].slice.call(document.querySelectorAll("[data-release]"));
      var wires = [].slice.call(document.querySelectorAll("[data-wire]"));
      var months = [].slice.call(document.querySelectorAll("[data-month]"));
      var count = document.getElementById("filter-count"), empty = document.getElementById("filter-empty");
      function apply() {
        var f = new FormData(form);
        var brand = f.get("brand") || "", build = f.get("build") || "", tier = f.get("tier") || "";
        var fund = f.get("fund") === "on", wire = f.get("wire") === "on";
        var narrowed = Boolean(brand || build || tier || fund), shown = 0;
        releases.forEach(function (el) {
          var ok = (!brand || el.dataset.brand === brand) && (!build || el.dataset.build === build) &&
            (!tier || el.dataset.tier === tier) && (!fund || el.dataset.fund === "1");
          el.hidden = !ok; if (ok) shown += 1;
        });
        wires.forEach(function (el) { el.hidden = !wire || narrowed; });
        months.forEach(function (mo) {
          var n = mo.querySelectorAll("[data-release]:not([hidden])").length;
          mo.hidden = n === 0 && mo.querySelectorAll("[data-wire]:not([hidden])").length === 0;
          mo.querySelector("[data-month-count]").textContent = n ? String(n) : "";
        });
        count.textContent = shown + " release" + (shown === 1 ? "" : "s");
        empty.hidden = shown !== 0;
      }
      form.addEventListener("input", apply);
      form.addEventListener("submit", function (e) { e.preventDefault(); });

      // Next drop: the first dated release still ahead of the reader's clock.
      var today = new Date().toISOString().slice(0, 10);
      var road = [].slice.call(document.querySelectorAll("[data-ahead]"));
      var next = road.filter(function (el) { return el.dataset.aheadKind === "release" && el.dataset.ahead >= today; })[0];
      var big = document.getElementById("next-drop"), small = document.getElementById("next-drop-note");
      if (next) {
        var days = Math.round((Date.parse(next.dataset.ahead) - Date.parse(today)) / 864e5);
        big.textContent = days === 0 ? "Today" : days + " day" + (days === 1 ? "" : "s");
        small.textContent = "to the next dated drop · " + next.dataset.aheadTitle;
      } else { big.textContent = "—"; small.textContent = "no dated drop on the calendar right now"; }
      road.forEach(function (el) { if (el.dataset.ahead < today) el.classList.add("is-past"); });

      // Price ladder tooltip.
      var tip = document.getElementById("ladder-tip"), ladder = tip.parentElement;
      function show(dot) {
        var parts = (dot.getAttribute("data-tip") || "").split("|");
        tip.textContent = "";
        ["strong", "span", "small"].forEach(function (tag, i) { var n = document.createElement(tag); n.textContent = parts[i] || ""; tip.appendChild(n); });
        var box = ladder.getBoundingClientRect(), at = dot.getBoundingClientRect();
        tip.hidden = false;
        tip.style.left = Math.min(Math.max(at.left - box.left + at.width / 2, 90), box.width - 90) + "px";
        tip.style.top = (at.top - box.top) + "px";
      }
      [].slice.call(ladder.querySelectorAll(".dot")).forEach(function (dot) {
        dot.addEventListener("pointerenter", function () { show(dot); });
        dot.addEventListener("focus", function () { show(dot); });
        dot.addEventListener("pointerleave", function () { tip.hidden = true; });
        dot.addEventListener("blur", function () { tip.hidden = true; });
      });
    })();
  </script>
</body>
</html>
`;

writeFileSync(new URL("index.html", dir), html);
console.log(`paddle-calendar: ${releases.length} releases, ${html.length} bytes`);
