import {
  circleDescription,
  escapeHtml,
  formatTez,
  kt1Pattern,
  readCircle,
  siteOrigin,
} from "../../src/share-circle";

const headers = {
  "Cache-Control": "public, max-age=60",
  "Content-Type": "text/html; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
};

const shell = (head: string, body: string): string => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
${head}
<style>
  :root{--paper:#f2efe9;--ink:#241f1c;--stamp:#b3402a;--tezos-blue:#0f61ff;--line:#d8d2c6;--dim:#6b6259}
  *{box-sizing:border-box}
  body{margin:0;min-height:100dvh;display:grid;place-items:center;padding:24px;background:var(--paper);color:var(--ink);font-family:Georgia,"Times New Roman",serif;background-image:radial-gradient(var(--line) 1px,transparent 1px);background-size:28px 28px}
  main{width:min(620px,94vw);background:#fff;border:1.5px solid var(--ink);padding:2.2rem 2rem;box-shadow:8px 8px 0 var(--stamp)}
  .eyebrow,.chip,.facts{font-family:ui-monospace,"SF Mono",Menlo,monospace}
  .eyebrow{display:flex;justify-content:space-between;gap:1rem;margin:0 0 1.1rem;color:var(--stamp);font-size:.68rem;letter-spacing:.2em;text-transform:uppercase}
  h1{margin:0 0 .7rem;font-size:clamp(2.2rem,9vw,3.5rem);line-height:1;font-weight:500;overflow-wrap:anywhere}
  h1 em{color:var(--stamp);font-style:italic}
  .chip{display:inline-block;border:1px solid currentColor;padding:.18rem .45rem;color:var(--tezos-blue);font-size:.62rem;letter-spacing:.13em;text-transform:uppercase}
  .facts{display:grid;grid-template-columns:repeat(2,1fr);gap:.7rem;margin:1.5rem 0}
  .fact{border:1.5px solid var(--ink);padding:.8rem;background:var(--paper);box-shadow:3px 3px 0 var(--line)}
  .fact b{display:block;color:var(--stamp);font-size:1.4rem}.fact span{color:var(--dim);font-size:.6rem;letter-spacing:.12em;text-transform:uppercase}
  .description{color:var(--dim);line-height:1.55}
  a.button{display:block;margin-top:1.4rem;padding:.8rem 1rem;border:1.5px solid var(--ink);background:var(--stamp);color:#fff;text-align:center;text-decoration:none;box-shadow:4px 4px 0 var(--ink)}
  a.button:hover{transform:translate(-1px,-1px);box-shadow:5px 5px 0 var(--ink)}
</style>
</head>
<body>${body}</body>
</html>`;

const missingPage = (id: string, back = siteOrigin): string => shell(
  `<title>no such circle — susu</title><meta name="robots" content="noindex" />`,
  `<main><p class="eyebrow"><span>tezos · el segundo</span><span>susu</span></p><h1>no such <em>circle</em></h1><p class="description">Circle #${escapeHtml(id)} is not on the books.</p><a class="button" href="${back}">back to the town square →</a></main>`,
);

export const onRequestGet: PagesFunction<Env, "id"> = async (context) => {
  const param = context.params.id;
  const id = Array.isArray(param) ? param[0] || "" : param;
  const requestedHouse = new URL(context.request.url).searchParams.get("house") || "";
  const house = kt1Pattern.test(requestedHouse) ? requestedHouse : "";
  const houseQuery = house ? `?house=${encodeURIComponent(house)}` : "";
  const houseHome = house ? `${siteOrigin}/?house=${encodeURIComponent(house)}` : siteOrigin;
  try {
    const circle = await readCircle(id, context.env, house);
    if (!circle) return new Response(missingPage(id, houseHome), { status: 404, headers });

    const name = escapeHtml(circle.name);
    const title = `${name} — a susu circle`;
    const description = escapeHtml(circleDescription(circle));
    const canonical = `${siteOrigin}/c/${id}${houseQuery}`;
    const image = `${siteOrigin}/og/c/${id}.png${houseQuery}`;
    const head = `<title>${title}</title>
<meta name="description" content="${description}" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${description}" />
<meta property="og:image" content="${image}" />
<meta property="og:type" content="website" />
<meta property="og:url" content="${canonical}" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="canonical" href="${canonical}" />`;
    const body = `<main>
  <p class="eyebrow"><span>tezos · el segundo</span><span>circle #${id}</span></p>
  <span class="chip">${escapeHtml(circle.status)}</span>
  <h1><em>${name}</em></h1>
  <p class="description">${description}</p>
  <div class="facts">
    <div class="fact"><b>${circle.joined}/${circle.seats}</b><span>seats filled</span></div>
    <div class="fact"><b>${formatTez(circle.contribution)}ꜩ</b><span>each round</span></div>
  </div>
  <a class="button" href="${houseHome}#c=${id}">take a seat →</a>
</main>`;
    return new Response(shell(head, body), { headers });
  } catch (error) {
    console.error(JSON.stringify({
      message: "circle share page failed",
      circleId: id,
      error: error instanceof Error ? error.message : String(error),
    }));
    return new Response("the ledger could not be read", { status: 502 });
  }
};
