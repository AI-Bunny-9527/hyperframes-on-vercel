// lib/composition.ts  (v5 — 真正用 HyperFrames registry 組件)
// 之前嘅版本自己砌純文字 HTML，所以無論揀邊個風格，出嚟都係「底色 + 文字」。
// 呢個版本改為掛載官方組件（titlecard-calm / headline-slam / whiteboard-ink …），
// 每個風格會有唔同動畫。

import { fetchComponent, slotsFor, type SlotSpec } from "./registry";

export type VideoPayload = {
  text?: string;
  prompt?: string;
  source_filename?: string;
  style?: string;
  aspect_ratio?: string;
  duration_seconds?: number;
  duration?: number;
  pace?: "slow" | "normal" | "fast";
  brand_name?: string;
  brand_color?: string;
  bgm?: string;
  bgm_url?: string;
  bgm_volume?: number;
  hyperframes?: {
    blocks?: string[];
    components?: string[];
    transitions?: string[];
    caption_style?: string;
  };
};

const DIMS: Record<string, { width: number; height: number }> = {
  "16:9": { width: 1920, height: 1080 },
  "9:16": { width: 1080, height: 1920 },
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
};

const PACE: Record<string, number> = { slow: 6, normal: 4.5, fast: 3 };

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function splitScenes(text: string, max: number): string[] {
  const parts = text
    .split(/\n{2,}|(?<=[。！？!?；;])\s*/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  if (parts.length === 0) return ["GoMan 為你帶來最新市場洞察"];
  if (parts.length <= max) return parts;
  const per = Math.ceil(parts.length / max);
  const out: string[] = [];
  for (let i = 0; i < parts.length; i += per) out.push(parts.slice(i, i + per).join(" "));
  return out.slice(0, max);
}

export type BuiltComposition = {
  html: string;
  /** 相對檔名 → 檔案內容，route 要一齊寫入渲染資料夾 */
  files: Record<string, string>;
  width: number;
  height: number;
  duration: number;
  sceneCount: number;
};

export async function buildComposition(payload: VideoPayload): Promise<BuiltComposition> {
  const { width, height } = DIMS[payload.aspect_ratio || "16:9"] ?? DIMS["16:9"];
  const requested = Number(payload.duration_seconds ?? payload.duration) || 30;
  const duration = Math.max(6, Math.min(300, requested));
  const per = PACE[payload.pace || "normal"] ?? 4.5;

  const sceneCount = Math.max(2, Math.min(24, Math.round(duration / per)));
  const sceneSeconds = duration / sceneCount;

  const raw = (payload.text || payload.prompt || "GoMan 為你帶來最新市場洞察").toString();
  const scenes = splitScenes(raw, sceneCount);
  const brand = payload.brand_name || "";
  const accent = payload.brand_color || "#C8102E";

  const recipe = slotsFor(payload.style);
  const pick = (i: number): SlotSpec => {
    if (i === 0) return recipe.intro;
    if (i === scenes.length - 1) return recipe.outro;
    return recipe.body[(i - 1) % recipe.body.length];
  };

  // 下載每個用到嘅組件
  const used = Array.from(new Set(scenes.map((_, i) => pick(i).component)));
  const files: Record<string, string> = {};
  await Promise.all(
    used.map(async (name) => {
      files[`components/${name}.html`] = await fetchComponent(name);
    }),
  );

  const mounts = scenes
    .map((text, i) => {
      const slot = pick(i);
      const vars = slot.vars(text, i, brand);
      const start = +(i * sceneSeconds).toFixed(3);
      return `      <div
        id="scene-${i}"
        class="mount"
        data-composition-id="${slot.component}"
        data-composition-src="./components/${slot.component}.html"
        data-variable-values='${esc(JSON.stringify(vars)).replace(/'/g, "&#39;")}'
        data-start="${start}"
        data-duration="${sceneSeconds.toFixed(3)}"
        data-track-index="0"
        data-width="${width}"
        data-height="${height}"
      ></div>`;
    })
    .join("\n");

  const bgm = payload.bgm_url || payload.bgm || "";
  const audio = bgm
    ? `      <audio src="${esc(bgm)}" data-start="0" data-duration="${duration}" data-track-index="1" data-volume="${
        typeof payload.bgm_volume === "number" ? payload.bgm_volume : 0.25
      }"></audio>`
    : "";

  const html = `<!doctype html>
<html lang="zh-HK">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${width}, height=${height}" />
    <title>GoMan Video</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: ${width}px; height: ${height}px; overflow: hidden; background: #0b0c0e; }
      #root {
        --bg: #0b0c0e;
        --fg: #f7f7f2;
        --muted: #aeb6c2;
        --surface: #111318;
        --border: #292d35;
        --accent: ${accent};
        --font-display: "Noto Sans TC", "PingFang HK", "Helvetica Neue", Arial, sans-serif;
        --font-body: "Noto Sans TC", "PingFang HK", Inter, system-ui, sans-serif;
        --font-mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
        position: relative; width: ${width}px; height: ${height}px; overflow: hidden;
        background: var(--bg); color: var(--fg);
      }
      .mount { position: absolute; inset: 0; container-type: size; overflow: hidden; }
    </style>
  </head>
  <body>
    <div
      id="root"
      data-composition-id="main"
      data-start="0"
      data-duration="${duration}"
      data-width="${width}"
      data-height="${height}"
      data-fps="30"
    >
${mounts}
${audio}
    </div>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <script>
      window.__timelines = window.__timelines || {};
      window.__timelines["main"] = gsap.timeline({ paused: true });
    </script>
  </body>
</html>`;

  return { html, files, width, height, duration, sceneCount: scenes.length };
}
