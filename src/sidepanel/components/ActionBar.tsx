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
  onExportOverlay: () => void
  onScriptButton: () => void
  onVoiceButton: () => void
  isExporting?: boolean
  isGeneratingScript?: boolean
  isGeneratingVoice?: boolean
  ttsProgress?: { done: number; total: number }
  hasScript?: boolean
  hasVoice?: boolean
  showScriptPanel?: boolean
  showVoicePanel?: boolean
}

const MODES: { mode: RankingMode; label: string }[] = [
  { mode: "default", label: "Normal" },
  { mode: "savage",  label: "☠ Savage" },
  { mode: "indian",  label: "🇮🇳 Desi" },
]

export function ActionBar({
  rankingMode, onModeChange, onRerank, onAddComment, onToggleSettings,
  onScrape, onGoHome, onDelete, onExport, onExportOverlay,
  onScriptButton, onVoiceButton,
  isExporting, isGeneratingScript, isGeneratingVoice, ttsProgress,
  hasScript, hasVoice, showScriptPanel, showVoicePanel,
}: Props) {
  return (
    <div className="border-b border-[#1e1e1e] bg-[#141414]">

      {/* Row 1 — Modes + Utility */}
      <div className="flex items-center justify-between px-2 pt-1.5 pb-1">
        <div className="flex gap-1">
          {MODES.map(({ mode, label }) => (
            <button
              key={mode}
              onClick={() => onModeChange(mode)}
              className={`font-ui text-[11px] font-semibold px-2.5 py-0.5 rounded transition-all duration-150 ${
                rankingMode === mode
                  ? "bg-[#FF6B35] text-black"
                  : "text-[#555] hover:text-white hover:bg-[#252525]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-0.5">
          <button onClick={onGoHome} title="Home"
            className="w-7 h-7 flex items-center justify-center text-[12px] text-[#555] hover:text-white hover:bg-[#252525] rounded transition-all">
            ⌂
          </button>
          <button onClick={onToggleSettings} title="API Keys"
            className="w-7 h-7 flex items-center justify-center text-[12px] text-[#555] hover:text-white hover:bg-[#252525] rounded transition-all">
            ⚙
          </button>
          <button onClick={onDelete} title="Delete session"
            className="w-7 h-7 flex items-center justify-center text-[12px] text-[#3a3a3a] hover:text-red-400 hover:bg-red-950/30 rounded transition-all">
            🗑
          </button>
        </div>
      </div>

      <div className="border-t border-[#1c1c1c] mx-2" />

      {/* Row 2 — Actions | Script → Voice | Export */}
      <div className="flex items-center px-2 pb-1.5 pt-1 gap-1">

        {/* Content actions */}
        {[
          { label: "Scan",    icon: "⟳", fn: onScrape },
          { label: "Re-rank", icon: "↺", fn: onRerank },
          { label: "Add",     icon: "+", fn: onAddComment },
        ].map(({ label, icon, fn }) => (
          <button key={label} onClick={fn}
            className="font-ui text-[11px] font-semibold px-2 py-0.5 text-[#555] hover:text-white hover:bg-[#252525] rounded transition-all">
            {icon} {label}
          </button>
        ))}

        <div className="flex-1" />

        {/* Step: Script */}
        <button
          onClick={onScriptButton}
          disabled={isGeneratingScript}
          title="Generate AI voiceover script"
          className={`font-ui text-[11px] font-semibold px-2 py-0.5 rounded transition-all flex items-center gap-1 disabled:opacity-40 ${
            isGeneratingScript
              ? "text-[#FF6B35] bg-[#1a1a1a] cursor-wait"
              : showScriptPanel
              ? "text-black bg-white"
              : hasScript
              ? "text-white hover:bg-[#252525]"
              : "text-[#555] hover:text-white hover:bg-[#252525]"
          }`}
        >
          {isGeneratingScript ? (
            <><span className="inline-block w-2.5 h-2.5 rounded-full border-2 border-[#FF6B35]/25 border-t-[#FF6B35] animate-spin" /> writing</>
          ) : (
            `${hasScript ? "✓" : "📝"} Script`
          )}
        </button>

        {/* Step: Voice */}
        <button
          onClick={onVoiceButton}
          disabled={!hasScript || isGeneratingVoice || isGeneratingScript}
          title={!hasScript ? "Generate script first" : "Generate TTS voiceover"}
          className={`font-ui text-[11px] font-semibold px-2 py-0.5 rounded transition-all flex items-center gap-1 disabled:opacity-40 ${
            isGeneratingVoice
              ? "text-[#FF6B35] bg-[#1a1a1a] cursor-wait"
              : showVoicePanel
              ? "text-black bg-[#39FF14]"
              : hasVoice
              ? "text-[#39FF14] hover:bg-[#252525]"
              : "text-[#555] hover:text-white hover:bg-[#252525]"
          }`}
        >
          {isGeneratingVoice ? (
            <><span className="inline-block w-2.5 h-2.5 rounded-full border-2 border-[#FF6B35]/25 border-t-[#FF6B35] animate-spin" />
              {ttsProgress && ttsProgress.total > 0 ? `${ttsProgress.done}/${ttsProgress.total}` : "…"}</>
          ) : (
            `${hasVoice ? "✓" : "♪"} Voice`
          )}
        </button>

        <div className="w-px h-3 bg-[#2a2a2a] mx-0.5" />

        {/* Export — always available */}
        <button
          onClick={onExport}
          disabled={isExporting}
          title="Export as standalone reel video"
          className={`font-ui text-[11px] font-semibold px-2 py-0.5 rounded transition-all flex items-center gap-1 ${
            isExporting
              ? "text-[#FF6B35] bg-[#1a1a1a] cursor-wait"
              : "text-[#FF6B35] hover:bg-[#FF6B35]/10"
          }`}
        >
          {isExporting
            ? <><span className="inline-block w-2.5 h-2.5 rounded-full border-2 border-[#FF6B35]/25 border-t-[#FF6B35] animate-spin" />rec</>
            : "▶ Reel"}
        </button>

        <button
          onClick={onExportOverlay}
          disabled={isExporting}
          title="Export green-screen overlay for CapCut"
          className="font-ui text-[11px] font-semibold px-2 py-0.5 text-[#555] hover:text-white hover:bg-[#252525] rounded transition-all disabled:opacity-40"
        >
          ◈ Overlay
        </button>
      </div>
    </div>
  )
}
