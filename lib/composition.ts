// lib/composition.ts (v6)
// 自足式 composition：唔再靠 registry 遠端組件（果啲係完整 HTML 文件，
// inline 落去會撞 id / script，最後淨返純色底 + 字）。
// 而家背景由 canvas 按時間確定性繪製，文字卡片同字幕都係自己排版。

import { BACKGROUND_SCRIPT, themeFor, type Theme } from "./backgrounds";

export type HyperframesSpec = {
  blocks?: string[];
  components?: string[];
  transitions?: string[];
  caption_style?: string;
};

export type VideoPayload = {
  text: string;
  prompt?: string;
  style: string;
  aspectRatio: string;
  durationSeconds: number;
  pace: "slow" | "normal" | "fast";
  bgm?: string;
  bgmVolume?: number;
  hyperframes?: HyperframesSpec;
  sourceFilename?: string;
  title?: string;
  brand_name?: string;
  brand_color?: string;
  subtitles?: boolean;
  narration_language?: string | null;
  voice?: string | null;
};

const DIMENSIONS: Record<string, { width: number; height: number }> = {
  "16:9": { width: 1920, height: 1080 },
  "9:16": { width: 1080, height: 1920 },
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
};

const PACE_SECONDS: Record<string, number> = { slow: 6, normal: 4, fast: 2.5 };

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/** 將長文字切成最多 maxScenes 段 */
export function splitScenes(text: string, maxScenes: number): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [""];

  const sentences = clean
    .split(/(?<=[。！？!?；;.])\s*/)
    .map((s) => s.trim())
    .filter(Boolean);

  const parts = sentences.length ? sentences : [clean];
  const n = Math.max(1, Math.min(maxScenes, parts.length));
  const perScene = Math.ceil(parts.length / n);

  const scenes: string[] = [];
  for (let i = 0; i < parts.length; i += perScene) {
    scenes.push(parts.slice(i, i + perScene).join(" "));
  }
  return scenes.slice(0, Math.max(1, maxScenes));
}

type Layout = "title" | "statement" | "body" | "quote" | "outro";

function layoutFor(index: number, total: number): Layout {
  if (index === 0) return "title";
  if (index === total - 1) return "outro";
  const cycle: Layout[] = ["statement", "body", "quote"];
  return cycle[(index - 1) % cycle.length];
}

function clipMarkup(params: {
  id: string;
  layout: Layout;
  text: string;
  index: number;
  start: number;
  duration: number;
  brand: string;
  brandColor: string;
  theme: Theme;
  subtitles: boolean;
}) {
  const { id, layout, text, index, start, duration, brand, brandColor, theme, subtitles } = params;
  const safe = escapeHtml(text);
  const kicker = escapeHtml(brand || "");
  const num = String(index + 1).padStart(2, "0");

  let inner = "";
  if (layout === "title") {
    inner = `
      <div class="stack center">
        ${kicker ? `<div class="kicker">${kicker}</div>` : ""}
        <div class="headline reveal">${safe}</div>
        <div class="rule"></div>
      </div>`;
  } else if (layout === "statement") {
    inner = `
      <div class="stack">
        <div class="index">${num}</div>
        <div class="statement reveal">${safe}</div>
      </div>`;
  } else if (layout === "quote") {
    inner = `
      <div class="card reveal">
        <div class="quote-mark">“</div>
        <div class="quote">${safe}</div>
        ${kicker ? `<div class="author">— ${kicker}</div>` : ""}
      </div>`;
  } else if (layout === "outro") {
    inner = `
      <div class="stack center">
        <div class="body reveal">${safe}</div>
        ${kicker ? `<div class="wordmark">${kicker.toUpperCase()}</div>` : ""}
        <div class="rule"></div>
      </div>`;
  } else {
    inner = `
      <div class="stack">
        <div class="bar"></div>
        <div class="body reveal">${safe}</div>
      </div>`;
  }

  const caption = subtitles
    ? `<div class="caption"><span>${safe}</span></div>`
    : "";

  return `
    <div class="clip" id="${id}" data-start="${start}" data-duration="${duration}"
      style="position:absolute;inset:0;opacity:0;">
      <div class="content">${inner}</div>
      ${caption}
    </div>`;
}

export async function buildComposition(args: VideoPayload) {
  const dims = DIMENSIONS[args.aspectRatio] ?? DIMENSIONS["16:9"];
  const sceneSeconds = PACE_SECONDS[args.pace] ?? 4;
  const maxScenes = Math.max(2, Math.round(args.durationSeconds / sceneSeconds));
  const sceneTexts = splitScenes(args.text, maxScenes);
  const brand = args.brand_name || "";
  const theme = themeFor(args.style);
  const brandColor = args.brand_color || theme.blobs[0];
  const subtitles = args.subtitles !== false;

  if (args.title && sceneTexts.length) {
    sceneTexts.unshift(args.title);
  }

  const totalDuration = sceneTexts.length * sceneSeconds;
  const totalFrames = Math.round(totalDuration * 30);

  const clipHTML = sceneTexts
    .map((body, i) =>
      clipMarkup({
        id: `scene-${i + 1}`,
        layout: layoutFor(i, sceneTexts.length),
        text: body,
        index: i,
        start: i * sceneSeconds,
        duration: sceneSeconds,
        brand,
        brandColor,
        theme,
        subtitles,
      }),
    )
    .join("\n");

  const captionBg = theme.dark ? "rgba(2,6,23,0.62)" : "rgba(255,255,255,0.78)";
  const scale = dims.width / 1920;
  const html = `<!DOCTYPE html>
<html lang="${args.narration_language?.startsWith("en") ? "en" : "zh-Hant"}">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(brand || "Video")}</title>
<style>
  :root {
    --brand:${brandColor};
    --ink:${theme.ink};
    --ink-muted:${theme.inkMuted};
    --unit:${scale};
  }
  * { box-sizing:border-box; }
  html, body { margin:0; padding:0; width:100%; height:100%; overflow:hidden;
    background:${theme.gradient[1]}; color:var(--ink);
    font-family:Inter,"Noto Sans TC","PingFang HK","Microsoft JhengHei",system-ui,sans-serif; }
  #stage { position:relative; width:${dims.width}px; height:${dims.height}px; overflow:hidden; }
  #bg { position:absolute; inset:0; z-index:0; }
  .clip { z-index:1; will-change:opacity, transform; }
  .content { position:absolute; inset:0; display:flex; align-items:center;
    padding:${Math.round(120 * scale)}px ${Math.round(150 * scale)}px; }
  .stack { display:flex; flex-direction:column; gap:${Math.round(28 * scale)}px; width:100%; }
  .stack.center { align-items:center; text-align:center; }
  .kicker { letter-spacing:.34em; text-transform:uppercase; color:var(--brand);
    font-size:${Math.round(34 * scale)}px; font-weight:700; }
  .headline { font-size:${Math.round(104 * scale)}px; font-weight:800; line-height:1.14;
    letter-spacing:-.01em; text-shadow:0 ${Math.round(12 * scale)}px ${Math.round(40 * scale)}px rgba(0,0,0,.35); }
  .statement { font-size:${Math.round(82 * scale)}px; font-weight:800; line-height:1.22; }
  .body { font-size:${Math.round(62 * scale)}px; font-weight:600; line-height:1.36; }
  .index { font-size:${Math.round(120 * scale)}px; font-weight:900; color:var(--brand); opacity:.55;
    line-height:1; }
  .bar { width:${Math.round(140 * scale)}px; height:${Math.round(10 * scale)}px; background:var(--brand);
    border-radius:999px; }
  .rule { width:${Math.round(200 * scale)}px; height:${Math.round(6 * scale)}px; background:var(--brand);
    border-radius:999px; }
  .wordmark { font-size:${Math.round(72 * scale)}px; font-weight:900; letter-spacing:.16em; }
  .card { position:relative; width:100%; padding:${Math.round(72 * scale)}px;
    border-radius:${Math.round(36 * scale)}px;
    background:${theme.dark ? "rgba(255,255,255,0.07)" : "rgba(15,23,42,0.05)"};
    border:1px solid ${theme.dark ? "rgba(255,255,255,0.16)" : "rgba(15,23,42,0.10)"};
    backdrop-filter:blur(6px); }
  .quote-mark { position:absolute; top:${Math.round(-6 * scale)}px; left:${Math.round(34 * scale)}px;
    font-size:${Math.round(150 * scale)}px; color:var(--brand); opacity:.6; line-height:1; }
  .quote { font-size:${Math.round(60 * scale)}px; font-weight:600; line-height:1.38; }
  .author { margin-top:${Math.round(26 * scale)}px; color:var(--ink-muted);
    font-size:${Math.round(34 * scale)}px; font-weight:600; }
  .caption { position:absolute; left:8%; right:8%; bottom:${theme.ticker ? "10%" : "6%"};
    display:flex; justify-content:center; z-index:3; }
  .caption span { background:${captionBg}; color:var(--ink);
    padding:${Math.round(16 * scale)}px ${Math.round(30 * scale)}px;
    border-radius:${Math.round(14 * scale)}px; font-size:${Math.round(40 * scale)}px;
    font-weight:600; line-height:1.3; text-align:center; max-width:100%; }
</style>
</head>
<body>
<div id="stage"
  data-composition-id="video"
  data-root="true"
  data-width="${dims.width}"
  data-height="${dims.height}"
  data-start="0"
  data-duration="${totalDuration}">
  <canvas id="bg" width="${dims.width}" height="${dims.height}"></canvas>
  ${clipHTML}
</div>
<script>
${BACKGROUND_SCRIPT}
(function () {
  var theme = ${JSON.stringify(theme)};
  var brandColor = ${JSON.stringify(brandColor)};
  var stage = document.getElementById("stage");
  var clips = Array.prototype.slice.call(stage.querySelectorAll(".clip"));
  var duration = parseFloat(stage.dataset.duration) || 10;
  var renderBackground = makeBackground(document.getElementById("bg"), theme, brandColor);

  function easeOut(p) { return 1 - Math.pow(1 - p, 3); }

  function renderAt(t) {
    renderBackground(t);
    clips.forEach(function (clip) {
      var start = parseFloat(clip.dataset.start) || 0;
      var dur = parseFloat(clip.dataset.duration) || 4;
      var end = start + dur;
      var fade = 0.45;
      var opacity = 0;
      if (t >= start && t < end) {
        if (t < start + fade) opacity = (t - start) / fade;
        else if (t > end - fade) opacity = (end - t) / fade;
        else opacity = 1;
      }
      clip.style.opacity = Math.max(0, Math.min(1, opacity)).toFixed(3);

      var local = Math.max(0, Math.min(1, (t - start) / Math.max(0.001, dur)));
      var intro = easeOut(Math.min(1, local / 0.35));
      var drift = local * 18;
      clip.querySelectorAll(".reveal").forEach(function (el) {
        el.style.transform = "translateY(" + ((1 - intro) * 48 - drift * 0.2).toFixed(2) + "px)";
        el.style.opacity = intro.toFixed(3);
      });
      var content = clip.querySelector(".content");
      if (content) {
        var z = 1 + local * 0.03;
        content.style.transform = "scale(" + z.toFixed(4) + ")";
      }
    });
  }

  var timeline = {
    duration: function () { return duration; },
    time: function () { return typeof window.__videoTime === "number" ? window.__videoTime : 0; },
    progress: function () { return duration ? this.time() / duration : 0; },
    seek: function (t) {
      window.__videoTime = Math.max(0, Math.min(duration, t));
      renderAt(window.__videoTime);
    },
    renderAt: renderAt,
    play: function () { return this; },
    pause: function () { return this; }
  };

  window.__timelines = window.__timelines || {};
  window.__timelines["video"] = timeline;
  window.__timelines["main"] = timeline;
  window.__HYPERFRAMES_READY__ = true;
  renderAt(0);
})();
</script>
</body>
</html>`;

  return {
    html,
    files: [] as Array<{ path: string; content: string }>,
    width: dims.width,
    height: dims.height,
    duration: totalDuration,
    durationInFrames: totalFrames,
    fps: 30,
    style: args.style,
    captionStyle: subtitles ? "burned" : "none",
    audio: args.bgm
      ? { src: args.bgm, volume: typeof args.bgmVolume === "number" ? args.bgmVolume : 0.25 }
      : undefined,
    sceneCount: sceneTexts.length,
  };
}
