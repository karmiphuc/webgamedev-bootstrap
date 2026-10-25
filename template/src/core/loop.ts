// Fixed-step game loop. The simulation advances in exact ticks; rendering
// interpolates between the last two ticks using `alpha`.
//
// Rules (learned the hard way in earlier projects):
// - Never compute game outcomes from wall-clock time.
// - Cap catch-up work per frame: after a stall, game time slows down
//   instead of freezing the tab with hundreds of queued ticks.
// - Reset the accumulator on pause / tab hide so nothing "jumps" on resume.

export interface LoopOptions {
  tickHz: number;
  maxStepsPerFrame: number;
  step: () => void;
  render: (alpha: number) => void;
  now?: () => number;
}

export interface LoopStats {
  frames: number;
  ticks: number;
  droppedMs: number;
}

export class FixedLoop {
  readonly dtMs: number;
  speed = 1;
  paused = false;
  readonly stats: LoopStats = { frames: 0, ticks: 0, droppedMs: 0 };
  private acc = 0;
  private last = -1;
  private handle = 0;
  private running = false;
  private readonly opts: Required<LoopOptions>;

  constructor(opts: LoopOptions) {
    this.opts = { now: () => performance.now(), ...opts };
    this.dtMs = 1000 / opts.tickHz;
  }

  /** Advance by wall-clock milliseconds. Pure logic, used directly by tests. */
  advance(elapsedMs: number): number {
    if (this.paused) {
      this.acc = 0;
      return 0;
    }
    this.acc += Math.max(0, elapsedMs) * this.speed;
    let steps = 0;
    while (this.acc >= this.dtMs && steps < this.opts.maxStepsPerFrame) {
      this.opts.step();
      this.acc -= this.dtMs;
      steps++;
    }
    if (this.acc >= this.dtMs) {
      // Overloaded: drop the surplus instead of building an endless backlog.
      this.stats.droppedMs += this.acc - (this.acc % this.dtMs);
      this.acc %= this.dtMs;
    }
    this.stats.ticks += steps;
    return steps;
  }

  get alpha(): number {
    return this.paused ? 1 : this.acc / this.dtMs;
  }

  /** Forget elapsed time (call on resume / visibility change). */
  resetClock(): void {
    this.acc = 0;
    this.last = -1;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    const frame = () => {
      if (!this.running) return;
      const t = this.opts.now();
      const elapsed = this.last < 0 ? 0 : t - this.last;
      this.last = t;
      this.advance(elapsed);
      this.stats.frames++;
      this.opts.render(this.alpha);
      this.handle = requestAnimationFrame(frame);
    };
    this.handle = requestAnimationFrame(frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.handle);
    this.resetClock();
  }
}
