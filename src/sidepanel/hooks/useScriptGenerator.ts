import { useCallback } from "react"
import type { RankedComment, ReelData, RankingMode, Tier } from "../../shared/messages"
import type { TierScript } from "../lib/ttsScript"

type ScriptResult = { scripts: TierScript[] } | { error: string }

export function useScriptGenerator() {
  const generateScript = useCallback(
    async (
      reel: ReelData,
      comments: RankedComment[],
      mode: RankingMode,
      reelContext?: string
    ): Promise<ScriptResult> => {
      const TIERS: Tier[] = ["S", "A", "B", "C", "D", "F"]
      // List mode sends a flat collection — use more comments since there's no tier spread
      const MAX_PER_TIER = mode === "scrape" ? 8 : 2
      const byTier: Partial<Record<Tier, { text: string; username: string }[]>> = {}
      for (const c of comments) {
        const tier = (c.tier?.toUpperCase() ?? "") as Tier
        if (TIERS.includes(tier)) {
          if (!byTier[tier]) byTier[tier] = []
          if (byTier[tier]!.length < MAX_PER_TIER) {
            byTier[tier]!.push({ text: c.text, username: c.username })
          }
        }
      }

      return new Promise((resolve) => {
        chrome.runtime.sendMessage(
          { type: "GENERATE_SCRIPT", payload: { reel, byTier, mode, reelContext } },
          (response) => {
            if (chrome.runtime.lastError) {
              resolve({ error: chrome.runtime.lastError.message ?? "Unknown error" })
              return
            }
            if (!response || response.type === "ERROR") {
              resolve({ error: response?.error ?? "Script generation failed" })
              return
            }
            resolve({ scripts: response.payload as TierScript[] })
          }
        )
      })
    },
    []
  )

  return { generateScript }
}
