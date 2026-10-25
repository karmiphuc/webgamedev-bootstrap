// DOM interface: HUD bar, menu panel and in-game dialogs.
// Rules: never use alert()/confirm()/prompt() (they block the loop and
// break automated tests); UI reads state and calls app actions only;
// updates are throttled and dirty-checked, not rebuilt every frame.

import type { Lifetime } from "../core/lifetime";
import type { GameState } from "../sim/state";

export interface HudActions {
  togglePause(): void;
  toggleSound(): boolean;
  newGame(): void;
  exportSave(): void;
  importSave(file: File): void;
}

interface Pack {
  title: string;
  author: string;
  license: string;
  source: string;
  attribution?: string;
  placeholder?: boolean;
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

export class Hud {
  private readonly stats = el("div", "hud-stats");
  private readonly pauseBtn = el("button", "hud-btn", "Pause");
  private readonly panel = el("div", "panel");
  private last = "";

  constructor(
    private readonly root: HTMLElement,
    private readonly actions: HudActions,
    life: Lifetime,
  ) {
    const bar = el("div", "hud-bar");
    const soundBtn = el("button", "hud-btn", "Sound: off");
    const menuBtn = el("button", "hud-btn", "Menu");
    this.stats.setAttribute("aria-live", "polite");
    this.pauseBtn.dataset.testid = "pause";
    menuBtn.dataset.testid = "menu";
    bar.append(this.stats, this.pauseBtn, soundBtn, menuBtn);
    this.panel.hidden = true;
    root.prepend(bar);
    root.append(this.panel);
    life.own(() => {
      bar.remove();
      this.panel.remove();
    });
    life.listen(this.pauseBtn, "click", () => actions.togglePause());
    life.listen(soundBtn, "click", () => {
      soundBtn.textContent = `Sound: ${actions.toggleSound() ? "on" : "off"}`;
    });
    life.listen(menuBtn, "click", () => this.openMenu());
    // The HUD and panel are siblings of #stage, so UI clicks never reach
    // the world's pointer handler. Keep it that way when changing layout.
  }

  update(s: Readonly<GameState>, paused: boolean): void {
    const text = `HP ${Math.ceil(s.hero.hp)}  Gold ${s.gold}  Kills ${s.kills}  World ${s.worldCode}`;
    const key = `${text}|${paused}`;
    if (key === this.last) return;
    this.last = key;
    this.stats.textContent = text;
    this.pauseBtn.textContent = paused ? "Resume" : "Pause";
  }

  toast(message: string): void {
    const t = el("div", "toast", message);
    t.setAttribute("role", "status");
    this.root.appendChild(t);
    setTimeout(() => t.remove(), 3500);
  }

  /** In-game confirmation dialog (replaces window.confirm). */
  ask(text: string, okLabel: string, onOk: () => void): void {
    this.show([
      el("p", undefined, text),
      this.row([
        this.button(okLabel, () => {
          this.close();
          onOk();
        }),
        this.button("Cancel", () => this.close()),
      ]),
    ]);
  }

  showDefeat(s: Readonly<GameState>): void {
    this.show([
      el("h2", undefined, "Defeated"),
      el("p", undefined, `You lasted ${Math.floor(s.tick / 20)} s and defeated ${s.kills} enemies.`),
      this.row([this.button("New game", () => this.actions.newGame())]),
    ]);
  }

  close(): void {
    this.panel.hidden = true;
    this.panel.replaceChildren();
  }

  private openMenu(): void {
    const file = el("input");
    file.type = "file";
    file.accept = "application/json,.json";
    file.hidden = true;
    file.addEventListener("change", () => {
      if (file.files?.[0]) this.actions.importSave(file.files[0]);
    });
    this.show([
      el("h2", undefined, "Menu"),
      this.row([
        this.button("New game", () => this.ask("Start a new game? Your current game will be replaced.", "New game", () => this.actions.newGame())),
        this.button("Export save", () => this.actions.exportSave()),
        this.button("Import save", () => file.click()),
        this.button("Credits", () => void this.openCredits()),
        this.button("Close", () => this.close()),
      ]),
      file,
    ]);
  }

  private async openCredits(): Promise<void> {
    const list = el("ul", "credits");
    try {
      const prov = (await (await fetch("assets/provenance.json")).json()) as { packs: Pack[] };
      for (const p of prov.packs) {
        const credit = p.attribution ? `${p.author} — ${p.attribution}` : p.author;
        list.append(el("li", undefined, `${p.title}${p.placeholder ? " (placeholder)" : ""}: ${credit} (${p.license})`));
      }
    } catch {
      list.append(el("li", undefined, "Credits could not be loaded."));
    }
    this.show([el("h2", undefined, "Credits"), list, this.row([this.button("Close", () => this.close())])]);
  }

  private show(children: HTMLElement[]): void {
    this.panel.replaceChildren(...children);
    this.panel.hidden = false;
  }

  private row(children: HTMLElement[]): HTMLElement {
    const r = el("div", "panel-row");
    r.append(...children);
    return r;
  }

  private button(label: string, onClick: () => void): HTMLButtonElement {
    const b = el("button", "hud-btn", label);
    b.addEventListener("click", onClick);
    return b;
  }
}
