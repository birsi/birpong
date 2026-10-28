/** `localStorage`, or null where it is missing or blocked (private windows, disabled site data). */
export function safeStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}
