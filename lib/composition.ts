// lib/composition.ts (v5)
import {
  fetchBlockHTML,
  fetchComponentHTML,
  getPresetSlots,
  splitScenes,
} from "./registry";

export type HyperframesSpec = {
  blocks: string[];
  components: string[];
  transitions: string[];
  caption_style: string;
};

export type VideoPayload = {
  text: string;
  prompt?: string;
  style: string;
  aspectRatio: string;
  durationSeconds: number;
  pace: "slow" | "normal" | "fast";
  bgm?: string;
  hyperframes?: HyperframesSpec;
  sourceFilename?: string;
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
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
function toJsonAttr(obj: unknown): string {
  return escapeHtml(JSON.stringify(obj));
}

export async function buildComposition(args: VideoPayload) {
  const dims = DIMENSIONS[args.aspectRatio] ?? DIMENSIONS["16:9"];
  const sceneSeconds = PACE_SECONDS[args.pace] ?? 4;
  const maxScenes = Math.max(2, Math.round(args.durationSeconds / sceneSeconds));
  const sceneTexts = splitScenes(args.text, maxScenes);
  const brand = args.brand_name || "";

  const preset = getPresetSlots(args.style, args.hyperframes);

  const neededBlocks = new Set(preset.slots.map((s) => s.block));
  const neededComponents = new Set(preset.slots.map((s) => s.component));

  const blockHTML: Record<string, string> = {};
  const componentHTML: Record<string, string> = {};

  await Promise.all(
    Array.from(neededBlocks).map(async (name) => {
      try {
        blockHTML[name] = await fetchBlockHTML(name);
      } catch {
        blockHTML[name] = `<div style="width:100%;height:100%;background:#0F172A;"></div>`;
      }
    })
  );

  await Promise.all(
    Array.from(neededComponents).map(async (name) => {
      try {
        componentHTML[name] = await fetchComponentHTML(name);
      } catch {
        componentHTML[name] = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:56px;font-weight:700;text-align:center;" data-variable="text"></div>`;
      }
    })
  );

  const totalDuration = sceneTexts.length * sceneSeconds;
  const totalFrames = Math.round(totalDuration * 30);

  const clips = sceneTexts.map((body, i) => {
    const slot = preset.slots[i % preset.slots.length];
    const transition =
      i < sceneTexts.length - 1 ? preset.transitions[i % preset.transitions.length] : undefined;
    return {
      id: `scene-${i + 1}`,
      block: slot.block,
      component: slot.component,
      start: i * sceneSeconds,
      duration: sceneSeconds,
      transition,
      vars: slot.vars(body, i, brand),
      body,
    };
  });

  const clipHTML = clips
    .map((clip) => `
      <div class="clip" id="${clip.id}"
        data-start="${clip.start}"
        data-duration="${clip.duration}"
        data-transition-out="${clip.transition || "none"}"
        data-variable-values='${toJsonAttr(clip.vars)}'
        style="position:absolute;inset:0;opacity:0;">
        <div class="block-layer" style="position:absolute;inset:0;z-index:1;">
          ${blockHTML[clip.block] || ""}
        </div>
        <div class="component-layer" style="position:absolute;inset:0;z-index:2;display:flex;align-items:center;justify-content:center;padding:8%;">
          ${componentHTML[clip.component] || ""}
        </div>
        <div class="fallback-text" style="position:absolute;left:8%;right:8%;bottom:10%;z-index:3;font-size:46px;line-height:1.35;font-weight:700;color:#fff;text-shadow:0 2px 12px rgba(0,0,0,.6);">
          ${escapeHtml(clip.body.slice(0, 140))}
        </div>
      </div>`)
    .join("\n");

  const brandColor = args.brand_color || "#C8102E";

  const html = `<!DOCTYPE html>
<html lang="${args.narration_language?.startsWith("en") ? "en" : "zh-Hant"}">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(brand || "GoMan Video")}</title>
<style>
  :root { --brand:${brandColor}; --accent:${brandColor}; --accent-2:#3B82F6; --bg:#0F172A; --ink:#fff; }
  * { box-sizing:border-box; }
  html, body { margin:0; padding:0; width:100%; height:100%; background:var(--bg); color:var(--ink); overflow:hidden;
    font-family:Inter,"Noto Sans TC",system-ui,sans-serif; }
  #stage { position:relative; width:100vw; height:100vh; background:var(--bg); }
  .clip { will-change:opacity, transform; }
</style>
</head>
<body>
<div id="stage"
  data-composition-id="goman-video"
  data-width="${dims.width}"
  data-height="${dims.height}"
  data-start="0"
  data-duration="${totalDuration}">
  ${clipHTML}
</div>
<script>
(function () {
  const stage = document.getElementById("stage");
  const clips = Array.from(stage.querySelectorAll(".clip"));
  const duration = parseFloat(stage.dataset.duration) || 10;

  clips.forEach(function (clip) {
    const raw = clip.dataset.variableValues;
    if (!raw) return;
    try {
      const vars = JSON.parse(raw);
      clip.querySelectorAll("[data-variable]").forEach(function (el) {
        const key = el.dataset.variable;
        if (vars[key] !== undefined) el.textContent = String(vars[key]);
      });
    } catch (e) {}
  });

  function renderAt(t) {
    clips.forEach(function (clip) {
      const start = parseFloat(clip.dataset.start) || 0;
      const dur = parseFloat(clip.dataset.duration) || 4;
      const end = start + dur;
      const fade = 0.4;
      let opacity = 0;
      if (t >= start && t < end) {
        if (t < start + fade) opacity = (t - start) / fade;
        else if (t > end - fade) opacity = (end - t) / fade;
        else opacity = 1;
      }
      clip.style.opacity = Math.max(0, Math.min(1, opacity)).toFixed(3);
    });
  }

  const timeline = {
    duration: function () { return duration; },
    time: function () { return typeof window.__gomanTime === "number" ? window.__gomanTime : 0; },
    progress: function () { return duration ? this.time() / duration : 0; },
    seek: function (t) { window.__gomanTime = Math.max(0, Math.min(duration, t)); renderAt(window.__gomanTime); },
    renderAt: renderAt,
    play: function () { return this; },
    pause: function () { return this; }
  };

  window.__timelines = window.__timelines || {};
  window.__timelines["goman-video"] = timeline;
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
    captionStyle: preset.caption_style,
    audio: args.bgm ? { src: args.bgm, volume: 0.25 } : undefined,
    sceneCount: sceneTexts.length,
  };
}
