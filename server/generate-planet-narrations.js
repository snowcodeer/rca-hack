import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
if (!ELEVENLABS_API_KEY) {
  console.error("ELEVENLABS_API_KEY environment variable is required.");
  process.exit(1);
}

const MODEL_ID = "eleven_v3";
const VOICE_API_BASE = "https://api.elevenlabs.io/v1/text-to-speech";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..");
const DATA_PATH = join(ROOT, "src", "voice", "narration-data.json");
const OUTPUT_DIR = join(ROOT, "static", "audio");

const force = process.argv.includes("--force");
const onlyArg = process.argv.find((arg) => arg.startsWith("--only="));
const onlyFilter = onlyArg
  ? new Set(
      onlyArg
        .slice("--only=".length)
        .split(",")
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean)
    )
  : null;

const payload = JSON.parse(await readFile(DATA_PATH, "utf8"));

if (!Array.isArray(payload) || payload.length === 0) {
  console.error("Narration dataset is empty – nothing to generate.");
  process.exit(1);
}

const seenVoices = new Set(payload.map((entry) => entry.voiceId));
if (seenVoices.size !== payload.length) {
  console.warn("Warning: Duplicate voice IDs detected in narration-data.json. Each narration should use a unique voice.");
}

await mkdir(OUTPUT_DIR, { recursive: true });

for (const entry of payload) {
  if (!entry || typeof entry.name !== "string" || typeof entry.text !== "string" || typeof entry.voiceId !== "string") {
    console.warn("Skipping invalid entry", entry);
    continue;
  }

  const key = entry.name.trim().toLowerCase();
  if (onlyFilter && !onlyFilter.has(key)) {
    continue;
  }

  const slug = slugify(entry.name);
  const outputFile = join(OUTPUT_DIR, `narration-${slug}.mp3`);

  if (!force && existsSync(outputFile)) {
    console.log(`Skipping ${entry.name} (already exists)`);
    continue;
  }

  console.log(`Generating narration for ${entry.name} using voice ${entry.voiceId}…`);
  const response = await fetch(`${VOICE_API_BASE}/${entry.voiceId}`, {
    method: "POST",
    headers: {
      Accept: "audio/mpeg",
      "Content-Type": "application/json",
      "xi-api-key": ELEVENLABS_API_KEY,
    },
    body: JSON.stringify({
      text: entry.text,
      model_id: MODEL_ID,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.15,
        use_speaker_boost: true,
      },
    }),
  });

  if (!response.ok) {
    const detail = await safeRead(response);
    console.error(`Failed to generate narration for ${entry.name}: ${response.status} ${detail}`);
    continue;
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(outputFile, buffer);
  console.log(`Saved ${outputFile}`);
}

console.log("Narration generation complete.");

function slugify(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

async function safeRead(response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      return JSON.stringify(await response.json());
    } catch (error) {
      return `<invalid json: ${error}>`;
    }
  }
  try {
    return await response.text();
  } catch (error) {
    return `<unreadable: ${error}>`;
  }
}
