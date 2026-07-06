import { useCallback, useState } from "react";
import { reportError } from "@/lib/reportError";

/**
 * Wraps an async action with loading/error state, so failures surface as a
 * toast instead of being silently swallowed by a bare `.catch(() => {})`.
 */
export function useAsyncAction() {
  const [loading, setLoading] = useState(false);

  const run = useCallback(async (fn, { errorMessage } = {}) => {
    setLoading(true);
    try {
      return await fn();
    } catch (e) {
      reportError(e, errorMessage);
      return undefined;
    } finally {
      setLoading(false);
    }
  }, []);

  return { run, loading };
}
