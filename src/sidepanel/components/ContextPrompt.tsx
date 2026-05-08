import { useState, useRef, useEffect } from "react"

interface Props {
  onSubmit: (context: string, minLikes: number) => void
  onSkip: () => void
  onBack: () => void
  isListMode?: boolean
}

export function ContextPrompt({ onSubmit, onSkip, onBack, isListMode }: Props) {
  const [text, setText] = useState("")
  const [minLikes, setMinLikes] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      onSubmit(text.trim(), minLikes)
    }
    if (e.key === "Escape") onSkip()
  }

  return (
    <div className="flex flex-col h-screen bg-[#0f0f0f] overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-5 pb-3 border-b border-[#222]">
        <div className="flex items-start justify-between">
          <div className="font-display leading-[0.9] mb-1.5">
            <span className="text-[44px] text-white">COOL </span>
            <span className="text-[44px]" style={{ color: "#FF6B35" }}>COMMENTS</span>
          </div>
          <button
            onClick={onBack}
            className="font-mono text-[10px] text-[#444] hover:text-[#aaa] transition-colors mt-1 px-2 py-1 rounded hover:bg-[#1a1a1a]"
          >
            ← back
          </button>
        </div>
        <p className="font-mono text-[10px] text-[#444] tracking-[0.15em] uppercase">
          scraping reel · add context to improve rankings
        </p>
      </div>

      {/* Context box */}
      <div className="flex-1 flex flex-col justify-end px-4 pb-4 gap-3">
        <div className="flex flex-col gap-2">
          <p className="font-ui text-[13px] font-semibold text-[#888]">
            {isListMode ? "Filter before showing" : "What's this reel about?"}
          </p>
          <p className="font-mono text-[10px] text-[#444] leading-relaxed">
            {isListMode
              ? "Set a min likes threshold to only keep top comments. Skip to show all."
              : <>Give the AI context so it ranks humor more accurately.<br />e.g. "guy flexing rented BMW" · "girl reacting to dad jokes" · "gym bro fails"</>
            }
          </p>
        </div>

        {/* Chat-style input box */}
        <div className="relative flex flex-col gap-2 bg-[#141414] border border-[#2a2a2a] rounded-lg p-3 focus-within:border-[#FF6B35]/50 transition-colors">

          {/* Min likes filter row */}
          <div className="flex items-center gap-2 pb-2 border-b border-[#222]">
            <span className="font-mono text-[10px] text-[#555]">♥ min likes</span>
            <input
              type="number"
              min={0}
              value={minLikes === 0 ? "" : minLikes}
              onChange={(e) => setMinLikes(Math.max(0, parseInt(e.target.value) || 0))}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder="0"
              className="w-16 bg-[#0f0f0f] border border-[#333] focus:border-[#FF6B35]/50 rounded-sm px-2 py-0.5 font-mono text-[11px] text-white outline-none text-center transition-colors"
            />
            <span className="font-mono text-[9px] text-[#333]">
              {minLikes > 0 ? `only comments with ≥ ${minLikes.toLocaleString()} likes` : "all comments"}
            </span>
          </div>

          {!isListMode && (
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe the reel in one line..."
              rows={3}
              className="w-full bg-transparent font-mono text-[13px] text-white placeholder-[#333] outline-none resize-none leading-relaxed"
            />
          )}
          <div className="flex items-center justify-between">
            <p className="font-mono text-[9px] text-[#333]">Enter to rank · Esc to skip</p>
            <div className="flex gap-2">
              <button
                onClick={onSkip}
                className="font-ui text-[11px] font-bold tracking-wider px-3 py-1.5 rounded-sm bg-[#1a1a1a] border border-[#2a2a2a] text-[#555] hover:text-[#aaa] transition-colors"
              >
                Skip →
              </button>
              <button
                onClick={() => onSubmit(text.trim(), minLikes)}
                className="font-ui text-[11px] font-bold tracking-wider px-3 py-1.5 rounded-sm bg-[#FF6B35] text-black hover:bg-[#ff8050] transition-colors"
              >
                Rank ↗
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
