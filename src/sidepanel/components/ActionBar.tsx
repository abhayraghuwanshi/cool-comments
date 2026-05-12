import type { RankingMode } from "../../shared/messages"

interface Props {
  rankingMode: RankingMode
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

const MODE_META: Record<RankingMode, { label: string; color: string }> = {
  scrape:  { label: "List",   color: "#888888" },
  default: { label: "Normal", color: "#e0e0e0" },
  savage:  { label: "Savage", color: "#FF1744" },
  indian:  { label: "Desi",   color: "#FF9500" },
}

export function ActionBar({
  rankingMode, onRerank, onAddComment, onToggleSettings,
  onScrape, onGoHome, onDelete, onExport, onExportOverlay,
  onScriptButton, onVoiceButton,
  isExporting, isGeneratingScript, isGeneratingVoice, ttsProgress,
  hasScript, hasVoice, showScriptPanel, showVoicePanel,
}: Props) {
  const { label: modeLabel, color: modeColor } = MODE_META[rankingMode]

  return (
    <div className="border-b border-[#1e1e1e] bg-[#141414]">

      {/* Row 1 — Mode badge + Utility */}
      <div className="flex items-center justify-between px-3 py-1.5">
        {/* Read-only mode indicator */}
        <div className="flex items-center gap-1.5">
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ background: modeColor }}
          />
          <span
            className="font-ui text-[11px] font-semibold tracking-wide"
            style={{ color: modeColor }}
          >
            {modeLabel}
          </span>
        </div>

        {/* Utility buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={onGoHome}
            title="Home"
            className="flex items-center gap-1 px-2 py-1 rounded text-[#444] hover:text-[#ccc] hover:bg-[#1e1e1e] transition-all font-ui text-[11px] font-semibold"
          >
            <span className="text-[11px]">⌂</span>
          </button>
          <button
            onClick={onToggleSettings}
            title="API Keys"
            className="flex items-center gap-1 px-2 py-1 rounded text-[#444] hover:text-[#ccc] hover:bg-[#1e1e1e] transition-all font-ui text-[11px] font-semibold"
          >
            <span className="text-[11px]">⚙</span>
          </button>
          <div className="w-px h-3 bg-[#2a2a2a] mx-0.5" />
          <button
            onClick={onDelete}
            title="Delete session"
            className="flex items-center gap-1 px-2 py-1 rounded text-[#3a3a3a] hover:text-[#FF1744] hover:bg-[#FF1744]/8 transition-all font-ui text-[11px] font-semibold"
          >
            <span className="text-[11px]">✕</span>
          </button>
        </div>
      </div>

      <div className="border-t border-[#1c1c1c] mx-2" />

      {/* Row 2 — Actions | Script → Voice | Export */}
      <div className="flex items-center px-2 pb-1.5 pt-1 gap-0.5">

        {/* Content actions — text only */}
        {[
          { label: "Scan",    fn: onScrape },
          { label: "Re-rank", fn: onRerank },
          { label: "Add",     fn: onAddComment },
        ].map(({ label, fn }) => (
          <button key={label} onClick={fn}
            className="font-ui text-[11px] font-semibold px-2 py-0.5 text-[#4a4a4a] hover:text-white hover:bg-[#252525] rounded transition-all">
            {label}
          </button>
        ))}

        <div className="flex-1" />

        {/* Script */}
        <button
          onClick={onScriptButton}
          disabled={isGeneratingScript}
          title="Generate AI voiceover script"
          className={`font-ui text-[11px] font-semibold px-2 py-0.5 rounded transition-all flex items-center gap-1.5 disabled:opacity-40 ${
            isGeneratingScript
              ? "text-[#FF6B35] cursor-wait"
              : showScriptPanel
              ? "text-black bg-white"
              : hasScript
              ? "text-[#ccc] hover:bg-[#252525]"
              : "text-[#4a4a4a] hover:text-white hover:bg-[#252525]"
          }`}
        >
          {isGeneratingScript ? (
            <><span className="inline-block w-2 h-2 rounded-full border border-[#FF6B35]/30 border-t-[#FF6B35] animate-spin" />writing</>
          ) : (
            <>
              {hasScript && !showScriptPanel && <span className="w-1 h-1 rounded-full bg-white shrink-0" />}
              Script
            </>
          )}
        </button>

        {/* Voice */}
        <button
          onClick={onVoiceButton}
          disabled={!hasScript || isGeneratingVoice || isGeneratingScript}
          title={!hasScript ? "Generate script first" : "Generate TTS voiceover"}
          className={`font-ui text-[11px] font-semibold px-2 py-0.5 rounded transition-all flex items-center gap-1.5 disabled:opacity-40 ${
            isGeneratingVoice
              ? "text-[#FF6B35] cursor-wait"
              : showVoicePanel
              ? "text-black bg-[#39FF14]"
              : hasVoice
              ? "text-[#39FF14] hover:bg-[#252525]"
              : "text-[#4a4a4a] hover:text-white hover:bg-[#252525]"
          }`}
        >
          {isGeneratingVoice ? (
            <><span className="inline-block w-2 h-2 rounded-full border border-[#FF6B35]/30 border-t-[#FF6B35] animate-spin" />
              {ttsProgress && ttsProgress.total > 0 ? `${ttsProgress.done}/${ttsProgress.total}` : "…"}</>
          ) : (
            <>
              {hasVoice && !showVoicePanel && <span className="w-1 h-1 rounded-full bg-[#39FF14] shrink-0" />}
              Voice
            </>
          )}
        </button>

        <div className="w-px h-3 bg-[#252525] mx-1" />

        {/* Reel export */}
        <button
          onClick={onExport}
          disabled={isExporting}
          title="Export as standalone reel video"
          className={`font-ui text-[11px] font-semibold px-2 py-0.5 rounded transition-all flex items-center gap-1 ${
            isExporting
              ? "text-[#FF6B35] cursor-wait"
              : "text-[#FF6B35] hover:bg-[#FF6B35]/10"
          }`}
        >
          {isExporting
            ? <><span className="inline-block w-2 h-2 rounded-full border border-[#FF6B35]/30 border-t-[#FF6B35] animate-spin" />rec</>
            : "▶ Reel"}
        </button>

        {/* Overlay export */}
        <button
          onClick={onExportOverlay}
          disabled={isExporting}
          title="Export green-screen overlay for CapCut"
          className="font-ui text-[11px] font-semibold px-2 py-0.5 text-[#4a4a4a] hover:text-white hover:bg-[#252525] rounded transition-all disabled:opacity-40"
        >
          Overlay
        </button>
      </div>
    </div>
  )
}
