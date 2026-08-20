// app/api/render/route.ts
// 接收主 App 傳嚟參數，掛載 HyperFrames registry 組件，喺 Vercel Sandbox 渲染影片。

import { put } from "@vercel/blob";
import { buildComposition } from "../../../lib/composition2";
import { renderInSandbox } from "../../../lib/sandbox";
import { collectRender, startRender } from "../../../lib/asyncRender";

export const maxDuration = 800;
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

    // Poll an already-started detached render.
    if (body.mode === "status") {
      const status = await collectRender({
        sandboxId: String(body.sandboxId || ""),
        cmdId: String(body.cmdId || ""),
        output: String(body.output || "out.mp4"),
      });
      if (status.status !== "done") {
        return Response.json(status, { headers: CORS_HEADERS });
      }
      const doneBlob = await put(
        `renders/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp4`,
        status.mp4,
        { access: "public", contentType: "video/mp4" },
      );
      return Response.json({ status: "done", url: doneBlob.url }, { headers: CORS_HEADERS });
    }

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
      narration_audio,
      narration_seconds,
      text_scale,
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
      durationSeconds:
        typeof narration_seconds === "number" && narration_seconds > 0
          ? Math.min(Math.ceil(narration_seconds), 600)
          : typeof duration_seconds === "number"
            ? duration_seconds
            : 30,
      textScale: typeof text_scale === "number" ? text_scale : 1,
      pace: pace === "slow" || pace === "normal" || pace === "fast" ? pace : "normal",
      bgm: typeof bgm === "string" ? bgm : undefined,
      bgmVolume: typeof bgm_volume === "number" ? bgm_volume : undefined,
      title: typeof narration_audio === "string" && narration_audio ? undefined : typeof title === "string" ? title : undefined,
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

    const extOf = (url: string, fallback = "mp3") => {
      const ext = (url.split("?")[0].split(".").pop() || fallback).toLowerCase().slice(0, 4);
      return /^[a-z0-9]+$/.test(ext) ? ext : fallback;
    };

    const download = async (url: string, label: string): Promise<Buffer | null> => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`${label} download failed (${res.status})`);
        return Buffer.from(await res.arrayBuffer());
      } catch (err) {
        console.warn(`[render] ${label} skipped`, err);
        return null;
      }
    };

    const tracks: Array<{ content: Buffer; volume: number; ext: string; loop?: boolean; name?: string }> = [];

    // 1) Narration voice-over (primary track, full volume).
    if (typeof narration_audio === "string" && narration_audio.startsWith("http")) {
      const buf = await download(narration_audio, "narration");
      if (buf) {
        tracks.push({ content: buf, volume: 1, ext: extOf(narration_audio), name: "narration" });
      }
    }

    // 2) Background music (looped, ducked under the narration when present).
    if (typeof bgm === "string" && bgm.startsWith("http")) {
      const buf = await download(bgm, "bgm");
      if (buf) {
        const requested =
          typeof bgm_volume === "number" && bgm_volume >= 0 && bgm_volume <= 2 ? bgm_volume : 0.25;
        const volume = tracks.length > 0 ? Math.min(requested, 0.18) : requested;
        tracks.push({ content: buf, volume, ext: extOf(bgm), loop: true, name: "bgm" });
      }
    }

    const audio = tracks.length > 0 ? tracks : undefined;

    console.log("[render] audio tracks", tracks.map((t) => ({ name: t.name, volume: t.volume })));

    // Async mode: start the renderer and return immediately; the client polls
    // with mode:"status" so 長片唔會受 serverless timeout 限制.
    if (body.mode === "start") {
      const job = await startRender(files, audio);
      return Response.json(
        { ...job, status: "running", duration: composition.duration },
        { headers: CORS_HEADERS },
      );
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
