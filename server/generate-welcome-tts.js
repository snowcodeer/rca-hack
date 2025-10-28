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
const VOICE_IDS = new Map([
  ["sun", "RR2ynyOv72JmDyAdmblA"],
  ["mercury", "yPUfD9LmE4cGA4BXENkq"],
  ["venus", "Bsfdre5jDBDO2FL8lSwO"],
  ["earth", "cZcGQKkdzK0IyILxHUyg"],
  ["moon", "OIjELUVIOZLDGBHDVu9j"],
  ["mars", "y9Gomrn3AW2kfJ1JKwP3"],
  ["jupiter", "a1zCHhCNEKHweVfu6rVM"],
]);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..");
const PLANETS_PATH = join(ROOT, "src", "planets.json");
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

const data = JSON.parse(await readFile(PLANETS_PATH, "utf8"));
const uniqueBodies = Array.from(
  new Set(
    data
      .filter((body) => body?.traversable)
      .map((body) => body.name)
  )
);

await mkdir(OUTPUT_DIR, { recursive: true });

for (const name of uniqueBodies) {
  const key = name.toLowerCase();
  if (onlyFilter && !onlyFilter.has(key)) {
    continue;
  }
  const slug = slugify(name);
  const outputFile = join(OUTPUT_DIR, `welcome-${slug}.mp3`);

  if (!force && existsSync(outputFile)) {
    console.log(`Skipping ${name} (already exists)`);
    continue;
  }

  const voiceId = pickVoiceId(key);
  if (!voiceId) {
    console.warn(`No voice configured for ${name}; skipping.`);
    continue;
  }

  console.log(`Generating clip for ${name} using voice ${voiceId}…`);
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      Accept: "audio/mpeg",
      "Content-Type": "application/json",
      "xi-api-key": ELEVENLABS_API_KEY,
    },
    body: JSON.stringify({
      text: buildPrompt(name),
      model_id: MODEL_ID,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.8,
      },
    }),
  });

  if (!response.ok) {
    const detail = await safeRead(response);
    console.error(`Failed to generate clip for ${name}: ${response.status} ${detail}`);
    continue;
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(outputFile, buffer);
  console.log(`Saved ${outputFile}`);
}

console.log("Welcome narration generation complete.");

function pickVoiceId(key) {
  if (VOICE_IDS.has(key)) {
    return VOICE_IDS.get(key);
  }
  return VOICE_IDS.get("sun") ?? null;
}

function slugify(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function buildPrompt(name) {
  return `Welcome to ${name}.`;
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
