import api from "@/lib/api";

/**
 * Poll a project every `intervalMs` until `statusField` (default "status")
 * reaches "done" or "failed", invoking `onTick` with each fetched project.
 * Used after rerender/recut/trim (status) and translate (translation_status),
 * all of which render/process asynchronously server-side.
 */
export function pollProjectUntilSettled(id, onTick, { intervalMs = 1500, statusField = "status" } = {}) {
  return new Promise((resolve) => {
    const iv = setInterval(async () => {
      let data;
      try {
        ({ data } = await api.get(`/projects/${id}`));
      } catch {
        return; // transient network hiccup — try again next tick
      }
      onTick(data);
      if (data[statusField] === "done" || data[statusField] === "failed") {
        clearInterval(iv);
        resolve(data);
      }
    }, intervalMs);
  });
}
