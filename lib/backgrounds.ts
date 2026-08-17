// lib/backgrounds.ts
// 每個風格對應一個確定性（deterministic）嘅動畫背景主題。
// 背景由 canvas 按時間 t 繪製，唔靠 requestAnimationFrame，
// 所以 hyperframes 逐格 seek render 出嚟嘅畫面完全一致。

export type Theme = {
  /** 背景漸變（由上到下） */
  gradient: [string, string];
  /** 流動色塊顏色 */
  blobs: string[];
  /** 文字主色 */
  ink: string;
  /** 次要文字色 */
  inkMuted: string;
  /** 顯示網格 */
  grid: boolean;
  /** 顯示光掃 */
  sweep: boolean;
  /** 顆粒數量 */
  particles: number;
  /** 底部行情/新聞條 */
  ticker: boolean;
  /** 暗色底（決定字幕底色） */
  dark: boolean;
};

export const THEMES: Record<string, Theme> = {
  financial_commentary: {
    gradient: ["#050B1B", "#0E1E3C"],
    blobs: ["#1D4ED8", "#0EA5E9", "#22D3EE"],
    ink: "#F8FAFC",
    inkMuted: "#94A3B8",
    grid: true,
    sweep: false,
    particles: 0,
    ticker: true,
    dark: true,
  },
  news_brief: {
    gradient: ["#0A0A0F", "#1A1024"],
    blobs: ["#DC2626", "#F97316", "#7C3AED"],
    ink: "#FFFFFF",
    inkMuted: "#A1A1AA",
    grid: true,
    sweep: true,
    particles: 0,
    ticker: true,
    dark: true,
  },
  product_promo: {
    gradient: ["#120726", "#241046"],
    blobs: ["#A855F7", "#EC4899", "#38BDF8"],
    ink: "#FFFFFF",
    inkMuted: "#D8B4FE",
    grid: false,
    sweep: true,
    particles: 40,
    ticker: false,
    dark: true,
  },
  explainer_clean: {
    gradient: ["#F8FAFC", "#E2E8F0"],
    blobs: ["#93C5FD", "#A7F3D0", "#FDE68A"],
    ink: "#0F172A",
    inkMuted: "#475569",
    grid: false,
    sweep: false,
    particles: 24,
    ticker: false,
    dark: false,
  },
  whiteboard_tutorial: {
    gradient: ["#FFFFFF", "#F1F5F9"],
    blobs: ["#BFDBFE", "#FEF3C7", "#BBF7D0"],
    ink: "#111827",
    inkMuted: "#6B7280",
    grid: true,
    sweep: false,
    particles: 0,
    ticker: false,
    dark: false,
  },
  social_short: {
    gradient: ["#0B0B0F", "#25060F"],
    blobs: ["#F43F5E", "#FB923C", "#8B5CF6"],
    ink: "#FFFFFF",
    inkMuted: "#FDA4AF",
    grid: false,
    sweep: true,
    particles: 60,
    ticker: false,
    dark: true,
  },
  cinematic_brand: {
    gradient: ["#000000", "#12100E"],
    blobs: ["#F59E0B", "#EF4444", "#38BDF8"],
    ink: "#FFFFFF",
    inkMuted: "#D6D3D1",
    grid: false,
    sweep: true,
    particles: 18,
    ticker: false,
    dark: true,
  },
  tech_neon: {
    gradient: ["#03040A", "#0A1430"],
    blobs: ["#22D3EE", "#6366F1", "#A855F7"],
    ink: "#F0F9FF",
    inkMuted: "#7DD3FC",
    grid: true,
    sweep: true,
    particles: 30,
    ticker: false,
    dark: true,
  },
  luxury_gold: {
    gradient: ["#0B0906", "#1C1408"],
    blobs: ["#D4AF37", "#B45309", "#FDE68A"],
    ink: "#FFFBEB",
    inkMuted: "#D6C79A",
    grid: false,
    sweep: true,
    particles: 22,
    ticker: false,
    dark: true,
  },
  minimal_mono: {
    gradient: ["#0A0A0A", "#1F1F1F"],
    blobs: ["#3F3F46", "#52525B", "#71717A"],
    ink: "#FAFAFA",
    inkMuted: "#A1A1AA",
    grid: false,
    sweep: false,
    particles: 0,
    ticker: false,
    dark: true,
  },
  nature_calm: {
    gradient: ["#04150F", "#0B2A1E"],
    blobs: ["#34D399", "#10B981", "#A7F3D0"],
    ink: "#ECFDF5",
    inkMuted: "#86EFAC",
    grid: false,
    sweep: false,
    particles: 34,
    ticker: false,
    dark: true,
  },
  retro_wave: {
    gradient: ["#160726", "#3B0A4A"],
    blobs: ["#F472B6", "#22D3EE", "#FDE047"],
    ink: "#FFFFFF",
    inkMuted: "#F9A8D4",
    grid: true,
    sweep: true,
    particles: 26,
    ticker: false,
    dark: true,
  },
  corporate_clean: {
    gradient: ["#FFFFFF", "#E8EEF6"],
    blobs: ["#2563EB", "#60A5FA", "#CBD5F5"],
    ink: "#0F172A",
    inkMuted: "#475569",
    grid: true,
    sweep: false,
    particles: 0,
    ticker: false,
    dark: false,
  },
  crypto_dark: {
    gradient: ["#050505", "#101A12"],
    blobs: ["#22C55E", "#84CC16", "#0EA5E9"],
    ink: "#F0FDF4",
    inkMuted: "#86EFAC",
    grid: true,
    sweep: true,
    particles: 18,
    ticker: true,
    dark: true,
  },
  sunset_warm: {
    gradient: ["#1A0A05", "#3A1206"],
    blobs: ["#FB923C", "#F43F5E", "#FACC15"],
    ink: "#FFF7ED",
    inkMuted: "#FDBA74",
    grid: false,
    sweep: true,
    particles: 28,
    ticker: false,
    dark: true,
  },
};

export function themeFor(style: string | undefined): Theme {
  return THEMES[style || ""] ?? THEMES.financial_commentary;
}

/** 注入畫面嘅背景繪圖 script（純函數，靠 t 決定畫面） */
export const BACKGROUND_SCRIPT = String.raw`
function makeBackground(canvas, theme, brandColor) {
  var ctx = canvas.getContext("2d");
  var W = canvas.width, H = canvas.height;

  function rand(seed) {
    var x = Math.sin(seed * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  }

  function drawBlobs(t) {
    for (var i = 0; i < theme.blobs.length; i++) {
      var s = i + 1;
      var speed = 0.06 + rand(s) * 0.08;
      var cx = W * (0.2 + 0.6 * (0.5 + 0.5 * Math.sin(t * speed + s * 2.1)));
      var cy = H * (0.2 + 0.6 * (0.5 + 0.5 * Math.cos(t * speed * 1.3 + s * 1.7)));
      var r = Math.min(W, H) * (0.42 + 0.12 * Math.sin(t * 0.15 + s));
      var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, theme.blobs[i]);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalAlpha = theme.dark ? 0.42 : 0.5;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawGrid(t) {
    var step = Math.round(W / 24);
    var offset = (t * 12) % step;
    ctx.strokeStyle = theme.dark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.07)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var x = -step + offset; x < W + step; x += step) {
      ctx.moveTo(x, 0); ctx.lineTo(x, H);
    }
    for (var y = -step + offset; y < H + step; y += step) {
      ctx.moveTo(0, y); ctx.lineTo(W, y);
    }
    ctx.stroke();
  }

  function drawSweep(t) {
    var p = (t * 0.18) % 1.6 - 0.3;
    var x = p * W;
    var g = ctx.createLinearGradient(x - W * 0.25, 0, x + W * 0.25, H);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.5, theme.dark ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.55)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function drawParticles(t) {
    for (var i = 0; i < theme.particles; i++) {
      var sx = rand(i + 7) * W;
      var drift = ((rand(i + 13) * 40 + 12) * t) % (H + 120);
      var sy = H + 60 - drift;
      var r = 2 + rand(i + 21) * 5;
      ctx.globalAlpha = theme.dark ? 0.28 : 0.35;
      ctx.fillStyle = brandColor;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawTicker(t) {
    var barH = Math.round(H * 0.055);
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, H - barH, W, barH);
    ctx.fillStyle = brandColor;
    ctx.fillRect(0, H - barH, W, 3);
    var step = Math.round(W / 6);
    var offset = (t * 90) % step;
    ctx.font = Math.round(barH * 0.42) + "px Inter, system-ui, sans-serif";
    ctx.textBaseline = "middle";
    for (var i = -1; i < 8; i++) {
      var x = i * step - offset;
      var up = (i + 10) % 3 !== 0;
      ctx.fillStyle = up ? "#22C55E" : "#EF4444";
      ctx.fillText((up ? "\u25B2 " : "\u25BC ") + (1000 + i * 137) + "." + ((i * 37) % 100),
        x + 24, H - barH / 2);
    }
  }

  function drawVignette() {
    var g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.75);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, theme.dark ? "rgba(0,0,0,0.55)" : "rgba(15,23,42,0.18)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  return function renderBackground(t) {
    var base = ctx.createLinearGradient(0, 0, 0, H);
    base.addColorStop(0, theme.gradient[0]);
    base.addColorStop(1, theme.gradient[1]);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, W, H);

    drawBlobs(t);
    if (theme.grid) drawGrid(t);
    if (theme.particles) drawParticles(t);
    if (theme.sweep) drawSweep(t);
    drawVignette();
    if (theme.ticker) drawTicker(t);
  };
}
`;
