// Explicit resource ownership. Every listener, timer, observer and GPU
// resource gets exactly one owner with an idempotent disposer. Garbage
// collection is never relied on to release external resources.

export class Lifetime {
  private cleanups: (() => void)[] = [];
  closed = false;

  own(cleanup: () => void): void {
    if (this.closed) cleanup();
    else this.cleanups.push(cleanup);
  }

  listen<K extends keyof WindowEventMap>(
    target: Window,
    event: K,
    handler: (e: WindowEventMap[K]) => void,
    options?: AddEventListenerOptions,
  ): void;
  listen<K extends keyof DocumentEventMap>(
    target: Document,
    event: K,
    handler: (e: DocumentEventMap[K]) => void,
    options?: AddEventListenerOptions,
  ): void;
  listen<K extends keyof HTMLElementEventMap>(
    target: HTMLElement,
    event: K,
    handler: (e: HTMLElementEventMap[K]) => void,
    options?: AddEventListenerOptions,
  ): void;
  listen(
    target: EventTarget,
    event: string,
    handler: EventListener,
    options?: AddEventListenerOptions,
  ): void;
  listen(
    target: EventTarget,
    event: string,
    handler: EventListener,
    options?: AddEventListenerOptions,
  ): void {
    target.addEventListener(event, handler, options);
    this.own(() => target.removeEventListener(event, handler, options));
  }

  interval(fn: () => void, ms: number): void {
    const id = setInterval(fn, ms);
    this.own(() => clearInterval(id));
  }

  /** Child scope that is disposed with this one (or earlier on its own). */
  child(): Lifetime {
    const c = new Lifetime();
    this.own(() => c.dispose());
    return c;
  }

  get count(): number {
    return this.cleanups.length;
  }

  dispose(): void {
    if (this.closed) return;
    this.closed = true;
    for (let i = this.cleanups.length - 1; i >= 0; i--) {
      try {
        this.cleanups[i]();
      } catch (err) {
        console.error("dispose failed", err);
      }
    }
    this.cleanups.length = 0;
  }
}

/** Fixed-capacity numeric samples with percentile summary (no growth). */
export class Samples {
  private readonly values: Float64Array;
  private index = 0;
  private size = 0;

  constructor(readonly capacity = 600) {
    this.values = new Float64Array(capacity);
  }

  add(value: number): void {
    this.values[this.index] = value;
    this.index = (this.index + 1) % this.capacity;
    this.size = Math.min(this.capacity, this.size + 1);
  }

  summary(): { count: number; p50: number; p95: number; p99: number; max: number } {
    const sorted = Array.from(this.values.subarray(0, this.size)).sort((a, b) => a - b);
    const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] ?? 0;
    return { count: this.size, p50: at(0.5), p95: at(0.95), p99: at(0.99), max: sorted[sorted.length - 1] ?? 0 };
  }
}
