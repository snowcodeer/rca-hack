# Voice System (Hackathon Plan)

This plan implements expressive narration with ElevenLabs v3 (alpha) Text-to-Speech and offline Speech-to-Text for voice navigation across project plans. Kept lightweight for hackathon speed: no tests section, focus on practical steps and configs.

## Goals

- Narration: high‑quality, expressive TTS for “planets,” with distinct pilot voices.
- Voice navigation: local/offline STT to open/switch/search plans by voice.
- Simple configs, caching to save cost/time, and portable docs-first approach.

## Architecture Overview

- TTS (cloud)
  - ElevenLabs v3 via REST API (`model_id: eleven_v3`).
  - Single-voice narration via Text-to-Speech; multi-voice scenes via Text-to-Dialogue.
  - Output format default: `mp3_44100_128` (can use PCM for pipelines).

- STT (local/offline)
  - Default: faster‑whisper (CTranslate2) for speed/accuracy on macOS.
  - Alternatives: whisper.cpp (CPU‑only), Vosk (ultra‑light), Coqui STT (customization).

- Voice navigation
  - STT stream → intent parser → “plans” resolver → action + short TTS feedback.
  - Fuzzy matching for plan names, confirmations for ambiguous cases.

- Caching & Config
  - Cache generated TTS by hash of inputs.
  - Config files for pilots/voices, TTS defaults, STT settings, intents, and a plans manifest.

## Components

- ElevenLabs v3 TTS
  - Model: `eleven_v3`
  - Endpoints: Text‑to‑Speech (`/v1/text-to-speech/{voice_id}`), Text‑to‑Dialogue (`/v1/text-to-dialogue`)
  - API key header: `xi-api-key`
  - Pilot voice mapping (custom/clone/designed/community voice IDs)

- Local STT
  - faster‑whisper with VAD (e.g., webrtcvad or silero‑vad)
  - 16 kHz mono mic capture, chunked streaming, rolling context

- Voice Navigation Intents (examples)
  - OpenPlan(name): “Open plan Europa”
  - Next/Prev: “Next plan”, “Previous plan”
  - SearchPlans(query): “Find plans about terraforming”
  - ReadSection(name), Repeat, Stop

## Expected Config Files (to create later)

- `config/pilots.json` — pilot → `voice_id`, `language_code`, style
- `config/tts.json` — `model_id`, `output_format`, `cache_dir`
- `config/stt.json` — model name/size, VAD settings, language
- `config/commands.json` — intent patterns, synonyms
- `config/plans_manifest.json` — generated index of plans (names, aliases, paths)

## Workflow (Narration)

1) Pick or clone voices for each pilot; record 30–60s clean samples if cloning.
2) Draft scripts with inline cues like `[whisper]`, `[excited]`, `[pause 300ms]`.
3) Chunk text (< ~3,000 chars for v3). Generate audio and cache outputs.
4) Assemble chunks and normalize loudness (e.g., around −16 LUFS) if needed.
5) Store per‑planet tracks in `var/assets/narration/{planet}/{locale}/`.

## Voice Navigation Flow

1) Build `plans_manifest.json` by indexing repo plan files (e.g., Markdown under `plans/`).
2) Stream mic → VAD → STT → text.
3) Parse intents with simple rules/regex + synonyms; fuzzy match plan names.
4) Execute action (open/switch/search/read) and play a short TTS confirmation.

## Operational Notes

- Keys: store `ELEVEN_API_KEY` in an env file or keychain (never commit secrets).
- Caching: hash `(model_id, voice_id, language_code, output_format, text)` → `var/cache/tts/{hash}.mp3`.
- Quotas: pre‑generate common lines to reduce calls; monitor usage.
- Fallbacks: if v3 unavailable, use Flash v2.5 or Turbo v2.5 for quick system prompts.

## References

- Eleven v3 overview: https://elevenlabs.io/v3
- Models (model_id = `eleven_v3`): https://elevenlabs.io/docs/models
- Create speech (Text‑to‑Speech): https://elevenlabs.io/docs/api-reference/text-to-speech/convert
- Text to Dialogue capability: https://elevenlabs.io/docs/capabilities/text-to-dialogue
- Create dialogue (API): https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert
- Local STT roundups (Whisper/faster‑whisper, Vosk, Coqui):
  - https://modal.com/blog/open-source-stt
  - https://www.notta.ai/en/blog/speech-to-text-open-source
  - https://qcall.ai/speech-to-text-open-source/
