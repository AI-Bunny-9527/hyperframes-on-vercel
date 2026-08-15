/**
 * Builds a self-contained HyperFrames composition (single index.html) from the
 * user payload sent by GoMan. No external type imports — must stay standalone
 * so the Next.js build never breaks.
 */

export type VideoPayload = {
  text?: string;
  prompt?: string;
  style?: string;
  aspect_ratio?: "16:9" | "9:16" | "1:1" | "4:5";
  duration?: number;
  pace?: "slow" | "normal" | "fast";
  subtitles?: boolean;
  brand_name?: string;
  brand_color?: string;
  bgm_url?: string;
  bgm_volume?: number;
};

type Theme = { bg: string; text: string; accent: string; font: string; ease: string };

const THEME: Record<string, Theme> = {
  minimal: { bg: "#0B0F19", text: "#F4F6FB", accent: "#3B82F6", font: '"Noto Sans TC", Inter, system-ui, sans-serif', ease: "expo.out" },
  bold: { bg: "#111827", text: "#FFFFFF", accent: "#EF4444", font: '"Noto Sans TC", Inter, system-ui, sans-serif', ease: "back.out(1.4)" },
  elegant: { bg: "#14110F", text: "#F5F1E8", accent: "#D4AF37", font: '"Noto Serif TC", Georgia, serif', ease: "power3.out" },
  finance: { bg: "#0F1B3D", text: "#FFFFFF", accent: "#C8102E", font: '"Noto Sans TC", Inter, system-ui, sans-serif', ease: "power2.out" },
};

function resolveStyle(style?: string): Theme {
  const key = (style || "minimal").toLowerCase();
  return THEME[key] || THEME.minimal;
}

function resolveAspect(ar?: string): { width: number; height: number } {
  switch (ar) {
    case "16:9": return { width: 1920, height: 1080 };
    case "1:1": return { width: 1080, height: 1080 };
    case "4:5": return { width: 1080, height: 1350 };
    case "9:16":
    default: return { width: 1080, height: 1920 };
  }
}

function resolveSceneCount(pace: string | undefined, duration: number): number {
  const secondsPerScene = pace === "fast" ? 3 : pace === "slow" ? 7 : 5;
  return Math.max(2, Math.min(30, Math.round(duration / secondsPerScene)));
}

function splitTextIntoScenes(text: string, count: number): string[] {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return Array.from({ length: count }, () => "GoMan");
  const sentences = cleaned.match(/[^.!?。！？\n]+[.!?。！？]?/g) || [cleaned];
  const per = Math.ceil(sentences.length / count);
  const chunks: string[] = [];
  for (let i = 0; i < sentences.length; i += per) {
    const chunk = sentences.slice(i, i + per).join(" ").trim();
    if (chunk) chunks.push(chunk.slice(0, 140));
  }
  while (chunks.length < count) chunks.push(chunks[chunks.length - 1] || cleaned.slice(0, 140));
  return chunks.slice(0, count);
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildComposition(payload: VideoPayload): {
  html: string;
  width: number;
  height: number;
  duration: number;
  sceneCount: number;
} {
  const theme = resolveStyle(payload.style);
  const { width, height } = resolveAspect(payload.aspect_ratio);
  const duration = Math.max(6, Math.min(300, Number(payload.duration) || 30));
  const sceneCount = resolveSceneCount(payload.pace, duration);
  const raw = (payload.text || payload.prompt || "GoMan 為你帶來最新市場洞察").toString();
  const scenes = splitTextIntoScenes(raw, sceneCount);
  const per = duration / sceneCount;
  const brand = payload.brand_name ? esc(payload.brand_name) : "";
  const brandColor = payload.brand_color || theme.accent;
  const fontSize = Math.round(height * 0.055);

  const sceneDivs = scenes
    .map(
      (line, i) => `      <div class="scene" id="scene-${i}"><div class="line">${esc(line)}</div></div>`
    )
    .join("\n");

  const audio = payload.bgm_url
    ? `    <audio id="bgm" data-start="0" data-duration="${duration}" data-track-index="0" src="${esc(payload.bgm_url)}" data-volume="${typeof payload.bgm_volume === "number" ? payload.bgm_volume : 0.25}"></audio>`
    : "";

  const html = `<!doctype html>
<html lang="zh-HK">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=${width}, height=${height}">
<title>GoMan Video</title>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>
  * { box-sizing: border-box; }
  html, body { margin:0; width:${width}px; height:${height}px; overflow:hidden; background:${theme.bg}; }
  #root { position:relative; width:${width}px; height:${height}px; overflow:hidden;
          background:${theme.bg}; color:${theme.text}; font-family:${theme.font}; }
  .scene { position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
           padding:${Math.round(width * 0.09)}px; opacity:0; }
  .line { font-size:${fontSize}px; line-height:1.45; font-weight:700; text-align:center; max-width:100%;
          text-wrap:balance; }
  #accentbar { position:absolute; left:0; bottom:0; height:${Math.round(height * 0.012)}px;
               width:0%; background:${theme.accent}; z-index:5; }
  #brand { position:absolute; top:${Math.round(height * 0.05)}px; left:0; right:0; text-align:center;
           font-size:${Math.round(height * 0.026)}px; letter-spacing:.16em; font-weight:800;
           color:${brandColor}; opacity:${brand ? 0.95 : 0}; z-index:6; }
</style>
</head>
<body>
  <div id="root">
    <div id="brand">${brand}</div>
${sceneDivs}
    <div id="accentbar"></div>
${audio}
  </div>
  <script>
  window.__timelines = window.__timelines || {};
  (function () {
    var tl = gsap.timeline({ paused: true });
    var per = ${per};
    var scenes = document.querySelectorAll(".scene");
    tl.to("#accentbar", { width: "100%", duration: ${duration}, ease: "none" }, 0);
    scenes.forEach(function (el, i) {
      var at = i * per;
      var line = el.querySelector(".line");
      tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: "${theme.ease}" }, at);
      tl.fromTo(line,
        { y: ${Math.round(height * 0.05)}, scale: 0.94, opacity: 0 },
        { y: 0, scale: 1, opacity: 1, duration: 0.9, ease: "${theme.ease}" }, at);
      tl.to(line, { scale: 1.03, duration: Math.max(0.1, per - 1.4), ease: "none" }, at + 0.9);
      tl.to(el, { opacity: 0, duration: 0.5, ease: "power1.in" }, at + per - 0.5);
    });
    tl.totalDuration(${duration});
    window.__timelines["goman-video"] = tl;
  })();
  </script>
</body>
</html>`;

  return { html, width, height, duration, sceneCount };
}
