import { useEffect, useRef } from "react";

/**
 * Calls `fn` immediately, then again every `intervalMs` while `enabled`,
 * using a setTimeout chain (not setInterval) so a slow request can't pile up
 * calls on top of each other. Return `false` from `fn` to stop polling
 * early (e.g. once a background job reaches a terminal status).
 */
export function usePolling(fn, intervalMs, { enabled = true, deps = [] } = {}) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!enabled) return undefined;
    let stopped = false;
    let timer = null;

    const tick = async () => {
      if (stopped) return;
      const result = await fnRef.current();
      if (stopped) return;
      if (result === false) return;
      timer = setTimeout(tick, intervalMs);
    };

    tick();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, intervalMs, ...deps]);
}
