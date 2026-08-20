// lib/composition2.ts
// Applies a viewport-independent text scale and retimes scenes from their actual visible text.
import { buildComposition as baseComposition } from "./composition";

type BaseArgs = Parameters<typeof baseComposition>[0];
type BaseResult = Awaited<ReturnType<typeof baseComposition>>;
type ExtendedArgs = BaseArgs & { textScale?: number };

function applyScale(html: string, requestedScale: number, aspectRatio: string): string {
  // The base composition already multiplies all typography by width / 1920.
  // Compensate for that internal scale so a chosen size has the same visual meaning in 9:16, 1:1 and 16:9.
  const width = aspectRatio === "9:16" || aspectRatio === "1:1" || aspectRatio === "4:5" ? 1080 : 1920;
  const baseViewportScale = width / 1920;
  const factor = requestedScale / baseViewportScale;
  if (Math.abs(factor - 1) < 0.01) return html;
  return html.replace(/font-size:\s*(\d+(?:\.\d+)?)px/g, (_match, value: string) =>
    `font-size:${Math.max(12, Math.round(Number(value) * factor))}px`,
  );
}

function visibleTextLength(chunk: string): number {
  // Prefer the exact burned caption. It is the same scene text and excludes CSS/JS/meta labels.
  const caption = chunk.match(/class="caption"[^>]*>\s*<span>([\s\S]*?)<\/span>/);
  const reveal = chunk.match(/class="[^"]*reveal[^"]*"[^>]*>([\s\S]*?)<\/div>/);
  const source = caption?.[1] ?? reveal?.[1] ?? "";
  const text = source
    .replace(/<[^>]*>/g, "")
    .replace(/&(?:amp|lt|gt|quot|#039);/g, "x")
    .replace(/\s+/g, "");
  return Math.max(6, text.length);
}

function retime(html: string, total: number): string {
  const re = /<div class="clip([^"]*)" id="([^"]+)" data-start="([\d.]+)" data-duration="([\d.]+)"/g;
  const clips: Array<{ match: string; cls: string; id: string; index: number }> = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    clips.push({ match: match[0], cls: match[1], id: match[2], index: match.index });
  }
  if (clips.length < 2 || total <= 0) return html;

  const weights = clips.map((clip, index) => {
    const end = index + 1 < clips.length ? clips[index + 1].index : html.indexOf("<script>", clip.index);
    return visibleTextLength(html.slice(clip.index, end > clip.index ? end : html.length));
  });
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  const minScene = Math.min(1.8, total / clips.length);
  let durations = weights.map((weight) => Math.max(minScene, (weight / sum) * total));
  const durationSum = durations.reduce((a, b) => a + b, 0) || 1;
  durations = durations.map((duration) => (duration / durationSum) * total);

  let elapsed = 0;
  let output = html;
  clips.forEach((clip, index) => {
    const replacement = `<div class="clip${clip.cls}" id="${clip.id}" data-start="${elapsed.toFixed(3)}" data-duration="${durations[index].toFixed(3)}"`;
    output = output.replace(clip.match, replacement);
    elapsed += durations[index];
  });
  return output;
}

export async function buildComposition(args: ExtendedArgs): Promise<BaseResult> {
  const result = await baseComposition(args);
  const scale = Math.min(2.4, Math.max(0.7, Number(args.textScale) || 1));
  let html = applyScale(String(result.html || ""), scale, args.aspectRatio);
  html = retime(html, Number(result.duration) || 0);
  console.log("[composition2] textScale", scale, "aspectRatio", args.aspectRatio);
  return { ...result, html };
}
