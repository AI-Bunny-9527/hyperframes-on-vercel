// Detached rendering: the sandbox keeps working after the HTTP request returns,
// so long videos are not bound by the serverless function timeout.

import { Sandbox } from "@vercel/sandbox";
import { get } from "@vercel/blob";
import { prepareSandbox, ensureRendererVersion, buildMuxPlan, toTracks, type AudioTrack } from "./sandbox";

import { RENDER_ARGS, renderDiagnostic, isSandboxUnavailable, sandboxUnavailableMessage } from "./renderPolicy";

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
      const sandbox = await Sandbox.create({
        source: { type: "snapshot", snapshotId },
        timeout: SANDBOX_TIMEOUT_MS,
        resources: RESOURCES,
      });
      try {
        await ensureRendererVersion(sandbox);
        return sandbox;
      } catch (err) {
        await sandbox.stop().catch(() => {});
        throw err;
      }
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
  audio?: AudioTrack | ReadonlyArray<AudioTrack>,
): Promise<{ sandboxId: string; cmdId: string; output: string }> {
  const sandbox = await newSandbox();
  await sandbox.writeFiles(files.map(({ rel, content }) => ({ path: `composition/${rel}`, content })));

  let body = `printf 'node=%s renderer=%s\\n' "$(node --version)" "$(node -p 'require(\"hyperframes/package.json\").version')"\n`;
  body += `npx ${RENDER_ARGS.join(" ")}\n`;
  let output = "out.mp4";
  const plan = buildMuxPlan(toTracks(audio));
  if (plan) {
    await sandbox.writeFiles(plan.files);
    const quoted = plan.args
      .map((arg) => `'${arg.replace(/'/g, "'\\''")}'`)
      .join(" ");
    body += `ffmpeg ${quoted}\n`;
    output = plan.output;
  }

  // Write an explicit status file: detached commands do not reliably report
  // exitCode when fetched later by id, so the sandbox filesystem is the source of truth.
  const script = `rm -f render.status render.log\nset +e\n(\nset -e\n${body}) > render.log 2>&1\nexit_code=$?\nprintf '%s\\n' "$exit_code" > render.status\nexit "$exit_code"\n`;

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
  } catch (err) {
    if (isSandboxUnavailable(err)) throw err;
    // Missing status is expected while the detached command is running.
    if (/ENOENT|not found|\b404\b/i.test(err instanceof Error ? err.message : String(err))) return null;
    throw err;
  }
}

export async function collectRender(params: {
  sandboxId: string;
  cmdId: string;
  output: string;
}): Promise<RenderStatus> {
  let sandbox: Sandbox;
  try {
    sandbox = await Sandbox.get({ sandboxId: params.sandboxId });
  } catch (err) {
    if (!isSandboxUnavailable(err)) {
      console.warn("[render] temporary status lookup failure", { sandboxId: params.sandboxId });
      return { status: "running" };
    }
    return { status: "failed", message: sandboxUnavailableMessage(err) };
  }

  let statusText: string | null;
  try {
    statusText = await readText(sandbox, "render.status");
  } catch (err) {
    if (!isSandboxUnavailable(err)) {
      console.warn("[render] temporary status lookup failure", { sandboxId: params.sandboxId });
      return { status: "running" };
    }
    return { status: "failed", message: sandboxUnavailableMessage(err) };
  }
  if (statusText === null) return { status: "running" };

  const exitCode = Number(statusText.trim());
  if (exitCode !== 0) {
    const log = (await readText(sandbox, "render.log")) || "";
    console.error("[render] native diagnostic", { sandboxId: params.sandboxId, cmdId: params.cmdId, diagnostic: renderDiagnostic(log, exitCode) });
    await sandbox.stop().catch(() => {});
    return { status: "failed", message: log.slice(-12000) || `render exited ${exitCode}` };
  }

  let mp4: Buffer | null = null;
  try {
    mp4 = await sandbox.readFileToBuffer({ path: params.output });
  } catch {
    mp4 = null;
  }
  const log = mp4 ? "" : (await readText(sandbox, "render.log")) || "";
  if (!mp4) console.error("[render] missing output", { sandboxId: params.sandboxId, diagnostic: renderDiagnostic(log, exitCode) });
  await sandbox.stop().catch(() => {});
  if (!mp4) {
    return { status: "failed", message: log.slice(-1500) || `render produced no ${params.output}` };
  }
  return { status: "done", mp4 };
}
