import { useRef, useState } from "react"
import type { Tier } from "../../shared/messages"

const TIER_COLORS: Record<Tier, string> = {
  S: "#FF6B35", A: "#39FF14", B: "#00B4FF", C: "#CC44FF", D: "#FFB300", F: "#FF1744",
}

// Worst-to-best — matches video reveal order
const TIERS: Tier[] = ["F", "D", "C", "B", "A", "S"]

interface Props {
  audioMap: Map<Tier, string>
  onRegenerate: () => void
  onClose: () => void
  isGenerating?: boolean
  ttsProgress?: { done: number; total: number }
}

export function TtsPanel({ audioMap, onRegenerate, onClose, isGenerating, ttsProgress }: Props) {
  const [playingTier, setPlayingTier] = useState<Tier | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const activeTiers = TIERS.filter((t) => audioMap.has(t))

  function handlePlay(tier: Tier) {
    if (playingTier === tier) {
      audioRef.current?.pause()
      setPlayingTier(null)
      return
    }
    audioRef.current?.pause()
    const audio = new Audio(audioMap.get(tier)!)
    audio.onended = () => setPlayingTier(null)
    audio.play()
    audioRef.current = audio
    setPlayingTier(tier)
  }

  function handleDownload(tier: Tier) {
    const url = audioMap.get(tier)
    if (!url) return
    const a = document.createElement("a")
    a.href = url
    a.download = `cool-comments-${tier.toLowerCase()}-tier.mp3`
    a.click()
  }

  function handleDownloadAll() {
    activeTiers.forEach((tier, i) => {
      setTimeout(() => handleDownload(tier), i * 300)
    })
  }

  return (
    <div className="bg-[#0b0b0b] border-b border-[#1e1e1e]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#161616]">
        <span className="font-mono text-[9px] tracking-[0.18em] text-[#3a3a3a] uppercase">
          onyx · {activeTiers.length} tiers ready
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleDownloadAll}
            title="Download all tiers"
            className="font-ui text-[10px] text-[#444] hover:text-white px-1.5 py-0.5 rounded hover:bg-[#1a1a1a] transition-all"
          >
            ⬇ all
          </button>
          <div className="w-px h-3 bg-[#222] mx-0.5" />
          <button
            onClick={onRegenerate}
            disabled={isGenerating}
            title="Regenerate all voices"
            className="font-ui text-[10px] text-[#444] hover:text-[#FF6B35] px-1.5 py-0.5 rounded hover:bg-[#1a1a1a] transition-all disabled:opacity-40"
          >
            {isGenerating
              ? `${ttsProgress?.done ?? 0}/${ttsProgress?.total ?? "…"}`
              : "↺ Regen"}
          </button>
          <button
            onClick={onClose}
            className="font-mono text-[10px] text-[#2a2a2a] hover:text-[#666] transition-colors w-5 h-5 flex items-center justify-center rounded hover:bg-[#1a1a1a]"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Tier rows */}
      <div className="px-3 py-1 flex flex-col">
        {activeTiers.map((tier) => (
          <div key={tier} className="flex items-center gap-2.5 py-1.5 group border-b border-[#111] last:border-0">
            {/* Tier badge */}
            <span
              className="font-display text-[14px] w-4 text-center shrink-0 leading-none"
              style={{ color: TIER_COLORS[tier] }}
            >
              {tier}
            </span>

            {/* Play / pause */}
            <button
              onClick={() => handlePlay(tier)}
              className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-all"
              style={
                playingTier === tier
                  ? { background: TIER_COLORS[tier], color: "#000" }
                  : { background: "#1e1e1e", color: "#666" }
              }
            >
              <span className="text-[9px] leading-none">{playingTier === tier ? "⏸" : "▶"}</span>
            </button>

            <div className="flex-1" />

            {/* Playing bars */}
            {playingTier === tier ? (
              <div className="flex items-end gap-px shrink-0 h-3.5">
                {[4, 7, 10, 7, 4].map((h, i) => (
                  <div
                    key={i}
                    className="w-0.5 rounded-full animate-pulse"
                    style={{
                      height: `${h}px`,
                      background: TIER_COLORS[tier],
                      animationDelay: `${i * 80}ms`,
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="w-5 shrink-0" /> /* spacer */
            )}

            {/* Download */}
            <button
              onClick={() => handleDownload(tier)}
              title={`Download ${tier} tier`}
              className="text-[11px] text-[#2a2a2a] hover:text-white transition-all opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded hover:bg-[#1e1e1e] shrink-0"
            >
              ⬇
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
