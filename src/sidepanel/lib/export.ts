import html2canvas from "html2canvas"

export async function exportTierBoard(elementId: string): Promise<void> {
  const node = document.getElementById(elementId)
  if (!node) return

  try {
    const canvas = await html2canvas(node, {
      backgroundColor: "#0f0f0f",
      scale: 2,
      useCORS: true,
      allowTaint: false,
      logging: false,
    })

    const link = document.createElement("a")
    link.download = `cool-comments-${Date.now()}.png`
    link.href = canvas.toDataURL("image/png")
    link.click()
  } catch (err) {
    console.error("Export failed:", err)
  }
}
