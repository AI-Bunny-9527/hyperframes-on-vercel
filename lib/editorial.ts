// lib/editorial.ts
// Hyperframes 風格嘅「編輯 / 海報」主題（paper + ink），同 gradient 主題並存。
// 全部繪圖都係 t 嘅純函數，逐格 seek 都一致。

export type EditorialSpec = {
  /** 紙張底色 */
  paper: string;
  /** 側／頂色塊 */
  panel?: { side: "right" | "top" | "bottom" | "left"; size: number; color: string; skew?: number };
  /** 柔光暈 */
  halo?: { color: string; x: number; y: number; r: number };
  /** 紙紋 */
  texture?: "dots" | "graph" | "hatch" | "none";
  /** 內框 */
  border?: { color: string; width: number; inset: number };
  /** 幾何裝飾 */
  confetti?: Array<{
    shape: "square" | "pill" | "star" | "circle" | "halfCircle";
    color: string;
    x: number;
    y: number;
    size: number;
    rot: number;
    outline?: boolean;
  }>;
  /** 頂／底髮絲線同角落小字 */
  rules?: boolean;
  metaLeft?: string;
  metaRight?: string;
  /** 右側直條圖案（Cobalt Grid） */
  columns?: { color: string; count: number };
};

type EditorialTheme = {
  gradient: [string, string];
  blobs: string[];
  ink: string;
  inkMuted: string;
  grid: boolean;
  sweep: boolean;
  particles: number;
  ticker: boolean;
  dark: boolean;
  editorial: EditorialSpec;
};

function base(paper: string, ink: string, inkMuted: string, accent: string, editorial: EditorialSpec): EditorialTheme {
  return {
    gradient: [paper, paper],
    blobs: [accent, accent, accent],
    ink,
    inkMuted,
    grid: false,
    sweep: false,
    particles: 0,
    ticker: false,
    dark: false,
    editorial,
  };
}

export const EDITORIAL_THEMES: Record<string, EditorialTheme> = {
  biennale_yellow: base("#F3F0E7", "#1F2A63", "#6B7280", "#2743C8", {
    paper: "#F3F0E7",
    halo: { color: "#F5D547", x: 0.42, y: 0.42, r: 0.42 },
    rules: true,
    metaLeft: "FRAME SYSTEM — VOL. 01",
    metaRight: "2026 — 2027",
  }),
  blockframe: base("#FAF6E6", "#101010", "#5B5B55", "#111111", {
    paper: "#FAF6E6",
    texture: "dots",
    border: { color: "#101010", width: 8, inset: 46 },
    rules: false,
    confetti: [
      { shape: "square", color: "#FF5CC8", x: 0.86, y: 0.2, size: 0.09, rot: 0.16 },
      { shape: "star", color: "#F7C948", x: 0.74, y: 0.34, size: 0.05, rot: 0 },
      { shape: "square", color: "#9BE3F5", x: 0.83, y: 0.72, size: 0.07, rot: -0.2 },
    ],
    metaLeft: "FRAME SYSTEM — VOL. 01",
    metaRight: "01 / 08",
  }),
  blue_professional: base("#FBF6E7", "#141414", "#6C6A63", "#1F3FBF", {
    paper: "#FBF6E7",
    panel: { side: "right", size: 0.34, color: "#E3E3E1", skew: 0.06 },
    rules: true,
    metaLeft: "CONSULTING GRADE — FRAME SYSTEM",
    metaRight: "COBALT",
  }),
  bold_poster: base("#FFFFFF", "#111111", "#6B6B6B", "#D81E24", {
    paper: "#FFFFFF",
    texture: "graph",
    rules: true,
    metaLeft: "FRAME SYSTEM — VOL. 01",
    metaRight: "INK / RED / PAPER",
  }),
  broadside: base("#F04E23", "#141414", "#4A1E10", "#141414", {
    paper: "#F04E23",
    texture: "hatch",
    rules: true,
    metaLeft: "BROADSIDE — FRAME SYSTEM",
    metaRight: "ORANGE PLATE",
  }),
  capsule: base("#F2EFE9", "#151515", "#6E6A63", "#FF5A47", {
    paper: "#F2EFE9",
    halo: { color: "#FFE8DF", x: 0.5, y: 0.5, r: 0.5 },
    confetti: [
      { shape: "pill", color: "#F26B4E", x: 0.16, y: 0.2, size: 0.07, rot: -0.2 },
      { shape: "pill", color: "#F7C948", x: 0.62, y: 0.16, size: 0.08, rot: 0.05 },
      { shape: "pill", color: "#8FD3F4", x: 0.85, y: 0.32, size: 0.07, rot: 0.18 },
      { shape: "circle", color: "#F2A03D", x: 0.12, y: 0.62, size: 0.035, rot: 0 },
      { shape: "pill", color: "#9BE0C0", x: 0.86, y: 0.78, size: 0.07, rot: -0.12 },
    ],
    metaLeft: "CAPSULE — FRAME SYSTEM",
    metaRight: "SOFT SHAPES",
  }),
  cartesian: base("#F4F2EC", "#1B1B1B", "#7A776F", "#B08C5A", {
    paper: "#F4F2EC",
    confetti: [{ shape: "circle", color: "#C9C4B8", x: 0.74, y: 0.5, size: 0.3, rot: 0, outline: true }],
    rules: true,
    metaLeft: "MUSEUM CATALOG IN MOTION",
    metaRight: "45° — COMPASS",
  }),
  cobalt_grid: base("#FAF7EA", "#2A3FD1", "#6E7391", "#2A3FD1", {
    paper: "#FAF7EA",
    texture: "graph",
    columns: { color: "#2A3FD1", count: 18 },
    rules: true,
    metaLeft: "TWO-COLOR RISOGRAPH MONOGRAPH",
    metaRight: "COBALT 2026",
  }),
  coral: base("#F3EFE6", "#141414", "#6B6963", "#F2545B", {
    paper: "#F3EFE6",
    panel: { side: "top", size: 0.3, color: "#F2545B" },
    rules: true,
    metaLeft: "CORAL — FRAME SYSTEM",
    metaRight: "VOL 01 / 1920×1080",
  }),
  creative_mode: base("#F7F3E6", "#111111", "#63615A", "#FF4FA3", {
    paper: "#F7F3E6",
    confetti: [
      { shape: "square", color: "#FF4FA3", x: 0.84, y: 0.62, size: 0.13, rot: 0.14 },
      { shape: "halfCircle", color: "#F7C948", x: 0.08, y: 0.9, size: 0.12, rot: 0 },
      { shape: "square", color: "#111111", x: 0.9, y: 0.16, size: 0.05, rot: -0.1, outline: true },
    ],
    rules: true,
    metaLeft: "NEO-BRUTALIST — SWISS GRID",
    metaRight: "#2026 / FRAME LAYER",
  }),
};

/** 編輯風格背景繪圖 script（純函數，靠 t） */
export const EDITORIAL_SCRIPT = String.raw`
function makeEditorialBackground(canvas, theme, brandColor) {
  var ctx = canvas.getContext("2d");
  var W = canvas.width, H = canvas.height;
  var e = theme.editorial;
  var S = Math.min(W, H);

  function star(cx, cy, r, rot) {
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var rad = i % 2 === 0 ? r : r * 0.45;
      var a = rot + (Math.PI / 5) * i - Math.PI / 2;
      var x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawTexture(t) {
    if (e.texture === "dots") {
      var step = Math.round(S / 42);
      ctx.fillStyle = "rgba(17,17,17,0.10)";
      for (var x = step; x < W; x += step) {
        for (var y = step; y < H; y += step) {
          ctx.beginPath();
          ctx.arc(x, y, Math.max(1, step * 0.07), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (e.texture === "graph") {
      var g = Math.round(S / 26);
      var off = (t * 3) % g;
      ctx.strokeStyle = "rgba(42,63,209,0.10)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (var gx = -g + off; gx < W + g; gx += g) { ctx.moveTo(gx, 0); ctx.lineTo(gx, H); }
      for (var gy = -g + off; gy < H + g; gy += g) { ctx.moveTo(0, gy); ctx.lineTo(W, gy); }
      ctx.stroke();
    } else if (e.texture === "hatch") {
      var h = Math.round(S / 16);
      var ho = (t * 6) % h;
      ctx.strokeStyle = "rgba(0,0,0,0.06)";
      ctx.lineWidth = Math.max(2, S / 300);
      ctx.beginPath();
      for (var i = -H; i < W + H; i += h) {
        ctx.moveTo(i + ho, 0); ctx.lineTo(i + ho - H, H);
      }
      ctx.stroke();
    }
  }

  function drawHalo(t) {
    if (!e.halo) return;
    var cx = W * (e.halo.x + 0.012 * Math.sin(t * 0.18));
    var cy = H * (e.halo.y + 0.02 * Math.cos(t * 0.15));
    var r = S * (e.halo.r + 0.03 * Math.sin(t * 0.12));
    var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, e.halo.color);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawPanel(t) {
    if (!e.panel) return;
    var p = e.panel;
    ctx.fillStyle = p.color;
    if (p.side === "right") {
      var w = W * p.size;
      var skew = (p.skew || 0) * W * (1 + 0.05 * Math.sin(t * 0.2));
      ctx.beginPath();
      ctx.moveTo(W - w + skew, 0);
      ctx.lineTo(W, 0);
      ctx.lineTo(W, H);
      ctx.lineTo(W - w - skew, H);
      ctx.closePath();
      ctx.fill();
    } else if (p.side === "left") {
      ctx.fillRect(0, 0, W * p.size, H);
    } else if (p.side === "top") {
      ctx.fillRect(0, 0, W, H * p.size);
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = "#000";
      var s = Math.round(S / 20);
      var off = (t * 8) % s;
      ctx.beginPath();
      for (var i = -H; i < W + H; i += s) { ctx.moveTo(i + off, 0); ctx.lineTo(i + off - H * p.size, H * p.size); }
      ctx.lineWidth = Math.max(1, S / 400);
      ctx.strokeStyle = "#000";
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else {
      ctx.fillRect(0, H * (1 - p.size), W, H * p.size);
    }
  }

  function drawColumns(t) {
    if (!e.columns) return;
    var c = e.columns;
    var x0 = W * 0.62, wArea = W * 0.3, y0 = H * 0.18, hArea = H * 0.6;
    var bw = wArea / (c.count * 1.6);
    for (var i = 0; i < c.count; i++) {
      var ph = 0.35 + 0.65 * Math.abs(Math.sin(t * 0.35 + i * 0.55));
      var bh = hArea * ph;
      ctx.globalAlpha = 0.16 + 0.12 * (i % 3) / 2;
      ctx.fillStyle = c.color;
      ctx.fillRect(x0 + i * bw * 1.6, y0 + (hArea - bh), bw, bh);
    }
    ctx.globalAlpha = 1;
  }

  function drawConfetti(t) {
    if (!e.confetti) return;
    for (var i = 0; i < e.confetti.length; i++) {
      var c = e.confetti[i];
      var cx = W * c.x;
      var cy = H * c.y + S * 0.012 * Math.sin(t * 0.6 + i);
      var size = S * c.size;
      var rot = c.rot + 0.06 * Math.sin(t * 0.35 + i);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.fillStyle = c.color;
      ctx.strokeStyle = c.color;
      ctx.lineWidth = Math.max(2, S / 320);
      if (c.shape === "square") {
        if (c.outline) ctx.strokeRect(-size / 2, -size / 2, size, size);
        else ctx.fillRect(-size / 2, -size / 2, size, size);
      } else if (c.shape === "pill") {
        roundRect(-size, -size * 0.34, size * 2, size * 0.68, size * 0.34);
        if (c.outline) ctx.stroke(); else ctx.fill();
      } else if (c.shape === "star") {
        star(0, 0, size, rot);
      } else if (c.shape === "halfCircle") {
        ctx.beginPath();
        ctx.arc(0, 0, size, Math.PI, Math.PI * 2);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, size, 0, Math.PI * 2);
        if (c.outline) ctx.stroke(); else ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawBorder() {
    if (!e.border) return;
    var inset = S * (e.border.inset / 1080);
    ctx.strokeStyle = e.border.color;
    ctx.lineWidth = S * (e.border.width / 1080);
    ctx.strokeRect(inset, inset, W - inset * 2, H - inset * 2);
  }

  function drawRules() {
    // 頂／底髮絲線同 meta 小字改由 HTML 層繪製（更清晰），呢度唔再重覆畫。
  }

  function drawGrain(t) {
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = "#8a8577";
    for (var i = 0; i < 220; i++) {
      var s = Math.sin((i + 1) * 12.9898 + Math.floor(t * 6)) * 43758.5453;
      var r1 = s - Math.floor(s);
      var s2 = Math.sin((i + 7) * 78.233 + Math.floor(t * 6)) * 12345.6789;
      var r2 = s2 - Math.floor(s2);
      ctx.fillRect(r1 * W, r2 * H, 2, 2);
    }
    ctx.globalAlpha = 1;
  }

  return function renderBackground(t) {
    ctx.fillStyle = e.paper;
    ctx.fillRect(0, 0, W, H);
    drawHalo(t);
    drawPanel(t);
    drawTexture(t);
    drawColumns(t);
    drawConfetti(t);
    drawGrain(t);
    drawBorder();
    drawRules();
  };
}
`;
