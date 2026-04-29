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
  const reel = await scrapeReelInfo()
  const comments = scrapeComments(60)
  return { reel, comments }
}

// ---------------------------------------------------------------------------
// Reel info
// ---------------------------------------------------------------------------

async function scrapeReelInfo(): Promise<ReelData> {
  // The post header wraps the avatar in a div[aria-disabled="true"] button —
  // this attribute is unique to the post header (Instagram disables the avatar
  // button when viewing someone else's reel in the overlay).
  // Fallback: span[role="link"] for own reels where aria-disabled may differ.
  const headerPic =
    document.querySelector<HTMLImageElement>(
      '[aria-disabled="true"] img[alt*="\'s profile picture"]'
    ) ||
    document.querySelector<HTMLImageElement>(
      'span[role="link"] img[alt*="\'s profile picture"]'
    )

  // Also try _aacw inside the disabled container as a username cross-check
  const headerContainer = document.querySelector<HTMLElement>('[aria-disabled="true"]')
  const usernameFromSpan = headerContainer
    ?.querySelector<HTMLElement>("span._ap3a._aacw, span._aacw")
    ?.textContent?.trim() ?? ""

  const altText = headerPic?.getAttribute("alt") ?? ""
  const usernameFromAlt = altText.replace(/'s profile picture$/i, "").trim()

  const username = usernameFromAlt || usernameFromSpan

  const profilePicUrl = headerPic ? await imageToBase64(headerPic.src) : ""

  // Caption:
  //   Old format → span._ap3a._aacu
  //   New format → span.x126k92a (observed consistently in all new-format pages)
  const captionEl =
    document.querySelector<HTMLElement>("span._ap3a._aacu") ||
    document.querySelector<HTMLElement>("span.x126k92a") ||
    document.querySelector<HTMLElement>("h1[dir='auto']") ||
    null
  const caption = captionEl?.textContent?.trim() ?? ""

  // Like count
  const likesLinkEl = document.querySelector<HTMLAnchorElement>("a[href*='/liked_by/']")
  const likesCount = likesLinkEl?.querySelector("span")?.textContent?.trim() ?? ""

  return { username, profilePicUrl, caption, reelUrl: location.href, likesCount, commentsCount: "" }
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

function scrapeComments(limit: number): RawComment[] {
  const results: RawComment[] = []
  const seen = new Set<string>()

  const usernameSpans = document.querySelectorAll<HTMLElement>("span._ap3a._aacw, span._aacw")

  for (const usernameSpan of usernameSpans) {
    if (results.length >= limit) break

    const username = usernameSpan.textContent?.trim() ?? ""
    if (!username) continue

    const root = findCommentRoot(usernameSpan)
    if (!root) continue

    const permalinkEl = root.querySelector<HTMLAnchorElement>("a[href*='/c/']")
    const igId = permalinkEl?.href.match(/\/c\/(\d+)/)?.[1]
    const dedupKey = igId ?? `${username}-${results.length}`
    if (seen.has(dedupKey)) continue
    seen.add(dedupKey)

    const text = extractText(root, username)
    if (!text || text === username) continue
    if (isSpam(text)) continue

    const likesCount = extractLikes(root)
    const isReply = text.startsWith("@") || !!root.querySelector("span._aacu a._a6hd")

    results.push({
      id: igId ?? `${username}-${results.length}`,
      username,
      text,
      likesCount,
      isReply,
    } as RawComment & { isReply: boolean })
  }

  return results
}

/**
 * Walk up from a username span until we find a container that has:
 * 1. Exactly one _aacw span (we're inside a single comment)
 * 2. A <time datetime> element (every comment has a timestamp)
 * 3. Actual comment text (ensures we're above the sibling text div in new format)
 *
 * The bug this fixes: in the new Instagram DOM, the comment text is a SIBLING div
 * to the username+time div. The old logic stopped at the username+time div which
 * didn't contain the text. Now we keep going until we find a root that has all three.
 */
function findCommentRoot(el: HTMLElement): HTMLElement | null {
  let cur: HTMLElement | null = el.parentElement
  for (let i = 0; i < 18 && cur; i++) {
    const uCount = cur.querySelectorAll("span._aacw, span._ap3a._aacw").length
    // Bail if we've moved into a container with multiple comments
    if (uCount > 1) break

    if (uCount === 1 && cur.querySelector("time[datetime]") && hasCommentText(cur)) {
      return cur
    }
    cur = cur.parentElement
  }
  return null
}

/**
 * Check if an element contains actual comment body text.
 * Handles both DOM formats:
 * - New: span[dir="auto"][style*="18px"] not inside <a>, not containing _aacw or <time>
 * - Old: span._aacu with non-trivial content
 */
function hasCommentText(el: HTMLElement): boolean {
  // New format
  for (const span of el.querySelectorAll<HTMLElement>("span[dir='auto']")) {
    if (span.closest("a")) continue
    if (span.querySelector("span._aacw, time")) continue
    const style = span.getAttribute("style") ?? ""
    if (!style.includes("18px")) continue
    const content = span.textContent?.trim() ?? ""
    if (content && content.length > 1) return true
  }

  // Old format
  for (const span of el.querySelectorAll<HTMLElement>("span._aacu, span._ap3a._aacu")) {
    const content = span.textContent?.trim() ?? ""
    if (content && content.length > 1) return true
  }

  return false
}

/**
 * Extract comment body text — handles both DOM formats.
 * Old: span._aacu   New: span[dir="auto"][style*="18px"] not inside <a>
 */
function extractText(root: HTMLElement, username: string): string {
  // Old format: _aacu spans
  const aacuSpans = root.querySelectorAll<HTMLElement>("span._ap3a._aacu, span._aacu")
  if (aacuSpans.length > 0) {
    let text = ""
    for (const span of aacuSpans) {
      const content = span.textContent?.trim() ?? ""
      if (content && content !== " " && content !== username) text = content
    }
    if (text) return text
  }

  // New format: span[dir="auto"] with 18px line-height, not inside <a>
  for (const span of root.querySelectorAll<HTMLElement>("span[dir='auto']")) {
    if (span.closest("a")) continue
    if (span.querySelector("span._aacw, time")) continue
    const style = span.getAttribute("style") ?? ""
    if (!style.includes("18px")) continue
    const content = span.textContent?.trim() ?? ""
    if (content && content !== username && content.length > 1) return content
  }

  return ""
}

/**
 * Extract like count — handles both DOM formats.
 * Old: a[href*="/liked_by/"] span   New: [role="button"] span text "X likes"
 */
function extractLikes(root: HTMLElement): string {
  const likedByLink = root.querySelector<HTMLAnchorElement>("a[href*='/liked_by/']")
  if (likedByLink) {
    const raw = likedByLink.querySelector("span")?.textContent?.trim() ?? ""
    return raw.replace(/\s*likes?\s*/i, "").trim()
  }

  for (const btn of root.querySelectorAll<HTMLElement>("[role='button']")) {
    const t = btn.textContent?.trim() ?? ""
    const m = t.match(/^([\d,]+)\s+likes?$/i)
    if (m) return m[1]
  }

  return ""
}

// ---------------------------------------------------------------------------
// Spam filter
// ---------------------------------------------------------------------------

/**
 * Strip emojis, @mentions, #hashtags, and punctuation.
 * Returns only real word characters.
 */
function stripToMeaningful(text: string): string {
  return text
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, "") // supplementary emoji (🔥😂👏 etc)
    .replace(/[\u{2600}-\u{27FF}]/gu, "")   // misc symbols (♥ ★ ☆ etc)
    .replace(/[\u{FE00}-\u{FEFF}]/gu, "")   // variation selectors
    .replace(/‍/g, "")                  // zero-width joiner
    .replace(/⃣/g, "")                  // combining enclosing keycap
    .replace(/@[\w.]+/g, "")                 // @mentions
    .replace(/#\w+/g, "")                    // #hashtags
    .replace(/[^\p{L}\p{N}\s]/gu, "")        // punctuation/symbols
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Returns true for comments that are pure noise:
 * - Emoji-only / @mention-only / symbol-only (< 5 real chars after stripping)
 * - Repeated single token (👏👏👏 or "lol lol lol")
 * - Known one-word fillers
 */
function isSpam(text: string): boolean {
  const meaningful = stripToMeaningful(text)

  // Less than 5 real characters after removing emoji + mentions = spam
  if (meaningful.length < 5) return true

  // Repeated token spam ("lol lol lol", "nice nice")
  const tokens = meaningful.toLowerCase().split(" ").filter(Boolean)
  if (tokens.length > 1 && new Set(tokens).size === 1) return true

  // Single known filler word
  const FILLERS = new Set([
    "nice", "wow", "lol", "lmao", "haha", "hehe", "ok", "okay",
    "yes", "no", "great", "amazing", "fire", "bro", "gg",
  ])
  if (tokens.length === 1 && FILLERS.has(tokens[0])) return true

  return false
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

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
