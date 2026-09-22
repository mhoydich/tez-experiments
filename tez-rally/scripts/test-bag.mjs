// Headless checks for The Bag (public/bag/index.html).
// The page is one static file, so this lifts the block between PURE-START and
// PURE-END out of its inline script and runs assertions on it under node.
//   node scripts/test-bag.mjs
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const html = readFileSync(new URL("../public/bag/index.html", import.meta.url), "utf8");
const m = html.match(/\/\* PURE-START[\s\S]*?\*\/([\s\S]*?)\/\* PURE-END \*\//);
assert.ok(m, "PURE block not found");
const api = new Function(m[1] + `; return { ROLES, GRIT, WEAR, WEAR_KEYS, CAPS, validDate, dayNum, isoFromDay, shortDate, fmtH, hoursWord, fmtMoney,
  cleanStr, cleanMsrp, cleanRef, emptyBag, cleanBag, encodeBag, decodeBag, paddleStats, ledgerLine, cleanRegister, searchRegister,
  RATINGS, REPORT, ratingFromMilli, wearReport, wearReportDue, cleanAddParam, cleanChanges };`)();
const { CAPS, validDate, dayNum, isoFromDay, shortDate, fmtH, cleanBag, encodeBag, decodeBag, paddleStats, ledgerLine, cleanRegister, searchRegister,
  RATINGS, REPORT, ratingFromMilli, wearReport, wearReportDue, cleanAddParam, cleanChanges } = api;

const TODAY = "2026-09-21";
let n = 0; const test = (name, fn) => { fn(); n++; console.log("ok  " + name); };
const b64u = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

test("dates", () => {
  assert.equal(validDate("2026-03-17"), true);
  assert.equal(validDate("2026-02-30"), false);
  assert.equal(validDate("1999-12-31"), false);
  assert.equal(validDate("2026-3-17"), false);
  assert.equal(validDate(20260317), false);
  assert.equal(isoFromDay(dayNum("2026-03-17")), "2026-03-17");
  assert.equal(isoFromDay(dayNum("2024-02-29")), "2024-02-29");
  assert.equal(isoFromDay(1e9), ""); assert.equal(isoFromDay("x"), ""); assert.equal(isoFromDay(20000.5), "");
  assert.equal(shortDate("2026-03-17", TODAY), "Mar 17");
  assert.equal(shortDate("2025-12-01", TODAY), "Dec 1, 2025");
  assert.equal(fmtH(62.5), "62.5"); assert.equal(fmtH(38), "38");
});

// the task's own example: 62.5 hours over 41 sessions since Mar 17, grit fading at 38 hours
function exampleBag() {
  const sessions = [];
  // 25 sessions × 1.5h = 37.5h, then one 0.5h = 38h by the grit check, then 15 more to reach 62.5h over 41
  for (let i = 0; i < 25; i++) sessions.push({ p: "p0", d: isoFromDay(dayNum("2026-03-17") + i * 3), h: 1.5 });
  sessions.push({ p: "p0", d: "2026-06-05", h: 0.5 });
  for (let i = 0; i < 14; i++) sessions.push({ p: "p0", d: isoFromDay(dayNum("2026-06-10") + i * 4), h: 1.5 });
  sessions.push({ p: "p0", d: "2026-09-10", h: 3.5 });
  return { v: 1, paddles: [
      { id: "p0", ref: "volair-shift", name: "Volair Shift", msrp: 189.99, build: "foam", since: "2026-03-17", role: "main", note: "lead tape at 3 and 9" },
      { id: "p1", ref: "", name: "Old faithful", msrp: null, build: "", since: "2025-01-05", role: "backup", note: "" }],
    sessions, wear: [
      { p: "p0", d: "2026-06-05", t: "grit", g: 3 }, { p: "p0", d: "2026-04-01", t: "grit", g: 2 }, { p: "p0", d: "2026-08-01", t: "grit", g: 4 },
      { p: "p1", d: "2025-06-01", t: "edge", g: null }] };
}

test("stats + ledger line", () => {
  const bag = cleanBag(exampleBag(), TODAY);
  const st = paddleStats(bag, "p0", TODAY, 189.99);
  assert.equal(st.sessions, 41); assert.equal(st.hours, 62.5);
  assert.equal(st.fade.g, 3); assert.equal(st.fade.hours, 38);
  assert.equal(st.dead, null); assert.equal(st.retired, null);
  assert.equal(st.days, dayNum(TODAY) - dayNum("2026-03-17") + 1);
  assert.ok(Math.abs(st.costPerHour - 189.99 / 62.5) < 1e-9);
  assert.equal(ledgerLine(st, TODAY), "62.5 hours over 41 sessions since Mar 17. Grit fading at 38 hours.");
  const st1 = paddleStats(bag, "p1", TODAY, null);
  assert.equal(st1.hours, 0); assert.equal(st1.costPerHour, null);
  assert.equal(ledgerLine(st1, TODAY), "No sessions logged yet. In the bag since Jan 5, 2025.");
  assert.equal(paddleStats(bag, "nope", TODAY, null), null);
});

test("cost per hour waits for five hours; dead + retired read into the line", () => {
  const bag = cleanBag({ v: 1, paddles: [{ id: "a", name: "X", msrp: 200, since: "2026-09-01", role: "retired" }],
    sessions: [{ p: "a", d: "2026-09-02", h: 2 }, { p: "a", d: "2026-09-03", h: 2.5 }, { p: "a", d: "2026-08-30", h: 1 }],
    wear: [{ p: "a", d: "2026-09-03", t: "dead" }, { p: "a", d: "2026-09-05", t: "retired" }, { p: "a", d: "2026-09-02", t: "grit", g: 4 }] }, TODAY);
  let st = paddleStats(bag, "p0", TODAY, 200);
  assert.equal(st.hours, 5.5); assert.ok(Math.abs(st.costPerHour - 200 / 5.5) < 1e-9);
  assert.equal(st.start, "2026-08-30", "a session before the in-play date moves the start back");
  assert.equal(st.days, 7, "retired paddles stop counting days at the retired date");
  assert.equal(ledgerLine(st, TODAY), "5.5 hours over 3 sessions since Aug 30. Grit slick at 3 hours. Went dead at 5.5 hours. Retired Sep 5.");
  bag.sessions.pop(); bag.sessions.pop();
  st = paddleStats(bag, "p0", TODAY, 200);
  assert.equal(st.hours, 2); assert.equal(st.costPerHour, null);
  assert.equal(ledgerLine(paddleStats(cleanBag({ v: 1, paddles: [{ id: "a", name: "X", since: TODAY }], sessions: [{ p: "a", d: TODAY, h: 1 }] }, TODAY), "p0", TODAY, null), TODAY),
    "1 hour over 1 session since Sep 21.");
});

test("share link round trip", () => {
  const bag = cleanBag(exampleBag(), TODAY);
  const str = encodeBag(bag);
  assert.match(str, /^[A-Za-z0-9_-]+$/);
  const back = decodeBag(str, TODAY);
  assert.deepEqual(back, bag);
  // unicode names survive
  bag.paddles[1].name = "Paddle ñ 🏓 “quoted”"; bag.paddles[1].note = "<img src=x onerror=alert(1)>";
  const again = decodeBag(encodeBag(bag), TODAY);
  assert.equal(again.paddles[1].name, "Paddle ñ 🏓 “quoted”");
  assert.equal(again.paddles[1].note, "<img src=x onerror=alert(1)>", "markup stays a plain string; the page only ever uses textContent");
});

test("a full bag still fits and round-trips", () => {
  const paddles = Array.from({ length: 12 }, (_, i) => ({ id: "p" + i, name: "Paddle " + i, since: "2024-01-01", role: i ? "backup" : "main" }));
  const sessions = Array.from({ length: 2000 }, (_, i) => ({ p: "p" + (i % 12), d: isoFromDay(dayNum("2024-01-01") + (i % 900)), h: 1.5 }));
  const wear = Array.from({ length: 400 }, (_, i) => ({ p: "p" + (i % 12), d: "2025-01-01", t: "grit", g: (i % 5) + 1 }));
  const bag = cleanBag({ v: 1, paddles, sessions, wear }, TODAY), str = encodeBag(bag);
  assert.ok(str.length < CAPS.hash, "link length " + str.length);
  assert.deepEqual(decodeBag(str, TODAY), bag);
  console.log("    full bag link is " + str.length + " chars");
});

test("hostile links are rejected or cut down", () => {
  for (const bad of ["", "!!!", "e30", b64u({ v: 2, p: [] }), b64u({ v: 1, p: "x" }), b64u({ v: 1, p: [] }), b64u([1, 2]), b64u(null), "A".repeat(CAPS.hash + 1)])
    assert.throws(() => decodeBag(bad, TODAY), "should throw: " + bad.slice(0, 20));
  const day = dayNum("2026-01-01");
  const big = { v: 1, junk: { a: 1 },
    p: Array.from({ length: 20 }, (_, i) => ["N".repeat(500) + i, "../../evil", 1e9, "b".repeat(99), day, 0, "n".repeat(999), "extra"]),
    s: Array.from({ length: 3000 }, () => [0, day, 3]), w: Array.from({ length: 1000 }, () => [0, day, 0, 3]) };
  assert.ok(b64u(big).length < CAPS.hash, "test payload must get past the length cap to exercise the array caps");
  const bag = decodeBag(b64u(big), TODAY);
  assert.equal(bag.paddles.length, 12); assert.equal(bag.sessions.length, 2000); assert.equal(bag.wear.length, 400);
  assert.equal(bag.paddles[0].name.length, 60); assert.equal(bag.paddles[0].note.length, 120); assert.equal(bag.paddles[0].build.length, 16);
  assert.equal(bag.paddles[0].ref, ""); assert.equal(bag.paddles[0].msrp, null);
  assert.equal(bag.paddles.filter((p) => p.role === "main").length, 1, "only one main");
  assert.deepEqual(Object.keys(bag).sort(), ["next", "paddles", "sessions", "v", "wear"]);
  assert.deepEqual(Object.keys(bag.paddles[0]).sort(), ["build", "id", "lastReportAt", "lastReportHours", "msrp", "name", "note", "ref", "role", "since"]);
  assert.equal(bag.paddles[0].lastReportAt, ""); assert.equal(bag.paddles[0].lastReportHours, null, "report marks never travel in a link");

  const odd = decodeBag(b64u({ v: 1, p: [null, [""], ["Real", "ok-ref", "12", 7, "soon", 9, 5], { name: "obj" }],
    s: [[2, day, 3], [0, day, 3], [2, "x", 3], [2, day, 99], [2, day, -1], [2, day, "3"], "str", null, [2.5, day, 3], [99, day, 3]],
    w: [[2, day, 0, 9], [2, day, 0, 2], [2, day, 44, 0], [2, day, 1, 0], [2, day, 0, "2"], [2, day, 0, 2.5]] }), TODAY);
  assert.equal(odd.paddles.length, 1); assert.equal(odd.paddles[0].id, "p0"); assert.equal(odd.paddles[0].name, "Real");
  assert.equal(odd.paddles[0].since, TODAY); assert.equal(odd.paddles[0].role, "backup"); assert.equal(odd.paddles[0].note, ""); assert.equal(odd.paddles[0].msrp, null);
  assert.deepEqual(odd.sessions, [{ p: "p0", d: "2026-01-01", h: 1.5 }], "only well-formed rows that point at a surviving paddle");
  assert.deepEqual(odd.wear, [{ p: "p0", d: "2026-01-01", t: "grit", g: 2 }, { p: "p0", d: "2026-01-01", t: "dead", g: null }]);
});

test("stored bags pass the same gate", () => {
  assert.throws(() => cleanBag(null, TODAY)); assert.throws(() => cleanBag({ v: 1 }, TODAY)); assert.throws(() => cleanBag("[]", TODAY));
  const bag = cleanBag({ v: 1, paddles: [{ id: "p7", name: " A\u0000B\n ", role: "main" }, { id: "p7", name: "dupe id", role: "main" }, { id: "p9", name: "C", role: "wizard" }],
    sessions: [{ p: "p7", d: "2026-01-01", h: 1.26 }, { p: "p9", d: "2026-01-01", h: 0.1 }, { p: "__proto__", d: "2026-01-01", h: 1 }] }, TODAY);
  assert.equal(bag.paddles[0].name, "A B"); assert.equal(bag.paddles[1].role, "backup"); assert.equal(bag.paddles[2].role, "backup");
  assert.deepEqual(bag.sessions, [{ p: "p0", d: "2026-01-01", h: 1.5 }], "hours snap to half steps; the first paddle with an id keeps its sessions");
  assert.equal(bag.next, 3);
});

test("a wear-report mark is kept whole or not at all", () => {
  const mk = (extra) => cleanBag({ v: 1, paddles: [{ id: "a", name: "X", ref: "volair-shift", since: "2026-01-01", ...extra }] }, TODAY).paddles[0];
  let p = mk({ lastReportAt: "2026-09-01", lastReportHours: 62.5 });
  assert.equal(p.lastReportAt, "2026-09-01"); assert.equal(p.lastReportHours, 62.5);
  p = mk({ lastReportAt: "2026-09-01", lastReportHours: 62.26 }); assert.equal(p.lastReportHours, 62.5, "snaps to half steps");
  for (const bad of [{ lastReportAt: "2026-09-01" }, { lastReportHours: 10 }, { lastReportAt: "soon", lastReportHours: 10 },
    { lastReportAt: "2026-09-01", lastReportHours: "10" }, { lastReportAt: "2026-09-01", lastReportHours: 0.5 }, { lastReportAt: "2026-09-01", lastReportHours: 3001 }]) {
    p = mk(bad); assert.equal(p.lastReportAt, ""); assert.equal(p.lastReportHours, null, JSON.stringify(bad));
  }
  // the mark is device-only: it does not survive a share link
  const bag = cleanBag({ v: 1, paddles: [{ id: "a", name: "X", ref: "volair-shift", since: "2026-01-01", lastReportAt: "2026-09-01", lastReportHours: 10 }] }, TODAY);
  const back = decodeBag(encodeBag(bag), TODAY);
  assert.equal(back.paddles[0].lastReportAt, ""); assert.equal(back.paddles[0].lastReportHours, null);
});

test("wear report: builder, ranges, nulls, rounding", () => {
  assert.deepEqual(RATINGS, [2.5, 3, 3.5, 4, 4.5, 5]);
  assert.equal(ratingFromMilli(4000), 4); assert.equal(ratingFromMilli(4250), 4.5); assert.equal(ratingFromMilli(4249), 4);
  assert.equal(ratingFromMilli(3749), 3.5); assert.equal(ratingFromMilli(3750), 4); assert.equal(ratingFromMilli(2500), 2.5); assert.equal(ratingFromMilli(5000), 5);
  assert.equal(ratingFromMilli(2000), null, "2.0 is not a half the register takes"); assert.equal(ratingFromMilli(5500), null); assert.equal(ratingFromMilli(8000), null);
  assert.equal(ratingFromMilli(null), null); assert.equal(ratingFromMilli("4000"), null); assert.equal(ratingFromMilli(4000.5), null); assert.equal(ratingFromMilli(1999), null);

  const bag = cleanBag(exampleBag(), TODAY);
  const st = paddleStats(bag, "p0", TODAY, 189.99);
  const r = wearReport(bag.paddles[0], st, 4250);
  assert.deepEqual(r, { paddleId: "volair-shift", hours: 62.5, sessions: 41, months: Math.round((st.days / 30.4) * 100) / 100, fadeAt: 38, deadAt: null, rating: 4.5 });
  assert.deepEqual(Object.keys(r), ["paddleId", "hours", "sessions", "months", "fadeAt", "deadAt", "rating"], "nothing else rides along");
  assert.ok(r.months > 0 && r.months <= 60 && Number.isFinite(r.months));
  assert.equal(wearReport(bag.paddles[0], st, null).rating, null, "no number set → null");
  assert.equal(wearReport(bag.paddles[1], paddleStats(bag, "p1", TODAY, null), 4000), null, "not a register paddle");
  assert.equal(wearReport(null, st, 4000), null); assert.equal(wearReport(bag.paddles[0], null, 4000), null);

  // under five hours → nothing to send
  const few = cleanBag({ v: 1, paddles: [{ id: "a", name: "X", ref: "volair-shift", since: "2026-09-01" }],
    sessions: [{ p: "a", d: "2026-09-02", h: 2 }, { p: "a", d: "2026-09-03", h: 2.5 }] }, TODAY);
  assert.equal(wearReport(few.paddles[0], paddleStats(few, "p0", TODAY, null), 4000), null);
  few.sessions.push({ p: "p0", d: "2026-09-04", h: 0.5 });
  const fr = wearReport(few.paddles[0], paddleStats(few, "p0", TODAY, null), 4000);
  assert.equal(fr.hours, 5); assert.equal(fr.sessions, 3); assert.equal(fr.fadeAt, null); assert.equal(fr.deadAt, null); assert.equal(fr.rating, 4);
  assert.equal(REPORT.minHours, 5);

  // dead + fade ride along, never above the total
  const worn = cleanBag({ v: 1, paddles: [{ id: "a", name: "X", ref: "joola-pro-v", since: "2026-08-01" }],
    sessions: [{ p: "a", d: "2026-08-02", h: 3 }, { p: "a", d: "2026-08-03", h: 3 }, { p: "a", d: "2026-08-10", h: 3 }],
    wear: [{ p: "a", d: "2026-08-03", t: "grit", g: 3 }, { p: "a", d: "2026-08-10", t: "dead" }, { p: "a", d: "2026-08-02", t: "grit", g: 2 }] }, TODAY);
  const wr = wearReport(worn.paddles[0], paddleStats(worn, "p0", TODAY, null), 3000);
  assert.equal(wr.fadeAt, 6, "first grit 3+ counts, not the earlier grit 2"); assert.equal(wr.deadAt, 9); assert.equal(wr.hours, 9); assert.equal(wr.rating, 3);
  assert.ok(wr.fadeAt <= wr.hours && wr.deadAt <= wr.hours);

  // out of the register's ranges → null rather than a refused send
  const big = { hours: 3000.5, sessions: 300, days: 900, fade: null, dead: null };
  assert.equal(wearReport(bag.paddles[0], big, 4000), null, "hours over 3000");
  assert.equal(wearReport(bag.paddles[0], { ...big, hours: 3000 }, 4000).hours, 3000);
  assert.equal(wearReport(bag.paddles[0], { hours: 10, sessions: 0, days: 10 }, 4000), null, "no sessions");
  assert.equal(wearReport(bag.paddles[0], { hours: 10, sessions: 2001, days: 10 }, 4000), null, "sessions over 2000");
  assert.equal(wearReport(bag.paddles[0], { hours: 13, sessions: 1, days: 10 }, 4000), null, "hours per session over 12");
  assert.equal(wearReport(bag.paddles[0], { hours: 10, sessions: 2, days: 30.4 * 60 + 40 }, 4000), null, "months over 60");
  assert.equal(wearReport(bag.paddles[0], { hours: 10, sessions: 2, days: 1824 }, 4000).months, 60);
  assert.equal(wearReport(bag.paddles[0], { hours: 10.26, sessions: 2, days: 1 }, 4000).hours, 10.5, "hours snap to the half");
  assert.equal(wearReport(bag.paddles[0], { hours: 10, sessions: 2, days: 1 }, 4000).months, 0.03);

  // resend only once five more hours are on it
  const p = { lastReportAt: "", lastReportHours: null };
  assert.equal(wearReportDue(p, 5), true);
  assert.equal(wearReportDue({ lastReportAt: "2026-09-01", lastReportHours: 60 }, 64.5), false);
  assert.equal(wearReportDue({ lastReportAt: "2026-09-01", lastReportHours: 60 }, 65), true);
  assert.equal(REPORT.resendAfter, 5);
});

test("?add= deep link takes a slug or nothing", () => {
  assert.equal(cleanAddParam("volair-shift"), "volair-shift"); assert.equal(cleanAddParam("joola-pro-v"), "joola-pro-v"); assert.equal(cleanAddParam("a1"), "a1");
  for (const bad of ["", "-lead", "trail-", "Upper-Case", "two--dash", "sp ace", "../x", "a".repeat(65), null, 5, "<b>", "x_y"])
    assert.equal(cleanAddParam(bad), "", JSON.stringify(bad));
  assert.equal(cleanAddParam("a".repeat(64)), "a".repeat(64));
});

test("what changed: three newest, plain values, capped", () => {
  const feed = { changes: [
    { date: "2026-09-01", kind: "price", paddle: "x", text: "Old one", source: "s" },
    { date: "2026-09-20", kind: "added", text: "<b>Newest</b> " + "z".repeat(400) },
    { date: "2026-09-10", kind: "correction", text: "Middle  one\n" },
    { date: "2026-09-15", kind: "", text: "no kind" }, { date: "2026-09-15", kind: "k", text: "" }, { date: "yesterday", kind: "k", text: "bad date" },
    null, "str", { date: "2026-09-12", kind: 7, text: "kind not a string" }, { date: "2026-09-05", kind: "note", text: "Fourth" } ] };
  const rows = cleanChanges(feed, 3);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map((r) => r.date), ["2026-09-20", "2026-09-10", "2026-09-05"]);
  assert.deepEqual(rows.map((r) => r.kind), ["ADDED", "CORRECTION", "NOTE"]);
  assert.equal(rows[0].text.length, 200); assert.ok(rows[0].text.startsWith("<b>Newest</b> "), "markup stays a plain string; the page only ever uses textContent");
  assert.equal(rows[1].text, "Middle  one");
  assert.deepEqual(Object.keys(rows[0]), ["date", "kind", "text"]);
  assert.deepEqual(cleanChanges(null), []); assert.deepEqual(cleanChanges({}), []); assert.deepEqual(cleanChanges({ changes: "x" }), []);
  assert.deepEqual(cleanChanges({ changes: [{ date: "2026-01-01", kind: "k", text: "t" }] }), [{ date: "2026-01-01", kind: "K", text: "t" }]);
});

test("register search", () => {
  const data = JSON.parse(readFileSync(new URL("../public/paddle-calendar/register.json", import.meta.url), "utf8"));
  const reg = cleanRegister(data);
  assert.equal(reg.length, data.releases.length);
  assert.equal(searchRegister(reg, "volair")[0].id, "volair-shift");
  assert.equal(searchRegister(reg, "  SHIFT vol ")[0].msrp, 189.99);
  assert.ok(searchRegister(reg, "selkirk").length >= 3);
  assert.equal(searchRegister(reg, "joola pro v")[0].id, "joola-pro-v");
  assert.deepEqual(searchRegister(reg, ""), []); assert.deepEqual(searchRegister(reg, "zzzz"), []);
  assert.ok(searchRegister(reg, "a").length <= 8);
  assert.equal(reg.find((r) => r.id === "head-boom-pro-ex15").msrp, null, "a paddle with no list price stays null");
  assert.deepEqual(cleanRegister(null), []); assert.deepEqual(cleanRegister({ releases: [null, { id: "BAD ID", short: "x" }, { id: "ok", brand: 5 }] }), []);
});

test("page hygiene", () => {
  const script = html.slice(html.indexOf("<script>"));
  assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(/.test(script), "no HTML sinks");
  assert.equal((script.match(/fetch\(/g) || []).length, 3, "three fetches: the register, the wear report, the changes feed");
  assert.equal((script.match(/method:\s*["']POST/g) || []).length, 1, "one network write: the wear report");
  assert.ok(/fetch\(WEAR_URL, \{ method: "POST"/.test(script) && /WEAR_URL = "https:\/\/pointcast\.xyz\/api\/paddles\/wear"/.test(script), "the write goes to the register's wear endpoint");
  assert.ok(/send\.addEventListener\("click", \(\) => sendReport\(/.test(script), "the write is behind the Send button");
  assert.ok(!/sendBeacon|XMLHttpRequest|WebSocket/.test(script), "no other network writes");
  assert.ok(html.includes("Nothing leaves the device unless you") && html.includes("aggregates-only on the other end"), "honesty copy names the one send");
  assert.ok(html.includes('<link rel="canonical" href="https://tez-rally.pages.dev/bag/" />'));
  assert.ok(html.includes("[hidden] { display: none !important; }") && html.includes("prefers-reduced-motion"));
  assert.ok(!/unlock|elevate|seamless/i.test(html));
});

console.log("\n" + n + " groups passed");
