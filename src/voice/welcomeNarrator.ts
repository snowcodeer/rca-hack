import { eventBus } from "./eventBus";

export class WelcomeNarrator {
  private enabled = false;
  private current: HTMLAudioElement | null = null;
  private lastTarget: string | null = null;
  private readonly clips: Map<string, HTMLAudioElement> = new Map();

  constructor(private readonly bodies: string[], initiallyEnabled = false, initialTarget: string | null = null) {
    this.enabled = initiallyEnabled;
    this.lastTarget = initialTarget;
    if (this.enabled && this.lastTarget) {
      this.playFor(this.lastTarget);
    }

    eventBus.on("narrationToggle", ({ enabled }) => {
      this.setEnabled(enabled);
    });

    eventBus.on("focusChanged", ({ current }) => {
      this.lastTarget = current;
      if (this.enabled) {
        this.playFor(current);
      }
    });
  }

  private setEnabled(enabled: boolean) {
    if (this.enabled === enabled) {
      return;
    }
    this.enabled = enabled;
    if (!enabled) {
      this.stop();
    } else if (this.lastTarget) {
      this.playFor(this.lastTarget);
    }
  }

  private playFor(target: string) {
    if (!target) {
      return;
    }
    const clip = this.getClip(target);
    if (!clip) {
      return;
    }
    this.stop();
    this.current = clip;
    this.current.currentTime = 0;
    const playPromise = this.current.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch((error) => {
        console.error("[voice][welcome] play failed", error);
      });
    }
  }

  private stop() {
    if (this.current) {
      this.current.pause();
      this.current.currentTime = 0;
      this.current = null;
    }
  }

  private getClip(target: string): HTMLAudioElement | null {
    const key = this.slug(target);
    if (!key) {
      return null;
    }
    if (!this.clips.has(key)) {
      const src = `/audio/welcome-${key}.mp3`;
      const audio = new Audio(src);
      audio.preload = "auto";
      this.clips.set(key, audio);
    }
    return this.clips.get(key) ?? null;
  }

  private slug(target: string): string | null {
    if (!target) {
      return null;
    }
    const normalized = target.trim().toLowerCase();
    if (!normalized) {
      return null;
    }
    return normalized.replace(/[^a-z0-9]+/g, "-");
  }
}
