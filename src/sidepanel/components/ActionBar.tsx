import type { RankingMode } from "../../shared/messages"
import { exportTierBoard } from "../lib/export"

interface Props {
  rankingMode: RankingMode
  onModeChange: (mode: RankingMode) => void
  onRerank: () => void
  onAddComment: () => void
  onToggleSettings: () => void
  onScrape: () => void
}

export function ActionBar({
  rankingMode,
  onModeChange,
  onRerank,
  onAddComment,
  onToggleSettings,
  onScrape,
}: Props) {
  const modeButton = (mode: RankingMode, label: string) => (
    <button
      onClick={() => onModeChange(mode)}
      className={`px-2 py-1 rounded text-xs font-medium transition-colors
        ${rankingMode === mode
          ? "bg-orange-500 text-white"
          : "bg-[#222] text-gray-400 hover:text-white hover:bg-[#2a2a2a]"
        }`}
    >
      {label}
    </button>
  )

  return (
    <div className="flex flex-col gap-1.5 p-2 border-b border-[#222] bg-[#0f0f0f]">
      <div className="flex gap-1.5 flex-wrap">
        {modeButton("default", "Normal")}
        {modeButton("savage", "☠️ Savage")}
        {modeButton("indian", "🇮🇳 Desi")}
      </div>

      <div className="flex gap-1.5 flex-wrap">
        <button
          onClick={onRerank}
          className="px-2 py-1 bg-[#222] text-gray-300 hover:text-white hover:bg-[#2a2a2a] rounded text-xs font-medium transition-colors"
        >
          🔁 Re-rank
        </button>
        <button
          onClick={onAddComment}
          className="px-2 py-1 bg-[#222] text-gray-300 hover:text-white hover:bg-[#2a2a2a] rounded text-xs font-medium transition-colors"
        >
          + Add
        </button>
        <button
          onClick={() => exportTierBoard("tier-board-export-root")}
          className="px-2 py-1 bg-[#222] text-gray-300 hover:text-white hover:bg-[#2a2a2a] rounded text-xs font-medium transition-colors"
        >
          📸 Export
        </button>
        <button
          onClick={onScrape}
          className="px-2 py-1 bg-[#222] text-gray-300 hover:text-white hover:bg-[#2a2a2a] rounded text-xs font-medium transition-colors"
        >
          🔄 Rescrape
        </button>
        <button
          onClick={onToggleSettings}
          className="px-2 py-1 bg-[#222] text-gray-400 hover:text-white hover:bg-[#2a2a2a] rounded text-xs transition-colors ml-auto"
          title="API Key Settings"
        >
          ⚙️
        </button>
      </div>
    </div>
  )
}
