import type { ReelData, RawComment } from "../shared/messages"

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== "SCRAPE_REEL") return

  const onInstagramPost =
    location.pathname.startsWith("/reel/") || location.pathname.startsWith("/p/")
  if (!onInstagramPost) {
    sendResponse({ error: "NOT_ON_REEL_PAGE" })
    return
  }

  scrapeReel().then(sendResponse)
  return true
})

async function scrapeReel(): Promise<{ reel: ReelData; comments: RawComment[] }> {
  // Expand all visible "View all X replies" buttons before scraping
  await expandAllReplies()

  const reel = await scrapeReelInfo()
  const comments = scrapeComments(60)
  return { reel, comments }
}

// Click every "View all X replies" button and wait for replies to load
async function expandAllReplies(): Promise<void> {
  const replyButtons = document.querySelectorAll<HTMLElement>("div.x11hdunq")
  if (replyButtons.length === 0) return

  for (const btn of replyButtons) {
    try {
      btn.click()
    } catch {
      // ignore individual click failures
    }
  }

  // Wait for replies to render
  await delay(1200)
}

async function scrapeReelInfo(): Promise<ReelData> {
  // Username from the first profile link in the header/author area
  // Instagram uses `_a6hd` on profile links; the author link is near the top
  const authorLink = document.querySelector<HTMLAnchorElement>(
    "a._a6hd[href^='/'][tabindex='0']:not([href*='/p/'])"
  )
  const username = extractUsername(authorLink?.href ?? "") || ""

  // Profile pic — first img inside the header author area
  const profilePicEl =
    document.querySelector<HTMLImageElement>("article header img") ||
    document.querySelector<HTMLImageElement>("header img[crossorigin='anonymous']") ||
    null

  const profilePicUrl = profilePicEl ? await imageToBase64(profilePicEl.src) : ""

  // Caption: the reel owner's own text — appears in the first ._ac6x block
  // In the DOM, the poster's caption shares the same structure but is the first comment-like block
  // It's also found in article section or in the first text block near the author
  const captionEl = document.querySelector<HTMLElement>(
    "article span._ap3a._aacu, h1[dir='auto'], span[dir='auto'] > div[style*='inline'] span._ap3a._aacu"
  )
  const caption = captionEl?.textContent?.trim() ?? ""

  // Like count from a "liked_by" link near the post (not comments)
  const likesLinkEls = document.querySelectorAll<HTMLAnchorElement>("a[href*='/liked_by/']")
  let likesCount = ""
  if (likesLinkEls.length > 0) {
    const span = likesLinkEls[0].querySelector("span")
    likesCount = span?.textContent?.trim() ?? ""
  }

  return {
    username,
    profilePicUrl,
    caption,
    reelUrl: location.href,
    likesCount,
    commentsCount: "",
  }
}

function scrapeComments(limit: number): RawComment[] {
  // All comment/reply blocks use the stable `_ac6x` class
  const commentBlocks = document.querySelectorAll<HTMLElement>("div._ac6x")
  const results: RawComment[] = []

  for (let i = 0; i < commentBlocks.length && results.length < limit; i++) {
    const block = commentBlocks[i]

    const extracted = extractComment(block, i)
    if (extracted) results.push(extracted)
  }

  return results
}

function extractComment(block: HTMLElement, index: number): RawComment | null {
  // Username: inside `a._a6hd` > `span._ap3a._aacw` — `_aacw` is the username variant
  const usernameSpan = block.querySelector<HTMLElement>(
    "a._a6hd span._ap3a._aacw, a._a6hd span._aacw"
  )
  const username = usernameSpan?.textContent?.trim() ?? ""
  if (!username) return null

  // Comment text: `span._ap3a._aacu` — `_aacu` is the body text variant
  // There can be multiple _aacu spans (whitespace, @mentions prefix, text).
  // The actual content is in the last non-empty _aacu span that contains text.
  const textSpans = block.querySelectorAll<HTMLElement>("span._ap3a._aacu, span._aacu")
  let text = ""
  for (const span of textSpans) {
    const content = span.textContent?.trim() ?? ""
    // Skip whitespace-only spans and spans that are just the username mention
    if (content && content !== " " && content !== username) {
      text = content
      // Don't break — keep iterating so we get the last (deepest) text
    }
  }

  // If no _aacu text found, try the inline div pattern:
  // <div style="display: inline;"><span class="...">actual text</span></div>
  if (!text) {
    const inlineDivSpan = block.querySelector<HTMLElement>(
      "div[style*='display: inline'] span._ap3a"
    )
    text = inlineDivSpan?.textContent?.trim() ?? ""
  }

  if (!text || text === username) return null

  // Like count: from the linked "liked_by" anchor within this block
  const likesLink = block.querySelector<HTMLAnchorElement>("a[href*='/liked_by/']")
  const likesText = likesLink?.querySelector("span")?.textContent?.trim() ?? ""
  // Normalize: "4,016 likes" → "4,016" or "4016"
  const likesCount = likesText.replace(/\s*likes?\s*/i, "").trim()

  // Detect if this is a reply: replies typically have "@username" prefix text
  // We keep them since they can also be funny
  const isReply = !!block.querySelector<HTMLElement>("span._aacu a._a6hd")

  return {
    id: `${username}-${index}`,
    username,
    text,
    likesCount,
    isReply,
  } as RawComment & { isReply: boolean }
}

function extractUsername(href: string): string {
  const match = href.match(/instagram\.com\/([^/?#]+)/)
  return match ? match[1] : ""
}

async function imageToBase64(url: string): Promise<string> {
  try {
    const response = await fetch(url)
    const blob = await response.blob()
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = () => resolve("")
      reader.readAsDataURL(blob)
    })
  } catch {
    return ""
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
