import { useCallback } from "react"
import type { ScrapeResultPayload } from "../../shared/messages"

type ScrapeResult = ScrapeResultPayload | { error: string }

export function useScraper() {
  const scrape = useCallback(async (): Promise<ScrapeResult> => {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "SCRAPE_REEL" }, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ error: chrome.runtime.lastError.message ?? "Unknown error" })
          return
        }
        if (!response || response.type === "ERROR") {
          resolve({ error: response?.error ?? "Failed to scrape" })
          return
        }
        if (response.payload?.error) {
          resolve({ error: response.payload.error })
          return
        }
        resolve(response.payload as ScrapeResultPayload)
      })
    })
  }, [])

  return { scrape }
}
