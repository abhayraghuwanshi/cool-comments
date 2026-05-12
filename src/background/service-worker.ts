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
  // Fetch media (GIF/video) as ArrayBuffer so the sidepanel can create a
  // same-origin blob URL — avoids canvas taint during video export.
  if (message.type === "FETCH_MEDIA_BLOB") {
    const url = message.url as string
    fetch(url)
      .then(async (r) => {
        const contentType = r.headers.get("content-type") ?? "application/octet-stream"
        const buffer = await r.arrayBuffer()
        sendResponse({ buffer, contentType })
      })
      .catch((err) => sendResponse({ error: String(err) }))
    return true
  }

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

  // Scrape/List mode: skip AI entirely — all comments (including GIFs) go into the flat list
  if (payload.mode === "scrape") {
    return {
      type: "RANK_RESULT",
      payload: payload.comments.map((c) => ({ ...c, tier: "A" as Tier, locked: false })),
    }
  }

  // Normal/savage/indian: GIF comments skip AI and go to the GIF holding tier
  const gifComments = payload.comments.filter((c) => c.gifUrl)
  const textComments = payload.comments.filter((c) => !c.gifUrl)

  const gifRanked: RankedComment[] = gifComments.map((c) => ({
    ...c,
    tier: "GIF" as Tier,
    locked: false,
  }))

  if (textComments.length === 0) {
    return { type: "RANK_RESULT", payload: gifRanked }
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" })
    const prompt = buildPrompt(payload.reel, textComments, payload.mode, payload.reelContext)
    const result = await model.generateContent(prompt)
    const text = result.response.text()
    const ranked = parseRankingResponse(text, textComments)
    return { type: "RANK_RESULT", payload: [...ranked, ...gifRanked] }
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

  if (mode === "scrape") {
    return buildListScriptPrompt(reel, byTier, reelContext)
  }

  // Worst-to-best order — matches the video export reveal format
  const TIERS_ORDER: Tier[] = ["F", "D", "C", "B", "A", "S"]

  const tierLines = TIERS_ORDER
    .filter((t) => byTier[t] && byTier[t]!.length > 0)
    .map((t) => {
      const comments = byTier[t]!.map((c) => `  - "${c.text}" (@${c.username})`).join("\n")
      return `${t} tier:\n${comments}`
    }).join("\n\n")

  const modeNote: Record<RankingMode, string> = {
    default: `You are a witty content creator who actually thinks about what comments mean. After reading a comment, you don't just react — you add a quick observation, joke, or callback that makes the viewer think "lmao exactly". Like a comedian doing crowd work but for comment sections.`,
    savage: `You are a ruthless roaster. After reading each bad comment, add a specific one-liner that burns what they said — not generic insults, actual jokes about the content of their comment. For good ones, add genuine disbelief like you can't believe someone actually wrote something smart.`,
    indian: `Full desi comedian energy. After reading each comment, add a quick observation in Indian internet style — reference engineering culture, Bollywood, Indian parent logic, or the "log kya kahenge" mindset when relevant. Use 'bhai', 'yaar', 'arre'. For a zoology or science comment, reference NEET/JEE. For gym content, reference "protein bro" culture. Make it feel like Indian Twitter reacting.`,
    scrape: "",
  }

  return `You are writing a voiceover script for a viral Instagram short-form video — a comment tier list reveal.

VIDEO FORMAT: Tiers revealed WORST to BEST (F → D → C → B → A → S). S tier is the CLIMAX. Energy builds from flat/done (F) to genuinely hyped (S).

REEL: @${reel.username}
CAPTION: "${reel.caption ?? ""}"${reelContext ? `\nCONTEXT: "${reelContext}"` : ""}
VOICE PERSONA: ${modeNote[mode]}

TIER BOARD (worst → best):
${tierLines}

SCRIPT RULES — follow all of these:
1. Open each tier with a punchy single line that sets the energy. NOT just "X tier."
2. For EACH comment do THREE things in order:
   a. Read it in double quotes
   b. Give a short punchy reaction (1 sentence, specific to what it says)
   c. Add ONE follow-up joke or observation about what the comment says about the person — this is where the comedy lives. ONE sentence only.
3. Use "..." for timing pauses — where a comedian would breathe or let something land
4. CAPS on words that need stress: "this person really thought they were DEEP"
5. Short sentences only. Never run-on.
6. VARY your reactions — no repeated phrases within a tier
7. Tie jokes back to the reel context when it makes it funnier
8. WORD BUDGET: each tier narration must be under 30 words total. The video is 50 seconds — audio must match. Be ruthless about cutting.
9. NO hashtags, emojis, markdown, filler phrases ("let's get into it", "without further ado")

EXAMPLE of good comment handling for an A tier zoology comment:
Input: "My zoology professor said that these birds are very rare"
Output: ... "My zoology professor said that these birds are very rare." ... Okay wait. An ACTUAL fact. ... This person went to class, took notes, and came back to help us. ... While everyone else is typing "lol" this one's out here doing field research. A tier. Respect.

Return ONLY a valid JSON array, tiers in F→S order, no markdown:
[{"tier": "F", "text": "..."}, ..., {"tier": "S", "text": "..."}]

Only include tiers that have comments. Tier keys must be uppercase single letters.`
}

function buildListScriptPrompt(
  reel: ReelData,
  byTier: Partial<Record<Tier, { text: string; username: string }[]>>,
  reelContext?: string
): string {
  const TIERS_ORDER: Tier[] = ["S", "A", "B", "C", "D", "F"]
  const allComments: { text: string; username: string }[] = []
  for (const t of TIERS_ORDER) {
    allComments.push(...(byTier[t] ?? []))
  }

  const commentLines = allComments
    .map((c) => `  - "${c.text}" (@${c.username})`)
    .join("\n")

  return `You are writing a voiceover script for a short Instagram video where the creator reads and reacts to top comments on their reel.

REEL: @${reel.username}
CAPTION: "${reel.caption ?? ""}"${reelContext ? `\nCONTEXT: "${reelContext}"` : ""}

TOP COMMENTS:
${commentLines}

SCRIPT RULES:
1. Open with ONE punchy line that captures the vibe of the comment section.
2. For EACH comment: read it in double quotes, then give ONE short punchy reaction specific to what it says.
3. Use "..." for dramatic pauses.
4. CAPS on words that need stress.
5. Short sentences only. Never run-on.
6. WORD BUDGET: entire script must be under 100 words. Be ruthless about cutting.
7. NO tier mentions, hashtags, emojis, markdown, or filler phrases like "let's get into it".

Return ONLY a valid JSON array with a single entry, no markdown:
[{"tier": "A", "text": "...the full script..."}]`
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
