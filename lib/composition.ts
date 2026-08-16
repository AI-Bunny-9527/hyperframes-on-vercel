/**
 * GoMan × HyperFrames composition builder.
 * Self-contained: no external type imports, so the Next.js build never breaks.
 * Exports exactly ONE buildComposition().
 */

export type HyperframesSpec = {
  blocks: string[];
  components: string[];
  transitions: string[];
  caption_style: string;
};

export type VideoPayload = {
  text?: string;
  prompt?: string;
  style?: string;
  aspect_ratio?: string;               // "16:9" | "9:16" | "1:1" | "4:5"
  duration?: number;                   // legacy
  duration_seconds?: number;           // preferred
  pace?: "slow" | "normal" | "fast";
  subtitles?: boolean;
  brand_name?: string;
  brand_color?: string;
  bgm?: string;
  bgm_url?: string;
  bgm_volume?: number;
  source_filename?: string;
  hyperframes?: HyperframesSpec;
};

type Theme = { bg: string; text: string; accent: string; font: string; ease: string };

const THEME: Record<string, Theme> = {
  minimal:              { bg: "#0B0F19", text: "#F4F6FB", accent: "#3B82F6", font: '"Noto Sans TC", Inter, system-ui, sans-serif', ease: "expo.out" },
  bold:                 { bg: "#111827", text: "#FFFFFF", accent: "#EF4444", font: '"Noto Sans TC", Inter, system-ui, sans-serif', ease: "back.out(1.4)" },
  elegant:              { bg: "#14110F", text: "#F5F1E8", accent: "#D4AF37", font: '"Noto Serif TC", Georgia, serif',              ease: "power3.out" },
  finance:              { bg: "#0F1B3D", text: "#FFFFFF", accent: "#C8102E", font: '"Noto Sans TC", Inter, system-ui, sans-serif', ease: "power2.out" },
  financial_commentary: { bg: "#0F1B3D", text: "#FFFFFF", accent: "#C8102E", font: '"Noto Sans TC", Inter, system-ui, sans-serif', ease: "power2.out" },
  social_short:         { bg: "#0B0F19", text: "#FFFFFF", accent: "#22D3EE", font: '"Noto Sans TC", Inter, system-ui, sans-serif', ease: "back.out(1.6)" },
  whiteboard_tutorial:  { bg: "#FAFAF7", text: "#1B1B1B", accent: "#2563EB", font: '"Noto Sans TC", Inter, system-ui, sans-serif', ease: "power1.out" },
  cinematic_brand:      { bg: "#08080A", text: "#F5F5F5", accent: "#D4AF37", font: '"Noto Serif TC", Georgia, serif',              ease: "power3.out" },
  explainer_clean:      { bg: "#FFFFFF", text: "#111827", accent: "#0EA5E9", font: '"Noto Sans TC", Inter, system-ui, sans-serif', ease: "power2.out" },
  energetic_promo:      { bg: "#160B2A", text: "#FFFFFF", accent: "#F97316", font: '"Noto Sans TC", Inter, system-ui, sans-serif', ease: "back.out(2)" },
};

const DEFAULT_HF: HyperframesSpec = {
  blocks: ["titlecard-calm", "bullet-stack", "summary-card"],
  components: ["stagger-in", "caption-clean"],
  transitions: ["fade-soft"],
  caption_style: "clean",
};

function resolveStyle(style?: string): Theme {
  const key = (style || "minimal").toLowerCase();
  return THEME[key] || THEME.minimal;
}

function resolveAspect(ar?: string): { width: number; height: number } {
  switch (ar) {
    case "16:9": return { width: 1920, height: 1080 };
    case "1:1":  return { width: 1080, height: 1080 };
    case "4:5":  return { width: 1080, height: 1350 };
    case "9:16":
    default:     return { width: 1080, height: 1920 };
  }
}

function paceSeconds(pace?: string): number {
  if (pace === "fast") return 2.5;
  if (pace === "slow") return 6;
  return 4;
}

function splitTextIntoScenes(text: string, count: number): string[] {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return Array.from({ length: count }, () => "GoMan");
  const sentences = cleaned.match(/[^.!?。！？\n]+[.!?。！？]?/g) || [cleaned];
  const per = Math.ceil(sentences.length / count);
  const chunks: string[] = [];
  for (let i = 0; i < sentences.length; i += per) {
    const chunk = sentences.slice(i, i + per).join(" ").trim();
    if (chunk) chunks.push(chunk.slice(0, 160));
  }
  while (chunks.length < count) chunks.push(chunks[chunks.length - 1] || cleaned.slice(0, 160));
  return chunks.slice(0, count);
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** HyperFrames block name -> layout class used in the generated HTML */
function blockClass(block: string): string {
  const b = (block || "").toLowerCase();
  if (b.includes("title")) return "b-title";
  if (b.includes("headline") || b.includes("slam")) return "b-slam";
  if (b.includes("bullet") || b.includes("stack")) return "b-bullet";
  if (b.includes("chart") || b.includes("data")) return "b-data";
  if (b.includes("whiteboard") || b.includes("ink") || b.includes("hw")) return "b-ink";
  if (b.includes("summary") || b.includes("outro") || b.includes("logo")) return "b-summary";
  if (b.includes("vertical") || b.includes("fill")) return "b-fill";
  return "b-default";
}

export function buildComposition(payload: VideoPayload): {
  html: string;
  width: number;
  height: number;
  duration: number;
  sceneCount: number;
} {
  const hf = payload.hyperframes ?? DEFAULT_HF;
  const theme = resolveStyle(payload.style);
  const { width, height } = resolveAspect(payload.aspect_ratio);

  const requested = Number(payload.duration_seconds ?? payload.duration) || 30;
  const duration = Math.max(6, Math.min(300, requested));

  const per = paceSeconds(payload.pace);
  const sceneCount = Math.max(2, Math.min(30, Math.round(duration / per)));
  const sceneSeconds = duration / sceneCount;

  const raw = (payload.text || payload.prompt || "GoMan 為你帶來最新市場洞察").toString();
  const scenes = splitTextIntoScenes(raw, sceneCount);

  const brand = payload.brand_name ? esc(payload.brand_name) : "";
  const brandColor = payload.brand_color || theme.accent;
  const fontSize = Math.round(height * 0.055);
  const bgm = payload.bgm || payload.bgm_url || "";
  const bgmVolume = typeof payload.bgm_volume === "number" ? payload.bgm_volume : 0.25;

  const blocks = hf.blocks && hf.blocks.length ? hf.blocks : DEFAULT_HF.blocks;

  const sceneDivs = scenes
    .map((line, i) => {
      const block = i === 0 ? blocks[0] : blocks[i % blocks.length];
      const cls = blockClass(block);
      const isTitle = i === 0;
      return `      <div class="scene ${cls}" id="scene-${i}" data-block="${esc(block)}">
        <div class="line${isTitle ? " title" : ""}">${esc(line)}</div>
      </div>`;
    })
    .join("\n");

  const audio = bgm
    ? `    <audio id="bgm" data-start="0" data-duration="${duration}" data-track-index="0" src="${esc(bgm)}" data-volume="${bgmVolume}"></audio>`
    : "";

  const captionClass = `cap-${esc(hf.caption_style || "clean")}`;
  const scenePayload = JSON.stringify(scenes);

  const html = `<!doctype html>
<html lang="zh-HK">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=${width}, height=${height}">
<title>GoMan Video</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin:0; width:${width}px; height:${height}px; overflow:hidden; background:${theme.bg}; }
  #root { position:relative; width:${width}px; height:${height}px; overflow:hidden;
          background:${theme.bg}; color:${theme.text}; font-family:${theme.font}; }
  .scene { position:absolute; inset:0; display:none; align-items:center; justify-content:center;
           padding:${Math.round(width * 0.09)}px; opacity:1; }
  .scene:first-of-type { display:flex; }
  .line { font-size:${fontSize}px; line-height:1.45; font-weight:700; text-align:center; max-width:100%; }
  .line.title { font-size:${Math.round(fontSize * 1.35)}px; font-weight:900; letter-spacing:.01em; }

  .b-title  { align-items:center; }
  .b-slam .line { font-weight:900; font-size:${Math.round(fontSize * 1.2)}px; text-transform:none; }
  .b-bullet { align-items:flex-start; padding-top:${Math.round(height * 0.22)}px; }
  .b-bullet .line { text-align:left; border-left:${Math.round(width * 0.008)}px solid ${theme.accent};
                    padding-left:${Math.round(width * 0.03)}px; }
  .b-data .line { text-align:left; }
  .b-ink .line { font-weight:600; }
  .b-summary .line { font-size:${Math.round(fontSize * 1.1)}px; }
  .b-fill { align-items:flex-end; padding-bottom:${Math.round(height * 0.18)}px; }

  .cap-karaoke .line, .cap-pill .line {
    background:rgba(0,0,0,.35); border-radius:${Math.round(height * 0.02)}px;
    padding:${Math.round(height * 0.015)}px ${Math.round(width * 0.03)}px;
  }

  #accentbar { position:absolute; left:0; bottom:0; height:${Math.round(height * 0.012)}px;
               width:0%; background:${theme.accent}; z-index:5; }
  #brand { position:absolute; top:${Math.round(height * 0.05)}px; left:0; right:0; text-align:center;
           font-size:${Math.round(height * 0.026)}px; letter-spacing:.16em; font-weight:800;
           color:${brandColor}; opacity:${brand ? 0.95 : 0}; z-index:6; }
</style>
</head>
<body>
  <div id="root" class="${captionClass}">
    <div id="brand">${brand}</div>
${sceneDivs}
    <div id="accentbar"></div>
${audio}
  </div>
  <script>
  window.__timelines = window.__timelines || {};
  (function () {
    var TOTAL = ${duration};
    var PER = ${sceneSeconds};
    var sceneText = ${scenePayload};
    var scenes = Array.prototype.slice.call(document.querySelectorAll(".scene"));
    var progress = document.getElementById("accentbar");

    function clamp(value, min, max) {
      return Math.min(max, Math.max(min, value));
    }

    function renderAt(seconds) {
      var time = clamp(Number(seconds) || 0, 0, TOTAL);
      var index = Math.min(scenes.length - 1, Math.floor(time / PER));
      var local = time - index * PER;
      var fade = Math.min(1, local / 0.35, Math.max(0, (PER - local) / 0.35));

      scenes.forEach(function (scene, i) {
        scene.style.display = i === index ? "flex" : "none";
        scene.style.opacity = i === index ? String(Math.max(0.01, fade)) : "0";
        var line = scene.querySelector(".line");
        if (line && i === index) {
          var enter = clamp(local / 0.7, 0, 1);
          line.style.opacity = String(Math.max(0.01, enter));
          line.style.transform = "translateY(" + Math.round((1 - enter) * ${Math.round(height * 0.05)}) + "px) scale(" + (0.94 + enter * 0.06) + ")";
        }
      });
      if (progress) progress.style.width = String((time / TOTAL) * 100) + "%";
      document.documentElement.setAttribute("data-render-time", String(time));
      document.documentElement.setAttribute("data-scene-text", sceneText[index] || "");
      return time;
    }

    var currentTime = renderAt(0.001);
    var timeline = {
      seek: function (seconds) { currentTime = renderAt(seconds); return timeline; },
      time: function (seconds) {
        if (typeof seconds === "number") { currentTime = renderAt(seconds); return timeline; }
        return currentTime;
      },
      progress: function (value) {
        if (typeof value === "number") { currentTime = renderAt(value * TOTAL); return timeline; }
        return currentTime / TOTAL;
      },
      duration: function () { return TOTAL; },
      totalDuration: function () { return TOTAL; },
      pause: function () { return timeline; }
    };
    window.__timelines["goman-video"] = timeline;
    window.__renderAt = renderAt;
    window.__HYPERFRAMES_READY__ = true;
  })();
  </script>
</body>
</html>`;

  return { html, width, height, duration, sceneCount };
}
