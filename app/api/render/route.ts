// app/api/render/route.ts
// 接收主 App 傳嚟嘅參數，掛載 HyperFrames registry 組件，渲染影片。

import { buildComposition } from "../../lib/composition";
// 注意：請根據你嘅 repo 結構調整 renderVideo 嘅 import 路徑
import { renderVideo } from "../../lib/render-video";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;

    const {
      text,
      source_filename,
      prompt,
      aspect_ratio = "16:9",
      style = "financial_commentary",
      duration_seconds = 30,
      pace = "normal",
      bgm,
      hyperframes,
      brand_name,
      brand_color,
      subtitles,
      narration_language,
      voice,
      test,
    } = body;

    if (test === true) {
      return Response.json({ url: "" });
    }

    if (!text || typeof text !== "string" || !text.trim()) {
      return Response.json({ error: "text is required" }, { status: 400 });
    }

    const composition = await buildComposition({
      text,
      prompt: typeof prompt === "string" ? prompt : undefined,
      style: typeof style === "string" ? style : "financial_commentary",
      aspectRatio: typeof aspect_ratio === "string" ? aspect_ratio : "16:9",
      durationSeconds: typeof duration_seconds === "number" ? duration_seconds : 30,
      pace: pace === "slow" || pace === "normal" || pace === "fast" ? pace : "normal",
      bgm: typeof bgm === "string" ? bgm : undefined,
      hyperframes:
        hyperframes &&
        typeof hyperframes === "object" &&
        !Array.isArray(hyperframes)
          ? (hyperframes as {
              blocks: string[];
              components: string[];
              transitions: string[];
              caption_style: string;
            })
          : undefined,
      sourceFilename: typeof source_filename === "string" ? source_filename : undefined,
      brand_name: typeof brand_name === "string" ? brand_name : undefined,
      brand_color: typeof brand_color === "string" ? brand_color : undefined,
      subtitles: typeof subtitles === "boolean" ? subtitles : undefined,
      narration_language:
        typeof narration_language === "string" ? narration_language : null,
      voice: typeof voice === "string" ? voice : null,
    });

    console.log("[render] composition ready", {
      width: composition.width,
      height: composition.height,
      duration: composition.duration,
      sceneCount: composition.sceneCount,
      style: composition.style,
      captionStyle: composition.captionStyle,
    });

    const result = await renderVideo(composition);
    return Response.json(result);
  } catch (e) {
    console.error("[render] failed", e);
    return Response.json(
      { error: "render_failed", message: (e as Error).message },
      { status: 500 }
    );
  }
}
