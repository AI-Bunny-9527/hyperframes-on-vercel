import test from "node:test";
import assert from "node:assert/strict";
import { RENDER_ARGS, RENDERER_VERSION, renderDiagnostic, isSandboxUnavailable, sandboxUnavailableMessage } from "./renderPolicy";

test("renderer and worker configuration is deterministic", () => {
  assert.match(RENDERER_VERSION, /^\d+\.\d+\.\d+$/);
  assert.equal(RENDER_ARGS.at(-1), "1");
  assert.ok(!RENDER_ARGS.includes("auto"));
});
test("native diagnostics survive a long log without exposing arbitrary content", () => {
  const log = "private narration https://secret.example token=secret\n" + "progress\n".repeat(2000) +
    "# Fatal JavaScript invalid size error 134217728\n 6: 0x188ac29 v8::internal::Runtime_RegExpExecMultiple(int, unsigned long*, v8::internal::Isolate*) [node]\n";
  const diagnostic = renderDiagnostic(log, 133);
  assert.match(diagnostic, /invalid size error/);
  assert.match(diagnostic, /RegExpExecMultiple/);
  assert.match(diagnostic, /exit=133/);
  assert.doesNotMatch(diagnostic, /secret|private narration|progress/);
});
test("stopping is terminal, not proof of timeout; transient failures are not terminal", () => {
  assert.equal(isSandboxUnavailable(new Error("sandbox_stopping: no longer accepts commands")), true);
  assert.equal(isSandboxUnavailable(new Error("Status code 410")), true);
  assert.equal(isSandboxUnavailable(new Error("503 unavailable")), false);
  assert.match(sandboxUnavailableMessage(new Error("sandbox_stopping")), /並不代表影片太長/);
});
