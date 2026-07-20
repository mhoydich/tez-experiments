import { ImageResponse } from "workers-og";
import {
  escapeHtml,
  formatReceiptTime,
  operationHashPattern,
  readFountainReceipt,
  receiptWish,
  shortenAddress,
  truncateText,
} from "../../../src/share-fountain";

const missingHeaders = {
  "Cache-Control": "public, max-age=30",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow",
};

export const onRequestGet: PagesFunction<Env, "hash"> = async (context) => {
  const param = context.params.hash;
  const hash = (Array.isArray(param) ? param[0] || "" : param).replace(/\.png$/, "");
  if (!operationHashPattern.test(hash)) {
    return new Response("no such toss", { status: 404, headers: missingHeaders });
  }

  try {
    const receipt = await readFountainReceipt(hash, context.env);
    if (!receipt) return new Response("no such toss", { status: 404, headers: missingHeaders });

    const wish = truncateText(receiptWish(receipt), 120);
    const wishLength = Array.from(wish).length;
    const wishSize = wishLength > 104 ? 40 : wishLength > 82 ? 46 : wishLength > 55 ? 58 : 68;
    const time = formatReceiptTime(receipt.timestamp);
    const html = `<div style="display:flex;width:1200px;height:630px;padding:58px 64px;background:#f2efe9;color:#241f1c;font-family:Georgia,serif;border:18px solid #0f61ff">
  <div style="display:flex;flex-direction:column;justify-content:space-between;width:100%">
    <div style="display:flex;justify-content:space-between;font-family:monospace;font-size:22px;letter-spacing:4px;text-transform:uppercase;color:#0f61ff">
      <span>the fountain · toss receipt</span><span>1 tez</span>
    </div>
    <div style="display:flex;align-items:center;gap:48px">
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;width:210px;height:210px;border:5px solid #241f1c;border-radius:999px;background:#86d9f7;box-shadow:12px 12px 0 #0f61ff;color:#0f61ff">
        <span style="display:flex;font-size:96px;line-height:.8">1</span><span style="display:flex;margin-top:16px;font-family:monospace;font-size:21px;letter-spacing:5px">TEZ</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:20px;flex:1">
        <div style="display:flex;font-size:${wishSize}px;line-height:1.12;font-style:italic;overflow-wrap:anywhere">“${escapeHtml(wish)}”</div>
        <div style="display:flex;font-family:monospace;font-size:22px;color:#6b6259;letter-spacing:1px">${escapeHtml(shortenAddress(receipt.sender))} · ${escapeHtml(time)} UTC</div>
      </div>
    </div>
    <div style="display:flex;justify-content:space-between;border-top:3px solid #d8d2c6;padding-top:22px;font-family:monospace;font-size:21px;letter-spacing:2px">
      <span>one coin joined the equal split</span><span>tez-susu.pages.dev/fountain</span>
    </div>
  </div>
</div>`;
    return new ImageResponse(html, {
      width: 1200,
      height: 630,
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=180, stale-while-revalidate=600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error(JSON.stringify({
      message: "fountain receipt OG image failed",
      operationHash: hash,
      error: error instanceof Error ? error.message : String(error),
    }));
    return new Response("image could not be rendered", {
      status: 502,
      headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
    });
  }
};
