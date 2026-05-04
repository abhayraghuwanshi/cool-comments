import { useState, useRef, useEffect } from "react"
import type { ReelData } from "../../shared/messages"

interface Props {
  reel: ReelData
  onUsernameChange: (username: string) => void
}

export function ReelInfoPanel({ reel, onUsernameChange }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(reel.username)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setDraft(reel.username)
  }, [reel.username])

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  function commit() {
    const trimmed = draft.trim().replace(/^@/, "")
    if (trimmed && trimmed !== reel.username) onUsernameChange(trimmed)
    else setDraft(reel.username)
    setEditing(false)
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 border-b border-[#222] bg-[#141414]">
      {/* Profile pic */}
      {reel.profilePicUrl ? (
        <img
          src={reel.profilePicUrl}
          alt=""
          className="w-8 h-8 rounded-full object-cover shrink-0"
          style={{ border: "1px solid #333" }}
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-[#2a2a2a] shrink-0 flex items-center justify-center font-display text-[13px] text-[#555]">
          {reel.username?.[0]?.toUpperCase() ?? "?"}
        </div>
      )}

      {/* Username + caption */}
      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="flex items-center gap-1">
            <span className="font-ui text-[14px] font-bold text-[#FF6B35]">@</span>
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit()
                if (e.key === "Escape") { setDraft(reel.username); setEditing(false) }
              }}
              className="flex-1 bg-transparent border-b border-[#FF6B35]/60 font-ui text-[14px] font-bold text-white outline-none pb-px min-w-0"
              spellCheck={false}
            />
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            title="Click to edit username"
            className="group flex items-center gap-1 text-left max-w-full"
          >
            <p className="font-ui text-[14px] font-bold text-white leading-tight truncate group-hover:text-[#FF6B35] transition-colors">
              {reel.username ? `@${reel.username}` : "Unknown reel"}
            </p>
            <span className="font-mono text-[9px] text-[#333] group-hover:text-[#FF6B35]/60 transition-colors shrink-0">✎</span>
          </button>
        )}
        {reel.caption && (
          <p className="font-mono text-[10px] text-[#555] truncate mt-0.5 leading-none">
            {reel.caption}
          </p>
        )}
      </div>

      {/* Stats + link */}
      <div className="flex items-center gap-2.5 shrink-0">
        {reel.likesCount && (
          <span className="font-mono text-[10px] text-[#666]">♥ {reel.likesCount}</span>
        )}
        <a
          href={reel.reelUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-[12px] text-[#555] hover:text-white transition-colors"
          title="Open reel"
        >
          ↗
        </a>
      </div>
    </div>
  )
}
