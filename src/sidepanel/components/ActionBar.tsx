import type { RankingMode } from "../../shared/messages"

interface Props {
  rankingMode: RankingMode
  onModeChange: (mode: RankingMode) => void
  onRerank: () => void
  onAddComment: () => void
  onToggleSettings: () => void
  onScrape: () => void
  onGoHome: () => void
  onDelete: () => void
  onExport: () => void
  isExporting?: boolean
}

const MODES: { mode: RankingMode; label: string }[] = [
  { mode: "default", label: "Normal" },
  { mode: "savage",  label: "☠ Savage" },
  { mode: "indian",  label: "🇮🇳 Desi" },
]

export function ActionBar({
  rankingMode, onModeChange, onRerank, onAddComment,
  onToggleSettings, onScrape, onGoHome, onDelete, onExport, isExporting,
}: Props) {
  return (
    <div className="flex items-center gap-1 px-2 py-2 border-b border-[#222] bg-[#141414] flex-wrap">
      {MODES.map(({ mode, label }) => (
        <button
          key={mode}
          onClick={() => onModeChange(mode)}
          className={`font-ui text-[12px] font-semibold px-2.5 py-1 rounded transition-all duration-150 ${
            rankingMode === mode
              ? "bg-[#FF6B35] text-black"
              : "text-[#777] hover:text-white hover:bg-[#252525]"
          }`}
        >
          {label}
        </button>
      ))}

      <div className="w-px h-4 bg-[#2a2a2a] mx-1 shrink-0" />

      <button onClick={onGoHome} title="Home" className="font-ui text-[13px] px-2 py-1 text-[#666] hover:text-white hover:bg-[#252525] rounded transition-all">⌂</button>

      {[
        { label: "Re-rank", icon: "↺", fn: onRerank },
        { label: "Add",     icon: "+", fn: onAddComment },
        { label: "Scan",    icon: "⟳", fn: onScrape },
      ].map(({ label, icon, fn }) => (
        <button key={label} onClick={fn} title={label} className="font-ui text-[12px] font-semibold px-2.5 py-1 text-[#777] hover:text-white hover:bg-[#252525] rounded transition-all">
          {icon} {label}
        </button>
      ))}
      <button
        onClick={onExport}
        disabled={isExporting}
        title="Export as Reel"
        className={`font-ui text-[12px] font-semibold px-2.5 py-1 rounded transition-all flex items-center gap-1.5 ${
          isExporting
            ? "text-[#FF6B35] bg-[#1a1a1a] cursor-wait"
            : "text-[#777] hover:text-white hover:bg-[#252525]"
        }`}
      >
        {isExporting ? (
          <>
            <span className="inline-block w-3 h-3 rounded-full border-2 border-[#FF6B35]/25 border-t-[#FF6B35] animate-spin" />
            rec
          </>
        ) : "▶ Reel"}
      </button>

      <button onClick={onDelete} title="Delete this session" className="font-ui text-[13px] px-2 py-1 text-[#444] hover:text-red-400 hover:bg-red-950/30 rounded transition-all">🗑</button>

      <button onClick={onToggleSettings} title="API Key Settings" className="font-ui text-[13px] px-2 py-1 text-[#555] hover:text-white hover:bg-[#252525] rounded transition-all ml-auto">⚙</button>
    </div>
  )
}
