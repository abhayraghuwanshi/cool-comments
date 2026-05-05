import { useState, useCallback, useEffect, useRef } from "react"
import type { ReelData, RankedComment, RankingMode, Tier } from "../shared/messages"
import { useScraper } from "./hooks/useScraper"
import { useRanker } from "./hooks/useRanker"
import { saveSession, loadLastSession, deleteSession, saveAudio, loadAudio, deleteAudio, type SavedSession } from "./lib/db"
import { exportReelVideo, exportOverlayVideo } from "./lib/exportReel"
import { generateAllTierAudio, blobsToUrls, revokeTierAudio } from "./lib/tts"
import { useScriptGenerator } from "./hooks/useScriptGenerator"
import { TtsPanel } from "./components/TtsPanel"
import { ScriptPanel } from "./components/ScriptPanel"
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
  const [openAiApiKey, setOpenAiApiKey] = useState("")
  const [currentScript, setCurrentScript] = useState<import("./lib/ttsScript").TierScript[] | null>(null)
  const [isGeneratingScript, setIsGeneratingScript] = useState(false)
  const [showScriptPanel, setShowScriptPanel] = useState(false)
  const [ttsAudio, setTtsAudio] = useState<Map<Tier, string> | null>(null)
  const [isGeneratingVoice, setIsGeneratingVoice] = useState(false)
  const [ttsProgress, setTtsProgress] = useState({ done: 0, total: 0 })
  const [showTtsPanel, setShowTtsPanel] = useState(false)
  const [restoredFrom, setRestoredFrom] = useState<string | null>(null)
  const [pendingScrape, setPendingScrape] = useState<{ reel: import("../shared/messages").ReelData; comments: import("../shared/messages").RawComment[] } | null>(null)

  const { scrape } = useScraper()
  const { rank } = useRanker()
  const { generateScript } = useScriptGenerator()

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

  // Load API keys from storage on mount
  useEffect(() => {
    chrome.storage.local.get(["apiKey", "openAiApiKey"]).then((stored) => {
      if (stored.apiKey) setApiKey(stored.apiKey)
      if (stored.openAiApiKey) setOpenAiApiKey(stored.openAiApiKey)
    })
  }, [])

  // Restore last session on mount (including saved audio)
  useEffect(() => {
    loadLastSession().then(async (s) => {
      if (!s) return
      setReelData(s.reelData)
      setComments(s.comments)
      setRankingMode(s.rankingMode)
      setPhase("ready")
      setRestoredFrom(s.reelData.username)
      const blobs = await loadAudio(s.reelData.reelUrl).catch(() => null)
      if (blobs && blobs.size > 0) setTtsAudio(blobsToUrls(blobs))
    }).catch(console.error)
  }, [])

  // All useCallbacks must be before any conditional returns
  const handleRestoreSession = useCallback((session: SavedSession) => {
    setReelData(session.reelData)
    setComments(session.comments)
    setRankingMode(session.rankingMode)
    setRestoredFrom(session.reelData.username)
    setPhase("ready")
    setCurrentScript(null)
    setShowScriptPanel(false)
    if (ttsAudio) revokeTierAudio(ttsAudio)
    setTtsAudio(null)
    setShowTtsPanel(false)
    loadAudio(session.reelData.reelUrl).then((blobs) => {
      if (blobs && blobs.size > 0) setTtsAudio(blobsToUrls(blobs))
    }).catch(console.error)
  }, [ttsAudio])

  const handleScrapeAndRank = useCallback(async () => {
    setPhase("scraping")
    setErrorMsg("")
    setRestoredFrom(null)
    // Clear stale script and audio from previous reel
    setCurrentScript(null)
    setShowScriptPanel(false)
    if (ttsAudio) revokeTierAudio(ttsAudio)
    setTtsAudio(null)
    setShowTtsPanel(false)

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
  }, [scrape, rankingMode, ttsAudio])

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
    // Tiers changed — old script is stale
    setCurrentScript(null)
    setShowScriptPanel(false)
    setPhase("ready")
  }, [reelData, comments, rank, rankingMode])

  const handleSaveApiKey = useCallback(async () => {
    await chrome.storage.local.set({ apiKey, openAiApiKey })
    setShowSettings(false)
  }, [apiKey, openAiApiKey])

  // Step 1 — generate script via Gemini (visible to user before TTS)
  const handleGenerateScript = useCallback(async () => {
    if (!comments.length) return
    setIsGeneratingScript(true)
    setCurrentScript(null)

    const result = await generateScript(reelData!, comments, rankingMode)

    if ("error" in result || !("scripts" in result) || result.scripts.length === 0) {
      setPhase("error")
      setErrorMsg("Script generation failed. Check your Gemini API key and try again.")
      setIsGeneratingScript(false)
      return
    }

    setCurrentScript(result.scripts)
    setShowScriptPanel(true)
    setShowTtsPanel(false)
    setIsGeneratingScript(false)
  }, [comments, reelData, rankingMode, generateScript])

  const handleScriptButton = useCallback(() => {
    if (currentScript) {
      setShowScriptPanel((s) => !s)
    } else {
      handleGenerateScript()
    }
  }, [currentScript, handleGenerateScript])

  // Step 2 — TTS from current script (OpenAI)
  const handleGenerateVoice = useCallback(async () => {
    if (!currentScript || !openAiApiKey) {
      if (!openAiApiKey) setShowSettings(true)
      return
    }
    setIsGeneratingVoice(true)
    setTtsProgress({ done: 0, total: currentScript.length })
    if (ttsAudio) revokeTierAudio(ttsAudio)

    try {
      const blobs = await generateAllTierAudio(currentScript, openAiApiKey, (done, total) => {
        setTtsProgress({ done, total })
      })
      if (reelData) await saveAudio(reelData.reelUrl, blobs).catch(console.error)
      if (ttsAudio) revokeTierAudio(ttsAudio)
      setTtsAudio(blobsToUrls(blobs))
      setShowTtsPanel(true)
      setShowScriptPanel(false)
    } catch (err) {
      console.error("TTS generation failed:", err)
    } finally {
      setIsGeneratingVoice(false)
    }
  }, [currentScript, openAiApiKey, ttsAudio, reelData])

  const handleVoiceButton = useCallback(() => {
    if (ttsAudio && ttsAudio.size > 0) {
      setShowTtsPanel((s) => !s)
    } else {
      handleGenerateVoice()
    }
  }, [ttsAudio, handleGenerateVoice])

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
        onToggleSettings={() => setShowSettings((s) => !s)}
        apiKey={apiKey}
        onApiKeyChange={setApiKey}
        openAiApiKey={openAiApiKey}
        onOpenAiApiKeyChange={setOpenAiApiKey}
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
        <div className="bg-[#0c0c0c] border-b border-[#141414] px-3 py-2 flex flex-col gap-1.5">
          <div className="flex gap-2 items-center">
            <span className="font-mono text-[9px] text-[#555] w-14 shrink-0">Gemini</span>
            <input
              type="password"
              placeholder="AIza..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="flex-1 bg-[#080808] border border-[#1a1a1a] focus:border-[#FF6B35]/40 rounded-sm px-2 py-1 font-mono text-[11px] text-[#e0e0e0] placeholder-[#252525] outline-none transition-colors"
            />
          </div>
          <div className="flex gap-2 items-center">
            <span className="font-mono text-[9px] text-[#555] w-14 shrink-0">OpenAI</span>
            <input
              type="password"
              placeholder="sk-..."
              value={openAiApiKey}
              onChange={(e) => setOpenAiApiKey(e.target.value)}
              className="flex-1 bg-[#080808] border border-[#1a1a1a] focus:border-[#FF6B35]/40 rounded-sm px-2 py-1 font-mono text-[11px] text-[#e0e0e0] placeholder-[#252525] outline-none transition-colors"
            />
          </div>
          <div className="flex gap-2 justify-end">
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
        </div>
      )}

      {/* Reel info strip */}
      {reelData && (
        <ReelInfoPanel
          reel={reelData}
          onUsernameChange={(username) => setReelData((r) => r ? { ...r, username } : r)}
        />
      )}

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
        onScriptButton={handleScriptButton}
        onVoiceButton={handleVoiceButton}
        isExporting={isExporting}
        isGeneratingScript={isGeneratingScript}
        isGeneratingVoice={isGeneratingVoice}
        ttsProgress={ttsProgress}
        hasScript={currentScript !== null && currentScript.length > 0}
        hasVoice={ttsAudio !== null && ttsAudio.size > 0}
        showScriptPanel={showScriptPanel}
        showVoicePanel={showTtsPanel}
        onExport={async () => {
          if (!reelData || isExporting) return
          setIsExporting(true)
          await exportReelVideo(reelData, comments).catch(console.error)
          setIsExporting(false)
        }}
        onExportOverlay={async () => {
          if (isExporting) return
          setIsExporting(true)
          await exportOverlayVideo(comments).catch(console.error)
          setIsExporting(false)
        }}
        onGoHome={() => setPhase("idle")}
        onDelete={async () => {
          if (reelData) {
            await deleteSession(reelData.reelUrl).catch(console.error)
            await deleteAudio(reelData.reelUrl).catch(console.error)
          }
          if (ttsAudio) revokeTierAudio(ttsAudio)
          setTtsAudio(null)
          setShowTtsPanel(false)
          setReelData(null)
          setComments([])
          setPhase("idle")
        }}
      />

      {/* Script panel */}
      {showScriptPanel && currentScript && currentScript.length > 0 && (
        <ScriptPanel
          scripts={currentScript}
          onRegenerate={handleGenerateScript}
          onGenerateVoice={handleGenerateVoice}
          onClose={() => setShowScriptPanel(false)}
          isGeneratingVoice={isGeneratingVoice}
          hasVoice={ttsAudio !== null && ttsAudio.size > 0}
        />
      )}

      {/* Voice panel */}
      {showTtsPanel && ttsAudio && ttsAudio.size > 0 && (
        <TtsPanel
          audioMap={ttsAudio}
          onRegenerate={handleGenerateVoice}
          onClose={() => setShowTtsPanel(false)}
          isGenerating={isGeneratingVoice}
          ttsProgress={ttsProgress}
        />
      )}

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
