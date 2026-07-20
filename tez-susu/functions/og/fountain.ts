import { ImageResponse } from "workers-og";

export const onRequestGet: PagesFunction<Env> = async () => {
  const coins = Array.from({ length: 7 }, (_, index) =>
    `<div style="display:flex;align-items:center;justify-content:center;width:46px;height:46px;margin:${index % 2 === 0 ? "0" : "12px"} 6px 0;border:3px solid #241f1c;border-radius:999px;background:#fffdf8;color:#0f61ff;font-family:Georgia,serif;font-size:27px">1</div>`,
  ).join("");
  const html = `<div style="display:flex;width:1200px;height:630px;padding:58px 64px;background:#f2efe9;color:#241f1c;font-family:Georgia,serif;border:18px solid #0f61ff">
  <div style="display:flex;flex-direction:column;justify-content:space-between;width:100%">
    <div style="display:flex;justify-content:space-between;font-family:monospace;font-size:22px;letter-spacing:4px;text-transform:uppercase;color:#0f61ff">
      <span>tezos · el segundo</span><span>a daily money ritual</span>
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;gap:64px">
      <div style="display:flex;flex-direction:column;gap:18px;width:620px">
        <div style="display:flex;font-size:82px;line-height:.98;font-style:italic;color:#0f61ff">the fountain</div>
        <div style="display:flex;font-size:37px;line-height:1.2">toss a coin,<br />make a public wish</div>
        <div style="display:flex;font-family:monospace;font-size:22px;color:#6b6259;letter-spacing:1px">one wallet · one share · extra coins water everyone</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:flex-end;width:350px;height:330px">
        <div style="display:flex;width:34px;height:94px;background:#0f61ff;border:4px solid #241f1c"></div>
        <div style="display:flex;width:205px;height:58px;margin-top:-5px;border:5px solid #241f1c;border-radius:0 0 999px 999px;background:#86d9f7"></div>
        <div style="display:flex;width:38px;height:62px;margin-top:-5px;background:#0f61ff;border:4px solid #241f1c"></div>
        <div style="display:flex;align-items:flex-start;justify-content:center;width:340px;height:104px;margin-top:-5px;border:5px solid #241f1c;border-radius:0 0 999px 999px;background:#86d9f7">${coins}</div>
      </div>
    </div>
    <div style="display:flex;justify-content:space-between;border-top:3px solid #d8d2c6;padding-top:22px;font-family:monospace;font-size:21px;letter-spacing:2px">
      <span>no house · no chance</span><span>tez-susu.pages.dev/fountain</span>
    </div>
  </div>
</div>`;
  return new ImageResponse(html, {
    width: 1200,
    height: 630,
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
};
