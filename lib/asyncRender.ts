// Detached rendering: the sandbox keeps working after the HTTP request returns,
// so long videos are not bound by the serverless function timeout.

import { Sandbox } from "@vercel/sandbox";
import { get } from "@vercel/blob";
import { prepareSandbox } from "./sandbox";

const SANDBOX_TIMEOUT_MS = 45 * 60 * 1000;
const RESOURCES = { vcpus: 4 } as const;

async function newSandbox(): Promise<Sandbox> {
  const deploymentId = process.env.VERCEL_DEPLOYMENT_ID;
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (deploymentId && token) {
    try {
      const res = await get(`snapshot-cache/${deploymentId}.json`, { access: "public", token });
      if (!res || res.statusCode !== 200) throw new Error("snapshot pointer missing");
      const { snapshotId } = (await new Response(res.stream).json()) as { snapshotId: string };
      return await Sandbox.create({
        source: { type: "snapshot", snapshotId },
        timeout: SANDBOX_TIMEOUT_MS,
        resources: RESOURCES,
      });
    } catch (err) {
      console.warn("[asyncRender] snapshot restore failed", err);
    }
  }
  const sandbox = await Sandbox.create({
    runtime: "node22",
    resources: RESOURCES,
    timeout: SANDBOX_TIMEOUT_MS,
  });
  await prepareSandbox(sandbox);
  return sandbox;
}

export async function startRender(
  files: ReadonlyArray<{ rel: string; content: Buffer }>,
  audio?: { content: Buffer; volume: number; ext: string },
): Promise<{ sandboxId: string; cmdId: string; output: string }> {
  const sandbox = await newSandbox();
  await sandbox.writeFiles(files.map(({ rel, content }) => ({ path: `composition/${rel}`, content })));

  let body = "npx --no-install hyperframes render composition -o out.mp4 --workers auto\n";
  let output = "out.mp4";
  if (audio) {
    const audioPath = `bgm.${audio.ext}`;
    await sandbox.writeFiles([{ path: audioPath, content: audio.content }]);
    body += `ffmpeg -y -i out.mp4 -stream_loop -1 -i ${audioPath} -filter_complex "[1:a]volume=${audio.volume}[a]" -map 0:v -map "[a]" -c:v copy -c:a aac -shortest final.mp4\n`;
    output = "final.mp4";
  }

  // Write an explicit status file: detached commands do not reliably report
  // exitCode when fetched later by id, so the sandbox filesystem is the source of truth.
  const script = `rm -f render.status render.log\n{\nset -e\n${body}} > render.log 2>&1\necho $? > render.status\n`;

  const cmd = await sandbox.runCommand({ cmd: "bash", args: ["-lc", script], detached: true });
  return { sandboxId: sandbox.sandboxId, cmdId: cmd.cmdId, output };
}

export type RenderStatus =
  | { status: "running" }
  | { status: "done"; mp4: Buffer }
  | { status: "failed"; message: string };

async function readText(sandbox: Sandbox, path: string): Promise<string | null> {
  try {
    const buf = await sandbox.readFileToBuffer({ path });
    return buf ? buf.toString("utf8") : null;
  } catch {
    return null;
  }
}

export async function collectRender(params: {
  sandboxId: string;
  cmdId: string;
  output: string;
}): Promise<RenderStatus> {
  const sandbox = await Sandbox.get({ sandboxId: params.sandboxId });

  const statusText = await readText(sandbox, "render.status");
  if (statusText === null) return { status: "running" };

  const exitCode = Number(statusText.trim());
  if (exitCode !== 0) {
    const log = (await readText(sandbox, "render.log")) || "";
    await sandbox.stop().catch(() => {});
    return { status: "failed", message: log.slice(-1500) || `render exited ${exitCode}` };
  }

  let mp4: Buffer | null = null;
  try {
    mp4 = await sandbox.readFileToBuffer({ path: params.output });
  } catch {
    mp4 = null;
  }
  const log = mp4 ? "" : (await readText(sandbox, "render.log")) || "";
  await sandbox.stop().catch(() => {});
  if (!mp4) {
    return { status: "failed", message: log.slice(-1500) || `render produced no ${params.output}` };
  }
  return { status: "done", mp4 };
}
