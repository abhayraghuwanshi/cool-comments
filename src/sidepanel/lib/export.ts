import type { RankedComment, Tier } from "../../shared/messages"

const TIERS: Tier[] = ["S", "A", "B", "C", "D", "F"]
const TIER_COLOR: Record<Tier, string> = {
  S: "#FF6B35", A: "#39FF14", B: "#00B4FF",
  C: "#CC44FF", D: "#FFB300", F: "#FF1744", DRAFT: "#4a4a4a", GIF: "#FFD700",
}

const W         = 480   // canvas width
const PAD       = 16    // outer horizontal & vertical padding
const CARD_PX   = 12    // card inner horizontal padding
const CARD_PY   = 9     // card inner vertical padding
const CARD_GAP  = 5     // gap between cards
const TIER_GAP  = 4     // gap between tier rows

function setupCtx(ctx: CanvasRenderingContext2D) {
  ctx.textBaseline = "top"
  ctx.imageSmoothingEnabled = true
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  if (!text) return []
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ""
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (line && ctx.measureText(test).width > maxW) {
      lines.push(line)
      line = word
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines.length ? lines : [""]
}

function cardHeight(ctx: CanvasRenderingContext2D, comment: RankedComment, innerW: number): number {
  ctx.font = 'bold 11px "Courier New", monospace'
  const uLines = wrapText(ctx, `@${comment.username}`, innerW)
  ctx.font = '12px "Courier New", monospace'
  const tLines = wrapText(ctx, comment.text, innerW)
  return CARD_PY + uLines.length * 15 + 4 + tLines.length * 17 + CARD_PY
}

function drawRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

function drawCard(
  ctx: CanvasRenderingContext2D,
  comment: RankedComment,
  x: number, y: number, w: number,
  tierColor: string
): number {
  const innerW = w - 3 - CARD_PX * 2
  const h = cardHeight(ctx, comment, innerW)

  // Card background
  ctx.fillStyle = "#181818"
  drawRoundRect(ctx, x, y, w, h, 3)
  ctx.fill()

  // Left tier color border
  ctx.fillStyle = tierColor
  ctx.fillRect(x, y, 3, h)

  // Re-clip rounded corners on left
  ctx.fillStyle = "#181818"
  drawRoundRect(ctx, x, y, w, h, 3)
  // draw border back
  ctx.fillStyle = tierColor
  ctx.fillRect(x, y, 3, h)

  const textX = x + 3 + CARD_PX
  let cy = y + CARD_PY

  // Username
  ctx.font = 'bold 11px "Courier New", monospace'
  ctx.fillStyle = "#FF6B35"
  const uLines = wrapText(ctx, `@${comment.username}`, innerW)
  for (const line of uLines) {
    ctx.fillText(line, textX, cy)
    cy += 15
  }

  cy += 4

  // Comment text
  ctx.font = '12px "Courier New", monospace'
  ctx.fillStyle = "#c8c8c8"
  const tLines = wrapText(ctx, comment.text, innerW)
  for (const line of tLines) {
    ctx.fillText(line, textX, cy)
    cy += 17
  }

  // Likes (right-aligned)
  if (comment.likesCount && comment.likesCount !== "0") {
    ctx.font = '10px "Courier New", monospace'
    ctx.fillStyle = "#555"
    const likeText = `♥ ${comment.likesCount}`
    const tw = ctx.measureText(likeText).width
    ctx.fillText(likeText, x + w - 8 - tw, y + CARD_PY)
  }

  return h
}

function computeTotalHeight(ctx: CanvasRenderingContext2D, commentsByTier: Record<Tier, RankedComment[]>): number {
  const cardW = W - PAD * 2
  const innerW = cardW - 3 - CARD_PX * 2
  let total = PAD // top padding

  for (const tier of TIERS) {
    total += 64 // tier header height
    const comments = commentsByTier[tier]
    if (comments.length === 0) {
      total += 32 // empty placeholder
    } else {
      for (const c of comments) {
        ctx.font = 'bold 11px "Courier New", monospace'
        const h = cardHeight(ctx, c, innerW)
        total += h + CARD_GAP
      }
    }
    total += TIER_GAP
  }

  return total + PAD // bottom padding
}

export async function exportTierBoard(
  _elementId: string,
  comments: RankedComment[]
): Promise<void> {
  // Build offscreen canvas
  const offscreen = document.createElement("canvas")
  const ctx = offscreen.getContext("2d")!
  offscreen.width = W

  // Measure total height first
  setupCtx(ctx)
  const byTier: Record<Tier, RankedComment[]> = {
    S: [], A: [], B: [], C: [], D: [], F: [], DRAFT: [], GIF: [],
  }
  for (const c of comments) byTier[c.tier].push(c)

  const totalH = computeTotalHeight(ctx, byTier)
  offscreen.height = totalH

  // Background
  setupCtx(ctx)
  ctx.fillStyle = "#0f0f0f"
  ctx.fillRect(0, 0, W, totalH)

  let y = PAD

  for (const tier of TIERS) {
    const color = TIER_COLOR[tier]
    const tierComments = byTier[tier]
    const cardW = W - PAD * 2

    // ── Tier header ──
    // Tier letter
    ctx.font = 'bold 52px Impact, Arial, sans-serif'
    ctx.fillStyle = color
    ctx.textBaseline = "top"
    ctx.fillText(tier, PAD, y + 6)

    // Gradient line (simulate with solid line)
    const lineY = y + 32
    const grad = ctx.createLinearGradient(PAD + 58, lineY, W - PAD, lineY)
    grad.addColorStop(0, color + "90")
    grad.addColorStop(1, color + "00")
    ctx.strokeStyle = grad
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(PAD + 58, lineY)
    ctx.lineTo(W - PAD, lineY)
    ctx.stroke()

    // Comment count
    ctx.font = '10px "Courier New", monospace'
    ctx.fillStyle = "#555"
    ctx.textBaseline = "top"
    const countText = tierComments.length > 0 ? `${tierComments.length}` : "—"
    const countW = ctx.measureText(countText).width
    ctx.fillText(countText, W - PAD - countW, y + 28)

    y += 64

    // ── Cards ──
    if (tierComments.length === 0) {
      // Empty placeholder
      ctx.strokeStyle = color + "30"
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      ctx.strokeRect(PAD, y, cardW, 28)
      ctx.setLineDash([])
      ctx.font = '9px "Courier New", monospace'
      ctx.fillStyle = color + "50"
      ctx.textBaseline = "middle"
      ctx.fillText("— empty —", PAD + cardW / 2 - 20, y + 14)
      ctx.textBaseline = "top"
      y += 32
    } else {
      for (const comment of tierComments) {
        const h = drawCard(ctx, comment, PAD, y, cardW, color)
        y += h + CARD_GAP
      }
    }

    y += TIER_GAP
  }

  // Download
  const link = document.createElement("a")
  link.download = `cool-comments-${Date.now()}.png`
  link.href = offscreen.toDataURL("image/png")
  link.click()
}
