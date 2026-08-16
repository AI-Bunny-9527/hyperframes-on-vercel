import { NextResponse } from "next/server";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { put } from "@vercel/blob";
import { collectFiles, renderInSandbox } from "@/lib/sandbox";
import { buildComposition, VideoPayload } from "@/lib/composition";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const key = request.headers.get("authorization");
  if (key !== `Bearer ${process.env.RENDER_API_SECRET}`) {
    return NextResponse.json({ error: "No permission" }, { status: 401 });
  }

  let payload: VideoPayload;
  try {
    payload = (await request.json()) as VideoPayload;
  } catch {
    return NextResponse.json({ error: "Bad JSON body" }, { status: 400 });
  }

  const text = (payload.text || payload.prompt || "").slice(0, 20000);

  try {
    const { html, width, height, duration, sceneCount } = buildComposition({
      ...payload,
      text,
    });

    const dir = await mkdtemp(join(tmpdir(), "goman-comp-"));
    await writeFile(join(dir, "index.html"), html, "utf8");

    const files = await collectFiles(dir);
    const { mp4 } = await renderInSandbox(files);

    const blob = await put("renders/goman-video.mp4", mp4, {
      access: "public",
      token: process.env.BLOB_READ_WRITE_TOKEN,
      contentType: "video/mp4",
      addRandomSuffix: true,
      allowOverwrite: true,
    });

    return NextResponse.json({
      url: blob.url,
      meta: {
        width,
        height,
        duration,
        scenes: sceneCount,
        style: payload.style || "minimal",
        aspect_ratio: payload.aspect_ratio || "9:16",
      },
    });
  } catch (err) {
    console.error("[/api/render] failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Render failed" },
      { status: 500 }
    );
  }
}
type RenderBody = {
  text: string;
  source_filename?: string;
  prompt?: string;
  aspect_ratio?: string;      // "16:9" | "9:16" | "1:1" | "4:5"
  style?: string;             // preset value, e.g. "financial_commentary"
  duration_seconds?: number;
  pace?: "slow" | "normal" | "fast";
  bgm?: string;
  hyperframes?: {
    blocks: string[];
    components: string[];
    transitions: string[];
    caption_style: string;
  };
};

export async function POST(request: Request) {
  const body = (await request.json()) as RenderBody;

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
  } = body;

  if (!text || !text.trim()) {
    return Response.json({ error: "text is required" }, { status: 400 });
  }

  const composition = buildComposition({
    text,
    prompt,
    style,
    aspectRatio: aspect_ratio,
    durationSeconds: duration_seconds,
    pace,
    bgm,
    hyperframes,           // ← 關鍵：傳落去
    sourceFilename: source_filename,
  });

  const result = await renderVideo(composition);
  return Response.json(result);
}
