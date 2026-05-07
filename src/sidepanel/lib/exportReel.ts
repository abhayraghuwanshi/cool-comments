import type { RankedComment, ReelData, Tier } from "../../shared/messages"

const W   = 1080
const H   = 1920
const FPS = 30

const TIERS_ORDER: Tier[] = ["F", "D", "C", "B", "A", "S"]
const TIER_COLOR: Record<Tier, string> = {
  S: "#FF6B35", A: "#39FF14", B: "#00B4FF",
  C: "#CC44FF", D: "#FFB300", F: "#FF1744", DRAFT: "#4a4a4a",
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

function drawCard(
  ctx: CanvasRenderingContext2D,
  comment: RankedComment,
  x: number, y: number, w: number,
  color: string,
  slideProgress: number
): number {
  const innerW = w - 8 - CARD_PAD_X * 2
  ctx.font = `bold ${U_SIZE}px "Courier New", monospace`
  const uLines = wrapText(ctx, `@${comment.username}`, innerW)
  ctx.font = `${T_SIZE}px "Courier New", monospace`
  const tLines = wrapText(ctx, comment.text, innerW)
  const h = CARD_PAD_Y + uLines.length * U_LINE + 10 + tLines.length * T_LINE + CARD_PAD_Y

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

  ctx.font = `${T_SIZE}px "Courier New", monospace`
  ctx.fillStyle = "#e0e0e0"
  for (const line of tLines) { ctx.fillText(line, tx, cy); cy += T_LINE }

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
  overlay = false
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
    const h = drawCard(ctx, tierComments[i], PAD, y, CARD_W, color, 1)
    y += h + 14
  }
  if (visibleCount < tierComments.length && currentSlide > 0) {
    drawCard(ctx, tierComments[visibleCount], PAD, y, CARD_W, color, currentSlide)
  }
  if (tierComments.length === 0 && labelProgress >= 1) {
    ctx.font = '44px "Courier New", monospace'
    ctx.fillStyle = color + "50"
    ctx.textBaseline = "top"
    ctx.fillText("— none —", PAD, 430)
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

export async function exportReelVideo(reelData: ReelData, comments: RankedComment[]): Promise<void> {
  await document.fonts.ready

  const byTier: Record<Tier, RankedComment[]> = { S: [], A: [], B: [], C: [], D: [], F: [], DRAFT: [] }
  for (const c of comments) {
    const tier = (c.tier?.toUpperCase() ?? "") as Tier
    if (tier in byTier) byTier[tier].push(c)
  }

  const [thumbImg, profImg] = await Promise.all([
    reelData.thumbnailUrl ? loadImg(reelData.thumbnailUrl) : Promise.resolve(null),
    reelData.profilePicUrl ? loadImg(reelData.profilePicUrl) : Promise.resolve(null),
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
  for (const tier of TIERS_ORDER) {
    tierStarts.push(cursor)
    cursor += tierDur(tier)
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
    const startTime = Date.now()

    function drawFrame() {
      const t = (Date.now() - startTime) / 1000

      if (t < INTRO_DUR) {
        drawIntro(ctx, reelData, thumbImg, profImg, t / INTRO_DUR)
      } else if (t >= outroStart) {
        drawOutro(ctx, (t - outroStart) / OUTRO_DUR)
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
        drawTierScene(ctx, tier, tierComments, labelProgress, visibleCount, currentSlide)
      }
    }

    const timerId = setInterval(() => {
      const t = (Date.now() - startTime) / 1000
      if (t >= totalDur) {
        clearInterval(timerId)
        drawOutro(ctx, 1)
        setTimeout(() => recorder.stop(), 300)
        return
      }
      drawFrame()
    }, 1000 / FPS)
  })
}

const GREEN_SCREEN = "#00FF00"  // chroma key color — remove in CapCut with Chroma Key tool

// Green-screen overlay export — use in CapCut: Overlay → Chroma Key → pick green → done.
export async function exportOverlayVideo(comments: RankedComment[]): Promise<void> {
  await document.fonts.ready

  const byTier: Record<Tier, RankedComment[]> = { S: [], A: [], B: [], C: [], D: [], F: [], DRAFT: [] }
  for (const c of comments) {
    const tier = (c.tier?.toUpperCase() ?? "") as Tier
    if (tier in byTier) byTier[tier].push(c)
  }

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

  function tierDur(tier: Tier) {
    const n = byTier[tier].length
    return LABEL_DUR + (n === 0 ? EMPTY_DUR : n * COMMENT_DUR)
  }

  const tierStarts: number[] = []
  let cursor = 0
  for (const tier of TIERS_ORDER) {
    tierStarts.push(cursor)
    cursor += tierDur(tier)
  }
  const totalDur = cursor

  await new Promise<void>((resolve) => {
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `cool-comments-overlay-${Date.now()}.${ext}`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
      resolve()
    }

    recorder.start(200)
    const startTime = Date.now()

    const timerId = setInterval(() => {
      const t = (Date.now() - startTime) / 1000

      if (t >= totalDur) {
        clearInterval(timerId)
        ctx.clearRect(0, 0, W, H)
        setTimeout(() => recorder.stop(), 300)
        return
      }

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

      drawTierScene(ctx, tier, tierComments, labelProgress, visibleCount, currentSlide, true)
    }, 1000 / FPS)
  })
}
