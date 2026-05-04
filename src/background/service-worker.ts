import { GoogleGenerativeAI } from "@google/generative-ai"
import type {
  GenerateScriptPayload,
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

  if (message.type === "GENERATE_SCRIPT") {
    const payload = message.payload as GenerateScriptPayload
    handleScriptGeneration(payload).then(sendResponse)
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
  const contextLine = reelContext
    ? `- What this reel is about: "${reelContext}"`
    : `- Caption: "${reel.caption}"`

  const modeBlock: Record<RankingMode, string> = {
    default: `
TIER DEFINITIONS:
S - Legendary. Stops your scroll. Instantly quotable or perfectly timed.
A - Genuinely funny or clever. Clearly above average. Made you laugh out loud.
B - Solid joke. Gets a chuckle. Nothing wrong but nothing special.
C - Generic reaction. Low effort but inoffensive. Basic comment energy.
D - Cringe, try-hard, unfunny, or painfully mid.
F - Spam, off-topic, emoji-only, or painful to read.

INSTRUCTIONS: Judge purely on humor, wit, and originality. Spread comments across all tiers — do not cluster everything in B/C.`,

    savage: `
TIER DEFINITIONS:
S - Once-in-a-lifetime comment. Completely stops your scroll. Devastating wit or perfect callback.
A - Legitimately clever or funny. Rare. Most people couldn't write this.
B - Acceptable. Has a point. Still kind of mid though.
C - Mediocre filler. Forgettable within 2 seconds.
D - Cringe, try-hard, or just embarrassing to read.
F - Basic, spam, generic reaction, or any comment a bot could write.

INSTRUCTIONS: You are a brutal critic. The bar for S and A is extremely high — only 1-2 comments max should reach S. MOST comments in any reel section are D or F tier. Do NOT be generous. If a comment made you think "that's fine", it is a D. Generic compliments, basic reactions, and low-effort one-liners are all F.`,

    indian: `
TIER DEFINITIONS:
S - Peak desi comment. Instantly relatable to any Indian. Possibly goes viral in Indian WhatsApp groups.
A - Strong desi humor. Bollywood reference, Indian English gem, or regional joke that lands perfectly.
B - Has some desi flavor. Decent humor even if not fully Indian-coded.
C - Generic comment. No desi flavor. Could have been written by anyone anywhere.
D - Cringe, try-hard, or imports Western humor that doesn't land for an Indian audience.
F - Spam, emoji-only, or completely irrelevant.

INSTRUCTIONS: You are judging from a pure desi internet perspective. BONUS TIER for: "bhai/yaar" energy, Bollywood puns, engineering/IIT/UPSC memes, mom-dad-"log kya kahenge" jokes, Indian English quirks ("doing the needful", "out of station", "prepone"), regional slips ("ek dum", "bindaas", "jugaad"), uncle-aunty observations. PENALISE comments that are generic English internet humor with zero desi flavor — those are C or D regardless of how funny they might seem globally.`,
  }

  return `You are a comment tier-list judge for Instagram reels.

REEL CONTEXT:
- Creator: @${reel.username}
${contextLine}
${modeBlock[mode]}

COMMENTS TO RANK:
${JSON.stringify(comments.map((c) => ({ id: c.id, text: c.text, likes: c.likesCount, reply: c.isReply ?? false })))}

Return ONLY a valid JSON array. No explanation. No markdown. Format:
[{"id": "comment-id", "tier": "S"}, ...]

Include ALL ${comments.length} comments. Every comment gets exactly one tier (S/A/B/C/D/F uppercase).`
}

async function handleScriptGeneration(payload: GenerateScriptPayload): Promise<object> {
  const storage = await chrome.storage.local.get("apiKey")
  const apiKey = storage.apiKey as string | undefined
  if (!apiKey) return { type: "ERROR", error: "NO_API_KEY" }

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview" })
    const prompt = buildScriptPrompt(payload)
    const result = await model.generateContent(prompt)
    const text = result.response.text()
    const scripts = parseScriptResponse(text)
    return { type: "SCRIPT_RESULT", payload: scripts }
  } catch (err) {
    return { type: "ERROR", error: String(err) }
  }
}

function buildScriptPrompt(payload: GenerateScriptPayload): string {
  const { reel, byTier, mode, reelContext } = payload

  // Worst-to-best order — matches the video export reveal format
  const TIERS_ORDER: Tier[] = ["F", "D", "C", "B", "A", "S"]

  const tierLines = TIERS_ORDER
    .filter((t) => byTier[t] && byTier[t]!.length > 0)
    .map((t) => {
      const comments = byTier[t]!.map((c) => `  - "${c.text}" (@${c.username})`).join("\n")
      return `${t} tier:\n${comments}`
    }).join("\n\n")

  const modeNote: Record<RankingMode, string> = {
    default: `You are a reaction content creator with sharp wit. Balanced humor — hype the good ones, call out the bad ones. Think: someone who actually cares about good comments.`,
    savage: `You are a brutally honest critic. Zero mercy for bad comments — make the roast SPECIFIC to what they said, not generic. For good ones, sound genuinely surprised they exist.`,
    indian: `You are reacting with full desi energy — like watching this with your bhai in the hostel. Use 'bhai', 'yaar', 'arre', 'kya baat hai' naturally. Roast generic English comments for having zero desi flavor. Hype Bollywood references, IIT jokes, Indian English gems, and 'log kya kahenge' humor HARD. React like an Indian Twitter user, not a generic content creator.`,
  }

  return `You are writing a voiceover script for a viral Instagram short-form video — a comment tier list reveal.

VIDEO FORMAT: Tiers are revealed WORST to BEST (F → D → C → B → A → S). The S tier at the end is the CLIMAX. Your script must build energy from flat and disappointed (F) to genuinely shocked and hyped (S).

REEL: @${reel.username}
CAPTION: "${reel.caption ?? ""}"${reelContext ? `\nCONTEXT: "${reelContext}"` : ""}
VOICE PERSONA: ${modeNote[mode]}

TIER BOARD (worst → best):
${tierLines}

SCRIPT RULES:
1. Open each tier with a punchy line that sets its energy — do NOT just say "X tier"
2. Read each comment in double quotes, then give ONE reaction that is SPECIFIC to what that comment actually says — not a generic "bro" or "wow"
3. Use "..." for comedic timing pauses — place them where a real person would pause
4. Use CAPS to mark words that need vocal stress: "this is ACTUALLY insane"
5. SHORT sentences only. One beat per sentence. No run-ons.
6. VARY reactions — never use the same reaction word twice in one tier's script
7. Reference the reel context in reactions when it makes the reaction funnier
8. Allow 15-25 words per comment + reaction. Scale total length with comment count.
9. F tier energy = flat, tired, genuinely confused. S tier energy = loud, shocked, can't believe it.
10. NO hashtags, emojis, markdown, or filler phrases like "let's get into it"

Return ONLY a valid JSON array with tiers in F→S order. No explanation, no markdown:
[{"tier": "F", "text": "..."}, {"tier": "D", "text": "..."}, ..., {"tier": "S", "text": "..."}]

Only include tiers that have comments. Tier keys must be uppercase single letters.`
}

function parseScriptResponse(text: string): { tier: Tier; text: string }[] {
  try {
    const cleaned = text.replace(/```json?\n?/g, "").replace(/```/g, "").trim()
    const parsed = JSON.parse(cleaned) as { tier: string; text: string }[]
    const validTiers = new Set<Tier>(["S", "A", "B", "C", "D", "F"])
    return parsed
      .filter((s) => validTiers.has(s.tier as Tier) && typeof s.text === "string" && s.text.trim())
      .map((s) => ({ tier: s.tier as Tier, text: s.text.trim() }))
  } catch {
    return []
  }
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
