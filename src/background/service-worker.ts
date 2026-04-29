import { GoogleGenerativeAI } from "@google/generative-ai"
import type {
  RankCommentsPayload,
  RankedComment,
  RankingMode,
  RawComment,
  ReelData,
  Tier,
} from "../shared/messages"

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error)
})

chrome.runtime.onStartup.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error)
})

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "SCRAPE_REEL") {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const tab = tabs[0]
      const tabId = tab?.id
      if (!tabId) {
        sendResponse({ type: "ERROR", error: "No active tab found" })
        return
      }

      // Quick URL pre-check before touching the content script
      const url = tab.url ?? ""
      const onPost = url.includes("instagram.com/reel/") || url.includes("instagram.com/p/")
      if (!onPost) {
        sendResponse({ type: "ERROR", error: "NOT_ON_REEL_PAGE" })
        return
      }

      try {
        const result = await chrome.tabs.sendMessage(tabId, { type: "SCRAPE_REEL" })
        sendResponse({ type: "SCRAPE_RESULT", payload: result })
      } catch (err) {
        // "Receiving end does not exist" = content script not yet injected
        // (happens when the tab was open before the extension loaded)
        if (!String(err).includes("Receiving end does not exist")) {
          sendResponse({ type: "ERROR", error: String(err) })
          return
        }

        // Inject the content script programmatically, then retry once
        try {
          const manifest = chrome.runtime.getManifest()
          const files = manifest.content_scripts?.[0]?.js ?? []
          await chrome.scripting.executeScript({ target: { tabId }, files })
          await new Promise((r) => setTimeout(r, 400))
          const result = await chrome.tabs.sendMessage(tabId, { type: "SCRAPE_REEL" })
          sendResponse({ type: "SCRAPE_RESULT", payload: result })
        } catch {
          sendResponse({
            type: "ERROR",
            error: "Could not inject scraper. Please refresh the Instagram tab and try again.",
          })
        }
      }
    })
    return true
  }

  if (message.type === "RANK_COMMENTS") {
    const payload = message.payload as RankCommentsPayload
    handleRanking(payload).then(sendResponse)
    return true
  }
})

async function handleRanking(payload: RankCommentsPayload): Promise<object> {
  const storage = await chrome.storage.local.get("apiKey")
  const apiKey = storage.apiKey as string | undefined

  if (!apiKey) {
    return { type: "ERROR", error: "NO_API_KEY" }
  }

  if (!payload.comments || payload.comments.length === 0) {
    return { type: "ERROR", error: "NO_COMMENTS_SCRAPED" }
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" })
    const prompt = buildPrompt(payload.reel, payload.comments, payload.mode, payload.reelContext)
    const result = await model.generateContent(prompt)
    const text = result.response.text()
    const ranked = parseRankingResponse(text, payload.comments)
    return { type: "RANK_RESULT", payload: ranked }
  } catch (err) {
    return { type: "ERROR", error: String(err) }
  }
}

function buildPrompt(reel: ReelData, comments: RawComment[], mode: RankingMode, reelContext?: string): string {
  const modeInstruction: Record<RankingMode, string> = {
    default: "Rank based on humor, wit, originality, and cleverness.",
    savage: "Rank harshly. Only truly devastating or brilliant comments get S or A. Be merciless with mediocrity.",
    indian: "Rank with extra points for desi humor, Bollywood references, Indian English quirks, chai references, and regional jokes that resonate with an Indian audience.",
  }

  const contextLine = reelContext
    ? `- What this reel is about: "${reelContext}"`
    : `- Caption: "${reel.caption}"`

  return `You are a comment tier-list judge for Instagram reels.

REEL CONTEXT:
- Creator: @${reel.username}
${contextLine}

RANKING INSTRUCTIONS:
${modeInstruction[mode]}

TIER DEFINITIONS:
S - Legendary. Instantly shareable. Perfect timing or devastating wit.
A - Very funny or clever. Clearly above average.
B - Solid. Gets a laugh but nothing special.
C - Generic or mid. Standard comment energy.
D - Boring, cringe, or try-hard.
F - Spam, irrelevant, or painful to read.

COMMENTS TO RANK:
${JSON.stringify(comments.map((c) => ({ id: c.id, text: c.text, likes: c.likesCount, reply: c.isReply ?? false })))}

Return ONLY a valid JSON array. No explanation. No markdown code fences. Format:
[{"id": "comment-id", "tier": "S"}, ...]

Include all ${comments.length} comments. Every comment gets exactly one tier.`
}

function parseRankingResponse(text: string, comments: RawComment[]): RankedComment[] {
  try {
    const cleaned = text.replace(/```json?\n?/g, "").replace(/```/g, "").trim()
    const rankings = JSON.parse(cleaned) as { id: string; tier: string }[]
    const tierMap = new Map(rankings.map((r) => [r.id, r.tier as Tier]))

    const validTiers = new Set<Tier>(["S", "A", "B", "C", "D", "F"])

    return comments.map((c) => {
      const tier = tierMap.get(c.id)
      return {
        ...c,
        tier: tier && validTiers.has(tier) ? tier : "C",
        locked: false,
      }
    })
  } catch {
    return comments.map((c) => ({ ...c, tier: "C" as Tier, locked: false }))
  }
}
