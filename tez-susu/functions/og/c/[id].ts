import { ImageResponse } from "workers-og";
import { escapeHtml, formatTez, kt1Pattern, readCircle } from "../../../src/share-circle";

const errorHeaders = { "Cache-Control": "public, max-age=60" };

export const onRequestGet: PagesFunction<Env, "id"> = async (context) => {
  const param = context.params.id;
  const id = (Array.isArray(param) ? param[0] || "" : param).replace(/\.png$/, "");
  const requestedHouse = new URL(context.request.url).searchParams.get("house") || "";
  const house = kt1Pattern.test(requestedHouse) ? requestedHouse : "";
  try {
    const circle = await readCircle(id, context.env, house);
    if (!circle) return new Response("no such circle", { status: 404, headers: errorHeaders });

    const dots = Array.from({ length: circle.seats }, (_, seat) =>
      `<div style="display:flex;width:34px;height:34px;border:3px solid #241f1c;border-radius:999px;background:${seat < circle.joined ? "#0f61ff" : "#f2efe9"}"></div>`,
    ).join("");
    const html = `<div style="display:flex;flex-direction:column;justify-content:space-between;width:1200px;height:630px;padding:64px;background:#f2efe9;color:#241f1c;font-family:Georgia,serif;border:18px solid #241f1c">
  <div style="display:flex;justify-content:space-between;font-family:monospace;font-size:24px;letter-spacing:5px;text-transform:uppercase;color:#b3402a">
    <span>susu · circle #${id}</span><span>${escapeHtml(circle.status)}</span>
  </div>
  <div style="display:flex;flex-direction:column;gap:26px">
    <div style="display:flex;font-size:72px;line-height:1.05;font-style:italic;color:#b3402a">${escapeHtml(circle.name)}</div>
    <div style="display:flex;gap:16px;align-items:center">${dots}</div>
    <div style="display:flex;font-family:monospace;font-size:27px;letter-spacing:2px">${circle.joined}/${circle.seats} seats · ${formatTez(circle.contribution)} tez a round</div>
  </div>
  <div style="display:flex;border-top:3px solid #d8d2c6;padding-top:24px;font-family:monospace;font-size:24px;letter-spacing:2px">susu — the savings circle · tez-susu.pages.dev</div>
</div>`;
    return new ImageResponse(html, {
      width: 1200,
      height: 630,
      headers: { "Cache-Control": "public, max-age=60" },
    });
  } catch (error) {
    console.error(JSON.stringify({
      message: "circle OG image failed",
      circleId: id,
      error: error instanceof Error ? error.message : String(error),
    }));
    return new Response("image could not be rendered", { status: 502 });
  }
};
