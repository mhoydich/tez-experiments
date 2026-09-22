// The Rally field guide renderer — shared by /guide/ and /pros/.
// Data: the JSON named by <body data-guide>. Text only, never innerHTML.
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === false || v == null) continue;
      if (k === "class") el.className = v; else el.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid);
    return el;
  }
  const safeUrl = (u) => (/^https:\/\//.test(u || "") || /^\/[^/]/.test(u || "") ? u : null);
  const ext = (u) => /^https:/.test(u) ? { target: "_blank", rel: "noopener" } : {};
  const src = (u) => safeUrl(u) ? h("a", { class: "src", href: u, ...ext(u) }, "source ↗") : null;
  const today = new Date().toISOString().slice(0, 10);

  const render = {
    text: (b) => b.paras.map((p) => h("p", {}, p)),
    quick: (b) => h("div", { class: "quick" }, b.items.map((x) => h("div", { "data-find": x.big + " " + x.small }, h("b", {}, x.big), h("span", {}, x.small)))),
    links: (b) => h("div", { class: "links" }, b.items.filter((x) => safeUrl(x.url)).map((x) =>
      h("a", { class: "link", href: x.url, ...ext(x.url), "data-find": [x.name, x.what, x.kind].join(" ") },
        h("b", {}, x.name), x.kind ? h("small", {}, x.kind) : null, h("span", {}, x.what || "")))),
    facts: (b) => h("ul", { class: "facts" }, b.items.map((x) => h("li", { "data-find": x.fact }, x.fact, src(x.source)))),
    schedule: (b) => {
      const rows = [...b.rows].sort((a, z) => (a.start || "").localeCompare(z.start || ""));
      const next = rows.find((r) => (r.end || r.start || "") >= today);
      return h("div", { class: "scroll" }, h("table", {},
        h("thead", {}, h("tr", {}, h("th", {}, "dates"), h("th", {}, "event"), h("th", {}, "where"), h("th", {}, ""))),
        h("tbody", {}, rows.map((r) => h("tr", { class: (r.end || r.start) < today ? "past" : r === next ? "next" : "", "data-find": [r.event, r.city, r.venue].join(" ") },
          h("td", {}, r.dates), h("td", {}, r.event), h("td", {}, [r.city, r.venue].filter(Boolean).join(" · ")), h("td", {}, src(r.source)))))));
    },
    table: (b) => h("div", { class: "scroll" }, h("table", {},
      h("thead", {}, h("tr", {}, b.cols.map((c) => h("th", {}, c)), h("th", {}, ""))),
      h("tbody", {}, b.rows.map((r) => h("tr", { "data-find": r.cells.join(" ") }, r.cells.map((c) => h("td", {}, c)),
        h("td", {}, r.url && safeUrl(r.url) ? h("a", { class: "src", href: r.url, ...ext(r.url) }, "site ↗") : src(r.source))))))),
    cards: (b) => h("div", { class: "cards" }, b.items.map((x) => h("div", { class: "card", "data-find": [x.title, x.sub, x.body].join(" ") },
      h("b", {}, x.title), x.sub ? h("small", {}, x.sub) : null, x.body ? h("p", {}, x.body) : null,
      h("div", { class: "acts" }, (x.links || []).filter((l) => safeUrl(l.url)).map((l) => h("a", { href: l.url, ...ext(l.url) }, l.label + (l.url.startsWith("http") ? " ↗" : " →"))), src(x.source))))),
    note: (b) => h("p", { class: "note" }, b.text),
  };

  function build(g) {
    $("asof").replaceChildren(h("b", {}, "Checked " + g.asOf + ". "), g.method || "");
    const toc = $("toc"), box = $("chapters");
    g.chapters.forEach((c, i) => {
      toc.append(h("a", { href: "#" + c.id }, c.short || c.title));
      const body = h("div", { class: "body" });
      for (const b of c.blocks) {
        if (b.heading) body.append(h("h3", {}, b.heading));
        const out = render[b.type]?.(b); if (out) body.append(...[out].flat());
      }
      box.append(h("section", { class: "chapter", id: c.id },
        h("header", {}, h("span", { class: "num" }, String(i + 1).padStart(2, "0")), h("div", {}, h("h2", {}, c.title), c.dek ? h("p", { class: "dek" }, c.dek) : null)), body));
    });
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
    filter();
  }

  function filter() {
    const q = $("find").value.trim().toLowerCase(), items = document.querySelectorAll("[data-find]");
    let shown = 0;
    items.forEach((el) => { const hit = !q || el.dataset.find.toLowerCase().includes(q); el.hidden = !hit; if (hit) shown++; });
    document.querySelectorAll(".chapter").forEach((c) => { c.hidden = Boolean(q) && !c.querySelector("[data-find]:not([hidden])"); });
    $("count").textContent = q ? shown + " match" + (shown === 1 ? "" : "es") : items.length + " entries";
  }
  $("find").addEventListener("input", filter);

  // highlight the chapter in view
  const io = "IntersectionObserver" in window ? new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) document.querySelectorAll(".toc a").forEach((a) => a.classList.toggle("here", a.getAttribute("href") === "#" + e.target.id));
  }), { rootMargin: "-40% 0px -55% 0px" }) : null;

  fetch(document.body.dataset.guide || "/guide/guide.json").then((r) => r.json()).then((g) => { build(g); document.querySelectorAll(".chapter").forEach((c) => io?.observe(c)); })
    .catch(() => { $("asof").textContent = "The guide didn't load. Try again in a moment."; });
})();
