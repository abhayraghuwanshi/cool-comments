import html2canvas from "html2canvas"

export async function exportTierBoard(elementId: string): Promise<void> {
  const node = document.getElementById(elementId)
  if (!node) return

  // --- Snapshot styles we'll temporarily override ---
  const prevOverflow  = node.style.overflow
  const prevHeight    = node.style.height
  const prevMaxHeight = node.style.maxHeight

  // Kill stagger animations (cards start at opacity:0 until their delay fires)
  const cards = Array.from(node.querySelectorAll<HTMLElement>(".card-animate"))
  const cardPrev = cards.map((c) => ({
    animation: c.style.animation,
    opacity:   c.style.opacity,
    transform: c.style.transform,
  }))

  // Find all descendants that have overflow:hidden (truncate etc.) — these clip text in html2canvas
  const clipped = Array.from(node.querySelectorAll<HTMLElement>("*")).filter(
    (el) => getComputedStyle(el).overflow === "hidden" || getComputedStyle(el).overflowX === "hidden"
  )
  const clippedPrev = clipped.map((el) => ({
    overflow:  el.style.overflow,
    overflowX: el.style.overflowX,
    whiteSpace: el.style.whiteSpace,
  }))

  try {
    // 1. Kill animations — force every card fully visible
    cards.forEach((c) => {
      c.style.animation = "none"
      c.style.opacity   = "1"
      c.style.transform = "none"
    })

    // 2. Un-clip all overflow:hidden children so text isn't cut off
    clipped.forEach((el) => {
      el.style.overflow  = "visible"
      el.style.overflowX = "visible"
      el.style.whiteSpace = "normal"
    })

    // 3. Expand scroll container to full content height
    node.style.overflow  = "visible"
    node.style.height    = "auto"
    node.style.maxHeight = "none"

    // 4. Let browser reflow
    await new Promise((r) => setTimeout(r, 100))

    const canvas = await html2canvas(node, {
      backgroundColor: "#0f0f0f",
      scale: 2,
      useCORS: true,
      allowTaint: false,
      logging: false,
      width:        node.scrollWidth,
      height:       node.scrollHeight,
      windowWidth:  node.scrollWidth,
      windowHeight: node.scrollHeight,
    })

    const link = document.createElement("a")
    link.download = `cool-comments-${Date.now()}.png`
    link.href = canvas.toDataURL("image/png")
    link.click()
  } catch (err) {
    console.error("Export failed:", err)
  } finally {
    // Restore everything
    node.style.overflow  = prevOverflow
    node.style.height    = prevHeight
    node.style.maxHeight = prevMaxHeight

    cards.forEach((c, i) => {
      c.style.animation = cardPrev[i].animation
      c.style.opacity   = cardPrev[i].opacity
      c.style.transform = cardPrev[i].transform
    })

    clipped.forEach((el, i) => {
      el.style.overflow   = clippedPrev[i].overflow
      el.style.overflowX  = clippedPrev[i].overflowX
      el.style.whiteSpace = clippedPrev[i].whiteSpace
    })
  }
}
