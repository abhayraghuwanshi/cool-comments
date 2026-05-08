import type { RankedComment } from "../../shared/messages"

const W = 480
const H = 240

const TIER_COLOR: Record<string, string> = {
  S: '#FF6B35', A: '#39FF14', B: '#00B4FF',
  C: '#CC44FF', D: '#FFB300', F: '#FF1744',
  GIF: '#FFD700', DRAFT: '#4a4a4a',
}

// ─── Canvas drawing ──────────────────────────────────────────────────────────

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  if (!text) return [""]
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ""
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (line && ctx.measureText(test).width > maxW) { lines.push(line); line = word }
    else line = test
  }
  if (line) lines.push(line)
  return lines.length ? lines : [""]
}

function renderFrame(ctx: CanvasRenderingContext2D, comment: RankedComment, index: number, total: number) {
  ctx.fillStyle = "#0f0f0f"
  ctx.fillRect(0, 0, W, H)

  const color = TIER_COLOR[comment.tier] ?? '#888'

  const glow = ctx.createRadialGradient(W * 0.1, H * 0.1, 0, W * 0.1, H * 0.1, W * 0.9)
  glow.addColorStop(0, color + "22")
  glow.addColorStop(1, "rgba(0,0,0,0)")
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  const PAD = 16
  const CARD_PX = 14
  const CARD_PY = 11
  const cardW = W - PAD * 2
  const innerW = cardW - 6 - CARD_PX * 2

  ctx.font = 'bold 12px "Courier New", monospace'
  const uLines = wrapText(ctx, `@${comment.username}`, innerW)
  ctx.font = '13px "Courier New", monospace'
  const tLines = wrapText(ctx, comment.text, innerW)
  const cardH = CARD_PY + uLines.length * 17 + 6 + tLines.length * 19 + CARD_PY
  const cardX = PAD
  const cardY = Math.max(PAD + 24, Math.floor((H - cardH) / 2) - 8)

  ctx.fillStyle = "#181818"
  ctx.beginPath()
  ctx.roundRect(cardX, cardY, cardW, cardH, 4)
  ctx.fill()

  ctx.fillStyle = color
  ctx.fillRect(cardX, cardY, 4, cardH)

  const textX = cardX + 4 + CARD_PX
  let cy = cardY + CARD_PY

  ctx.font = 'bold 12px "Courier New", monospace'
  ctx.fillStyle = "#FF6B35"
  ctx.textBaseline = "top"
  for (const line of uLines) { ctx.fillText(line, textX, cy); cy += 17 }
  cy += 6

  ctx.font = '13px "Courier New", monospace'
  ctx.fillStyle = "#c8c8c8"
  for (const line of tLines) { ctx.fillText(line, textX, cy); cy += 19 }

  if (comment.likesCount && comment.likesCount !== "0") {
    ctx.font = '10px "Courier New", monospace'
    ctx.fillStyle = "#555"
    const lt = `♥ ${comment.likesCount}`
    ctx.fillText(lt, cardX + cardW - 6 - ctx.measureText(lt).width, cardY + CARD_PY)
  }

  // Tier badge (top-left)
  ctx.font = 'bold 11px "Courier New", monospace'
  ctx.fillStyle = color
  ctx.textBaseline = "top"
  ctx.fillText(comment.tier, PAD, PAD)

  // Progress dots (bottom center)
  if (total > 1) {
    const dotR = 3, gap = 10
    let dx = (W - (total * (dotR * 2) + (total - 1) * (gap - dotR * 2))) / 2
    const dy = H - 14
    for (let i = 0; i < total; i++) {
      ctx.beginPath()
      ctx.arc(dx + dotR, dy, dotR, 0, Math.PI * 2)
      ctx.fillStyle = i === index ? color : "#252525"
      ctx.fill()
      dx += dotR * 2 + (gap - dotR * 2)
    }
  }

  // Footer watermark
  ctx.font = '8px "Courier New", monospace'
  ctx.fillStyle = "#1e1e1e"
  ctx.textBaseline = "bottom"
  const wm = "coolcomments"
  ctx.fillText(wm, W - PAD - ctx.measureText(wm).width, H - 4)
  ctx.textBaseline = "top"
}

// ─── Color quantization ──────────────────────────────────────────────────────

function buildPalette(frames: ImageData[]): Uint8Array {
  const freq = new Map<number, number>()
  for (const { data } of frames) {
    for (let i = 0; i < data.length; i += 4) {
      const k = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4)
      freq.set(k, (freq.get(k) ?? 0) + 1)
    }
  }
  const top = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 256)
  const palette = new Uint8Array(256 * 3)
  for (let i = 0; i < top.length; i++) {
    const k = top[i][0]
    palette[i * 3]     = ((k >> 8) & 0xF) * 17
    palette[i * 3 + 1] = ((k >> 4) & 0xF) * 17
    palette[i * 3 + 2] = (k & 0xF) * 17
  }
  return palette
}

function buildLookup(palette: Uint8Array): Uint8Array {
  const lookup = new Uint8Array(4096) // 16*16*16
  for (let r = 0; r < 16; r++) {
    for (let g = 0; g < 16; g++) {
      for (let b = 0; b < 16; b++) {
        const rr = r * 17, gg = g * 17, bb = b * 17
        let best = 0, bestDist = Infinity
        for (let j = 0; j < 256; j++) {
          const dr = rr - palette[j * 3], dg = gg - palette[j * 3 + 1], db = bb - palette[j * 3 + 2]
          const d = dr * dr + dg * dg + db * db
          if (d < bestDist) { bestDist = d; best = j }
        }
        lookup[(r << 8) | (g << 4) | b] = best
      }
    }
  }
  return lookup
}

function quantizeFrame(imageData: ImageData, lookup: Uint8Array): Uint8Array {
  const { data, width, height } = imageData
  const out = new Uint8Array(width * height)
  for (let i = 0; i < width * height; i++) {
    out[i] = lookup[((data[i * 4] >> 4) << 8) | ((data[i * 4 + 1] >> 4) << 4) | (data[i * 4 + 2] >> 4)]
  }
  return out
}

// ─── LZW encoder (GIF89a) ────────────────────────────────────────────────────

function lzwEncode(pixels: Uint8Array, minCodeSize: number): Uint8Array {
  const clearCode = 1 << minCodeSize
  const eoi = clearCode + 1
  const out: number[] = []
  let bitBuf = 0, bitsInBuf = 0, codeSize = minCodeSize + 1, nextCode = eoi + 1
  const table = new Map<number, number>()

  function emit(code: number) {
    bitBuf |= code << bitsInBuf
    bitsInBuf += codeSize
    while (bitsInBuf >= 8) { out.push(bitBuf & 0xFF); bitBuf >>>= 8; bitsInBuf -= 8 }
  }

  emit(clearCode)
  if (!pixels.length) {
    emit(eoi)
    if (bitsInBuf > 0) out.push(bitBuf & 0xFF)
    return new Uint8Array(out)
  }

  let prefix = pixels[0]
  for (let i = 1; i < pixels.length; i++) {
    const k = pixels[i]
    const key = (prefix << 8) | k
    const found = table.get(key)
    if (found !== undefined) {
      prefix = found
    } else {
      emit(prefix)
      if (nextCode < 4096) {
        table.set(key, nextCode++)
        if (nextCode === (1 << codeSize) && codeSize < 12) codeSize++
      }
      prefix = k
    }
  }
  emit(prefix)
  emit(eoi)
  if (bitsInBuf > 0) out.push(bitBuf & 0xFF)
  return new Uint8Array(out)
}

// ─── GIF byte assembly ───────────────────────────────────────────────────────

function buildGif(palette: Uint8Array, quantizedFrames: Uint8Array[], delay: number): Uint8Array {
  const bytes: number[] = []
  const u16 = (n: number) => [n & 0xFF, (n >> 8) & 0xFF]
  const str = (s: string) => [...s].map(c => c.charCodeAt(0))

  bytes.push(...str("GIF89a"))
  bytes.push(...u16(W), ...u16(H), 0xF7, 0, 0) // screen descriptor: 256-color global table
  bytes.push(...palette)                         // global color table

  // Netscape 2.0 loop extension (infinite loop)
  bytes.push(0x21, 0xFF, 11, ...str("NETSCAPE2.0"), 3, 1, ...u16(0), 0)

  const minCodeSize = 8
  for (const indices of quantizedFrames) {
    bytes.push(0x21, 0xF9, 4, 0x00, ...u16(delay), 0, 0) // graphic control ext
    bytes.push(0x2C, ...u16(0), ...u16(0), ...u16(W), ...u16(H), 0x00) // image descriptor
    bytes.push(minCodeSize)
    const compressed = lzwEncode(indices, minCodeSize)
    for (let off = 0; off < compressed.length; off += 255) {
      const block = compressed.subarray(off, Math.min(off + 255, compressed.length))
      bytes.push(block.length, ...block)
    }
    bytes.push(0) // block terminator
  }

  bytes.push(0x3B) // GIF trailer
  return new Uint8Array(bytes)
}

// ─── Public export ───────────────────────────────────────────────────────────

export async function exportGif(comments: RankedComment[]): Promise<void> {
  if (!comments.length) return
  console.log("[exportGif] starting for", comments.length, "comments")
  await document.fonts.ready

  const canvas = document.createElement("canvas")
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext("2d")!

  const rawFrames: ImageData[] = []
  for (let i = 0; i < comments.length; i++) {
    renderFrame(ctx, comments[i], i, comments.length)
    rawFrames.push(ctx.getImageData(0, 0, W, H))
  }

  const palette = buildPalette(rawFrames)
  const lookup = buildLookup(palette)
  const quantizedFrames = rawFrames.map(f => quantizeFrame(f, lookup))
  const gif = buildGif(palette, quantizedFrames, 200) // 200 cs = 2s per frame
  console.log("[exportGif] gif bytes:", gif.byteLength)

  const blob = new Blob([gif.buffer as ArrayBuffer], { type: "image/gif" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.style.display = "none"
  a.href = url
  a.download = `cool-comments-${Date.now()}.gif`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
