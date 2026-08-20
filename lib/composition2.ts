// lib/composition2.ts
// 包一層 buildComposition：
//  1) 套用用戶揀嘅「文字大細」(textScale) — 放大／縮細所有 inline font-size。
//  2) 按每場字數重新分配時間，避免長句字幕未讀完就切走。
import { buildComposition as baseComposition } from "./composition";

type BaseResult = Awaited<ReturnType<typeof baseComposition>>;

function applyScale(html: string, scale: number): string {
  if (!scale || Math.abs(scale - 1) < 0.01) return html;
  return html.replace(/font-size:\s*(\d+(?:\.\d+)?)px/g, (_m, n: string) =>
    `font-size:${Math.max(12, Math.round(Number(n) * scale))}px`,
  );
}

/** 重新按字數分配每個 .clip 嘅 data-start / data-duration */
function retime(html: string, total: number): string {
  const re = /<div class="clip([^"]*)" id="([^"]+)" data-start="([\d.]+)" data-duration="([\d.]+)"/g;
  const clips: Array<{ match: string; cls: string; id: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) clips.push({ match: m[0], cls: m[1], id: m[2] });
  if (clips.length < 2 || !total) return html;

  const weights = clips.map((c) => {
    const start = html.indexOf(c.match);
    const nextIdx = clips
      .map((o) => html.indexOf(o.match))
      .filter((i) => i > start)
      .sort((a, b) => a - b)[0];
    const chunk = html.slice(start, nextIdx === undefined ? html.length : nextIdx);
    const textOnly = chunk.replace(/<[^>]*>/g, "").replace(/\s+/g, "");
    return Math.max(6, textOnly.length);
  });

  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  const minScene = Math.min(1.8, total / clips.length);
  let durations = weights.map((w) => Math.max(minScene, (w / sum) * total));
  const dSum = durations.reduce((a, b) => a + b, 0) || 1;
  durations = durations.map((d) => (d / dSum) * total);

  let acc = 0;
  let out = html;
  clips.forEach((c, i) => {
    const start = acc;
    acc += durations[i];
    const replacement = `<div class="clip${c.cls}" id="${c.id}" data-start="${start.toFixed(3)}" data-duration="${durations[i].toFixed(3)}"`;
    out = out.replace(c.match, replacement);
  });
  return out;
}

export async function buildComposition(args: Parameters<typeof baseComposition>[0] & { textScale?: number }): Promise<BaseResult> {
  const result = await baseComposition(args);
  const scale = Math.min(2, Math.max(0.6, Number((args as { textScale?: number }).textScale) || 1));
  let html = applyScale(String(result.html || ""), scale);
  html = retime(html, Number(result.duration) || 0);
  console.log("[composition2] textScale", scale);
  return { ...result, html };
}
