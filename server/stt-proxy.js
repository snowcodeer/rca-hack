import { createServer } from "node:http";

const PORT = Number(process.env.STT_PROXY_PORT ?? 4000);
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || "";
const ENDPOINTS = [
  "https://api.elevenlabs.io/v1/speech-to-text/convert",
  // Fallbacks in case of routing changes
  "https://api.elevenlabs.io/v1/speech-to-text",
  "https://api.elevenlabs.io/v1/speech-to-text/transcriptions",
];
const ROUTE = "/api/stt/transcriptions";

const baseHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};

const readBody = async (request) => {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
};

const decodeAudio = (base64) => {
  const trimmed = base64.includes(",") ? base64.split(",").pop() : base64;
  if (!trimmed) {
    throw new Error("audioBase64 payload is empty");
  }
  return Buffer.from(trimmed, "base64");
};

const extractTranscript = (payload) => {
  if (!payload) {
    return null;
  }
  if (typeof payload.transcript === "string" && payload.transcript.trim()) {
    return payload.transcript;
  }
  if (typeof payload.text === "string" && payload.text.trim()) {
    return payload.text;
  }
  if (Array.isArray(payload.words) && payload.words.length > 0) {
    return payload.words.map((word) => word.text ?? "").join(" ").trim() || null;
  }
  if (Array.isArray(payload.chunks) && payload.chunks.length > 0) {
    return payload.chunks.map((chunk) => chunk.text ?? "").join(" ").trim() || null;
  }
  if (Array.isArray(payload.segments) && payload.segments.length > 0) {
    return payload.segments.map((segment) => segment.text ?? "").join(" ").trim() || null;
  }
  if (Array.isArray(payload.transcripts) && payload.transcripts.length > 0) {
    return payload.transcripts
      .map((item) => extractTranscript(item))
      .filter(Boolean)
      .join(" ")
      .trim() || null;
  }
  return null;
};

const pickChunks = (payload) => {
  if (!payload) {
    return undefined;
  }
  if (Array.isArray(payload.chunks)) {
    return payload.chunks.map((chunk) => ({
      text: chunk.text ?? "",
      start: chunk.start ?? null,
      end: chunk.end ?? null,
      speaker: chunk.speaker ?? null,
    }));
  }
  if (Array.isArray(payload.words)) {
    return payload.words.map((word) => ({
      text: word.text ?? "",
      start: word.start ?? word.offset ?? null,
      end: word.end ?? null,
      speaker: word.speaker ?? null,
    }));
  }
  if (Array.isArray(payload.segments)) {
    return payload.segments.map((segment) => ({
      text: segment.text ?? "",
      start: segment.start ?? null,
      end: segment.end ?? null,
      speaker: segment.speaker ?? null,
    }));
  }
  return undefined;
};

const respond = (response, statusCode, body) => {
  response.writeHead(statusCode, {
    ...baseHeaders,
    "Content-Type": "application/json",
  });
  response.end(JSON.stringify(body));
};

const server = createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    response.writeHead(204, baseHeaders);
    response.end();
    return;
  }

  if (request.method !== "POST" || request.url !== ROUTE) {
    respond(response, 404, { error: "Not Found" });
    return;
  }

  if (!ELEVENLABS_API_KEY) {
    respond(response, 500, { error: "ELEVENLABS_API_KEY is not configured" });
    return;
  }

  let payload;
  try {
    const rawBody = await readBody(request);
    payload = JSON.parse(rawBody);
  } catch (error) {
    respond(response, 400, { error: "Invalid JSON payload" });
    return;
  }

  const { audioBase64, mimeType = "audio/webm", languageCode, modelId, diarize, numSpeakers, timestampsGranularity, tagAudioEvents, candidates = [], classify = false } =
    payload || {};

  if (!audioBase64) {
    respond(response, 400, { error: "audioBase64 is required" });
    return;
  }

  let audioBuffer;
  try {
    audioBuffer = decodeAudio(audioBase64);
  } catch (error) {
    respond(response, 400, { error: "Failed to decode audio", detail: error.message ?? String(error) });
    return;
  }

  const formData = new FormData();
  const blob = new Blob([audioBuffer], { type: mimeType });
  const fileName = payload.fileName || `voice-${Date.now()}.${mimeType.split("/").pop() || "webm"}`;

  formData.append("model_id", modelId || "scribe_v1");
  formData.append("file", blob, fileName);
  if (languageCode) {
    formData.append("language_code", languageCode);
  }
  if (typeof diarize === "boolean") {
    formData.append("diarize", String(diarize));
  }
  if (typeof numSpeakers === "number") {
    formData.append("num_speakers", String(numSpeakers));
  }
  if (timestampsGranularity) {
    formData.append("timestamps_granularity", timestampsGranularity);
  }
  if (typeof tagAudioEvents === "boolean") {
    formData.append("tag_audio_events", String(tagAudioEvents));
  }

  try {
    let result;
    let ok = false;
    let lastStatus = 0;
    let lastBody = null;
    for (const url of ENDPOINTS) {
      const upstream = await fetch(url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "xi-api-key": ELEVENLABS_API_KEY,
        },
        body: formData,
      });
      lastStatus = upstream.status;
      try {
        result = await upstream.json();
      } catch {
        result = null;
      }
      lastBody = result;
      if (upstream.ok) {
        ok = true;
        break;
      }
      if (upstream.status !== 404) {
        break;
      }
    }

    if (!ok) {
      console.error("[stt-proxy] ElevenLabs error", lastStatus, lastBody);
      respond(response, lastStatus || 502, {
        error: "Upstream ElevenLabs request failed",
        status: lastStatus,
        detail: lastBody,
      });
      return;
    }

    const transcript = extractTranscript(result);
    const chunks = pickChunks(result);

    // Optional server-side intent classification
    const intent = classify ? classifyIntent(transcript, candidates) : null;

    respond(response, 200, {
      transcript,
      chunks,
      text: result.text ?? null,
      words: Array.isArray(result.words) ? result.words : undefined,
      segments: Array.isArray(result.segments) ? result.segments : undefined,
      language: result.language ?? result.language_code ?? languageCode ?? null,
      requestId: result.request_id ?? result.id ?? null,
      intent,
    });
  } catch (error) {
    console.error("[stt-proxy] request failure", error);
    respond(response, 502, {
      error: "Failed to contact ElevenLabs",
      detail: error?.message ?? String(error),
    });
  }
});

server.listen(PORT, () => {
  console.log(`[stt-proxy] Listening on http://localhost:${PORT}${ROUTE}`);
});

// ----------------------
// Intent Classification
// ----------------------
const COMMAND_SYNONYMS = {
  open: ["open", "go to", "goto", "show", "focus on", "focus"],
  next: ["next", "next planet", "forward"],
  previous: ["previous", "prev", "back", "backwards"],
  repeat: ["repeat", "again"],
  stop: ["stop", "cancel", "pause"],
};

function classifyIntent(transcript, candidates) {
  if (!transcript || typeof transcript !== "string") return null;
  const normalized = transcript.toLowerCase();
  const simple = (phrases) => phrases.some((p) => normalized.includes(p));
  if (simple(COMMAND_SYNONYMS.next)) return { type: "next", transcript, normalized };
  if (simple(COMMAND_SYNONYMS.previous)) return { type: "previous", transcript, normalized };
  if (simple(COMMAND_SYNONYMS.repeat)) return { type: "repeat", transcript, normalized };
  if (simple(COMMAND_SYNONYMS.stop)) return { type: "stop", transcript, normalized };

  const m = normalized.match(/(?:open|go to|goto|show|focus on|focus)\s+(.+)/);
  let targetCandidate = m && m[1] ? m[1] : normalized;
  targetCandidate = targetCandidate.replace(/[.?!,]/g, " ").trim();
  const target = resolveCandidate(targetCandidate, candidates || []);
  if (target && target.score >= 0.45) {
    return { type: "open", target: target.name, confidence: target.score, transcript, normalized };
  }
  return null;
}

function resolveCandidate(raw, candidates) {
  if (!raw || !Array.isArray(candidates)) return null;
  const cand = raw.toLowerCase();
  let best = null;
  for (const name of candidates) {
    const score = similarity(name.toLowerCase(), cand);
    if (!best || score > best.score) best = { name, score };
  }
  return best;
}

function similarity(a, b) {
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.85;
  return levenshteinSimilarity(a, b);
}

function levenshteinSimilarity(a, b) {
  const distance = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length) || 1;
  return 1 - distance / maxLen;
}

function levenshtein(a, b) {
  const matrix = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
    }
  }
  return matrix[a.length][b.length];
}
