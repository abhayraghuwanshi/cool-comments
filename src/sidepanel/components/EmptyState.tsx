import { useState, useEffect } from "react"
import { listSessions, loadSession, deleteSession } from "../lib/db"
import type { SavedSession } from "../lib/db"
import type { RankingMode } from "../../shared/messages"

interface Props {
  error?: string
  showSettings: boolean
  onToggleSettings: () => void
  apiKey: string
  onApiKeyChange: (key: string) => void
  openAiApiKey: string
  onOpenAiApiKeyChange: (key: string) => void
  onSaveApiKey: () => void
  onScrape: () => void
  onRestoreSession: (session: SavedSession) => void
  rankingMode: RankingMode
  onModeChange: (mode: RankingMode) => void
}

export function EmptyState({
  error, showSettings, onToggleSettings, apiKey, onApiKeyChange, openAiApiKey, onOpenAiApiKeyChange,
  onSaveApiKey, onScrape, onRestoreSession, rankingMode, onModeChange,
}: Props) {
  const [sessions, setSessions] = useState<Pick<SavedSession, "reelUrl" | "reelData" | "savedAt">[]>([])
  const [loadingUrl, setLoadingUrl] = useState<string | null>(null)

  useEffect(() => {
    listSessions().then(setSessions).catch(console.error)
  }, [])

  const handleRestore = (url: string) => {
    setLoadingUrl(url)
    loadSession(url).then((full) => {
      setLoadingUrl(null)
      if (full) onRestoreSession(full)
    })
  }

  const handleDelete = (e: React.MouseEvent, url: string) => {
    e.stopPropagation()
    deleteSession(url)
    setSessions((p) => p.filter((s) => s.reelUrl !== url))
  }

  const formatAge = (ts: number) => {
    const d = Date.now() - ts
    if (d < 60000) return "just now"
    if (d < 3600000) return `${Math.floor(d / 60000)}m ago`
    if (d < 86400000) return `${Math.floor(d / 3600000)}h ago`
    return `${Math.floor(d / 86400000)}d ago`
  }

  return (
    <div className="flex flex-col h-screen bg-[#0f0f0f] overflow-hidden">

      {/* Header */}
      <div className="px-4 pt-5 pb-3 border-b border-[#222]">
        <div className="font-display leading-[0.9]">
          <span className="text-[44px] text-white">COOL </span>
          <span className="text-[44px]" style={{ color: '#FF6B35' }}>COMMENTS</span>
        </div>
        <p className="font-mono text-[10px] text-[#555] tracking-[0.15em] uppercase mt-1.5">
          verdict machine · instagram reels
        </p>
      </div>

      {/* API key settings */}
      {showSettings && (
        <div className="px-4 py-2.5 border-b border-[#222] bg-[#141414] flex flex-col gap-1.5">
          <div className="flex gap-2 items-center">
            <span className="font-mono text-[9px] text-[#555] w-14 shrink-0">Gemini</span>
            <input
              type="password"
              placeholder="AIza..."
              value={apiKey}
              onChange={(e) => onApiKeyChange(e.target.value)}
              className="flex-1 bg-[#0f0f0f] border border-[#333] focus:border-[#FF6B35] rounded-sm px-2 py-1 font-mono text-[11px] text-white placeholder-[#444] outline-none transition-colors"
            />
          </div>
          <div className="flex gap-2 items-center">
            <span className="font-mono text-[9px] text-[#555] w-14 shrink-0">OpenAI</span>
            <input
              type="password"
              placeholder="sk-..."
              value={openAiApiKey}
              onChange={(e) => onOpenAiApiKeyChange(e.target.value)}
              className="flex-1 bg-[#0f0f0f] border border-[#333] focus:border-[#FF6B35] rounded-sm px-2 py-1 font-mono text-[11px] text-white placeholder-[#444] outline-none transition-colors"
            />
          </div>
          <div className="flex justify-end">
            <button
              onClick={onSaveApiKey}
              className="font-ui text-[11px] font-bold tracking-widest px-3 py-1 rounded-sm bg-[#FF6B35] text-black hover:bg-[#ff8050] transition-colors"
            >
              SAVE
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mx-4 mt-3 px-3 py-2 border border-red-800 rounded-sm bg-red-950/30">
          <p className="font-mono text-[11px] text-red-400 leading-relaxed">{error}</p>
        </div>
      )}

      {/* VS Code two-column body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left — Start */}
        <div className="w-[148px] shrink-0 border-r border-[#222] flex flex-col p-4 gap-1 overflow-y-auto">
          <p className="font-ui text-[10px] font-bold tracking-[0.2em] text-[#666] uppercase mb-2">
            Start
          </p>

          <button
            onClick={onScrape}
            className="group flex items-center gap-2 py-1 text-left w-full"
          >
            <span className="font-mono text-[11px] text-[#FF6B35]">⟳</span>
            <span className="font-ui text-[13px] font-semibold text-[#FF6B35] hover:text-white transition-colors leading-tight">
              Scan Current Reel
            </span>
          </button>

          <button
            onClick={onToggleSettings}
            className="group flex items-center gap-2 py-1 text-left w-full"
          >
            <span className="font-mono text-[11px] text-[#666]">⚙</span>
            <span className={`font-ui text-[13px] font-semibold transition-colors leading-tight ${showSettings ? "text-[#FF6B35]" : "text-[#888] hover:text-white"}`}>
              API Settings
            </span>
          </button>

          <div className="border-t border-[#222] my-3" />

          <p className="font-ui text-[10px] font-bold tracking-[0.2em] text-[#666] uppercase mb-2">
            Modes
          </p>

          {([
            { mode: 'default' as RankingMode, label: 'Normal',    color: '#ccc',    desc: 'Balanced' },
            { mode: 'savage'  as RankingMode, label: '☠ Savage', color: '#FF1744', desc: 'Harsh verdicts' },
            { mode: 'indian'  as RankingMode, label: '🇮🇳 Desi',  color: '#FF6B35', desc: 'Desi humor' },
          ]).map(({ mode, label, color, desc }) => (
            <button
              key={mode}
              onClick={() => onModeChange(mode)}
              className="flex flex-col mb-1 text-left w-full px-1.5 py-1 rounded-sm transition-colors hover:bg-[#1a1a1a]"
              style={{ outline: rankingMode === mode ? `1px solid ${color}30` : 'none', background: rankingMode === mode ? `${color}10` : undefined }}
            >
              <span className="font-ui text-[12px] font-bold leading-tight" style={{ color: rankingMode === mode ? color : '#666' }}>{label}</span>
              <span className="font-mono text-[9px] text-[#555]">{desc}</span>
            </button>
          ))}
        </div>

        {/* Right — Recent Reels */}
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <p className="font-ui text-[10px] font-bold tracking-[0.2em] text-[#666] uppercase mb-3">
            Recent Reels
          </p>

          {sessions.length > 0 ? (
            <div className="flex flex-col gap-0.5">
              {sessions.map((s) => (
                <button
                  key={s.reelUrl}
                  onClick={() => handleRestore(s.reelUrl)}
                  disabled={!!loadingUrl}
                  className="group w-full text-left flex items-center gap-2.5 px-2 py-2 rounded-sm hover:bg-[#171717] transition-colors relative"
                >
                  {/* Orange accent on hover */}
                  <div className="absolute left-0 top-1 bottom-1 w-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity bg-[#FF6B35]" />

                  {/* Avatar */}
                  {s.reelData.profilePicUrl ? (
                    <img
                      src={s.reelData.profilePicUrl}
                      alt=""
                      className="w-7 h-7 rounded-full object-cover shrink-0"
                      style={{ border: '1px solid #333' }}
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-[#222] shrink-0 flex items-center justify-center font-display text-[11px] text-[#555]">
                      {s.reelData.username?.[0]?.toUpperCase() ?? '?'}
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-ui text-[13px] font-bold text-[#aaa] group-hover:text-white transition-colors leading-tight truncate">
                      {s.reelData.username ? `@${s.reelData.username}` : 'Unknown reel'}
                    </p>
                    {s.reelData.caption && (
                      <p className="font-mono text-[10px] text-[#555] group-hover:text-[#777] transition-colors truncate mt-0.5 leading-none">
                        {s.reelData.caption}
                      </p>
                    )}
                    <p className="font-mono text-[9px] text-[#444] mt-0.5">{formatAge(s.savedAt)}</p>
                  </div>

                  {/* Loading / delete */}
                  <div className="shrink-0">
                    {loadingUrl === s.reelUrl ? (
                      <div className="w-3 h-3 border border-[#FF6B35] border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <button
                        onClick={(e) => handleDelete(e, s.reelUrl)}
                        className="font-mono text-[10px] text-[#333] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-3 mt-6">
              <div className="flex gap-1.5">
                {['S','A','B','C','D','F'].map((t, i) => (
                  <span key={t} className="font-display text-2xl opacity-20"
                    style={{ color: ['#FF6B35','#39FF14','#00B4FF','#CC44FF','#FFB300','#FF1744'][i] }}>
                    {t}
                  </span>
                ))}
              </div>
              <p className="font-mono text-[11px] text-[#555] leading-relaxed">
                No sessions yet. Open an Instagram reel and hit Scan Current Reel.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
