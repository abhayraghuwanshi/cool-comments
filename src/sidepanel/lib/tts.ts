import type { Tier } from "../../shared/messages"
import type { TierScript } from "./ttsScript"
import { TTS_VOICE } from "./ttsScript"

// gpt-4o-mini-tts supports "instructions" — tells the model HOW to speak, not just what.
// Falls back to tts-1-hd if the newer model isn't available on the account.
const TTS_MODEL = "gpt-4o-mini-tts"
const TTS_FALLBACK_MODEL = "tts-1-hd"

const TTS_INSTRUCTIONS =
  "You are a young, energetic content creator reacting to Instagram comments. " +
  "Speak with genuine enthusiasm and personality — not like a robot reading a list. " +
  "When you see '...' pause dramatically for comedic timing. " +
  "Emphasize words written in ALL CAPS. " +
  "React to good comments with real hype. React to bad comments with flat disappointment. " +
  "Sound like you're actually surprised, amused, or done — not performing it."

async function fetchTierBlob(script: TierScript, apiKey: string): Promise<{ tier: Tier; blob: Blob }> {
  // Try gpt-4o-mini-tts first (supports instructions for emotional delivery)
  const body: Record<string, unknown> = {
    model: TTS_MODEL,
    voice: TTS_VOICE.voice,
    input: script.text,
    speed: TTS_VOICE.speed,
    instructions: TTS_INSTRUCTIONS,
  }

  let res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })

  // Fall back to tts-1-hd if the new model isn't available
  if (!res.ok && res.status === 404) {
    res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ...body, model: TTS_FALLBACK_MODEL, instructions: undefined }),
    })
  }

  if (!res.ok) {
    throw new Error(`TTS error ${res.status}: ${await res.text()}`)
  }

  return { tier: script.tier, blob: await res.blob() }
}

export async function generateAllTierAudio(
  scripts: TierScript[],
  apiKey: string,
  onProgress?: (done: number, total: number) => void
): Promise<Map<Tier, Blob>> {
  const map = new Map<Tier, Blob>()
  for (let i = 0; i < scripts.length; i++) {
    const { tier, blob } = await fetchTierBlob(scripts[i], apiKey)
    map.set(tier, blob)
    onProgress?.(i + 1, scripts.length)
  }
  return map
}

export function blobsToUrls(blobs: Map<Tier, Blob>): Map<Tier, string> {
  return new Map([...blobs.entries()].map(([tier, blob]) => [tier, URL.createObjectURL(blob)]))
}

export function revokeTierAudio(urlMap: Map<Tier, string>): void {
  for (const url of urlMap.values()) URL.revokeObjectURL(url)
}
