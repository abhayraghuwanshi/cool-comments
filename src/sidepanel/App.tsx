import { useState, useCallback } from "react"
import type { ReelData, RankedComment, RankingMode } from "../shared/messages"
import { useScraper } from "./hooks/useScraper"
import { useRanker } from "./hooks/useRanker"
import { ReelInfoPanel } from "./components/ReelInfoPanel"
import { TierBoard } from "./components/TierBoard"
import { ActionBar } from "./components/ActionBar"
import { LoadingState } from "./components/LoadingState"
import { EmptyState } from "./components/EmptyState"
import { AddCommentModal } from "./components/AddCommentModal"

type Phase = "idle" | "scraping" | "ranking" | "ready" | "error"

export default function App() {
  const [phase, setPhase] = useState<Phase>("idle")
  const [errorMsg, setErrorMsg] = useState("")
  const [reelData, setReelData] = useState<ReelData | null>(null)
  const [comments, setComments] = useState<RankedComment[]>([])
  const [rankingMode, setRankingMode] = useState<RankingMode>("default")
  const [showAddModal, setShowAddModal] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [apiKey, setApiKey] = useState("")

  const { scrape } = useScraper()
  const { rank } = useRanker()

  const handleScrapeAndRank = useCallback(async () => {
    setPhase("scraping")
    setErrorMsg("")

    const scrapeResult = await scrape()
    if ("error" in scrapeResult) {
      if (scrapeResult.error === "NOT_ON_REEL_PAGE") {
        setPhase("idle")
      } else {
        setPhase("error")
        setErrorMsg(scrapeResult.error)
      }
      return
    }

    setReelData(scrapeResult.reel)
    setPhase("ranking")

    const rankResult = await rank(scrapeResult.reel, scrapeResult.comments, rankingMode)
    if ("error" in rankResult) {
      if (rankResult.error === "NO_API_KEY") {
        setShowSettings(true)
        setPhase("error")
        setErrorMsg("Please enter your Gemini API key in settings.")
      } else {
        setPhase("error")
        setErrorMsg(rankResult.error)
      }
      return
    }

    setComments(rankResult.comments)
    setPhase("ready")
  }, [scrape, rank, rankingMode])

  const handleRerank = useCallback(async () => {
    if (!reelData) return
    setPhase("ranking")
    const raw = comments.map(({ tier: _t, locked: _l, ...rest }) => rest)
    const rankResult = await rank(reelData, raw, rankingMode)
    if ("error" in rankResult) {
      setPhase("error")
      setErrorMsg(rankResult.error)
      return
    }
    setComments((prev) =>
      rankResult.comments.map((rc) => {
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
    const newComment: RankedComment = {
      id: `manual-${Date.now()}`,
      username: "you",
      text,
      likesCount: "0",
      tier: "C",
      locked: false,
    }
    setComments((prev) => [...prev, newComment])
    setShowAddModal(false)
  }, [])

  if (phase === "scraping") return <LoadingState message="Scraping reel..." />
  if (phase === "ranking") return <LoadingState message="AI is ranking comments..." />

  if (phase === "idle" || (phase === "error" && !reelData)) {
    return (
      <EmptyState
        error={phase === "error" ? errorMsg : undefined}
        showSettings={showSettings}
        apiKey={apiKey}
        onApiKeyChange={setApiKey}
        onSaveApiKey={handleSaveApiKey}
        onScrape={handleScrapeAndRank}
      />
    )
  }

  return (
    <div className="flex flex-col h-screen bg-[#0f0f0f] overflow-hidden">
      {showSettings && (
        <div className="bg-[#1a1a1a] border-b border-[#333] p-3 flex gap-2 items-center">
          <input
            type="password"
            placeholder="Gemini API Key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="flex-1 bg-[#0f0f0f] border border-[#444] rounded px-2 py-1 text-sm text-white placeholder-gray-500 outline-none focus:border-orange-500"
          />
          <button
            onClick={handleSaveApiKey}
            className="px-3 py-1 bg-orange-500 text-white text-sm rounded hover:bg-orange-600"
          >
            Save
          </button>
          <button
            onClick={() => setShowSettings(false)}
            className="text-gray-400 hover:text-white text-sm px-1"
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {reelData && (
          <div className="w-44 shrink-0 overflow-y-auto border-r border-[#222]">
            <ReelInfoPanel reel={reelData} />
          </div>
        )}

        <div className="flex-1 flex flex-col overflow-hidden">
          <ActionBar
            rankingMode={rankingMode}
            onModeChange={setRankingMode}
            onRerank={handleRerank}
            onAddComment={() => setShowAddModal(true)}
            onToggleSettings={() => setShowSettings((s) => !s)}
            onScrape={handleScrapeAndRank}
          />

          {phase === "error" && (
            <div className="mx-3 mt-2 p-2 bg-red-900/30 border border-red-700 rounded text-red-300 text-xs">
              {errorMsg}
            </div>
          )}

          <div id="tier-board-export-root" className="flex-1 overflow-y-auto">
            <TierBoard comments={comments} onCommentsChange={setComments} />
          </div>
        </div>
      </div>

      {showAddModal && (
        <AddCommentModal
          onAdd={handleAddComment}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  )
}
