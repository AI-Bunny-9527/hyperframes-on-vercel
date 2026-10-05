// Keep fresh sandboxes and deployment snapshots on the same renderer release.
// A snapshot may expire; that must not silently upgrade the rendering engine.
export const RENDERER_VERSION = "0.8.127";
export const RENDER_WORKERS = "1";
export const RENDER_ARGS = [
  "--no-install", "hyperframes", "render", "composition",
  "-o", "out.mp4", "--workers", RENDER_WORKERS,
];

export function renderDiagnostic(log: string, exitCode?: number): string {
  // Only preserve engine diagnostics, not arbitrary user content, URLs or secrets.
  const safe = log.split("\n").filter((line) =>
    /^#|^\s*\d+:.*\[node\]|^bash:.*(?:trap|Aborted|Killed)|^node=v/.test(line) ||
    line.includes("Fatal JavaScript invalid size error") ||
    line.includes("heap out of memory") ||
    line.includes("Runtime_RegExpExecMultiple")
  ).join("\n").slice(-8000);
  return `renderer=${RENDERER_VERSION} workers=${RENDER_WORKERS} exit=${exitCode ?? "unknown"}\n${safe || "No recognized native diagnostic; inspect the job error returned to the caller."}`;
}

export function sandboxUnavailableMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  // Do not falsely diagnose video length or timeout for every Sandbox API failure.
  if (/sandbox_stopping|stopped execution|no longer accepts commands|\b410\b/i.test(message)) {
    return "渲染沙盒已停止，無法讀取結果；可能已完成清理、被停止或到期，並不代表影片太長。";
  }
  return "暫時無法取得渲染沙盒狀態，請稍後再查詢。";
}

export function isSandboxUnavailable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /sandbox_stopping|stopped execution|no longer accepts commands|\b410\b/i.test(message);
}
