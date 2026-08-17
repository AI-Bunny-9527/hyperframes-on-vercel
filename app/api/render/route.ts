// app/api/render/route.ts
// 接收主 App 傳嚟參數，掛載 HyperFrames registry 組件，喺 Vercel Sandbox 渲染影片。

import { put } from "@vercel/blob";
import { buildComposition } from "../../../lib/composition";
import { renderInSandbox } from "../../../lib/sandbox";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization",
  "Access-Control-Max-Age": "86400",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

function unauthorized() {
  return Response.json({ error: "unauthorized" }, { status: 401, headers: CORS_HEADERS });
}

export async function POST(request: Request) {
  try {
    const secret = process.env.HYPERFRAMES_RENDER_API_SECRET;
    if (secret) {
      const auth = request.headers.get("authorization") || "";
      const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
      if (token !== secret) return unauthorized();
    }

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
      bgm_volume,
      title,
      hyperframes,
      brand_name,
      brand_color,
      subtitles,
      narration_language,
      voice,
      test,
    } = body;

    if (test === true) {
      return Response.json({ ok: true, url: "" }, { headers: CORS_HEADERS });
    }

    if (!text || typeof text !== "string" || !text.trim()) {
      return Response.json({ error: "text is required" }, { status: 400, headers: CORS_HEADERS });
    }

    const composition = await buildComposition({
      text,
      prompt: typeof prompt === "string" ? prompt : undefined,
      style: typeof style === "string" ? style : "financial_commentary",
      aspectRatio: typeof aspect_ratio === "string" ? aspect_ratio : "16:9",
      durationSeconds: typeof duration_seconds === "number" ? duration_seconds : 30,
      pace: pace === "slow" || pace === "normal" || pace === "fast" ? pace : "normal",
      bgm: typeof bgm === "string" ? bgm : undefined,
      bgmVolume: typeof bgm_volume === "number" ? bgm_volume : undefined,
      title: typeof title === "string" ? title : undefined,
      hyperframes:
        hyperframes && typeof hyperframes === "object" && !Array.isArray(hyperframes)
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
      narration_language: typeof narration_language === "string" ? narration_language : null,
      voice: typeof voice === "string" ? voice : null,
    } as never);

    console.log("[render] composition ready", {
      width: composition.width,
      height: composition.height,
      duration: composition.duration,
      sceneCount: composition.sceneCount,
      style: composition.style,
      captionStyle: composition.captionStyle,
    });

    const files: Array<{ rel: string; content: Buffer }> = [
      { rel: "index.html", content: Buffer.from(composition.html, "utf8") },
      ...composition.files.map((f) => ({
        rel: f.path,
        content: Buffer.from(f.content, "utf8"),
      })),
    ];

    let audio: { content: Buffer; volume: number; ext: string } | undefined;
    if (typeof bgm === "string" && bgm.startsWith("http")) {
      try {
        const res = await fetch(bgm);
        if (!res.ok) throw new Error(`bgm download failed (${res.status})`);
        const buf = Buffer.from(await res.arrayBuffer());
        const ext = (bgm.split("?")[0].split(".").pop() || "mp3").toLowerCase().slice(0, 4);
        const volume =
          typeof bgm_volume === "number" && bgm_volume >= 0 && bgm_volume <= 2 ? bgm_volume : 0.25;
        audio = { content: buf, volume, ext: /^[a-z0-9]+$/.test(ext) ? ext : "mp3" };
      } catch (err) {
        console.warn("[render] bgm skipped", err);
      }
    }

    const { mp4, durationMs } = await renderInSandbox(files, audio);

    const blob = await put(`renders/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp4`, mp4, {
      access: "public",
      contentType: "video/mp4",
    });

    return Response.json({
      url: blob.url,
      duration: composition.duration,
      width: composition.width,
      height: composition.height,
      render_ms: durationMs,
    }, { headers: CORS_HEADERS });
  } catch (e) {
    console.error("[render] failed", e);
    return Response.json(
      { error: "render_failed", message: (e as Error).message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
