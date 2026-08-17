// lib/composition.ts (v7)
// 自足式 composition：背景由 canvas 按時間確定性繪製，文字卡片同字幕自己排版。
// v7：每個風格有唔同版面（字體／對齊／裝飾／轉場），場景切割會過濾空白同 emoji，
//     場景時長會平均鋪滿用戶要求嘅片長，唔會出現後半段黑畫面。

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

/** 每個風格嘅版面外觀，令唔同風格唔止顏色唔同，排版都唔同。 */
export type Look = {
  font: string;
  align: "left" | "center";
  /** 標題字重 */
  weight: number;
  /** 標題字距 */
  tracking: string;
  /** 內文裝飾 */
  decor: "bar" | "index" | "underline" | "dot" | "rule" | "none";
  /** 文字卡片外框 */
  card: "none" | "soft" | "solid" | "outline";
  /** 轉場 */
  transition: "rise" | "fade" | "slideLeft" | "zoom" | "blur";
  /** 標題全大寫（英文有效） */
  upper: boolean;
};

const SERIF = `"Noto Serif TC","Songti TC",Georgia,"Times New Roman",serif`;
const SANS = `Inter,"Noto Sans TC","PingFang HK","Microsoft JhengHei",system-ui,sans-serif`;
const MONO = `"JetBrains Mono","SFMono-Regular",Menlo,Consolas,"Noto Sans TC",monospace`;

const DEFAULT_LOOK: Look = {
  font: SANS,
  align: "left",
  weight: 800,
  tracking: "-0.01em",
  decor: "index",
  card: "none",
  transition: "rise",
  upper: false,
};

export const LOOKS: Record<string, Look> = {
  financial_commentary: { ...DEFAULT_LOOK, decor: "index", card: "none", transition: "rise" },
  news_brief: { ...DEFAULT_LOOK, align: "left", decor: "bar", card: "solid", transition: "slideLeft", upper: true },
  product_promo: { ...DEFAULT_LOOK, align: "center", decor: "dot", card: "soft", transition: "zoom", weight: 900 },
  explainer_clean: { ...DEFAULT_LOOK, align: "left", decor: "underline", card: "outline", transition: "fade", weight: 700 },
  whiteboard_tutorial: { ...DEFAULT_LOOK, font: MONO, align: "left", decor: "dot", card: "outline", transition: "fade", weight: 700, tracking: "0" },
  social_short: { ...DEFAULT_LOOK, align: "center", decor: "none", card: "solid", transition: "zoom", weight: 900, tracking: "-0.02em" },
  cinematic_brand: { ...DEFAULT_LOOK, font: SERIF, align: "center", decor: "underline", card: "none", transition: "blur", weight: 700, tracking: "0.04em" },
  tech_neon: { ...DEFAULT_LOOK, font: MONO, align: "left", decor: "bar", card: "outline", transition: "slideLeft", weight: 700, tracking: "0.02em", upper: true },
  luxury_gold: { ...DEFAULT_LOOK, font: SERIF, align: "center", decor: "underline", card: "none", transition: "fade", weight: 600, tracking: "0.08em" },
  minimal_mono: { ...DEFAULT_LOOK, align: "left", decor: "none", card: "none", transition: "fade", weight: 600, tracking: "0" },
  nature_calm: { ...DEFAULT_LOOK, font: SERIF, align: "center", decor: "dot", card: "soft", transition: "rise", weight: 600, tracking: "0.02em" },
  retro_wave: { ...DEFAULT_LOOK, align: "center", decor: "bar", card: "solid", transition: "zoom", weight: 900, tracking: "0.06em", upper: true },
  corporate_clean: { ...DEFAULT_LOOK, align: "left", decor: "index", card: "outline", transition: "slideLeft", weight: 700 },
  crypto_dark: { ...DEFAULT_LOOK, font: MONO, align: "left", decor: "index", card: "solid", transition: "rise", weight: 700, tracking: "0.02em" },
  sunset_warm: { ...DEFAULT_LOOK, align: "center", decor: "dot", card: "soft", transition: "blur", weight: 800 },
  biennale_yellow: { ...DEFAULT_LOOK, font: SERIF, align: "left", decor: "rule", card: "none", transition: "fade", weight: 600, tracking: "-0.01em" },
  blockframe: { ...DEFAULT_LOOK, font: SANS, align: "left", decor: "bar", card: "none", transition: "slideLeft", weight: 900, tracking: "-0.03em", upper: true },
  blue_professional: { ...DEFAULT_LOOK, font: SANS, align: "left", decor: "rule", card: "none", transition: "fade", weight: 700, tracking: "-0.01em" },
  bold_poster: { ...DEFAULT_LOOK, font: SERIF, align: "left", decor: "rule", card: "none", transition: "rise", weight: 800, tracking: "-0.02em" },
  broadside: { ...DEFAULT_LOOK, font: SANS, align: "left", decor: "none", card: "none", transition: "slideLeft", weight: 900, tracking: "-0.035em", upper: true },
  capsule: { ...DEFAULT_LOOK, font: SERIF, align: "center", decor: "dot", card: "none", transition: "zoom", weight: 700, tracking: "-0.01em" },
  cartesian: { ...DEFAULT_LOOK, font: SERIF, align: "left", decor: "rule", card: "none", transition: "fade", weight: 400, tracking: "0" },
  cobalt_grid: { ...DEFAULT_LOOK, font: SERIF, align: "left", decor: "index", card: "none", transition: "rise", weight: 600, tracking: "-0.01em" },
  coral: { ...DEFAULT_LOOK, font: SANS, align: "left", decor: "bar", card: "none", transition: "slideLeft", weight: 900, tracking: "-0.02em", upper: true },
  creative_mode: { ...DEFAULT_LOOK, font: SANS, align: "left", decor: "bar", card: "none", transition: "zoom", weight: 900, tracking: "-0.03em", upper: true },
};

export function lookFor(style: string | undefined): Look {
  return LOOKS[style || ""] ?? DEFAULT_LOOK;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/** 移除 emoji、項目符號同多餘空白（emoji 喺 sandbox 字體會變豆腐／空白） */
export function cleanLine(line: string): string {
  return line
    .replace(
      /[\u{1F000}-\u{1FAFF}\u{2190}-\u{21FF}\u{2300}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu,
      "",
    )
    .replace(/^[\s\-–—*•·>#]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** 將長文字切成最多 maxScenes 段（先按行，再按句） */
export function splitScenes(text: string, maxScenes: number): string[] {
  const lines = text
    .split(/\r?\n+/)
    .map(cleanLine)
    .filter((l) => l.replace(/[^\p{L}\p{N}]/gu, "").length >= 2);

  const parts: string[] = [];
  for (const line of lines) {
    if (line.length <= 60) {
      parts.push(line);
      continue;
    }
    const sentences = line
      .split(/(?<=[。！？!?；;.])\s*/)
      .map((s) => s.trim())
      .filter((s) => s.replace(/[^\p{L}\p{N}]/gu, "").length >= 2);
    parts.push(...(sentences.length ? sentences : [line]));
  }

  if (!parts.length) return [cleanLine(text) || "…"];
  if (parts.length <= maxScenes) return parts;

  // 合併相鄰句子直到唔多過 maxScenes 場
  const perScene = Math.ceil(parts.length / maxScenes);
  const scenes: string[] = [];
  for (let i = 0; i < parts.length; i += perScene) {
    scenes.push(parts.slice(i, i + perScene).join(" "));
  }
  return scenes;
}

type Layout = "title" | "statement" | "body" | "quote" | "outro";

function layoutFor(index: number, total: number): Layout {
  if (index === 0) return "title";
  if (index === total - 1) return "outro";
  const cycle: Layout[] = ["statement", "body", "quote"];
  return cycle[(index - 1) % cycle.length];
}

/** 文字愈長字愈細，避免爆出畫面 */
function fitSize(base: number, len: number): number {
  if (len <= 18) return base;
  if (len <= 34) return base * 0.82;
  if (len <= 60) return base * 0.66;
  if (len <= 100) return base * 0.52;
  return base * 0.42;
}

function decorMarkup(look: Look, index: number): string {
  const num = String(index + 1).padStart(2, "0");
  if (look.decor === "index") return `<div class="index">${num}</div>`;
  if (look.decor === "bar") return `<div class="bar"></div>`;
  if (look.decor === "dot") return `<div class="dot"></div>`;
  if (look.decor === "underline" || look.decor === "rule") return `<div class="rule"></div>`;
  return "";
}

function clipMarkup(params: {
  id: string;
  layout: Layout;
  text: string;
  index: number;
  start: number;
  duration: number;
  brand: string;
  look: Look;
  scale: number;
  subtitles: boolean;
}) {
  const { id, layout, text, index, start, duration, brand, look, scale, subtitles } = params;
  const safe = escapeHtml(text);
  const kicker = escapeHtml(brand || "");
  const len = text.length;

  const size = (base: number) => Math.round(fitSize(base, len) * scale);

  let inner = "";
  if (layout === "title") {
    inner = `
      <div class="stack center">
        ${kicker ? `<div class="kicker">${kicker}</div>` : ""}
        <div class="headline reveal" style="font-size:${size(104)}px">${safe}</div>
        <div class="rule"></div>
      </div>`;
  } else if (layout === "outro") {
    inner = `
      <div class="stack center">
        <div class="body reveal" style="font-size:${size(70)}px">${safe}</div>
        ${kicker ? `<div class="wordmark">${kicker.toUpperCase()}</div>` : ""}
        <div class="rule"></div>
      </div>`;
  } else if (layout === "quote" && look.card !== "none") {
    inner = `
      <div class="card reveal">
        <div class="quote" style="font-size:${size(64)}px">${safe}</div>
        ${kicker ? `<div class="author">— ${kicker}</div>` : ""}
      </div>`;
  } else if (layout === "statement") {
    inner = `
      <div class="stack">
        ${decorMarkup(look, index)}
        <div class="statement reveal" style="font-size:${size(84)}px">${safe}</div>
      </div>`;
  } else {
    inner = `
      <div class="stack">
        ${decorMarkup(look, index)}
        <div class="body reveal" style="font-size:${size(68)}px">${safe}</div>
      </div>`;
  }

  const caption = subtitles ? `<div class="caption"><span>${safe}</span></div>` : "";

  return `
    <div class="clip" id="${id}" data-start="${start.toFixed(3)}" data-duration="${duration.toFixed(3)}"
      style="position:absolute;inset:0;opacity:0;">
      <div class="content">${inner}</div>
      ${caption}
    </div>`;
}

/** Hyperframes 編輯風格版面：頂／底 meta 線、超大標題、重點字上色、細小說明段。 */
function editorialClipMarkup(params: {
  id: string;
  text: string;
  index: number;
  total: number;
  start: number;
  duration: number;
  brand: string;
  look: Look;
  scale: number;
  metaLeft: string;
  metaRight: string;
}) {
  const { id, text, index, total, start, duration, brand, look, scale, metaLeft, metaRight } = params;
  const len = text.length;
  const isTitle = index === 0;
  const base = isTitle ? 210 : 156;
  const size = Math.round(fitSize(base, len) * scale);

  // 最後一段（句號前）用重點色，模仿 Hyperframes 海報嘅撞色字
  const m = text.match(/^(.*?)([^\s，,。！？!?、]{2,14}[。．.!！?？]?)$/);
  const head = escapeHtml(m ? m[1] : text);
  const accent = escapeHtml(m ? m[2] : "");

  const num = String(index + 1).padStart(2, "0");
  const foot = escapeHtml(brand || metaLeft);

  return `
    <div class="clip ed" id="${id}" data-start="${start.toFixed(3)}" data-duration="${duration.toFixed(3)}"
      style="position:absolute;inset:0;opacity:0;">
      <div class="ed-meta ed-top">
        <span>${escapeHtml(metaLeft)}</span><span>${escapeHtml(metaRight)}</span>
      </div>
      <div class="ed-body">
        <div class="ed-head reveal" style="font-size:${size}px">${head}${
          accent ? `<span class="ed-accent">${accent}</span>` : ""
        }</div>
        <div class="ed-note">${escapeHtml(brand ? `${brand} — Frame ${num} / ${String(total).padStart(2, "0")}` : `Frame ${num} / ${String(total).padStart(2, "0")}`)}</div>
      </div>
      <div class="ed-meta ed-bottom">
        <span>${foot}</span><span>${num} / ${String(total).padStart(2, "0")}</span>
      </div>
    </div>`;
}

export async function buildComposition(args: VideoPayload) {
  const dims = DIMENSIONS[args.aspectRatio] ?? DIMENSIONS["16:9"];
  const paceSeconds = PACE_SECONDS[args.pace] ?? 4;
  const requested = Math.max(5, args.durationSeconds || 30);
  const maxScenes = Math.max(2, Math.round(requested / paceSeconds));
  const sceneTexts = splitScenes(args.text, maxScenes);
  const brand = args.brand_name || "";
  const theme = themeFor(args.style);
  const look = lookFor(args.style);
  const brandColor = args.brand_color || theme.blobs[0];
  const editorialSpec = (theme as { editorial?: { metaLeft?: string; metaRight?: string } }).editorial;
  const isEditorial = !!editorialSpec;
  const subtitles = args.subtitles !== false && !isEditorial;

  const cleanTitle = args.title ? cleanLine(args.title) : "";
  if (cleanTitle) sceneTexts.unshift(cleanTitle);

  // 平均鋪滿用戶要求嘅片長 → 唔會有後半段空白畫面
  const totalDuration = requested;
  const sceneSeconds = totalDuration / sceneTexts.length;
  const totalFrames = Math.round(totalDuration * 30);
  const scale = dims.width / 1920;

  const clipHTML = sceneTexts
    .map((body, i) =>
      isEditorial
        ? editorialClipMarkup({
            id: `scene-${i + 1}`,
            text: body,
            index: i,
            total: sceneTexts.length,
            start: i * sceneSeconds,
            duration: sceneSeconds,
            brand,
            look,
            scale,
            metaLeft: editorialSpec?.metaLeft ?? "FRAME SYSTEM — VOL. 01",
            metaRight: editorialSpec?.metaRight ?? "2026",
          })
        : clipMarkup({
        id: `scene-${i + 1}`,
        layout: layoutFor(i, sceneTexts.length),
        text: body,
        index: i,
        start: i * sceneSeconds,
        duration: sceneSeconds,
        brand,
        look,
        scale,
        subtitles,
      }),
    )
    .join("\n");

  const captionBg = theme.dark ? "rgba(2,6,23,0.62)" : "rgba(255,255,255,0.78)";
  const cardBg =
    look.card === "solid"
      ? theme.dark
        ? "rgba(2,6,23,0.55)"
        : "rgba(255,255,255,0.82)"
      : look.card === "soft"
        ? theme.dark
          ? "rgba(255,255,255,0.07)"
          : "rgba(15,23,42,0.05)"
        : "transparent";
  const cardBorder =
    look.card === "outline"
      ? `2px solid ${brandColor}`
      : look.card === "none"
        ? "none"
        : `1px solid ${theme.dark ? "rgba(255,255,255,0.16)" : "rgba(15,23,42,0.10)"}`;

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
  }
  * { box-sizing:border-box; }
  html, body { margin:0; padding:0; width:100%; height:100%; overflow:hidden;
    background:${theme.gradient[1]}; color:var(--ink);
    font-family:${look.font}; }
  #stage { position:relative; width:${dims.width}px; height:${dims.height}px; overflow:hidden; }
  #bg { position:absolute; inset:0; z-index:0; }
  .clip { z-index:1; will-change:opacity, transform, filter; }
  .content { position:absolute; inset:0; display:flex; align-items:center;
    justify-content:${look.align === "center" ? "center" : "flex-start"};
    padding:${Math.round(120 * scale)}px ${Math.round(150 * scale)}px; }
  .stack { display:flex; flex-direction:column; gap:${Math.round(26 * scale)}px; width:100%;
    ${look.align === "center" ? "align-items:center; text-align:center;" : ""} }
  .stack.center { align-items:center; text-align:center; }
  .kicker { letter-spacing:.34em; text-transform:uppercase; color:var(--brand);
    font-size:${Math.round(34 * scale)}px; font-weight:700; }
  .headline { font-weight:${look.weight}; line-height:1.16; letter-spacing:${look.tracking};
    ${look.upper ? "text-transform:uppercase;" : ""}
    ${theme.dark ? `text-shadow:0 ${Math.round(12 * scale)}px ${Math.round(40 * scale)}px rgba(0,0,0,.35);` : ""} }
  .statement { font-weight:${look.weight}; line-height:1.24; letter-spacing:${look.tracking}; }
  .body { font-weight:${Math.max(500, look.weight - 200)}; line-height:1.38; }
  .index { font-size:${Math.round(112 * scale)}px; font-weight:900; color:var(--brand); opacity:.55;
    line-height:1; }
  .bar { width:${Math.round(140 * scale)}px; height:${Math.round(10 * scale)}px; background:var(--brand);
    border-radius:999px; }
  .dot { width:${Math.round(26 * scale)}px; height:${Math.round(26 * scale)}px; background:var(--brand);
    border-radius:999px; }
  .rule { width:${Math.round(200 * scale)}px; height:${Math.round(6 * scale)}px; background:var(--brand);
    border-radius:999px; }
  .wordmark { font-size:${Math.round(64 * scale)}px; font-weight:900; letter-spacing:.16em; }
  .card { position:relative; width:100%; padding:${Math.round(70 * scale)}px;
    border-radius:${look.card === "outline" ? Math.round(12 * scale) : Math.round(36 * scale)}px;
    background:${cardBg}; border:${cardBorder};
    ${look.align === "center" ? "text-align:center;" : ""} }
  .quote { font-weight:600; line-height:1.4; }
  .author { margin-top:${Math.round(24 * scale)}px; color:var(--ink-muted);
    font-size:${Math.round(34 * scale)}px; font-weight:600; }
  .caption { position:absolute; left:8%; right:8%; bottom:${theme.ticker ? "10%" : "6%"};
    display:flex; justify-content:center; z-index:3; }
  .caption span { background:${captionBg}; color:var(--ink);
    padding:${Math.round(16 * scale)}px ${Math.round(30 * scale)}px;
    border-radius:${Math.round(14 * scale)}px; font-size:${Math.round(38 * scale)}px;
    font-weight:600; line-height:1.3; text-align:center; max-width:100%; }
  .ed-meta { position:absolute; left:${Math.round(96 * scale)}px; right:${Math.round(96 * scale)}px;
    display:flex; justify-content:space-between; align-items:center;
    font-family:${SANS}; font-size:${Math.round(22 * scale)}px; font-weight:600;
    letter-spacing:.22em; text-transform:uppercase; color:var(--ink-muted); }
  .ed-top { top:${Math.round(74 * scale)}px; padding-bottom:${Math.round(14 * scale)}px;
    border-bottom:1px solid rgba(0,0,0,.20); }
  .ed-bottom { bottom:${Math.round(74 * scale)}px; padding-top:${Math.round(14 * scale)}px;
    border-top:1px solid rgba(0,0,0,.20); }
  .ed-body { position:absolute; left:${Math.round(96 * scale)}px; right:${Math.round(96 * scale)}px;
    top:50%; transform:translateY(-50%);
    ${look.align === "center" ? "text-align:center;" : "text-align:left;"} }
  .ed-head { font-family:${look.font}; font-weight:${look.weight}; line-height:1.05;
    letter-spacing:${look.tracking}; ${look.upper ? "text-transform:uppercase;" : ""}
    max-width:${look.align === "center" ? "100%" : "76%"}; text-shadow:none; }
  .ed-accent { color:var(--brand); }
  .ed-note { margin-top:${Math.round(34 * scale)}px; font-family:${SANS};
    font-size:${Math.round(26 * scale)}px; font-weight:500; line-height:1.5;
    letter-spacing:.02em; color:var(--ink-muted);
    max-width:${look.align === "center" ? "100%" : "46%"};
    ${look.align === "center" ? "margin-left:auto;margin-right:auto;" : ""} }
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
  var transition = ${JSON.stringify(look.transition)};
  var brandColor = ${JSON.stringify(brandColor)};
  var stage = document.getElementById("stage");
  var clips = Array.prototype.slice.call(stage.querySelectorAll(".clip"));
  var duration = parseFloat(stage.dataset.duration) || 10;
  var renderBackground = makeBackground(document.getElementById("bg"), theme, brandColor);

  function easeOut(p) { return 1 - Math.pow(1 - p, 3); }

  function applyTransition(el, intro, local) {
    var p = 1 - intro;
    if (transition === "slideLeft") {
      el.style.transform = "translateX(" + (p * 120).toFixed(2) + "px)";
      el.style.filter = "";
    } else if (transition === "zoom") {
      el.style.transform = "scale(" + (0.88 + intro * 0.12).toFixed(4) + ")";
      el.style.filter = "";
    } else if (transition === "blur") {
      el.style.transform = "translateY(" + (p * 24).toFixed(2) + "px)";
      el.style.filter = "blur(" + (p * 14).toFixed(2) + "px)";
    } else if (transition === "fade") {
      el.style.transform = "";
      el.style.filter = "";
    } else {
      el.style.transform = "translateY(" + (p * 48 - local * 3.6).toFixed(2) + "px)";
      el.style.filter = "";
    }
    el.style.opacity = intro.toFixed(3);
  }

  function renderAt(t) {
    renderBackground(t);
    clips.forEach(function (clip) {
      var start = parseFloat(clip.dataset.start) || 0;
      var dur = parseFloat(clip.dataset.duration) || 4;
      var end = start + dur;
      var fade = Math.min(0.45, dur * 0.18);
      var opacity = 0;
      if (t >= start && t < end) {
        if (t < start + fade) opacity = (t - start) / fade;
        else if (t > end - fade) opacity = (end - t) / fade;
        else opacity = 1;
      } else if (t >= end && clip === clips[clips.length - 1]) {
        opacity = 1;
      }
      clip.style.opacity = Math.max(0, Math.min(1, opacity)).toFixed(3);

      var local = Math.max(0, Math.min(1, (t - start) / Math.max(0.001, dur)));
      var intro = easeOut(Math.min(1, local / 0.35));
      clip.querySelectorAll(".reveal").forEach(function (el) {
        applyTransition(el, intro, local);
      });
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
