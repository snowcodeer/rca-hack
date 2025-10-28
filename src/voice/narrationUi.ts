import { PlanetNarrator } from "./planetNarrator";
import { eventBus } from "./eventBus";

export class NarrationUI {
  private container: HTMLElement;
  private playBtn: HTMLButtonElement;
  private stopBtn: HTMLButtonElement;
  private label: HTMLElement;

  constructor(private narrator: PlanetNarrator, private getCurrentFocus: () => string) {
    this.container = this.createContainer();
    this.label = this.createLabel();
    this.playBtn = this.createButton("▶ Play narration", () => {
      const target = this.getCurrentFocus();
      if (target) this.narrator.play(target);
    });
    this.stopBtn = this.createButton("⏹ Stop", () => this.narrator.stop());
    this.container.appendChild(this.label);
    this.container.appendChild(this.playBtn);
    this.container.appendChild(this.stopBtn);
    document.body.appendChild(this.container);

    // Update label on focus changes
    eventBus.on("focusChanged", ({ current }) => this.updateLabel(current));
    this.updateLabel(this.getCurrentFocus());
  }

  private createContainer(): HTMLElement {
    const el = document.createElement("div");
    el.id = "narration-controls";
    el.style.position = "fixed";
    el.style.right = "20px";
    el.style.bottom = "20px";
    el.style.zIndex = "1002";
    el.style.display = "flex";
    el.style.gap = "8px";
    el.style.alignItems = "center";
    el.style.background = "rgba(0,0,0,0.6)";
    el.style.color = "white";
    el.style.padding = "8px 10px";
    el.style.borderRadius = "8px";
    el.style.backdropFilter = "blur(4px)";
    return el;
  }

  private createLabel(): HTMLElement {
    const span = document.createElement("span");
    span.style.fontFamily = "monospace";
    span.style.fontSize = "12px";
    span.style.opacity = "0.9";
    return span;
  }

  private createButton(text: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.textContent = text;
    btn.style.background = "#4CAF50";
    btn.style.color = "white";
    btn.style.border = "none";
    btn.style.padding = "6px 10px";
    btn.style.borderRadius = "6px";
    btn.style.cursor = "pointer";
    btn.style.fontSize = "12px";
    btn.addEventListener("click", onClick);
    if (text.startsWith("⏹")) {
      btn.style.background = "#757575";
    }
    return btn;
  }

  private updateLabel(current: string): void {
    this.label.textContent = `Narration: ${current}`;
  }
}
