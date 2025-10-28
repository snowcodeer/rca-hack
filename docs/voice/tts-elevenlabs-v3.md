# ElevenLabs v3 TTS (Hackathon Integration)

Highly expressive narration using Eleven v3 (alpha). Keep it simple and fast to ship.

## Setup

1) Create ElevenLabs account and API key.
2) Store key securely as env var (do not commit): `ELEVEN_API_KEY=...`
3) Choose voices per pilot:
   - Clone (upload 30–60s clean samples),
   - Design (parametric), or
   - Curated community voices (check licensing).

## Model & Endpoints

- Model ID: `eleven_v3`
- Single‑voice TTS: `POST /v1/text-to-speech/{voice_id}`
- Multi‑voice dialogue: `POST /v1/text-to-dialogue`
- Header: `xi-api-key: $ELEVEN_API_KEY`
- Common output format: `mp3_44100_128` (default). PCM variants available.

## Pilot Voice Mapping (config to create later)

`config/pilots.json` example fields:

```json
{
  "pilot_id": "call_sign",
  "voice_id": "elevenlabs-voice-id",
  "language_code": "en-US",
  "style": "calm"
}
```

## Prompting & Delivery Control

- Eleven v3 supports expressive cues (e.g., `[whisper]`, `[excited]`, `[pause 300ms]`).
- For conversations, use Text‑to‑Dialogue with an `inputs` array of `{ text, voice_id, language_code? }`.
- Character limit per request is lower than v2; chunk long text (~< 3,000 chars), then stitch.

## Request Examples (reference)

Single‑voice TTS (JSON body):

```http
POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}
Headers:
  xi-api-key: $ELEVEN_API_KEY
Body:
{
  "text": "[whisper] Approaching Europa… [pause 300ms] Switching to low‑orbit.",
  "model_id": "eleven_v3",
  "output_format": "mp3_44100_128",
  "language_code": "en-US"
}
```

Dialogue (multi‑voice):

```http
POST https://api.elevenlabs.io/v1/text-to-dialogue
Headers:
  xi-api-key: $ELEVEN_API_KEY
Body:
{
  "model_id": "eleven_v3",
  "output_format": "mp3_44100_128",
  "inputs": [
    { "voice_id": "<pilotA_voice>", "text": "[confident] Control, requesting approach vector." },
    { "voice_id": "<pilotB_voice>", "text": "[calm] Vector set. Maintain bearing 221." }
  ]
}
```

## Caching & Determinism

- File key: hash of `(model_id, voice_id, language_code, output_format, text)`.
- Path: `var/cache/tts/{hash}.mp3` (or `.wav` for PCM).
- Always check cache before API calls to save time/credits.

## Workflow (Narration)

1) Finalize pilot voices; document in `config/pilots.json`.
2) Write scripts with inline cues; split into chunks.
3) Generate audio per chunk (parallel OK); cache outputs.
4) Concatenate and loudness‑normalize; export per‑planet tracks.

## Notes & Fallbacks

- If you need quick confirmations (not full narration), Flash v2.5/Turbo v2.5 are fine.
- Monitor quota/latency; pre‑generate common lines during idle time.

## Official Docs

- Eleven v3 overview: https://elevenlabs.io/v3
- Models (model_id `eleven_v3`): https://elevenlabs.io/docs/models
- Create speech: https://elevenlabs.io/docs/api-reference/text-to-speech/convert
- Text to Dialogue capability: https://elevenlabs.io/docs/capabilities/text-to-dialogue
- Create dialogue (API): https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert
