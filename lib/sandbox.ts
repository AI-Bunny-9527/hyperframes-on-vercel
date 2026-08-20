import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { Sandbox } from "@vercel/sandbox";
import { get, put } from "@vercel/blob";

const RENDER_TIMEOUT_MS = 10 * 60 * 1000;
const SNAPSHOT_SETUP_TIMEOUT_MS = 15 * 60 * 1000;
const SNAPSHOT_TTL_MS = 7 * 24 * 3600 * 1000;
const SANDBOX_OPTS = { runtime: "node22", resources: { vcpus: 4 } } as const;

const pointerKey = (deploymentId: string) => `snapshot-cache/${deploymentId}.json`;

export interface RenderResult {
  mp4: Buffer;
  durationMs: number;
}

type RunCommandOpts = Parameters<Sandbox["runCommand"]>[0];

export async function runSandboxCommand(
  sandbox: Sandbox,
  label: string,
  opts: RunCommandOpts,
): Promise<void> {
  const result = await sandbox.runCommand(opts);
  if (result.exitCode !== 0) {
    throw new Error(`${label} failed (exit ${result.exitCode}):\n${await result.stderr()}`);
  }
}

export async function prepareSandbox(sandbox: Sandbox): Promise<void> {
  await Promise.all([
    runSandboxCommand(sandbox, "dnf install", {
      cmd: "dnf",
      args: [
        "install", "-y", "--setopt=install_weak_deps=False",
        "nss", "nspr", "atk", "at-spi2-atk", "cups-libs",
        "libdrm", "libxkbcommon", "libXcomposite", "libXdamage",
        "libXext", "libXfixes", "libXrandr", "mesa-libgbm",
        "alsa-lib", "pango",
      ],
      sudo: true,
    }),
    runSandboxCommand(sandbox, "npm install", {
      cmd: "npm",
      args: [
        "install", "--no-save", "--no-audit", "--no-fund",
        "hyperframes@latest", "ffmpeg-static", "ffprobe-static",
      ],
    }),
  ]);

  await Promise.all([
    runSandboxCommand(sandbox, "ffmpeg symlink", {
      cmd: "ln",
      args: ["-sf", "/vercel/sandbox/node_modules/ffmpeg-static/ffmpeg", "/usr/local/bin/ffmpeg"],
      sudo: true,
    }),
    runSandboxCommand(sandbox, "ffprobe symlink", {
      cmd: "ln",
      args: ["-sf", "/vercel/sandbox/node_modules/ffprobe-static/bin/linux/x64/ffprobe", "/usr/local/bin/ffprobe"],
      sudo: true,
    }),
  ]);
}

export async function createFreshSetupSandbox(): Promise<Sandbox> {
  return Sandbox.create({ ...SANDBOX_OPTS, timeout: SNAPSHOT_SETUP_TIMEOUT_MS });
}

export async function writeSnapshotPointer(params: {
  deploymentId: string;
  snapshotId: string;
  token: string;
}): Promise<void> {
  await put(
    pointerKey(params.deploymentId),
    JSON.stringify({ snapshotId: params.snapshotId }),
    {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
      token: params.token,
    },
  );
}

async function readSnapshotId(deploymentId: string, token: string): Promise<string> {
  const result = await get(pointerKey(deploymentId), { access: "public", token });
  if (!result || result.statusCode !== 200) {
    throw new Error(`snapshot pointer missing for deployment ${deploymentId}`);
  }
  const { snapshotId } = (await new Response(result.stream).json()) as { snapshotId: string };
  return snapshotId;
}

async function restoreOrCreate(): Promise<Sandbox> {
  const deploymentId = process.env.VERCEL_DEPLOYMENT_ID;
  const token = process.env.BLOB_READ_WRITE_TOKEN;

  if (deploymentId && token) {
    try {
      const snapshotId = await readSnapshotId(deploymentId, token);
      return await Sandbox.create({
        source: { type: "snapshot", snapshotId },
        timeout: RENDER_TIMEOUT_MS,
        resources: SANDBOX_OPTS.resources,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[sandbox] snapshot restore failed, falling back to fresh setup: ${msg}`);
    }
  }

  const sandbox = await Sandbox.create({ ...SANDBOX_OPTS, timeout: RENDER_TIMEOUT_MS });
  await prepareSandbox(sandbox);
  return sandbox;
}

export interface AudioTrack {
  content: Buffer;
  volume: number;
  ext: string;
  /** Loop the track to cover the whole video (background music). */
  loop?: boolean;
  /** File name prefix inside the sandbox. */
  name?: string;
}

/** Normalise legacy single-track input into an array. */
export function toTracks(
  audio?: AudioTrack | ReadonlyArray<AudioTrack>,
): AudioTrack[] {
  if (!audio) return [];
  return Array.isArray(audio) ? [...audio] : [audio as AudioTrack];
}

/**
 * Build the ffmpeg command (as argv) that mixes every audio track into the
 * rendered mp4. Narration keeps full volume, background music is looped and
 * mixed underneath it.
 */
export function buildMuxPlan(tracks: ReadonlyArray<AudioTrack>): {
  files: Array<{ path: string; content: Buffer }>;
  args: string[];
  output: string;
} | null {
  if (tracks.length === 0) return null;

  const files: Array<{ path: string; content: Buffer }> = [];
  const args: string[] = ["-y", "-i", "out.mp4"];
  const filters: string[] = [];
  const labels: string[] = [];

  tracks.forEach((track, i) => {
    const ext = /^[a-z0-9]+$/.test(track.ext) ? track.ext : "mp3";
    const path = `${track.name || `track${i}`}.${ext}`;
    files.push({ path, content: track.content });
    if (track.loop) args.push("-stream_loop", "-1");
    args.push("-i", path);
    const label = `a${i}`;
    filters.push(`[${i + 1}:a]volume=${track.volume}[${label}]`);
    labels.push(`[${label}]`);
  });

  let outLabel = labels[0];
  if (labels.length > 1) {
    filters.push(
      `${labels.join("")}amix=inputs=${labels.length}:duration=first:dropout_transition=0:normalize=0[mix]`,
    );
    outLabel = "[mix]";
  }

  args.push(
    "-filter_complex",
    filters.join(";"),
    "-map",
    "0:v",
    "-map",
    outLabel,
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-shortest",
    "final.mp4",
  );

  return { files, args, output: "final.mp4" };
}

export async function renderInSandbox(
  compositionFiles: ReadonlyArray<{ rel: string; content: Buffer }>,
  audio?: AudioTrack | ReadonlyArray<AudioTrack>,
): Promise<RenderResult> {
  const t0 = Date.now();
  const sandbox = await restoreOrCreate();

  try {
    await sandbox.writeFiles(
      compositionFiles.map(({ rel, content }) => ({
        path: `composition/${rel}`,
        content,
      })),
    );

    await runSandboxCommand(sandbox, "render", {
      cmd: "npx",
      args: [
        "--no-install", "hyperframes", "render", "composition",
        "-o", "out.mp4",
        "--workers", "auto",
      ],
    });

    let output = "out.mp4";

    const plan = buildMuxPlan(toTracks(audio));
    if (plan) {
      await sandbox.writeFiles(plan.files);
      await runSandboxCommand(sandbox, "mux audio", { cmd: "ffmpeg", args: plan.args });
      output = plan.output;
    }

    const mp4 = await sandbox.readFileToBuffer({ path: output });
    if (!mp4) throw new Error(`render produced no ${output}`);
    return { mp4, durationMs: Date.now() - t0 };
  } finally {
    await sandbox.stop().catch(() => {});
  }
}

export async function collectFiles(
  root: string,
): Promise<Array<{ rel: string; content: Buffer }>> {
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  return Promise.all(
    entries
      .filter((e) => e.isFile())
      .map(async (e) => {
        const abs = join(e.parentPath, e.name);
        return { rel: relative(root, abs), content: await readFile(abs) };
      }),
  );
}

export { SNAPSHOT_TTL_MS };
