import narrationData from "./narration-data.json";

type NarrationEntry = {
  name: string;
  voiceId: string;
  text: string;
};

type NarrationRecord = NarrationEntry & {
  slug: string;
  audioPath: string;
};

const ENTRIES: NarrationRecord[] = (narrationData as NarrationEntry[]).map((entry) => {
  const slug = slugify(entry.name);
  return {
    ...entry,
    slug,
    audioPath: `/audio/narration-${slug}.mp3`,
  };
});

const ENTRY_BY_NAME = new Map<string, NarrationRecord>(
  ENTRIES.map((entry) => [entry.name.toLowerCase(), entry])
);

export class PlanetNarrator {
  private readonly clips = new Map<string, HTMLAudioElement>();
  private current: HTMLAudioElement | null = null;

  constructor() {}

  play(target: string): void {
    if (!target) {
      return;
    }
    const entry = this.lookup(target);
    if (!entry) {
      console.warn("[voice][narrator] Unknown narration target", target);
      return;
    }
    const clip = this.getClip(entry);
    if (!clip) {
      console.warn("[voice][narrator] Audio clip missing for", entry.name);
      return;
    }
    this.stop();
    this.current = clip;
    this.current.currentTime = 0;
    const playPromise = this.current.play();
    if (playPromise?.catch) {
      playPromise.catch((error) => {
        console.error("[voice][narrator] Failed to play narration", error);
      });
    }
  }

  stop(): void {
    if (this.current) {
      this.current.pause();
      this.current.currentTime = 0;
      this.current = null;
    }
  }

  preload(target: string): void {
    const entry = this.lookup(target);
    if (entry) {
      this.getClip(entry);
    }
  }

  private lookup(target: string): NarrationRecord | undefined {
    const normalized = target.trim().toLowerCase();
    if (!normalized) {
      return undefined;
    }
    return ENTRY_BY_NAME.get(normalized);
  }

  private getClip(entry: NarrationRecord): HTMLAudioElement | null {
    if (this.clips.has(entry.slug)) {
      return this.clips.get(entry.slug) ?? null;
    }
    const audio = new Audio(entry.audioPath);
    audio.preload = "auto";
    this.clips.set(entry.slug, audio);
    return audio;
  }
}

function slugify(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
