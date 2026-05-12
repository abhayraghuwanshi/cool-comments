import type { RankedComment, RankingMode, ReelData, Tier } from "../../shared/messages"

const W   = 1080
const H   = 1920
const FPS = 30

const TIERS_ORDER: Tier[] = ["F", "D", "C", "B", "A", "S"]
const TIER_COLOR: Record<Tier, string> = {
  S: "#FF6B35", A: "#39FF14", B: "#00B4FF",
  C: "#CC44FF", D: "#FFB300", F: "#FF1744", DRAFT: "#4a4a4a", GIF: "#FFD700",
}

const INTRO_DUR   = 3.0
const LABEL_DUR   = 0.8
const SLIDE_DUR   = 0.35
const HOLD_DUR    = 2.0   // enough time to actually read the comment
const COMMENT_DUR = SLIDE_DUR + HOLD_DUR
const EMPTY_DUR   = 1.0
const OUTRO_DUR   = 2.0

function easeOut(t: number) {
  return 1 - (1 - Math.min(t, 1)) ** 3
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  if (!text) return [""]
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ""
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (line && ctx.measureText(test).width > maxW) { lines.push(line); line = w }
    else line = test
  }
  if (line) lines.push(line)
  return lines.length ? lines : [""]
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r); ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

const CARD_PAD_X = 32
const CARD_PAD_Y = 22
const U_SIZE     = 34   // username font size
const U_LINE     = 46   // username line height
const T_SIZE     = 40   // comment text font size
const T_LINE     = 56   // comment text line height
const L_SIZE     = 28   // likes font size

type GifMedia = HTMLImageElement | HTMLVideoElement

const drawCardLogged = new Set<string>()

function gifVideoCandidates(url: string): string[] {
  if (!/giphy\.com/i.test(url) || !/\.gif(\?|#|$)/i.test(url)) return []
  const mp4Url = url.replace(/\.gif(\?|#|$)/i, ".mp4$1")
  return mp4Url === url ? [] : [mp4Url]
}

function looksLikeVideo(url: string): boolean {
  return /\.(mp4|webm|mov)(\?|#|$)/i.test(url)
}

function isDrawableMedia(contentType: string): boolean {
  return contentType.startsWith("image/") || contentType.startsWith("video/")
}

function mediaDims(m: GifMedia): { nw: number; nh: number } {
  if (m instanceof HTMLVideoElement) return { nw: m.videoWidth || 200, nh: m.videoHeight || 200 }
  return { nw: m.naturalWidth || 200, nh: m.naturalHeight || 200 }
}

function gifContentHeight(innerW: number, m: GifMedia): number {
  const { nw, nh } = mediaDims(m)
  return Math.round(nh * Math.min(innerW / nw, 320 / nh))
}

function drawCard(
  ctx: CanvasRenderingContext2D,
  comment: RankedComment,
  x: number, y: number, w: number,
  color: string,
  slideProgress: number,
  gifImgs?: Map<string, GifMedia>
): number {
  const innerW = w - 8 - CARD_PAD_X * 2
  ctx.font = `bold ${U_SIZE}px "Courier New", monospace`
  const uLines = wrapText(ctx, `@${comment.username}`, innerW)

  const gifMedia = comment.gifUrl ? gifImgs?.get(comment.gifUrl) : undefined
  const hasGif = !!gifMedia && (
    gifMedia instanceof HTMLVideoElement ? gifMedia.videoWidth > 0 : (gifMedia as HTMLImageElement).naturalWidth > 0
  )
  if (comment.gifUrl && !hasGif && !drawCardLogged.has(comment.gifUrl)) {
    drawCardLogged.add(comment.gifUrl)
    const kind = gifMedia instanceof HTMLVideoElement ? "video" : gifMedia instanceof HTMLImageElement ? "image" : "missing"
    const w = gifMedia instanceof HTMLVideoElement ? gifMedia.videoWidth : gifMedia instanceof HTMLImageElement ? gifMedia.naturalWidth : 0
    console.warn(`[exportReel] GIF fallback to text for @${comment.username}`, { gifUrl: comment.gifUrl, mapHas: gifImgs?.has(comment.gifUrl), kind, w, mapSize: gifImgs?.size })
  }

  ctx.font = `${T_SIZE}px "Courier New", monospace`
  const tLines = hasGif ? [] : wrapText(ctx, comment.text, innerW)
  const contentH = hasGif ? gifContentHeight(innerW, gifMedia!) : tLines.length * T_LINE
  const h = CARD_PAD_Y + uLines.length * U_LINE + 10 + contentH + CARD_PAD_Y

  const ox = (1 - easeOut(slideProgress)) * -(W + w)
  ctx.save()
  ctx.translate(ox, 0)

  ctx.fillStyle = "#181818"
  roundRect(ctx, x, y, w, h, 8)
  ctx.fill()

  ctx.fillStyle = color
  ctx.fillRect(x, y, 8, h)

  const tx = x + 8 + CARD_PAD_X
  let cy = y + CARD_PAD_Y

  ctx.font = `bold ${U_SIZE}px "Courier New", monospace`
  ctx.fillStyle = "#FF6B35"
  ctx.textBaseline = "top"
  for (const line of uLines) { ctx.fillText(line, tx, cy); cy += U_LINE }
  cy += 10

  if (hasGif) {
    const { nw, nh } = mediaDims(gifMedia!)
    const scale = Math.min(innerW / nw, 320 / nh)
    const dw = Math.round(nw * scale), dh = Math.round(nh * scale)
    ctx.drawImage(gifMedia! as CanvasImageSource, tx + Math.round((innerW - dw) / 2), cy, dw, dh)
  } else {
    const isGifOnly = comment.gifUrl && comment.text === "[GIF]"
    ctx.font = isGifOnly ? `italic ${T_SIZE}px "Courier New", monospace` : `${T_SIZE}px "Courier New", monospace`
    ctx.fillStyle = isGifOnly ? "#FFD700" : "#e0e0e0"
    for (const line of tLines) { ctx.fillText(line, tx, cy); cy += T_LINE }
  }

  if (comment.likesCount && comment.likesCount !== "0") {
    ctx.font = `${L_SIZE}px "Courier New", monospace`
    ctx.fillStyle = "#555"
    const lt = `♥ ${comment.likesCount}`
    ctx.fillText(lt, x + w - 20 - ctx.measureText(lt).width, y + CARD_PAD_Y)
  }

  ctx.restore()
  return h
}

function drawIntro(
  ctx: CanvasRenderingContext2D,
  reelData: ReelData,
  thumbImg: HTMLImageElement | null,
  profImg: HTMLImageElement | null,
  progress: number
) {
  ctx.fillStyle = "#080808"
  ctx.fillRect(0, 0, W, H)

  if (thumbImg) {
    const scale = W / thumbImg.naturalWidth
    const th = thumbImg.naturalHeight * scale
    ctx.globalAlpha = easeOut(progress * 1.5) * 0.75
    ctx.drawImage(thumbImg, 0, (H - th) / 2, W, th)
    ctx.globalAlpha = 1
  }

  // bottom gradient
  const grad = ctx.createLinearGradient(0, H * 0.35, 0, H)
  grad.addColorStop(0, "rgba(8,8,8,0)")
  grad.addColorStop(0.3, "rgba(8,8,8,0.88)")
  grad.addColorStop(1, "rgba(8,8,8,1)")
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)

  const a = easeOut(Math.max(0, progress * 2.2 - 0.4))
  ctx.globalAlpha = a

  const PAD = 80
  let y = H * 0.6

  if (profImg) {
    const r = 56
    const cx = PAD + r
    const cy = y + r
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.closePath()
    ctx.clip()
    ctx.drawImage(profImg, cx - r, cy - r, r * 2, r * 2)
    ctx.restore()
    ctx.strokeStyle = "#FF6B35"
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(cx, cy, r + 2, 0, Math.PI * 2)
    ctx.stroke()
    y += r * 2 + 28
  }

  ctx.font = 'bold 58px "Bebas Neue", Impact, sans-serif'
  ctx.fillStyle = "#FF6B35"
  ctx.textBaseline = "top"
  ctx.fillText("RATING THESE COMMENTS", PAD, y)
  y += 78

  ctx.font = 'bold 90px "Bebas Neue", Impact, sans-serif'
  ctx.fillStyle = "#ffffff"
  ctx.fillText(`@${reelData.username}`, PAD, y)
  y += 110

  if (reelData.caption) {
    ctx.font = '44px "Barlow Condensed", sans-serif'
    ctx.fillStyle = "#999"
    for (const line of wrapText(ctx, reelData.caption, W - PAD * 2).slice(0, 3)) {
      ctx.fillText(line, PAD, y); y += 58
    }
  }

  ctx.globalAlpha = 1
}

function drawTierScene(
  ctx: CanvasRenderingContext2D,
  tier: Tier,
  tierComments: RankedComment[],
  labelProgress: number,
  visibleCount: number,
  currentSlide: number,
  overlay = false,
  gifImgs?: Map<string, GifMedia>
) {
  const color = TIER_COLOR[tier]

  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = overlay ? GREEN_SCREEN : "#080808"
  ctx.fillRect(0, 0, W, H)

  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, W)
  glow.addColorStop(0, color + (overlay ? "30" : "1a"))
  glow.addColorStop(1, "transparent")
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  // Big tier letter
  const lx = (1 - easeOut(labelProgress)) * -340
  ctx.save()
  ctx.translate(lx, 0)
  ctx.textBaseline = "top"
  ctx.font = 'bold 280px "Bebas Neue", Impact, sans-serif'
  ctx.fillStyle = color + "22"
  ctx.fillText(tier, 30, 20)
  ctx.font = 'bold 220px "Bebas Neue", Impact, sans-serif'
  ctx.fillStyle = color
  ctx.fillText(tier, 50, 50)
  ctx.restore()

  // Divider line
  const div = ctx.createLinearGradient(60, 360, W - 60, 360)
  div.addColorStop(0, color + "aa")
  div.addColorStop(1, color + "00")
  ctx.strokeStyle = div
  ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(60, 360); ctx.lineTo(W - 60, 360); ctx.stroke()

  // Cards
  const PAD = 60
  const CARD_W = W - PAD * 2
  let y = 400

  for (let i = 0; i < visibleCount; i++) {
    const h = drawCard(ctx, tierComments[i], PAD, y, CARD_W, color, 1, gifImgs)
    y += h + 14
  }
  if (visibleCount < tierComments.length && currentSlide > 0) {
    drawCard(ctx, tierComments[visibleCount], PAD, y, CARD_W, color, currentSlide, gifImgs)
  }
  if (tierComments.length === 0 && labelProgress >= 1) {
    ctx.font = '44px "Courier New", monospace'
    ctx.fillStyle = color + "50"
    ctx.textBaseline = "top"
    ctx.fillText("— none —", PAD, 430)
  }
}

function drawListScene(
  ctx: CanvasRenderingContext2D,
  batch: RankedComment[],
  labelProgress: number,
  gifImgs?: Map<string, GifMedia>
) {
  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = "#080808"
  ctx.fillRect(0, 0, W, H)

  const color = TIER_COLOR.A
  const glow = ctx.createRadialGradient(W, 0, 0, W, 0, W)
  glow.addColorStop(0, color + "18")
  glow.addColorStop(1, "transparent")
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  const lx = (1 - easeOut(labelProgress)) * -420
  ctx.save()
  ctx.translate(lx, 0)
  ctx.textBaseline = "top"
  ctx.font = 'bold 132px "Bebas Neue", Impact, sans-serif'
  ctx.fillStyle = "#ffffff"
  ctx.fillText("COMMENTS", 60, 88)
  ctx.restore()

  const div = ctx.createLinearGradient(60, 260, W - 60, 260)
  div.addColorStop(0, color + "aa")
  div.addColorStop(1, color + "00")
  ctx.strokeStyle = div
  ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(60, 260); ctx.lineTo(W - 60, 260); ctx.stroke()

  const PAD = 60
  const CARD_W = W - PAD * 2

  const heights = batch.map((comment) => {
    const innerW = CARD_W - 8 - CARD_PAD_X * 2
    ctx.font = `bold ${U_SIZE}px "Courier New", monospace`
    const uH = wrapText(ctx, `@${comment.username}`, innerW).length * U_LINE
    const gm = comment.gifUrl ? gifImgs?.get(comment.gifUrl) : undefined
    const gmReady = gm && (gm instanceof HTMLVideoElement ? gm.videoWidth > 0 : (gm as HTMLImageElement).naturalWidth > 0)
    const contentH = gmReady
      ? gifContentHeight(innerW, gm!)
      : (() => { ctx.font = `${T_SIZE}px "Courier New", monospace`; return wrapText(ctx, comment.text, innerW).length * T_LINE })()
    return CARD_PAD_Y + uH + 10 + contentH + CARD_PAD_Y
  })

  const GAP = 28
  const totalH = heights.reduce((sum, h) => sum + h, 0) + GAP * Math.max(0, batch.length - 1)
  let y = Math.max(310, Math.round((H + 260 - totalH) / 2))

  for (let i = 0; i < batch.length; i++) {
    const slideStart = i * (BATCH_SLIDE / (batch.length + 1))
    const progress = Math.min(Math.max((labelProgress - slideStart) / (BATCH_SLIDE * 0.7), 0), 1)
    const comment = batch[i]
    const h = drawCard(ctx, comment, PAD, y, CARD_W, TIER_COLOR[comment.tier] ?? color, progress, gifImgs)
    y += h + GAP
  }
}

function drawOutro(ctx: CanvasRenderingContext2D, progress: number) {
  ctx.fillStyle = "#080808"
  ctx.fillRect(0, 0, W, H)
  ctx.globalAlpha = easeOut(progress)
  ctx.font = 'bold 110px "Bebas Neue", Impact, sans-serif'
  ctx.fillStyle = "#FF6B35"
  ctx.textBaseline = "middle"
  ctx.textAlign = "center"
  ctx.fillText("coolcomments", W / 2, H / 2 - 60)
  ctx.font = '52px "Barlow Condensed", sans-serif'
  ctx.fillStyle = "#444"
  ctx.fillText("rate any reel's comments", W / 2, H / 2 + 60)
  ctx.globalAlpha = 1
  ctx.textAlign = "left"
  ctx.textBaseline = "top"
}

function loadImg(src: string): Promise<HTMLImageElement | null> {
  return new Promise((res) => {
    const img = new Image()
    img.onload = () => res(img)
    img.onerror = () => res(null)
    img.src = src
  })
}

// Extension pages share host_permissions — fetch directly from the sidepanel.
// Returns a same-origin blob URL that never taints the canvas.
async function fetchMediaBlobUrl(url: string): Promise<{ blobUrl: string; contentType: string } | null> {
  const fromBuffer = (buffer: ArrayBuffer, contentType: string) => {
    const blob = new Blob([buffer], { type: contentType })
    return { blobUrl: URL.createObjectURL(blob), contentType }
  }

  try {
    const resp = await Promise.race([
      fetch(url),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 5000)),
    ])
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const contentType = resp.headers.get("content-type") ?? ""
    if (!isDrawableMedia(contentType)) throw new Error(`Not drawable media: ${contentType}`)
    return fromBuffer(await resp.arrayBuffer(), contentType)
  } catch {
    try {
      const response = await chrome.runtime.sendMessage({ type: "FETCH_MEDIA_BLOB", url })
      if (!response || response.error || !response.buffer) return null
      if (!isDrawableMedia(response.contentType ?? "")) return null
      return fromBuffer(response.buffer, response.contentType ?? "")
    } catch {
      return null
    }
  }
}

// Loads GIF/media as blob-URL-backed elements so ctx.drawImage() never taints
// the canvas. Prefer video for Giphy GIFs because hidden HTMLImageElement GIFs
// are easy for Chrome to throttle/freeze, which records only one frame.
async function loadGifImgs(comments: RankedComment[]): Promise<{
  gifImgs: Map<string, GifMedia>
  cleanup: () => void
}> {
  drawCardLogged.clear()
  const gifImgs = new Map<string, GifMedia>()
  const nodes: (HTMLImageElement | HTMLVideoElement)[] = []
  const blobUrls: string[] = []
  const urls = [...new Set(comments.map(c => c.gifUrl).filter(Boolean) as string[])]
  console.log(`[exportReel] loadGifImgs: ${comments.length} comments, ${urls.length} unique gifUrls`)
  for (const u of urls) console.log(`  → ${u.slice(0, 120)}`)

  async function loadElement(src: string, useVideo: boolean, mapKey: string): Promise<void> {
    await new Promise<void>(res => {
      const done = () => res()
      if (useVideo) {
        const vid = document.createElement("video")
        vid.crossOrigin = "anonymous"
        vid.autoplay = true; vid.loop = true; vid.muted = true
        vid.setAttribute("playsinline", "")
        vid.style.cssText = "position:fixed;right:-9999px;bottom:0;width:200px;height:200px;opacity:0.001;pointer-events:none;"
        document.body.appendChild(vid)
        nodes.push(vid)
        vid.onloadeddata = () => {
          gifImgs.set(mapKey, vid)
          vid.play().catch(() => {})
          console.log(`[exportReel]     video onloadeddata vw=${vid.videoWidth}x${vid.videoHeight} src=${src.slice(0, 60)}`)
          done()
        }
        vid.onerror = () => {
          console.warn(`[exportReel]     video onerror src=${src.slice(0, 60)}`)
          done()
        }
        vid.src = src
      } else {
        const img = new Image()
        img.crossOrigin = "anonymous"
        img.style.cssText = "position:fixed;right:0;bottom:0;width:2px;height:2px;opacity:0.01;pointer-events:none;z-index:2147483647;"
        document.body.appendChild(img)
        nodes.push(img)
        img.onload = () => {
          gifImgs.set(mapKey, img)
          console.log(`[exportReel]     img onload nw=${img.naturalWidth}x${img.naturalHeight} src=${src.slice(0, 60)}`)
          setTimeout(done, 300)
        }
        img.onerror = () => {
          console.warn(`[exportReel]     img onerror src=${src.slice(0, 60)}`)
          done()
        }
        img.src = src
      }
    })
  }

  await Promise.all(urls.map(async (url) => {
    // Fetch via extension host_permissions — returns same-origin blob URL (no canvas taint)
    // For Giphy image GIFs, try the equivalent MP4 first so export samples a playing video.
    const candidates = [...gifVideoCandidates(url), url]
    let media: { blobUrl: string; contentType: string } | null = null
    for (const candidate of candidates) {
      media = await fetchMediaBlobUrl(candidate)
      if (media) break
    }
    if (!media) {
      await loadElement(url, looksLikeVideo(url), url)
      return
    }

    const { blobUrl, contentType } = media
    blobUrls.push(blobUrl)
    await loadElement(blobUrl, contentType.startsWith("video/"), url)
    console.log(`[exportReel]   blob loaded (${contentType}) → mapHas=${gifImgs.has(url)} for ${url.slice(0, 80)}`)

    // If the blob-backed load failed silently, fall back to a direct URL load.
    if (!gifImgs.has(url)) {
      console.warn(`[exportReel]   blob load did not register; trying direct URL`)
      await loadElement(url, looksLikeVideo(url), url)
    }
  }))
  console.log(`[exportReel] loadGifImgs done: ${gifImgs.size}/${urls.length} loaded`)

  return {
    gifImgs,
    cleanup: () => {
      nodes.forEach(n => n.remove())
      blobUrls.forEach(u => URL.revokeObjectURL(u))
    },
  }
}

export async function exportReelVideo(
  reelData: ReelData,
  comments: RankedComment[],
  rankingMode?: RankingMode,
): Promise<void> {
  await document.fonts.ready
  const isListMode = rankingMode === "scrape"

  const byTier: Record<Tier, RankedComment[]> = { S: [], A: [], B: [], C: [], D: [], F: [], DRAFT: [], GIF: [] }
  for (const c of comments) {
    const tier = (c.tier?.toUpperCase() ?? "") as Tier
    if (tier in byTier) byTier[tier].push(c)
  }
  if (!isListMode && byTier.GIF.length > 0) {
    byTier.A.push(...byTier.GIF.map((c) => ({ ...c, tier: "A" as Tier })))
    byTier.GIF = []
  }

  const listComments = comments.filter((c) => c.tier !== "DRAFT" && c.tier !== "GIF")
  const rankedComments = isListMode ? listComments : TIERS_ORDER.flatMap(t => byTier[t])
  if (rankedComments.length === 0) return

  console.log(`[exportReel] mode=${rankingMode} isListMode=${isListMode} input=${comments.length}`)
  console.log(`[exportReel] byTier counts:`, Object.fromEntries(Object.entries(byTier).map(([k, v]) => [k, v.length])))
  console.log(`[exportReel] rankedComments=${rankedComments.length} withGif=${rankedComments.filter(c => c.gifUrl).length}`)
  for (const c of rankedComments.filter(c => c.gifUrl)) {
    console.log(`  ranked: @${c.username} tier=${c.tier} gifUrl=${c.gifUrl?.slice(0, 100)}`)
  }

  const [thumbImg, profImg, { gifImgs, cleanup }] = await Promise.all([
    reelData.thumbnailUrl ? loadImg(reelData.thumbnailUrl) : Promise.resolve(null),
    reelData.profilePicUrl ? loadImg(reelData.profilePicUrl) : Promise.resolve(null),
    loadGifImgs(rankedComments),
  ])

  const canvas = document.createElement("canvas")
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext("2d")!

  const mimeType =
    MediaRecorder.isTypeSupported("video/mp4;codecs=avc1") ? "video/mp4;codecs=avc1" :
    MediaRecorder.isTypeSupported("video/mp4")             ? "video/mp4"             :
    MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" :
                                                             "video/webm"
  const ext = mimeType.startsWith("video/mp4") ? "mp4" : "webm"
  const recorder = new MediaRecorder(canvas.captureStream(FPS), {
    mimeType,
    videoBitsPerSecond: 8_000_000,
  })
  const chunks: Blob[] = []
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }

  // Timeline
  function tierDur(tier: Tier) {
    const n = byTier[tier].length
    return LABEL_DUR + (n === 0 ? EMPTY_DUR : n * COMMENT_DUR)
  }

  const tierStarts: number[] = []
  let cursor = INTRO_DUR
  const listBatches: RankedComment[][] = []
  if (isListMode) {
    for (let i = 0; i < listComments.length; i += BATCH_SIZE) {
      listBatches.push(listComments.slice(i, i + BATCH_SIZE))
    }
    tierStarts.push(cursor)
    cursor += listBatches.length * BATCH_DUR
  } else {
    for (const tier of TIERS_ORDER) {
      tierStarts.push(cursor)
      cursor += tierDur(tier)
    }
  }
  const outroStart = cursor
  const totalDur = outroStart + OUTRO_DUR

  await new Promise<void>((resolve) => {
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `cool-comments-${Date.now()}.${ext}`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
      resolve()
    }

    recorder.start(200)
    let frameNo = 0

    function drawFrame(t: number) {
      if (t < INTRO_DUR) {
        drawIntro(ctx, reelData, thumbImg, profImg, t / INTRO_DUR)
      } else if (t >= outroStart) {
        drawOutro(ctx, (t - outroStart) / OUTRO_DUR)
      } else if (isListMode) {
        const te = t - tierStarts[0]
        const batchIdx = Math.min(Math.floor(te / BATCH_DUR), listBatches.length - 1)
        const batchT = te - batchIdx * BATCH_DUR
        drawListScene(ctx, listBatches[batchIdx], batchT, gifImgs)
      } else {
        let ti = TIERS_ORDER.length - 1
        for (let i = 0; i < TIERS_ORDER.length - 1; i++) {
          if (t < tierStarts[i + 1]) { ti = i; break }
        }
        const tier = TIERS_ORDER[ti]
        const te = t - tierStarts[ti]
        const tierComments = byTier[tier]

        let labelProgress: number, visibleCount: number, currentSlide: number
        if (te < LABEL_DUR) {
          labelProgress = te / LABEL_DUR; visibleCount = 0; currentSlide = 0
        } else {
          labelProgress = 1
          const ce = te - LABEL_DUR
          const ci = Math.floor(ce / COMMENT_DUR)
          visibleCount = Math.min(ci, tierComments.length)
          currentSlide = ci < tierComments.length
            ? Math.min((ce - ci * COMMENT_DUR) / SLIDE_DUR, 1)
            : 0
        }
        drawTierScene(ctx, tier, tierComments, labelProgress, visibleCount, currentSlide, false, gifImgs)
      }
    }

    const timerId = setInterval(() => {
      const t = frameNo / FPS
      if (t >= totalDur) {
        clearInterval(timerId)
        drawOutro(ctx, 1)
        setTimeout(() => recorder.stop(), 300)
        return
      }
      drawFrame(t)
      frameNo++
    }, 1000 / FPS)
  })
  cleanup()
}

const GREEN_SCREEN = "#00FF00"  // chroma key color — remove in CapCut with Chroma Key tool

// ── Batch scene: renders up to 3 comment cards at once ───────────────────────
const BATCH_SIZE    = 3
const BATCH_SLIDE   = 0.45  // seconds for all cards to slide in
const BATCH_HOLD    = 2.8   // seconds cards stay on screen
const BATCH_DUR     = BATCH_SLIDE + BATCH_HOLD

function drawBatchScene(
  ctx: CanvasRenderingContext2D,
  batch: RankedComment[],
  batchT: number,
  gifImgs?: Map<string, GifMedia>
) {
  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = GREEN_SCREEN
  ctx.fillRect(0, 0, W, H)

  const PAD    = 60
  const CARD_W = W - PAD * 2

  // Measure all card heights first so we can center the group vertically
  const heights = batch.map((c) => {
    const innerW = CARD_W - 8 - CARD_PAD_X * 2
    ctx.font = `bold ${U_SIZE}px "Courier New", monospace`
    const uH = wrapText(ctx, `@${c.username}`, innerW).length * U_LINE
    const gm = c.gifUrl ? gifImgs?.get(c.gifUrl) : undefined
    const gmReady = gm && (gm instanceof HTMLVideoElement ? gm.videoWidth > 0 : (gm as HTMLImageElement).naturalWidth > 0)
    const contentH = gmReady
      ? gifContentHeight(innerW, gm!)
      : (() => { ctx.font = `${T_SIZE}px "Courier New", monospace`; return wrapText(ctx, c.text, innerW).length * T_LINE })()
    return CARD_PAD_Y + uH + 10 + contentH + CARD_PAD_Y
  })

  const GAP    = 28
  const totalH = heights.reduce((a, b) => a + b, 0) + GAP * (batch.length - 1)
  let   y      = Math.round((H - totalH) / 2)

  for (let i = 0; i < batch.length; i++) {
    const slideStart = i * (BATCH_SLIDE / (batch.length + 1))
    const progress   = Math.min(Math.max((batchT - slideStart) / (BATCH_SLIDE * 0.7), 0), 1)
    const color      = TIER_COLOR[batch[i].tier] ?? "#888"
    const h          = drawCard(ctx, batch[i], PAD, y, CARD_W, color, progress, gifImgs)
    y += h + GAP
  }
}

const OVERLAY_INTRO_DUR = 3.0
const OVERLAY_OUTRO_DUR = 2.5

function drawOverlayIntro(ctx: CanvasRenderingContext2D, username: string, progress: number) {
  ctx.fillStyle = GREEN_SCREEN
  ctx.fillRect(0, 0, W, H)

  const CARD_X = 60
  const CARD_Y = H / 2 - 200
  const CARD_W = W - 120
  const CARD_H = 400

  const cardP  = Math.min(easeOut(progress * 2.8), 1)
  const slideY = (1 - cardP) * 240

  // Dark card slides up
  ctx.save()
  ctx.translate(0, slideY)
  ctx.globalAlpha = cardP
  ctx.fillStyle = "#0d0d0d"
  roundRect(ctx, CARD_X, CARD_Y, CARD_W, CARD_H, 20)
  ctx.fill()
  // Orange accent bar grows downward
  ctx.fillStyle = "#FF6B35"
  ctx.fillRect(CARD_X, CARD_Y, 7, CARD_H * Math.min(easeOut(progress * 3.5), 1))
  ctx.restore()

  // "REVIEWING" — slides in from left
  const revP = Math.min(easeOut(Math.max(progress * 4.5 - 0.5, 0)), 1)
  ctx.save()
  ctx.translate((1 - revP) * -320, slideY)
  ctx.globalAlpha = revP * cardP
  ctx.font = 'bold 66px "Bebas Neue", Impact, sans-serif'
  ctx.fillStyle = "#666666"
  ctx.textBaseline = "top"
  ctx.fillText("REVIEWING", CARD_X + 28, CARD_Y + 36)
  ctx.restore()

  // "@username" — punch scale + orange glow
  const userP  = Math.min(easeOut(Math.max(progress * 3.5 - 0.8, 0)), 1)
  const scaleU = 0.5 + userP * 0.5
  ctx.save()
  ctx.translate(0, slideY)
  ctx.globalAlpha = userP * cardP
  ctx.translate(CARD_X + 28, CARD_Y + 135)
  ctx.scale(scaleU, scaleU)
  ctx.shadowColor = "#FF6B35"
  ctx.shadowBlur = 36 * userP
  ctx.font = 'bold 108px "Bebas Neue", Impact, sans-serif'
  ctx.fillStyle = "#FF6B35"
  ctx.textBaseline = "top"
  ctx.fillText(`@${username}`, 0, 0)
  ctx.restore()

  // Divider line draws left to right
  const divP = Math.min(easeOut(Math.max(progress * 5 - 2.0, 0)), 1)
  if (divP > 0) {
    ctx.save()
    ctx.translate(0, slideY)
    ctx.globalAlpha = divP * cardP * 0.45
    ctx.strokeStyle = "#FF6B35"
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(CARD_X + 28, CARD_Y + 290)
    ctx.lineTo(CARD_X + 28 + (CARD_W - 56) * divP, CARD_Y + 290)
    ctx.stroke()
    ctx.restore()
  }

  // "comments" — fades in
  const comP = Math.min(easeOut(Math.max(progress * 5 - 2.5, 0)), 1)
  ctx.save()
  ctx.translate(0, slideY)
  ctx.globalAlpha = comP * cardP
  ctx.font = '52px "Barlow Condensed", sans-serif'
  ctx.fillStyle = "#cccccc"
  ctx.textBaseline = "top"
  ctx.fillText("comments", CARD_X + 28, CARD_Y + 308)
  ctx.restore()
}

function drawOverlayOutro(ctx: CanvasRenderingContext2D, progress: number) {
  ctx.fillStyle = GREEN_SCREEN
  ctx.fillRect(0, 0, W, H)

  const CARD_X = 60
  const CARD_Y = H / 2 - 180
  const CARD_W = W - 120
  const CARD_H = 360

  const cardP  = Math.min(easeOut(progress * 2.8), 1)
  const slideY = (1 - cardP) * -220  // slides down from above

  // Dark card slides down
  ctx.save()
  ctx.translate(0, slideY)
  ctx.globalAlpha = cardP
  ctx.fillStyle = "#0d0d0d"
  roundRect(ctx, CARD_X, CARD_Y, CARD_W, CARD_H, 20)
  ctx.fill()
  ctx.fillStyle = "#FF6B35"
  ctx.fillRect(CARD_X, CARD_Y, 7, CARD_H * Math.min(easeOut(progress * 3.5), 1))
  ctx.restore()

  // "reelranker" — punch scale + glow
  const logoP  = Math.min(easeOut(Math.max(progress * 3.2 - 0.5, 0)), 1)
  const scaleL = 0.5 + logoP * 0.5
  ctx.save()
  ctx.translate(0, slideY)
  ctx.globalAlpha = logoP * cardP
  ctx.translate(CARD_X + 28, CARD_Y + 75)
  ctx.scale(scaleL, scaleL)
  ctx.shadowColor = "#FF6B35"
  ctx.shadowBlur = 42 * logoP
  ctx.font = 'bold 118px "Bebas Neue", Impact, sans-serif'
  ctx.fillStyle = "#FF6B35"
  ctx.textBaseline = "top"
  ctx.fillText("reelranker", 0, 0)
  ctx.restore()

  // Divider line draws left to right
  const divP = Math.min(easeOut(Math.max(progress * 5 - 1.8, 0)), 1)
  if (divP > 0) {
    ctx.save()
    ctx.translate(0, slideY)
    ctx.globalAlpha = divP * cardP * 0.45
    ctx.strokeStyle = "#FF6B35"
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(CARD_X + 28, CARD_Y + 240)
    ctx.lineTo(CARD_X + 28 + (CARD_W - 56) * divP, CARD_Y + 240)
    ctx.stroke()
    ctx.restore()
  }

  // "rank any reel's comments" — fades in
  const subP = Math.min(easeOut(Math.max(progress * 5 - 2.2, 0)), 1)
  ctx.save()
  ctx.translate(0, slideY)
  ctx.globalAlpha = subP * cardP
  ctx.font = '50px "Barlow Condensed", sans-serif'
  ctx.fillStyle = "#777777"
  ctx.textBaseline = "top"
  ctx.fillText("rank any reel's comments", CARD_X + 28, CARD_Y + 258)
  ctx.restore()
}

// Green-screen overlay export.
// Use in CapCut: Overlay → Chroma Key → pick green → done.
export async function exportOverlayVideo(
  comments: RankedComment[],
  reelData?: ReelData,
  rankingMode?: RankingMode,
): Promise<void> {
  await document.fonts.ready
  const isListMode = rankingMode === "scrape"

  const byTier: Record<Tier, RankedComment[]> = { S: [], A: [], B: [], C: [], D: [], F: [], DRAFT: [], GIF: [] }
  for (const c of comments) {
    const tier = (c.tier?.toUpperCase() ?? "") as Tier
    if (tier in byTier) byTier[tier].push(c)
  }
  if (!isListMode && byTier.GIF.length > 0) {
    byTier.A.push(...byTier.GIF.map((c) => ({ ...c, tier: "A" as Tier })))
    byTier.GIF = []
  }

  const displayComments = isListMode
    ? comments.filter((c) => c.tier !== "DRAFT" && c.tier !== "GIF")
    : TIERS_ORDER.flatMap((tier) => byTier[tier])
  if (displayComments.length === 0) return
  const activeTiers = TIERS_ORDER.filter((tier) => byTier[tier].length > 0)

  const { gifImgs, cleanup } = await loadGifImgs(displayComments)

  // List mode is a flat feed, three comments per slide.
  const batches: RankedComment[][] = []
  if (isListMode) {
    for (let i = 0; i < displayComments.length; i += BATCH_SIZE) {
      batches.push(displayComments.slice(i, i + BATCH_SIZE))
    }
  }

  function tierDur(tier: Tier) {
    const n = byTier[tier].length
    return LABEL_DUR + (n === 0 ? EMPTY_DUR : n * COMMENT_DUR)
  }

  const tierStarts: number[] = []
  let cursor = OVERLAY_INTRO_DUR
  if (isListMode) {
    cursor += batches.length * BATCH_DUR
  } else {
    for (const tier of activeTiers) {
      tierStarts.push(cursor)
      cursor += tierDur(tier)
    }
  }

  const commentsStart = OVERLAY_INTRO_DUR
  const outroStart    = cursor
  const totalDur      = outroStart + OVERLAY_OUTRO_DUR

  const username = reelData?.username ?? "creator"

  const canvas = document.createElement("canvas")
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext("2d")!

  const mimeType =
    MediaRecorder.isTypeSupported("video/mp4;codecs=avc1") ? "video/mp4;codecs=avc1" :
    MediaRecorder.isTypeSupported("video/mp4")             ? "video/mp4"             :
    MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" :
                                                             "video/webm"
  const ext = mimeType.startsWith("video/mp4") ? "mp4" : "webm"

  const recorder = new MediaRecorder(canvas.captureStream(FPS), {
    mimeType,
    videoBitsPerSecond: 8_000_000,
  })
  const chunks: Blob[] = []
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }

  await new Promise<void>((resolve) => {
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `reelranker-overlay-${Date.now()}.${ext}`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
      resolve()
    }

    recorder.start(200)
    let frameNo = 0

    const timerId = setInterval(() => {
      const t = frameNo / FPS
      if (t >= totalDur) {
        clearInterval(timerId)
        drawOverlayOutro(ctx, 1)
        setTimeout(() => recorder.stop(), 300)
        return
      }

      if (t < commentsStart) {
        drawOverlayIntro(ctx, username, t / OVERLAY_INTRO_DUR)
      } else if (t >= outroStart) {
        drawOverlayOutro(ctx, (t - outroStart) / OVERLAY_OUTRO_DUR)
      } else if (isListMode) {
        const batchIdx = Math.min(Math.floor((t - commentsStart) / BATCH_DUR), batches.length - 1)
        const batchT   = (t - commentsStart) - batchIdx * BATCH_DUR
        drawBatchScene(ctx, batches[batchIdx], batchT, gifImgs)
      } else {
        let ti = tierStarts.length - 1
        for (let i = 0; i < tierStarts.length - 1; i++) {
          if (t < tierStarts[i + 1]) { ti = i; break }
        }

        const tier = activeTiers[ti]
        const te = t - tierStarts[ti]
        const tierComments = byTier[tier]

        let labelProgress: number, visibleCount: number, currentSlide: number
        if (te < LABEL_DUR) {
          labelProgress = te / LABEL_DUR; visibleCount = 0; currentSlide = 0
        } else {
          labelProgress = 1
          const ce = te - LABEL_DUR
          const ci = Math.floor(ce / COMMENT_DUR)
          visibleCount = Math.min(ci, tierComments.length)
          currentSlide = ci < tierComments.length
            ? Math.min((ce - ci * COMMENT_DUR) / SLIDE_DUR, 1)
            : 0
        }

        drawTierScene(ctx, tier, tierComments, labelProgress, visibleCount, currentSlide, true, gifImgs)
      }
      frameNo++
    }, 1000 / FPS)
  })
  cleanup()
}
