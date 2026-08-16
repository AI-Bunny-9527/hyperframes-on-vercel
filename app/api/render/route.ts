import { NextResponse } from "next/server";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { put } from "@vercel/blob";
import { collectFiles, renderInSandbox } from "@/lib/sandbox";
import { buildComposition, type VideoPayload } from "@/lib/composition";

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
  if (!text.trim()) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

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
        source_filename: payload.source_filename,
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
