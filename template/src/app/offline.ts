// Offline support (production builds only). tools/build-sw.mjs generates
// dist/sw.js with a content-hashed cache of every built file.
// A new version never reloads the page by itself: the player is offered a
// reload, and the game saves first.

export function registerOffline(onUpdateReady: (apply: () => void) => void): void {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  const register = async () => {
    try {
      const reg = await navigator.serviceWorker.register("./sw.js");
      const offer = (worker: ServiceWorker) =>
        onUpdateReady(() => {
          navigator.serviceWorker.addEventListener("controllerchange", () => location.reload(), { once: true });
          worker.postMessage({ type: "SKIP_WAITING" });
        });
      if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
      reg.addEventListener("updatefound", () => {
        const worker = reg.installing;
        worker?.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) offer(worker);
        });
      });
    } catch (err) {
      console.warn("offline support unavailable", err);
    }
  };
  // Boot is async, so the load event may already have fired.
  if (document.readyState === "complete") void register();
  else window.addEventListener("load", () => void register(), { once: true });
}
