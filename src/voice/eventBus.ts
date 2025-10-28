type VoiceCoreEvents = {
  focusChanged: {
    current: string;
    previous: string | null;
  };
  speechRecognized: {
    transcript: string;
    normalized: string;
    final: boolean;
  };
  voiceCommand: VoiceIntentEvent;
  voiceError: {
    message: string;
    context?: unknown;
  };
  voiceToggle: {
    enabled: boolean;
  };
  voiceListenToggle: {
    // Toggle current listening state (start/stop recording)
  };
  narrationToggle: {
    enabled: boolean;
  };
};

export type VoiceIntentEvent =
  | {
      type: "open";
      target: string;
      confidence: number;
      transcript: string;
      normalized: string;
    }
  | {
      type: "next";
      transcript: string;
      normalized: string;
    }
  | {
      type: "previous";
      transcript: string;
      normalized: string;
    }
  | {
      type: "repeat";
      transcript: string;
      normalized: string;
    }
  | {
      type: "stop";
      transcript: string;
      normalized: string;
    };

type EventListener<E extends keyof VoiceCoreEvents> = (
  payload: VoiceCoreEvents[E]
) => void;

class EventBus {
  private listeners: Map<string, Set<EventListener<any>>> = new Map();

  on<E extends keyof VoiceCoreEvents>(event: E, listener: EventListener<E>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const set = this.listeners.get(event)!;
    set.add(listener as EventListener<any>);
    return () => this.off(event, listener);
  }

  off<E extends keyof VoiceCoreEvents>(event: E, listener: EventListener<E>): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(listener as EventListener<any>);
      if (set.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  emit<E extends keyof VoiceCoreEvents>(event: E, payload: VoiceCoreEvents[E]): void {
    const set = this.listeners.get(event);
    if (!set) {
      return;
    }
    for (const listener of Array.from(set.values())) {
      try {
        listener(payload);
      } catch (error) {
        console.error(`[voice][eventBus] listener error for ${event}`, error);
      }
    }
  }
}

export const eventBus = new EventBus();

export type { VoiceCoreEvents };
