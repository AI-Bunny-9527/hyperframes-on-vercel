import test from "node:test";
import assert from "node:assert/strict";
import { Sandbox } from "@vercel/sandbox";
import { collectRender } from "./asyncRender";
const params = { sandboxId: "test", cmdId: "cmd", output: "out.mp4" };

test("collector distinguishes missing status, stopped sandbox and transient failures", async (t) => {
  t.mock.method(Sandbox, "get", async () => ({ readFileToBuffer: async () => null }));
  assert.deepEqual(await collectRender(params), { status: "running" });
  t.mock.restoreAll();
  t.mock.method(Sandbox, "get", async () => ({ readFileToBuffer: async () => { throw new Error("sandbox_stopping"); } }));
  assert.equal((await collectRender(params)).status, "failed");
  t.mock.restoreAll();
  t.mock.method(Sandbox, "get", async () => { throw new Error("503 unavailable"); });
  assert.deepEqual(await collectRender(params), { status: "running" });
});

test("native failure is logged before sandbox cleanup with the longer caller diagnostic", async (t) => {
  const events: string[] = [];
  const log = "# Fatal JavaScript invalid size error 134217728\n" + "progress\n".repeat(500);
  t.mock.method(console, "error", () => { events.push("log"); });
  t.mock.method(Sandbox, "get", async () => ({
    readFileToBuffer: async ({ path }: { path: string }) => Buffer.from(path === "render.status" ? "133" : log),
    stop: async () => { events.push("stop"); },
  }));
  const result = await collectRender(params);
  assert.equal(result.status, "failed");
  if (result.status === "failed") assert.match(result.message, /invalid size error/);
  assert.deepEqual(events, ["log", "stop"]);
});
