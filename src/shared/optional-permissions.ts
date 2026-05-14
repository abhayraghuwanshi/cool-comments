// Maps a media URL host to the wildcard origin pattern declared in
// manifest.json `optional_host_permissions`. chrome.permissions.request only
// accepts origins that match a declared pattern, so we canonicalise the URL's
// host to the exact pattern Chrome will recognise.
const HOST_PATTERNS: { test: (host: string) => boolean; pattern: string }[] = [
  { test: (h) => h.endsWith(".fbcdn.net"),        pattern: "https://*.fbcdn.net/*" },
  { test: (h) => h.endsWith(".fbsbx.com"),        pattern: "https://*.fbsbx.com/*" },
  { test: (h) => h.endsWith(".cdninstagram.com"), pattern: "https://*.cdninstagram.com/*" },
  { test: (h) => h === "giphy.com",               pattern: "https://giphy.com/*" },
  { test: (h) => h.endsWith(".giphy.com"),        pattern: "https://*.giphy.com/*" },
  { test: (h) => h === "tenor.com",               pattern: "https://tenor.com/*" },
  { test: (h) => h.endsWith(".tenor.com"),        pattern: "https://*.tenor.com/*" },
]

function patternForUrl(url: string): string | null {
  try {
    const host = new URL(url).hostname.toLowerCase()
    for (const { test, pattern } of HOST_PATTERNS) {
      if (test(host)) return pattern
    }
    return null
  } catch {
    return null
  }
}

const grantedThisSession = new Set<string>()

// Ensures the extension has runtime permission to fetch the given URLs from
// the background/sidepanel. MUST be called synchronously from a user gesture
// (the request prompt is gated on user activation).
//
// URLs whose host isn't declared in optional_host_permissions are ignored:
// content-script fetches inherit the page's origin and don't need extension
// host_permissions, so callers can pass everything they intend to fetch
// without pre-filtering.
//
// Returns true if every required origin is granted, false if the user denied
// (caller should gracefully degrade — e.g. skip GIFs, render text cards).
export async function ensureOptionalHostPermissions(urls: string[]): Promise<boolean> {
  const needed = new Set<string>()
  for (const url of urls) {
    const p = patternForUrl(url)
    if (p && !grantedThisSession.has(p)) needed.add(p)
  }
  if (needed.size === 0) return true

  const origins = Array.from(needed)
  try {
    if (await chrome.permissions.contains({ origins })) {
      origins.forEach((o) => grantedThisSession.add(o))
      return true
    }
    const ok = await chrome.permissions.request({ origins })
    if (ok) origins.forEach((o) => grantedThisSession.add(o))
    return ok
  } catch (err) {
    console.warn("[permissions] request failed", err)
    return false
  }
}
