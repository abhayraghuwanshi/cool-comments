import { useCallback } from "react"
import type { ReelData, RawComment, RankedComment, RankingMode } from "../../shared/messages"

type RankResult = { comments: RankedComment[] } | { error: string }

export function useRanker() {
  const rank = useCallback(
    async (reel: ReelData, comments: RawComment[], mode: RankingMode): Promise<RankResult> => {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage(
          { type: "RANK_COMMENTS", payload: { reel, comments, mode } },
          (response) => {
            if (chrome.runtime.lastError) {
              resolve({ error: chrome.runtime.lastError.message ?? "Unknown error" })
              return
            }
            if (!response || response.type === "ERROR") {
              resolve({ error: response?.error ?? "Ranking failed" })
              return
            }
            resolve({ comments: response.payload as RankedComment[] })
          }
        )
      })
    },
    []
  )

  return { rank }
}
