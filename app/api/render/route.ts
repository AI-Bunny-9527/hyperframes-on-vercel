import { NextResponse } from "next/server";
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
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON body" }, { status: 400 });
  }

  const maxChars = 20000;
  const text = (payload.text || payload.prompt || "").slice(0, maxChars);

  try {
    const { composition, width, height, duration, sceneCount } = buildComposition({
      ...payload,
      text,
    });

    const files = await collectFiles(composition);
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
