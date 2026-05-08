import type { Tier } from "../../shared/messages"
import type { TierScript } from "../lib/ttsScript"

const TIER_COLORS: Record<Tier, string> = {
  S: "#FF6B35", A: "#39FF14", B: "#00B4FF", C: "#CC44FF", D: "#FFB300", F: "#FF1744", DRAFT: "#4a4a4a", GIF: "#FFD700",
}

interface Props {
  scripts: TierScript[]
  onGenerateVoice: () => void
  onRegenerate: () => void
  onClose: () => void
  isGeneratingVoice?: boolean
  hasVoice?: boolean
}

export function ScriptPanel({ scripts, onGenerateVoice, onRegenerate, onClose, isGeneratingVoice, hasVoice }: Props) {
  return (
    <div className="bg-[#0b0b0b] border-b border-[#1e1e1e]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#161616]">
        <span className="font-mono text-[9px] tracking-[0.18em] text-[#3a3a3a] uppercase">
          script · {scripts.length} tiers · AI
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={onRegenerate}
            className="font-ui text-[10px] text-[#444] hover:text-[#FF6B35] px-1.5 py-0.5 rounded hover:bg-[#1a1a1a] transition-all"
          >
            ↺ Rewrite
          </button>
          <div className="w-px h-3 bg-[#222] mx-0.5" />
          <button
            onClick={onGenerateVoice}
            disabled={isGeneratingVoice}
            className={`font-ui text-[10px] font-semibold px-2 py-0.5 rounded transition-all disabled:opacity-40 ${
              hasVoice
                ? "text-[#39FF14] hover:bg-[#1a1a1a]"
                : "text-[#FF6B35] bg-[#FF6B35]/10 hover:bg-[#FF6B35]/20"
            }`}
          >
            {isGeneratingVoice ? "generating…" : hasVoice ? "✓ voice ready" : "♪ Generate Voice →"}
          </button>
          <button
            onClick={onClose}
            className="font-mono text-[10px] text-[#2a2a2a] hover:text-[#666] w-5 h-5 flex items-center justify-center rounded hover:bg-[#1a1a1a] transition-colors"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Script per tier — scrollable */}
      <div className="max-h-52 overflow-y-auto px-3 py-2 flex flex-col gap-3">
        {scripts.map((s) => (
          <div key={s.tier} className="flex gap-2.5">
            <span
              className="font-display text-[14px] w-4 shrink-0 leading-none mt-0.5"
              style={{ color: TIER_COLORS[s.tier] }}
            >
              {s.tier}
            </span>
            <p className="font-mono text-[10px] text-[#555] leading-relaxed flex-1 select-text">
              {s.text}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
