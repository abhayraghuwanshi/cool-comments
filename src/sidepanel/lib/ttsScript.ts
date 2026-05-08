import type { RankedComment, Tier } from "../../shared/messages"

export interface TierScript {
  tier: Tier
  text: string
}

// ash = newer male voice, clear and punchy. fable = expressive British male (good alternative)
export const TTS_VOICE = { voice: "ash" as const, speed: 1.3 }

// Worst-to-best — matches the video export reveal order
export const TIERS_REVEAL_ORDER: Tier[] = ["F", "D", "C", "B", "A", "S"]

const TIER_INTROS: Record<Tier, string> = {
  F: "F tier. The worst ones. I'm so tired.",
  D: "D tier. Not as bad. Still bad.",
  C: "C tier. Mid. Peak mid.",
  B: "B tier. Actually decent.",
  A: "A tier. Now we're talking.",
  S: "S tier. The best comments on this reel. Let's GO.",
  DRAFT: "",
  GIF: "",
}

const TIER_REACTIONS: Record<Tier, string[]> = {
  F: ["...why.", "Delete this.", "Who approved this.", "I genuinely cannot.", "Next."],
  D: ["No.", "Come on.", "That's rough.", "Try again.", "...really?"],
  C: ["Okay.", "Sure.", "Mid.", "Moving on.", "...fine."],
  B: ["That works.", "Not bad.", "Solid.", "Okay actually.", "Yeah alright."],
  A: ["Okay that's good.", "Fair enough.", "That's clever.", "Nice one.", "Actually got me."],
  S: ["BRO.", "No way.", "That's ELITE.", "Genuinely insane.", "okay okay okay."],
  DRAFT: [],
  GIF: [],
}

const EMOJI_MAP: [RegExp, string][] = [
  [/😂|🤣/g, "HA."],
  [/💀/g, "DEAD."],
  [/🔥/g, "FIRE."],
  [/😭/g, "crying."],
  [/❤️|🧡|💛|💚|💙|💜/g, "love."],
  [/👏/g, "clap."],
  [/😍/g, "sheesh."],
  [/🤡/g, "CLOWN."],
  [/💯/g, "facts."],
  [/🙏/g, "please."],
]

const ABBREV_MAP: [RegExp, string][] = [
  [/\blmao\b/gi, "el mao"],
  [/\blmfao\b/gi, "el em fao"],
  [/\bomg\b/gi, "oh my GOD"],
  [/\bngl\b/gi, "not gonna lie"],
  [/\bfr\b/gi, "for REAL"],
  [/\bwtf\b/gi, "what the"],
  [/\bidk\b/gi, "I don't know"],
  [/\bsmh\b/gi, "shaking my head"],
  [/\bnpc\b/gi, "N P C"],
  [/\bbruh\b/gi, "BRO"],
]

function prepareComment(text: string): string {
  let out = text
  for (const [p, r] of EMOJI_MAP) out = out.replace(p, r)
  out = out.replace(/[\u{1F300}-\u{1FFFF}\u{2600}-\u{27BF}]/gu, "")
  for (const [p, r] of ABBREV_MAP) out = out.replace(p, r)
  out = out.replace(/\s+/g, " ").trim()
  if (out && !/[.!?,]$/.test(out)) out += "."
  return out
}

export function generateTierScripts(
  byTier: Record<Tier, RankedComment[]>
): TierScript[] {
  return TIERS_REVEAL_ORDER
    .filter((tier) => byTier[tier].length > 0)
    .map((tier) => {
      const reactions = TIER_REACTIONS[tier]
      const commentLines = byTier[tier].map((c, i) => {
        const prepared = prepareComment(c.text)
        const reaction = reactions[i % reactions.length]
        return `"${prepared}" ... ${reaction}`
      }).join(" ... ")

      return {
        tier,
        text: `${TIER_INTROS[tier]} ... ${commentLines}`,
      }
    })
}
