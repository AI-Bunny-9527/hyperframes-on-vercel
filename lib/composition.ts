import { Frame, Scene } from "./types";

export type VideoPayload = {
  text?: string;
  prompt?: string;
  style?: string;
  aspect_ratio?: "16:9" | "9:16" | "1:1" | "4:5";
  duration?: 30 | 60 | 90 | 180;
  pace?: "slow" | "normal" | "fast";
  narration?: "cantonese" | "mandarin" | "english" | "none";
  voice?: "male-friendly" | "male-professional" | "female-friendly" | "female-professional";
  subtitles?: boolean;
  brand_name?: string;
  brand_color?: string;
  bgm_url?: string;
  bgm_volume?: number;
};

const THEME: Record<string, any> = {
  minimal: {
    bg: "#0B0F19",
    text: "#F4F6FB",
    accent: "#3B82F6",
    font: "Inter",
    easing: "easeOutExpo",
  },
  bold: {
    bg: "#111827",
    text: "#FFFFFF",
    accent: "#EF4444",
    font: "Inter",
    easing: "easeInOutBack",
  },
  elegant: {
    bg: "#1A1A1A",
    text: "#F5F5F5",
    accent: "#D4AF37",
    font: "Playfair Display",
    easing: "easeOutQuart",
  },
  playful: {
    bg: "#FEF3C7",
    text: "#1F2937",
    accent: "#F59E0B",
    font: "Nunito",
    easing: "easeOutBounce",
  },
  corporate: {
    bg: "#FFFFFF",
    text: "#111827",
    accent: "#2563EB",
    font: "Inter",
    easing: "easeOutCubic",
  },
  dark: {
    bg: "#000000",
    text: "#E5E7EB",
    accent: "#10B981",
    font: "Inter",
    easing: "easeOutExpo",
  },
};

function resolveStyle(raw?: string): string {
  const s = (raw || "minimal").toLowerCase();
  if (THEME[s]) return s;
  if (s.includes("hk")) return "bold";
  if (s.includes("manga")) return "playful";
  if (s.includes("webtoon")) return "dark";
  if (s.includes("western")) return "elegant";
  if (s.includes("mascot")) return "playful";
  return "minimal";
}

function resolveAspect(raw?: string): { width: number; height: number } {
  switch (raw) {
    case "16:9":
      return { width: 1920, height: 1080 };
    case "1:1":
      return { width: 1080, height: 1080 };
    case "4:5":
      return { width: 1080, height: 1350 };
    case "9:16":
    default:
      return { width: 1080, height: 1920 };
  }
}

function resolvePace(pace?: string, duration = 30): number {
  const secondsPerScene = {
    slow: 8,
    normal: 5,
    fast: 3,
  }[pace || "normal"] || 5;
  return Math.max(2, Math.round(duration / secondsPerScene));
}

function splitTextIntoScenes(text: string, count: number): string[] {
  const cleaned = text.replace(/\n+/g, " ").trim();
  const sentences = cleaned.match(/[^.!?。！？]+[.!?。！？]+|[^.!?。！？]+$/g) || [cleaned];
  const chunks: string[] = [];

  for (let i = 0; i < sentences.length; i += Math.ceil(sentences.length / count)) {
    chunks.push(sentences.slice(i, i + Math.ceil(sentences.length / count)).join(" ").trim());
  }

  while (chunks.length < count && chunks.length > 0) {
    chunks.push(chunks[chunks.length - 1]);
  }
  return chunks.slice(0, count);
}

export function buildComposition(payload: VideoPayload): { composition: any; width: number; height: number; duration: number; sceneCount: number } {
  const styleKey = resolveStyle(payload.style);
  const theme = THEME[styleKey];
  const { width, height } = resolveAspect(payload.aspect_ratio);
  const duration = payload.duration || 30;
  const sceneCount = resolvePace(payload.pace, duration);
  const rawText = payload.text || payload.prompt || "GoMan 為你帶來最新市場洞察";
  const scenes = splitTextIntoScenes(rawText, sceneCount);

  const frames: Frame[] = scenes.map((line, idx) => {
    const isEven = idx % 2 === 0;
    const enterX = isEven ? -width : width;
    return {
      id: `scene-${idx}`,
      type: "text",
      width,
      height,
      duration: duration / sceneCount,
      props: {
        text: line,
        fontFamily: theme.font,
        fontSize: Math.round(height * 0.075),
        color: theme.text,
        backgroundColor: theme.bg,
        accentColor: theme.accent,
        align: "center",
        enter: { x: enterX, opacity: 0, scale: 0.92 },
        exit: { opacity: 0, scale: 1.05 },
        animation: {
          enterDuration: 0.8,
          holdDuration: (duration / sceneCount) - 1.6,
          exitDuration: 0.8,
          easing: theme.easing,
        },
      },
    };
  });

  const composition: Scene = {
    id: "goman-video",
    width,
    height,
    duration,
    fps: 30,
    backgroundColor: theme.bg,
    frames,
    audio: payload.bgm_url
      ? {
          src: payload.bgm_url,
          volume: typeof payload.bgm_volume === "number" ? payload.bgm_volume : 0.25,
        }
      : undefined,
    branding: payload.brand_name
      ? {
          text: payload.brand_name,
          color: payload.brand_color || theme.accent,
        }
      : undefined,
  };

  return { composition, width, height, duration, sceneCount };
}
