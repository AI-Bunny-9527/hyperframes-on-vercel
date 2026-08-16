// lib/composition.ts
// v5：掛載 HyperFrames 官方 registry 組件，唔再自己砌純文字 HTML。

import {
  fetchBlockHTML,
  fetchComponentHTML,
  getPresetSlots,
  splitScenes,
  type PresetSlots,
  type SlotSpec,
} from "./registry";

export type HyperframesSpec = {
  blocks: string[];
  components: string[];
  transitions: string[];
  caption_style: string;
};

export type BuildArgs = {
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

const PACE_SECONDS: Record<string, number> = {
  slow: 6,
  normal: 4,
  fast: 2.5,
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function toJsonAttr(obj: unknown): string {
  return escapeHtml(JSON.stringify(obj));
}

export async function buildComposition(args: BuildArgs) {
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
      } catch (e) {
        console.warn(`[composition] block not found: ${name}`, e);
        blockHTML[name] = `<div class="hf-fallback" style="width:100%;height:100%;background:#111;color:#fff;display:flex;align-items:center;justify-content:center;font-family:sans-serif;">${name}</div>`;
      }
    })
  );

  await Promise.all(
    Array.from(neededComponents).map(async (name) => {
      try {
        componentHTML[name] = await fetchComponentHTML(name);
      } catch (e) {
        console.warn(`[composition] component not found: ${name}`, e);
        componentHTML[name] = `<div class="hf-fallback" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-family:sans-serif;color:#fff;">${name}</div>`;
      }
    })
  );

  const totalDuration = sceneTexts.length * sceneSeconds;
  const totalFrames = Math.round(totalDuration * 30);

  const clips = sceneTexts.map((body, i) => {
    const slot = preset.slots[i % preset.slots.length];
    const transition =
      i < sceneTexts.length - 1
        ? preset.transitions[i % preset.transitions.length]
        : undefined;
    const start = i * sceneSeconds;
    const duration = sceneSeconds;
    const vars = slot.vars(body, i, brand);

    return {
      id: `scene-${i + 1}`,
      block: slot.block,
      component: slot.component,
      start,
      duration,
      transition,
      vars,
    };
  });

  const clipHTML = clips
    .map((clip) => {
      const block = blockHTML[clip.block] || "";
      const component = componentHTML[clip.component] || "";
      return `
      <div
        class="clip"
        id="${clip.id}"
        data-start="${clip.start}"
        data-duration="${clip.duration}"
        data-transition-out="${clip.transition || "none"}"
        data-variable-values='${toJsonAttr(clip.vars)}'
        style="position:absolute;inset:0;opacity:0;pointer-events:none;"
      >
        <div class="block-layer" style="position:absolute;inset:0;z-index:1;">
          ${block}
        </div>
        <div class="component-layer" style="position:absolute;inset:0;z-index:2;display:flex;align-items:center;justify-content:center;padding:8%;">
          ${component}
        </div>
      </div>`;
    })
    .join("\n");

  const brandColor = args.brand_color || "#C8102E";

  const html = `<!DOCTYPE html>
<html lang="${args.narration_language?.startsWith("en") ? "en" : "zh-Hant"}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(brand || "GoMan Video")}</title>
  <style>
    :root {
      --brand: ${brandColor};
      --accent: ${brandColor};
      --accent-2: #3B82F6;
      --bg: #0F172A;
      --ink: #ffffff;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      background: var(--bg);
      color: var(--ink);
      overflow: hidden;
      font-family: Inter, "Noto Sans TC", system-ui, sans-serif;
    }
    #stage {
      position: relative;
      width: 100vw;
      height: 100vh;
      background: var(--bg);
    }
    .clip { will-change: opacity, transform; }
    .hf-fallback { font-size: 48px; }
  </style>
</head>
<body>
  <div
    id="stage"
    data-composition-id="goman-video"
    data-width="${dims.width}"
    data-height="${dims.height}"
    data-start="0"
    data-duration="${totalDuration}"
  >
    ${clipHTML}
  </div>

  <script>
  (function () {
    const stage = document.getElementById("stage");
    const clips = Array.from(stage.querySelectorAll(".clip"));
    const duration = parseFloat(stage.dataset.duration) || 10;
    const fps = 30;

    function applyVars(clip) {
      const raw = clip.dataset.variableValues;
      if (!raw) return;
      try {
        const vars = JSON.parse(raw);
        clip.querySelectorAll("[data-variable]").forEach((el) => {
          const key = el.dataset.variable;
          if (vars[key] !== undefined) el.textContent = vars[key];
        });
      } catch (e) { /* ignore */ }
    }

    clips.forEach(applyVars);

    const timeline = {
      duration: function () { return duration; },
      time: function () {
        if (typeof window.__gomanTime === "number") return window.__gomanTime;
        return 0;
      },
      progress: function () {
        const t = this.time();
        return duration ? t / duration : 0;
      },
      seek: function (t) {
        window.__gomanTime = Math.max(0, Math.min(duration, t));
        this.renderAt(window.__gomanTime);
      },
      renderAt: function (t) {
        clips.forEach((clip) => {
          const start = parseFloat(clip.dataset.start) || 0;
          const dur = parseFloat(clip.dataset.duration) || 4;
          const end = start + dur;
          const trans = clip.dataset.transitionOut || "none";
          const fade = 0.4;

          let opacity = 0;
          if (t >= start && t < end) {
            if (t < start + fade) opacity = (t - start) / fade;
            else if (t > end - fade) opacity = (end - t) / fade;
            else opacity = 1;
          }

          if (trans !== "none" && t >= end && t < end + fade) {
            opacity = Math.max(0, 1 - (t - end) / fade);
          }

          clip.style.opacity = Math.max(0, Math.min(1, opacity)).toFixed(3);
        });
      },
      play: function () { return this; },
      pause: function () { return this; }
    };

    window.__timelines = window.__timelines || {};
    window.__timelines["goman-video"] = timeline;
    window.__HYPERFRAMES_READY__ = true;

    timeline.renderAt(0);
  })();
  </script>
</body>
</html>`;

  return {
    html,
    width: dims.width,
    height: dims.height,
    duration: totalDuration,
    durationInFrames: totalFrames,
    fps: 30,
    style: args.style,
    captionStyle: preset.caption_style,
    audio: args.bgm ? { src: args.bgm, volume: 0.25 } : undefined,
    metadata: {
      prompt: args.prompt,
      sourceFilename: args.sourceFilename,
      brand_name: args.brand_name,
      brand_color: args.brand_color,
      subtitles: args.subtitles,
      narration_language: args.narration_language,
      voice: args.voice,
      pace: args.pace,
      hyperframes: args.hyperframes,
    },
    sceneCount: sceneTexts.length,
  };
}
