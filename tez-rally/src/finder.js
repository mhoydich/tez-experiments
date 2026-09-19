// The level finder — "what's your number?" with no wallet in sight.
// Picks a level from plain-language lines, nudges by quarter points (the
// contract's declare step), remembers the choice, and hands it to the desk.
// /tonight/ standings link here with ?level=<milli> ("that's me").
const KEY = "rally:intended-rating";
const MIN = 2000, MAX = 8000, STEP = 250;

const clamp = (milli) => Math.min(MAX, Math.max(MIN, Math.round(milli / STEP) * STEP));

export function intendedRating() {
  const raw = Number(localStorage.getItem(KEY));
  return Number.isFinite(raw) && raw >= MIN && raw <= MAX ? clamp(raw) : null;
}

export function initFinder({ onOfficial }) {
  const $ = (id) => document.getElementById(id);
  const levels = [...document.querySelectorAll(".finder-levels [data-level]")];
  if (!levels.length) return;
  let current = null;

  function pick(milli, { remember = true } = {}) {
    current = clamp(milli);
    if (remember) localStorage.setItem(KEY, String(current));
    // light the line at or just below the number, so 3.75 still reads as a 3.5
    const lit = levels.filter((b) => Number(b.dataset.level) <= current).pop() || levels[0];
    for (const b of levels) b.setAttribute("aria-checked", String(b === lit));
    // keep the desk's declare form in step, whichever loaded first
    const declare = $("declare-rating");
    if (declare) declare.value = String(current);
    $("finder-number").textContent = (current / 1000).toFixed(2);
    $("finder-result").hidden = false;
    $("finder-down").disabled = current <= MIN;
    $("finder-up").disabled = current >= MAX;
  }

  for (const b of levels) b.addEventListener("click", () => pick(Number(b.dataset.level)));
  $("finder-down").addEventListener("click", () => pick(current - STEP));
  $("finder-up").addEventListener("click", () => pick(current + STEP));
  $("finder-official").addEventListener("click", () => onOfficial(current));

  const fromLink = Number(new URLSearchParams(location.search).get("level"));
  if (fromLink) pick(fromLink);
  else if (intendedRating()) pick(intendedRating(), { remember: false });
}
