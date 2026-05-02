import { useState, useCallback, useEffect, useRef } from "react"
import type { ReelData, RankedComment, RankingMode } from "../shared/messages"
import { useScraper } from "./hooks/useScraper"
import { useRanker } from "./hooks/useRanker"
import { saveSession, loadLastSession, deleteSession, type SavedSession } from "./lib/db"
import { exportReelVideo } from "./lib/exportReel"
import { ReelInfoPanel } from "./components/ReelInfoPanel"
import { ContextPrompt } from "./components/ContextPrompt"
import { TierBoard } from "./components/TierBoard"
import { ActionBar } from "./components/ActionBar"
import { LoadingState } from "./components/LoadingState"
import { EmptyState } from "./components/EmptyState"
import { AddCommentModal } from "./components/AddCommentModal"

type Phase = "idle" | "scraping" | "awaiting-context" | "ranking" | "ready" | "error"

export default function App() {
  const [phase, setPhase] = useState<Phase>("idle")
  const [errorMsg, setErrorMsg] = useState("")
  const [reelData, setReelData] = useState<ReelData | null>(null)
  const [comments, setComments] = useState<RankedComment[]>([])
  const [rankingMode, setRankingMode] = useState<RankingMode>("default")
  const [showAddModal, setShowAddModal] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [apiKey, setApiKey] = useState("")
  const [restoredFrom, setRestoredFrom] = useState<string | null>(null)
  const [pendingScrape, setPendingScrape] = useState<{ reel: import("../shared/messages").ReelData; comments: import("../shared/messages").RawComment[] } | null>(null)

  const { scrape } = useScraper()
  const { rank } = useRanker()

  // Auto-save on comments change (debounced 600ms)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!reelData || comments.length === 0) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      saveSession({ reelUrl: reelData.reelUrl, reelData, comments, rankingMode }).catch(console.error)
    }, 600)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [comments, reelData, rankingMode])

  // Restore last session on mount
  useEffect(() => {
    loadLastSession().then((s) => {
      if (!s) return
      setReelData(s.reelData)
      setComments(s.comments)
      setRankingMode(s.rankingMode)
      setPhase("ready")
      setRestoredFrom(s.reelData.username)
    }).catch(console.error)
  }, [])

  // All useCallbacks must be before any conditional returns
  const handleRestoreSession = useCallback((session: SavedSession) => {
    setReelData(session.reelData)
    setComments(session.comments)
    setRankingMode(session.rankingMode)
    setRestoredFrom(session.reelData.username)
    setPhase("ready")
  }, [])

  const handleScrapeAndRank = useCallback(async () => {
    setPhase("scraping")
    setErrorMsg("")
    setRestoredFrom(null)

    const scrapeResult = await scrape()
    if ("error" in scrapeResult) {
      setPhase(scrapeResult.error === "NOT_ON_REEL_PAGE" ? "idle" : "error")
      if (scrapeResult.error !== "NOT_ON_REEL_PAGE") setErrorMsg(scrapeResult.error)
      return
    }

    setReelData(scrapeResult.reel)

    if (scrapeResult.comments.length === 0) {
      setPhase("error")
      setErrorMsg("No comments found. Scroll down on the reel to load comments, then scan again.")
      return
    }

    // Pause here — show the context prompt before ranking
    setPendingScrape({ reel: scrapeResult.reel, comments: scrapeResult.comments })
    setPhase("awaiting-context")
  }, [scrape, rankingMode])

  const handleContextSubmit = useCallback(async (reelContext: string) => {
    if (!pendingScrape) return
    setPhase("ranking")

    const rankResult = await rank(pendingScrape.reel, pendingScrape.comments, rankingMode, reelContext || undefined)
    if ("error" in rankResult) {
      if (rankResult.error === "NO_API_KEY") {
        setShowSettings(true)
        setErrorMsg("Please enter your Gemini API key in settings.")
      } else if (rankResult.error === "NO_COMMENTS_SCRAPED") {
        setErrorMsg("No comments found. Scroll down on the reel to load comments, then scan again.")
      } else {
        setErrorMsg(rankResult.error)
      }
      setPhase("error")
      return
    }

    setComments(rankResult.comments)
    setPhase("ready")
  }, [pendingScrape, rank, rankingMode])

  const handleRerank = useCallback(async () => {
    if (!reelData) return
    setPhase("ranking")
    const raw = comments.map(({ tier: _t, locked: _l, ...rest }) => rest)
    const result = await rank(reelData, raw, rankingMode)
    if ("error" in result) {
      setPhase("error")
      setErrorMsg(result.error)
      return
    }
    setComments((prev) =>
      result.comments.map((rc) => {
        const existing = prev.find((p) => p.id === rc.id)
        return existing?.locked ? existing : rc
      })
    )
    setPhase("ready")
  }, [reelData, comments, rank, rankingMode])

  const handleSaveApiKey = useCallback(async () => {
    await chrome.storage.local.set({ apiKey })
    setShowSettings(false)
  }, [apiKey])

  const handleAddComment = useCallback((text: string) => {
    setComments((prev) => [...prev, {
      id: `manual-${Date.now()}`,
      username: "you",
      text,
      likesCount: "0",
      tier: "C",
      locked: false,
    }])
    setShowAddModal(false)
  }, [])

  // --- Conditional renders (after all hooks) ---

  if (phase === "scraping") return <LoadingState message="reading the comments..." />
  if (phase === "ranking")  return <LoadingState message="the AI is judging..." />
  if (phase === "awaiting-context") return (
    <ContextPrompt
      onSubmit={handleContextSubmit}
      onSkip={() => handleContextSubmit("")}
    />
  )

  if (phase === "idle" || (phase === "error" && !reelData)) {
    return (
      <EmptyState
        error={phase === "error" ? errorMsg : undefined}
        showSettings={showSettings}
        apiKey={apiKey}
        onApiKeyChange={setApiKey}
        onSaveApiKey={handleSaveApiKey}
        onScrape={handleScrapeAndRank}
        onRestoreSession={handleRestoreSession}
        rankingMode={rankingMode}
        onModeChange={setRankingMode}
      />
    )
  }

  return (
    <div className="flex flex-col h-screen bg-[#080808] overflow-hidden">
      {/* API key settings bar */}
      {showSettings && (
        <div className="bg-[#0c0c0c] border-b border-[#141414] px-3 py-2 flex gap-2 items-center">
          <input
            type="password"
            placeholder="Gemini API Key (AIza...)"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="flex-1 bg-[#080808] border border-[#1a1a1a] focus:border-[#FF6B35]/40 rounded-sm px-2 py-1 font-mono text-[11px] text-[#e0e0e0] placeholder-[#252525] outline-none transition-colors"
          />
          <button
            onClick={handleSaveApiKey}
            className="font-ui text-[11px] font-bold tracking-widest px-3 py-1 rounded-sm bg-[#FF6B35] text-[#080808] hover:bg-[#ff8050] transition-colors"
          >
            SAVE
          </button>
          <button
            onClick={() => setShowSettings(false)}
            className="font-mono text-[10px] text-[#2a2a2a] hover:text-[#888] transition-colors px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Reel info strip */}
      {reelData && <ReelInfoPanel reel={reelData} />}

      {/* Restored banner */}
      {restoredFrom && (
        <div className="flex items-center justify-between px-3 py-1 bg-[#0c0c0c] border-b border-[#141414]">
          <span className="font-mono text-[10px] text-[#2a2a2a]">
            restored · <span style={{ color: '#FF6B35' }}>@{restoredFrom}</span>
          </span>
          <button onClick={() => setRestoredFrom(null)} className="font-mono text-[9px] text-[#1e1e1e] hover:text-[#555] transition-colors">
            ✕
          </button>
        </div>
      )}

      {/* Action bar */}
      <ActionBar
        rankingMode={rankingMode}
        onModeChange={setRankingMode}
        onRerank={handleRerank}
        onAddComment={() => setShowAddModal(true)}
        onToggleSettings={() => setShowSettings((s) => !s)}
        onScrape={handleScrapeAndRank}
        isExporting={isExporting}
        onExport={async () => {
          if (!reelData || isExporting) return
          setIsExporting(true)
          await exportReelVideo(reelData, comments).catch(console.error)
          setIsExporting(false)
        }}
        onGoHome={() => setPhase("idle")}
        onDelete={async () => {
          if (reelData) await deleteSession(reelData.reelUrl).catch(console.error)
          setReelData(null)
          setComments([])
          setPhase("idle")
        }}
      />

      {/* Error bar */}
      {phase === "error" && (
        <div className="mx-3 mt-2 px-3 py-2 border border-[#FF1744]/20 rounded-sm bg-[#FF1744]/5">
          <p className="font-mono text-[10px] text-[#FF1744]/70">{errorMsg}</p>
        </div>
      )}

      {/* Tier board — full width */}
      <div id="tier-board-export-root" className="flex-1 overflow-y-auto">
        <TierBoard comments={comments} onCommentsChange={setComments} />
      </div>

      {showAddModal && (
        <AddCommentModal onAdd={handleAddComment} onClose={() => setShowAddModal(false)} />
      )}
    </div>
  )
}
