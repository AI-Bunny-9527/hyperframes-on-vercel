// lib/registry.ts
// 由 HyperFrames 官方 registry 取真正嘅動畫組件（component），
// 而唔係自己砌純文字 HTML。組件會被寫入渲染資料夾，
// index.html 用 data-composition-src 掛載佢哋。

const RAW =
  "https://raw.githubusercontent.com/heygen-com/hyperframes/main/registry/components";

/** 一個 scene 用邊個組件 + 佢嘅變數點樣由文字砌出嚟 */
export type SlotSpec = {
  component: string;
  vars: (text: string, index: number, brand: string) => Record<string, unknown>;
};

const firstWords = (t: string, n: number) => t.replace(/\s+/g, " ").trim().slice(0, n);

const TITLE = (accent: string): SlotSpec => ({
  component: "titlecard-calm",
  vars: (t, _i, brand) => ({ headline: firstWords(t, 46), kicker: brand || "GOMAN" }),
});

const SLAM: SlotSpec = {
  component: "headline-slam",
  vars: (t) => ({ text: firstWords(t, 34), accent_word_index: 1, accent: "green", shadow: true }),
};

// Do not use text-stagger, staggered-fade-up or typewriter here. Those files
// are source snippets without a <template>/<body>, so the renderer cannot use
// them through data-composition-src.
const CALM: SlotSpec = {
  component: "titlecard-calm",
  vars: (t, _i, brand) => ({ headline: firstWords(t, 72), kicker: brand || "GOMAN" }),
};

const INK: SlotSpec = {
  component: "whiteboard-ink",
  vars: (t) => ({ sketch: "bulb", caption: firstWords(t, 40), pen: "show", accent: "green" }),
};

const LOCKUP: SlotSpec = {
  component: "titlecard-lockup",
  vars: (t, _i, brand) => ({
    wordmark: (brand || "GOMAN").toUpperCase(),
    label: firstWords(t, 52),
    kicker: "INSIGHT",
    rule: "show",
    accent: "green",
  }),
};

const QUOTE: SlotSpec = {
  component: "testimonial-card",
  vars: (t, _i, brand) => ({ quote: firstWords(t, 96), author: brand || "GoMan", handle: "", rating: 5 }),
};

const CTA: SlotSpec = {
  component: "cta-lockup",
  vars: (t, _i, brand) => ({
    action_line: firstWords(t, 40),
    button_label: brand || "GoMan",
    microcopy: "",
    accent: "green",
  }),
};

const OUTRO: SlotSpec = {
  component: "logo-brand-close",
  vars: (_t, _i, brand) => ({
    wordmark: (brand || "GOMAN").toUpperCase(),
    tagline: "",
    url: "",
    accent: "green",
  }),
};

/** preset value → 場景組件循環（第一個一定係開場，最後一個一定係收尾） */
export const PRESET_SLOTS: Record<string, { intro: SlotSpec; body: SlotSpec[]; outro: SlotSpec }> = {
  financial_commentary: { intro: TITLE("green"), body: [CALM, QUOTE], outro: OUTRO },
  social_short: { intro: SLAM, body: [SLAM, CTA], outro: CTA },
  whiteboard_tutorial: { intro: CALM, body: [INK, CALM], outro: OUTRO },
  cinematic_brand: { intro: LOCKUP, body: [CALM, QUOTE], outro: OUTRO },
  explainer_clean: { intro: TITLE("blue"), body: [CALM, QUOTE], outro: OUTRO },
  energetic_promo: { intro: SLAM, body: [SLAM, CTA], outro: CTA },
};

export function slotsFor(style: string | undefined) {
  return PRESET_SLOTS[style || ""] ?? PRESET_SLOTS.explainer_clean;
}

/** 由 GitHub 拎組件 HTML（有 cache，唔會每次都下載） */
const cache = new Map<string, string>();

export async function fetchComponent(name: string): Promise<string> {
  const hit = cache.get(name);
  if (hit) return hit;
  const res = await fetch(`${RAW}/${name}/${name}.html`, { cache: "force-cache" });
  if (!res.ok) throw new Error(`registry component ${name} 下載失敗 (${res.status})`);
  const html = await res.text();
  if (!/<(?:template|body)\b/i.test(html) || !/data-composition-id/i.test(html)) {
    throw new Error(
      `registry component ${name} 並非可掛載組件：缺少 <template>/<body> 或 data-composition-id`,
    );
  }
  cache.set(name, html);
  return html;
}
