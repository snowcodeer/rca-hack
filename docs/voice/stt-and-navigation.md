# Local STT + Voice Navigation (Hackathon Plan)

Offline speech recognition for voice control over repo plans, plus UX patterns for confirmations.

## Local STT Options

- Recommended: faster‑whisper (CTranslate2)
  - Good accuracy and speed on macOS; streaming friendly.
  - Install: Python env → `pip install faster-whisper`
  - Choose model size: start `medium`; use `large-v3` if resources allow.
  - Use VAD (e.g., webrtcvad or silero‑vad) for chunking.

- Alternatives
  - whisper.cpp — portable CPU‑only C/C++; minimal deps.
  - Vosk — ultra‑lightweight CPU; good on limited hardware.
  - Coqui STT — customizable; more setup if training/tuning.

Input tips: 16 kHz mono capture, AGC/noise suppression if needed, 0.5–2.0s chunks.

## Voice Navigation Intents

Core intents and utterances:

- OpenPlan(name)
  - “Open plan Europa”, “Open the Europa plan”, “Go to Europa”
- NextPlan / PrevPlan
  - “Next plan”, “Previous plan”, “Go back”
- SearchPlans(query)
  - “Find plans about terraforming”, “Search navigation”
- ReadSection(name)
  - “Read Objectives”, “Read Summary”
- Repeat / Stop
  - “Repeat that”, “Stop reading”

## Plans Manifest

Create `config/plans_manifest.json` by indexing repo plan files (e.g., Markdown under `plans/`).

Suggested fields:

```json
{
  "name": "Europa",
  "aliases": ["europa plan", "europa mission"],
  "path": "plans/europa.md",
  "sections": ["Summary", "Objectives", "Navigation"]
}
```

## Intent Parsing

- Deterministic approach for hackathon speed:
  - Regex + keyword tables for intents.
  - Fuzzy match plan names with a ratio threshold (~0.75) to handle misrecognitions.
  - If multiple candidates, ask a short disambiguation question and wait for reply.

## UX Speech Back

- Short confirmations via TTS:
  - “Opening plan Europa.”
  - “I found two matches: Europa and Eudora. Which one?”
- Keep a consistent “system” voice; Eleven v3 for quality or Eleven Flash/Turbo for speed.

## Minimal Configs (to add later)

- `config/stt.json` — model size, language, VAD thresholds.
- `config/commands.json` — synonyms/phrases per intent.
- `config/tts.json` — default voice for system confirmations.

## Rollout Steps (Quick)

1) Install faster‑whisper; verify local transcription of a short sample.
2) Build `plans_manifest.json` from repo files; add sensible aliases.
3) Wire mic → VAD → STT → intent parser → action; print logs for visibility.
4) Hook TTS confirmations using Eleven v3 (or Flash/Turbo for quick replies).
5) Pre‑generate any frequent lines and cache to minimize API calls.

## References

- STT comparisons/landscape:
  - https://modal.com/blog/open-source-stt
  - https://www.notta.ai/en/blog/speech-to-text-open-source
  - https://qcall.ai/speech-to-text-open-source/
