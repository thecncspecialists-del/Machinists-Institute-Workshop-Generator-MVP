/**
 * Structured backend logging.
 *
 * This module is intentionally small and boring: backend routes call it at the
 * point where important data movement happens so future developers can trace an
 * import, generation request, or asset save without reverse-engineering helper
 * abstractions. It does not persist logs or redact arbitrary payloads; callers
 * should pass concise, non-secret metadata.
 */
export type BackendEvent =
  | "import_started"
  | "import_preview_generated"
  | "import_confirmed"
  | "rows_classified"
  | "warnings_generated"
  | "context_attached"
  | "ai_generation_requested"
  | "ai_generation_succeeded"
  | "ai_generation_failed"
  | "html_rendered"
  | "asset_created"
  | "asset_saved";

export function logBackendEvent(event: BackendEvent, details: Record<string, unknown> = {}) {
  console.info(
    JSON.stringify({
      event,
      timestamp: new Date().toISOString(),
      ...details
    })
  );
}

export function logBackendError(event: BackendEvent, error: unknown, details: Record<string, unknown> = {}) {
  console.error(
    JSON.stringify({
      event,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error),
      ...details
    })
  );
}
