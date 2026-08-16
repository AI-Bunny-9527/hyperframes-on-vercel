// app/api/render/route.ts  (v5 — 配合會下載 registry 組件嘅 composition.ts)
import { NextResponse } from "next/server";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
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
    const { html, files, width, height, duration, sceneCount } = await buildComposition({
      ...payload,
      text,
    });

    const dir = await mkdtemp(join(tmpdir(), "goman-comp-"));
    await writeFile(join(dir, "index.html"), html, "utf8");

    // 將 registry 組件寫入同一個資料夾，data-composition-src 先搵到
    for (const [rel, content] of Object.entries(files)) {
      const target = join(dir, rel);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, content, "utf8");
    }

    console.log("[/api/render] style:", payload.style, "scenes:", sceneCount, "components:", Object.keys(files));

    const collected = await collectFiles(dir);
    const { mp4 } = await renderInSandbox(collected);

    const blob = await put("renders/goman-video.mp4", mp4, {
      access: "public",
      token: process.env.BLOB_READ_WRITE_TOKEN,
      contentType: "video/mp4",
      addRandomSuffix: true,
    });

    return NextResponse.json({
      url: blob.url,
      meta: { width, height, duration, sceneCount, style: payload.style ?? null },
    });
  } catch (error) {
    console.error("[/api/render] failed", error);
    return NextResponse.json(
      { error: (error as Error)?.message || "render failed" },
      { status: 500 },
    );
  }
}
