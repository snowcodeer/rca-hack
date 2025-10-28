import { createServer } from "node:http";

const PORT = Number(process.env.STT_PROXY_PORT ?? 4000);
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || "";
const TARGET_URL = "https://api.elevenlabs.io/v1/speech-to-text/convert";
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
  if (typeof payload.transcript === "string") {
    return payload.transcript;
  }
  if (Array.isArray(payload.chunks)) {
    return payload.chunks.map((chunk) => chunk.text ?? "").join(" ").trim() || null;
  }
  if (Array.isArray(payload.transcripts)) {
    return payload.transcripts
      .map((item) => extractTranscript(item))
      .filter(Boolean)
      .join(" ")
      .trim() || null;
  }
  if (typeof payload.text === "string") {
    return payload.text;
  }
  return null;
};

const pickChunks = (payload) => {
  if (!payload || !Array.isArray(payload.chunks)) {
    return undefined;
  }
  return payload.chunks.map((chunk) => ({
    text: chunk.text ?? "",
    start: chunk.start ?? null,
    end: chunk.end ?? null,
    speaker: chunk.speaker ?? null,
  }));
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

  const { audioBase64, mimeType = "audio/webm", languageCode, modelId, diarize, numSpeakers, timestampsGranularity, tagAudioEvents } =
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
    const upstream = await fetch(TARGET_URL, {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
      },
      body: formData,
    });

    const result = await upstream.json();

    if (!upstream.ok) {
      respond(response, upstream.status, {
        error: "Upstream ElevenLabs request failed",
        status: upstream.status,
        detail: result,
      });
      return;
    }

    const transcript = extractTranscript(result);
    const chunks = pickChunks(result);

    respond(response, 200, {
      transcript,
      chunks,
      language: result.language ?? languageCode ?? null,
      requestId: result.request_id ?? result.id ?? null,
    });
  } catch (error) {
    respond(response, 502, {
      error: "Failed to contact ElevenLabs",
      detail: error?.message ?? String(error),
    });
  }
});

server.listen(PORT, () => {
  console.log(`[stt-proxy] Listening on http://localhost:${PORT}${ROUTE}`);
});
