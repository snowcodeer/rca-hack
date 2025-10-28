import { eventBus, VoiceIntentEvent } from "./eventBus";

type VoiceUIBindings = {
  button?: HTMLButtonElement | null;
  status?: HTMLElement | null;
  transcript?: HTMLElement | null;
  container?: HTMLElement | null;
};

type TranscriptChunk = {
  text?: string;
  start?: number | null;
  end?: number | null;
  speaker?: string | number | null;
};

type TranscriptResponse = {
  transcript?: string | null;
  text?: string | null;
  chunks?: TranscriptChunk[];
  words?: TranscriptChunk[];
  segments?: TranscriptChunk[];
  language?: string | null;
};

const DEFAULT_LANGUAGE = "en";

const COMMAND_SYNONYMS = {
  open: [
    "open",
    "go to",
    "goto",
    "show",
    "focus on",
    "focus",
    "move to",
    "move toward",
    "move over to",
    "bring me to",
    "take me to",
  ],
};

const COURTESY_WORDS = [
  "please",
  "now",
  "thanks",
  "thank",
  "you",
  "planet",
  "the",
  "a",
  "to",
  "me",
  "about",
  "tell",
  "would",
  "could",
  "can",
  "give"
];

export class VoiceNavigationController {
  private enabled = false;
  private listening = false;
  private mediaStream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private ui: VoiceUIBindings = {};
  private readonly aliases: Map<string, string[]> = new Map();
  private stopTimer: number | null = null;
  private readonly maxRecordingMs = 5000;

  constructor(private readonly planetNames: string[], private readonly languageCode: string = DEFAULT_LANGUAGE) {
    this.prepareAliases();
    eventBus.on("voiceToggle", ({ enabled }) => {
      this.setEnabled(enabled);
    });
    // Gesture-driven listen toggle
    eventBus.on("voiceListenToggle", () => {
      // If not enabled yet, enable and start listening
      if (!this.enabled) {
        this.setEnabled(true);
      }
      if (this.listening) {
        this.stopRecording();
      } else {
        this.startRecording().catch((error) => {
          this.handleError("Microphone access failed", error);
        });
      }
    });
  }

  attachUI(bindings: VoiceUIBindings): void {
    this.ui = bindings;
    if (this.ui.button) {
      this.ui.button.addEventListener("click", () => {
        if (!this.enabled) {
          this.notifyStatus("Enable voice in settings first");
          return;
        }
        if (this.listening) {
          this.stopRecording();
        } else {
          this.startRecording().catch((error) => {
            this.handleError("Microphone access failed", error);
          });
        }
      });
    }
    this.renderState();
  }

  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) {
      return;
    }
    this.enabled = enabled;
    if (!enabled) {
      this.stopRecording();
      this.releaseStream();
    }
    this.renderState();
  }

  private prepareAliases(): void {
    for (const name of this.planetNames) {
      const base = name.toLowerCase();
      const aliasList = new Set<string>();
      aliasList.add(base);
      aliasList.add(`the ${base}`);
      if (base.endsWith("'s rings")) {
        aliasList.add(base.replace("'s", ""));
      }
      if (base === "sun") {
        aliasList.add("sol");
        aliasList.add("the star");
      }
      if (base === "earth") {
        aliasList.add("terra");
        aliasList.add("the world");
      }
      if (base === "moon") {
        aliasList.add("luna");
        aliasList.add("earth's moon");
      }
      this.aliases.set(name, Array.from(aliasList));
    }
  }

  private async startRecording(): Promise<void> {
    if (!this.enabled || this.listening) {
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      this.handleError("MediaRecorder is not supported in this browser");
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.handleError("Microphone access is not supported");
      return;
    }
    if (!this.mediaStream) {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    }
    this.chunks = [];
    this.recorder = new MediaRecorder(this.mediaStream, {
      mimeType: this.selectMimeType(),
    });
    this.recorder.addEventListener("dataavailable", (event) => {
      if (event.data && event.data.size > 0) {
        this.chunks.push(event.data);
      }
    });
    this.recorder.addEventListener("stop", () => {
      this.onRecordingStopped();
    });

    try {
      this.recorder.start(1000);
      this.listening = true;
      this.renderState();
      this.notifyStatus("Listening…");
      this.armAutoStop();
    } catch (error) {
      this.handleError("Failed to start recorder", error);
    }
  }

  private stopRecording(): void {
    if (!this.recorder || this.recorder.state === "inactive") {
      return;
    }
    try {
      this.clearAutoStop();
      this.recorder.stop();
    } catch (error) {
      this.handleError("Failed to stop recorder", error);
    }
  }

  private releaseStream(): void {
    if (this.mediaStream) {
      for (const track of this.mediaStream.getTracks()) {
        track.stop();
      }
    }
    this.mediaStream = null;
  }

  private async onRecordingStopped(): Promise<void> {
    const blob = this.composeBlob();
    this.listening = false;
    this.renderState();
    if (!blob) {
      this.notifyStatus("No audio captured");
      return;
    }
    this.notifyStatus("Transcribing…");
    try {
      const transcript = await this.requestTranscription(blob);
      if (!transcript) {
        this.handleError("No transcript returned");
        return;
      }
      const normalized = transcript.toLowerCase().trim();
      eventBus.emit("speechRecognized", {
        transcript,
        normalized,
        final: true,
      });
      this.updateTranscript(transcript);
      const intent = this.parseIntent(transcript, normalized);
      if (intent) {
        this.notifyStatus(this.intentSummary(intent));
        window.setTimeout(() => {
          eventBus.emit("voiceCommand", intent);
        }, 25);
      } else {
        this.notifyStatus(`Did not understand: “${transcript}”`);
      }
    } catch (error) {
      this.handleError("Transcription failed", error);
    }
  }

  private composeBlob(): Blob | null {
    if (this.chunks.length === 0) {
      return null;
    }
    const type = this.recorder?.mimeType || "audio/webm";
    return new Blob(this.chunks, { type });
  }

  private async requestTranscription(blob: Blob): Promise<string | null> {
    const audioBase64 = await this.blobToBase64(blob);
    const response = await fetch("/api/stt/transcriptions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        audioBase64,
        mimeType: blob.type,
        languageCode: this.languageCode,
        candidates: this.planetNames,
        classify: true,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`STT proxy error: ${response.status} ${detail}`);
    }

    const data: TranscriptResponse = await response.json();
    // Prefer server-provided intent if available
    const serverIntent: any = (data as any).intent;
    if (serverIntent && typeof serverIntent === "object" && serverIntent.type) {
      const mapped: VoiceIntentEvent | null = this.mapServerIntent(serverIntent);
      if (mapped) {
        eventBus.emit("voiceCommand", mapped);
      }
    }

    const extracted = this.extractTranscript(data);
    if (extracted) {
      return extracted;
    }
    return null;
  }

  private parseIntent(transcript: string, normalized: string): VoiceIntentEvent | null {
    if (!normalized) {
      return null;
    }

    const openPhrase = this.detectOpenPhrase(normalized);
    if (openPhrase) {
      const candidate = this.cleanCandidate(openPhrase);
      const match = this.resolvePlanet(candidate);
      if (match && match.score >= 0.45) {
        return {
          type: "open",
          target: match.name,
          confidence: match.score,
          transcript,
          normalized,
        };
      }
    }

    return null;
  }

  private matchesAny(text: string, phrases: string[]): boolean {
    return phrases.some((phrase) => text.includes(phrase));
  }

  private detectOpenPhrase(text: string): string | null {
    const patterns = [
      /(?:open|go to|goto|show|focus on|focus)\s+(.+)/,
      /(?:move to|move toward|move over to)\s+(.+)/,
      /(?:bring me to|take me to)\s+(.+)/,
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  }

  private cleanCandidate(raw: string): string {
    const sanitized = raw
      .replace(/[.?!,]/g, " ")
      .split(/\s+/)
      .filter((token) => token && !COURTESY_WORDS.includes(token))
      .join(" ")
      .trim();
    if (sanitized) {
      return sanitized;
    }
    return raw.replace(/[.?!,]/g, " ").trim();
  }

  private resolvePlanet(candidate: string): { name: string; score: number } | null {
    if (!candidate) {
      return null;
    }
    const normalizedCandidate = candidate.toLowerCase();
    let best: { name: string; score: number } | null = null;
    for (const name of this.planetNames) {
      const aliases = this.aliases.get(name) ?? [name.toLowerCase()];
      const score = Math.max(...aliases.map((alias) => this.similarity(alias, normalizedCandidate)));
      if (!best || score > best.score) {
        best = { name, score };
      }
    }
    return best;
  }

  private similarity(reference: string, candidate: string): number {
    if (!reference || !candidate) {
      return 0;
    }
    if (reference === candidate) {
      return 1;
    }
    if (reference.includes(candidate) || candidate.includes(reference)) {
      return 0.85;
    }
    const tokenScore = this.tokenOverlap(reference, candidate);
    const editScore = this.levenshteinSimilarity(reference, candidate);
    return Math.max(tokenScore, editScore);
  }

  private tokenOverlap(reference: string, candidate: string): number {
    const refTokens = reference.split(/\s+/);
    const candTokens = candidate.split(/\s+/);
    const intersection = refTokens.filter((token) => candTokens.includes(token));
    if (intersection.length === 0) {
      return 0;
    }
    return (2 * intersection.length) / (refTokens.length + candTokens.length);
  }

  private levenshteinSimilarity(reference: string, candidate: string): number {
    const distance = this.levenshtein(reference, candidate);
    const maxLen = Math.max(reference.length, candidate.length) || 1;
    return 1 - distance / maxLen;
  }

  private levenshtein(a: string, b: string): number {
    const matrix: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
    for (let i = 0; i <= a.length; i++) {
      matrix[i][0] = i;
    }
    for (let j = 0; j <= b.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }
    return matrix[a.length][b.length];
  }

  private intentSummary(intent: VoiceIntentEvent): string {
    switch (intent.type) {
      case "open":
        return `Opening ${intent.target}`;
      default:
        return "Command processed";
    }
  }

  private renderState(): void {
    if (this.ui.button) {
      this.ui.button.disabled = !this.enabled;
      this.ui.button.setAttribute("aria-pressed", String(this.listening));
      this.ui.button.classList.toggle("is-active", this.listening);
    }
    if (this.ui.container) {
      if (this.enabled) {
        this.ui.container.removeAttribute("hidden");
      } else {
        this.ui.container.setAttribute("hidden", "true");
      }
    }
    if (!this.enabled) {
      this.notifyStatus("Voice control off");
    } else if (!this.listening) {
      this.notifyStatus("Voice control ready – tap the mic and speak");
    }
  }

  private updateTranscript(transcript: string): void {
    if (this.ui.transcript) {
      this.ui.transcript.textContent = transcript;
    }
  }

  private notifyStatus(message: string): void {
    if (this.ui.status) {
      this.ui.status.textContent = message;
    }
  }

  private handleError(message: string, error?: unknown): void {
    console.error("[voice][navigation]", message, error);
    eventBus.emit("voiceError", { message, context: error });
    this.notifyStatus(message);
    this.listening = false;
    this.clearAutoStop();
    this.renderState();
  }

  private selectMimeType(): string {
    const preferred = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg", "audio/mp4"];
    for (const type of preferred) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return "audio/webm";
  }

  private async blobToBase64(blob: Blob): Promise<string> {
    const buffer = await blob.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private armAutoStop(): void {
    this.clearAutoStop();
    this.stopTimer = window.setTimeout(() => {
      this.stopRecording();
    }, this.maxRecordingMs);
  }

  private clearAutoStop(): void {
    if (this.stopTimer !== null) {
      window.clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }
  }

  private extractTranscript(data: TranscriptResponse): string | null {
    if (!data) {
      return null;
    }
    if (data.transcript && data.transcript.trim()) {
      return data.transcript;
    }
    if (data.text && data.text.trim()) {
      return data.text;
    }
    if (Array.isArray(data.words) && data.words.length > 0) {
      return data.words.map((word) => word.text ?? "").join(" ").trim() || null;
    }
    if (Array.isArray(data.chunks) && data.chunks.length > 0) {
      return data.chunks.map((chunk) => chunk.text ?? "").join(" ").trim() || null;
    }
    if (Array.isArray(data.segments) && data.segments.length > 0) {
      return data.segments.map((segment) => segment.text ?? "").join(" ").trim() || null;
    }
    return null;
  }

  private mapServerIntent(si: any): VoiceIntentEvent | null {
    const type = String(si.type || "").toLowerCase();
    if (type === "open" && typeof si.target === "string") {
      // trust server target if it matches a known body
      const target = this.planetNames.find((p) => p.toLowerCase() === si.target.toLowerCase());
      if (target) {
        return {
          type: "open",
          target,
          confidence: typeof si.confidence === "number" ? si.confidence : 0.9,
          transcript: si.transcript || "",
          normalized: si.normalized || "",
        };
      }
    }
    return null;
  }
}
