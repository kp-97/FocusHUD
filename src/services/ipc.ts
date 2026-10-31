/**
 * Centralized Tauri IPC Service
 * Provides cached invoke resolution, graceful fallbacks, and debug error logging.
 */

export function isTauriEnvironment(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

type InvokeFn = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;

let cachedInvokePromise: Promise<InvokeFn | null> | null = null;

async function getInvoke(): Promise<InvokeFn | null> {
  if (!isTauriEnvironment()) return null;
  if (!cachedInvokePromise) {
    cachedInvokePromise = import("@tauri-apps/api/core")
      .then((mod) => mod.invoke as InvokeFn)
      .catch((err) => {
        if (import.meta.env?.DEV && import.meta.env?.MODE !== "test") {
          console.warn("[Tauri IPC] Failed to import @tauri-apps/api/core:", err);
        }
        cachedInvokePromise = null;
        return null;
      });
  }
  return cachedInvokePromise;
}

/**
 * Invokes a Tauri command safely, returning fallback if not in Tauri or on error.
 */
export async function invokeTauri<T>(
  cmd: string,
  args?: Record<string, unknown>,
  fallback: T | null = null
): Promise<T | null> {
  try {
    const invoke = await getInvoke();
    if (!invoke) return fallback;
    return await invoke<T>(cmd, args);
  } catch (err) {
    if (import.meta.env?.DEV && import.meta.env?.MODE !== "test") {
      console.warn(`[Tauri IPC] Command "${cmd}" failed:`, err);
    }
    return fallback;
  }
}

/**
 * Invokes a Tauri command that returns boolean success (true on success, false on failure or web).
 */
export async function invokeTauriBool(
  cmd: string,
  args?: Record<string, unknown>
): Promise<boolean> {
  try {
    const invoke = await getInvoke();
    if (!invoke) return false;
    await invoke(cmd, args);
    return true;
  } catch (err) {
    if (import.meta.env?.DEV && import.meta.env?.MODE !== "test") {
      console.warn(`[Tauri IPC] Command "${cmd}" failed:`, err);
    }
    return false;
  }
}

/**
 * Helper to reset the cached invoke instance (useful for unit testing).
 */
export function _resetIpcCacheForTesting(): void {
  cachedInvokePromise = null;
}
