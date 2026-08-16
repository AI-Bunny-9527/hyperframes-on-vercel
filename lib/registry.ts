// lib/registry.ts
// 由 HyperFrames 官方 registry 下載真正嘅動畫組件，
// 並將 preset 映射到可用嘅 scene slots。

export type SlotSpec = {
  /** 背景 / scene 框架（registry/blocks 入面） */
  block: string;
  /** 前景文字 / 動畫效果（registry/components 入面） */
  component: string;
  /** 將用戶文字映射到組件變數 */
  vars: (text: string, index: number, brand: string) => Record<string, unknown>;
};

export type PresetSlots = {
  slots: SlotSpec[];
  transitions: string[];
  caption_style: string;
};

const RAW_BLOCKS =
  "https://raw.githubusercontent.com/heygen-com/hyperframes/main/registry/blocks";
const RAW_COMPONENTS =
  "https://raw.githubusercontent.com/heygen-com/hyperframes/main/registry/components";

const PRESET_MAP: Record<string, PresetSlots> = {
  financial_commentary: {
    transitions: ["fade-soft", "slide-push"],
    caption_style: "caption-highlight",
    slots: [
      {
        block: "data-chart",
        component: "titlecard-calm",
        vars: (text) => ({
          wordmark: text.slice(0, 40),
          label: "",
          kicker: "",
        }),
      },
      {
        block: "mk-progress-stat",
        component: "chart-story",
        vars: (text) => ({
          text: text.slice(0, 120),
          type: "line",
          data: "12,28,45,64",
          labels: "Q1,Q2,Q3,Q4",
          emphasize: 3,
        }),
      },
      {
        block: "lower-third-bild",
        component: "count-up",
        vars: (text) => ({
          text: text.slice(0, 80),
          start: 0,
          end: 100,
          suffix: "%",
        }),
      },
      {
        block: "news-ticker",
        component: "text-stagger",
        vars: (text) => ({ text: text.slice(0, 120) }),
      },
    ],
  },
  social_short: {
    transitions: ["whip-pan", "zoom-punch"],
    caption_style: "caption-pill-karaoke",
    slots: [
      {
        block: "yt-vertical-fill",
        component: "headline-slam",
        vars: (text) => ({ text: text.slice(0, 40) }),
      },
      {
        block: "yt-lower-third",
        component: "staggered-fade-up",
        vars: (text) => ({ text: text.slice(0, 90) }),
      },
      {
        block: "glitch",
        component: "cta-lockup",
        vars: (text, _i, brand) => ({
          text: text.slice(0, 60),
          label: brand || "Learn more",
        }),
      },
    ],
  },
  whiteboard_tutorial: {
    transitions: ["hw-scribble-transition", "ink-wipe"],
    caption_style: "typewriter",
    slots: [
      {
        block: "hw-title",
        component: "typewriter",
        vars: (text) => ({ text: text.slice(0, 50) }),
      },
      {
        block: "hw-frame",
        component: "whiteboard-ink",
        vars: (text) => ({ text: text.slice(0, 120) }),
      },
      {
        block: "hw-pipeline",
        component: "staggered-fade-up",
        vars: (text) => ({ text: text.slice(0, 120) }),
      },
      {
        block: "hw-text-cloud",
        component: "typewriter",
        vars: (text) => ({ text: text.slice(0, 100) }),
      },
    ],
  },
  cinematic_brand: {
    transitions: ["light-leak", "ridged-burn"],
    caption_style: "caption-editorial-emphasis",
    slots: [
      {
        block: "cinematic-zoom",
        component: "titlecard-lockup",
        vars: (text, _i, brand) => ({
          wordmark: text.slice(0, 40),
          label: brand || "",
          kicker: "",
        }),
      },
      {
        block: "light-leak",
        component: "text-stagger",
        vars: (text) => ({ text: text.slice(0, 100) }),
      },
      {
        block: "gallery-tunnel",
        component: "logo-brand-close",
        vars: (text, _i, brand) => ({
          text: text.slice(0, 80),
          wordmark: brand || "",
        }),
      },
      {
        block: "logo-outro",
        component: "titlecard-lockup",
        vars: (text, _i, brand) => ({
          wordmark: brand || text.slice(0, 40),
          label: "",
          kicker: "",
        }),
      },
    ],
  },
  explainer_clean: {
    transitions: ["fade-soft", "slide-push"],
    caption_style: "per-word-rise",
    slots: [
      {
        block: "mk-callout-highlight",
        component: "titlecard-calm",
        vars: (text) => ({
          wordmark: text.slice(0, 40),
          label: "",
          kicker: "",
        }),
      },
      {
        block: "mk-progress-stat",
        component: "per-word-rise",
        vars: (text) => ({ text: text.slice(0, 100) }),
      },
      {
        block: "flowchart",
        component: "typewriter",
        vars: (text) => ({ text: text.slice(0, 120) }),
      },
      {
        block: "logo-outro",
        component: "titlecard-calm",
        vars: (text, _i, brand) => ({
          wordmark: brand || text.slice(0, 40),
          label: "",
          kicker: "",
        }),
      },
    ],
  },
  energetic_promo: {
    transitions: ["zoom-punch", "swirl-vortex"],
    caption_style: "caption-kinetic-slam",
    slots: [
      {
        block: "chromatic-radial-split",
        component: "headline-slam",
        vars: (text) => ({ text: text.slice(0, 40) }),
      },
      {
        block: "swirl-vortex",
        component: "count-up",
        vars: (text) => ({
          text: text.slice(0, 60),
          start: 0,
          end: 100,
          suffix: "%",
        }),
      },
      {
        block: "mk-progress-stat",
        component: "cta-lockup",
        vars: (text, _i, brand) => ({
          text: text.slice(0, 80),
          label: brand || "Get started",
        }),
      },
      {
        block: "logo-outro",
        component: "headline-slam",
        vars: (text, _i, brand) => ({ text: brand || text.slice(0, 40) }),
      },
    ],
  },
};

const cache = new Map<string, string>();

async function fetchText(url: string): Promise<string> {
  const cached = cache.get(url);
  if (cached) return cached;
  const res = await fetch(url, { cache: "force-cache" });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const text = await res.text();
  cache.set(url, text);
  return text;
}

export async function fetchComponentHTML(name: string): Promise<string> {
  return fetchText(`${RAW_COMPONENTS}/${name}/index.html`);
}

export async function fetchBlockHTML(name: string): Promise<string> {
  return fetchText(`${RAW_BLOCKS}/${name}/index.html`);
}

export function getPresetSlots(
  presetValue: string,
  hyperframes?: {
    blocks?: string[];
    components?: string[];
    transitions?: string[];
    caption_style?: string;
  }
): PresetSlots {
  const base = PRESET_MAP[presetValue] ?? PRESET_MAP["financial_commentary"];
  if (!hyperframes) return base;

  const blocks = hyperframes.blocks?.length ? hyperframes.blocks : base.slots.map((s) => s.block);
  const components = hyperframes.components?.length
    ? hyperframes.components
    : base.slots.map((s) => s.component);
  const transitions = hyperframes.transitions?.length
    ? hyperframes.transitions
    : base.transitions;
  const caption_style = hyperframes.caption_style || base.caption_style;

  const slots: SlotSpec[] = blocks.map((block, i) => {
    const component = components[i % components.length];
    const baseSlot = base.slots[i % base.slots.length];
    return {
      block,
      component,
      vars: baseSlot?.vars ?? ((text) => ({ text: text.slice(0, 100) })),
    };
  });

  return { slots, transitions, caption_style };
}

export function splitScenes(text: string, maxScenes: number): string[] {
  const chunks = text
    .split(/\n{2,}|(?<=[。！？!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (chunks.length <= maxScenes) return chunks;

  const perScene = Math.ceil(chunks.length / maxScenes);
  const merged: string[] = [];
  for (let i = 0; i < chunks.length; i += perScene) {
    merged.push(chunks.slice(i, i + perScene).join(" "));
  }
  return merged;
}
