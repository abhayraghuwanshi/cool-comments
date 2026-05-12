import { useState } from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import type { RankedComment, Tier } from "../../shared/messages"

const TIER_COLOR: Record<Tier, string> = {
  S: '#FF6B35', A: '#39FF14', B: '#00B4FF',
  C: '#CC44FF', D: '#FFB300', F: '#FF1744',
  DRAFT: '#4a4a4a', GIF: '#FFD700',
}
const ALL_MOVE_TIERS: Tier[] = ["S", "A", "B", "C", "D", "F", "DRAFT"]
const LIST_MOVE_TIERS: Tier[] = ["A", "GIF", "DRAFT"]

// Label shown on the tier button in the picker
function tierLabel(t: Tier, isListMode: boolean) {
  if (t === "DRAFT") return "↓ draft"
  if (t === "GIF")   return "gif"
  if (t === "A" && isListMode) return "list"
  return t
}

interface Props {
  comment: RankedComment
  tierColor: string
  index: number
  isDragging?: boolean
  deleteTitle?: string
  isListMode?: boolean
  onLock: (id: string) => void
  onDelete: (id: string) => void
  onMoveTo?: (id: string, tier: Tier) => void
}

export function CommentCard({ comment, tierColor, index, isDragging = false, deleteTitle = "Move to Draft", isListMode = false, onLock, onDelete, onMoveTo }: Props) {
  const [copied, setCopied] = useState(false)
  const [showMover, setShowMover] = useState(false)

  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation()
    navigator.clipboard.writeText(comment.gifUrl ?? comment.text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  const {
    attributes, listeners, setNodeRef,
    transform, transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: comment.id, disabled: comment.locked })

  const cardStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.15 : 1,
    borderLeftColor: tierColor,
    '--card-delay': `${Math.min(index * 32, 650)}ms`,
  } as React.CSSProperties

  return (
    <div
      ref={setNodeRef}
      style={isDragging ? { borderLeftColor: tierColor } : cardStyle}
      className={[
        "card-animate group relative",
        "pl-3 pr-2 py-2.5",
        "border-l-[3px] rounded-sm",
        "bg-[#181818] hover:bg-[#1e1e1e]",
        "border border-[#262626] border-l-0",
        "transition-colors duration-100",
        comment.locked ? "cursor-default" : "cursor-grab active:cursor-grabbing",
        isDragging ? "shadow-2xl rotate-[0.4deg]" : "",
      ].join(" ")}
      {...(comment.locked ? {} : { ...attributes, ...listeners })}
    >
      {/* Username + likes row */}
      <div className="flex items-center justify-between gap-2 mb-1" style={{ minHeight: 16 }}>
        <span className="font-mono text-[11px] font-bold text-[#FF6B35] min-w-0 flex-1" style={{ display: 'block', lineHeight: '1.4', wordBreak: 'break-all' }}>
          {comment.locked && <span className="mr-1 text-[#888]">⚓</span>}
          @{comment.username || "unknown"}
        </span>
        {comment.likesCount && comment.likesCount !== "0" && (
          <span className="font-mono text-[10px] text-[#666] shrink-0 ml-2">
            ♥ {comment.likesCount}
          </span>
        )}
      </div>

      {/* GIF image or comment text */}
      {comment.gifUrl ? (
        /\.(mp4|webm|mov)(\?|#|$)/i.test(comment.gifUrl) ? (
          <video
            src={comment.gifUrl}
            autoPlay loop muted playsInline
            className="rounded-sm mt-1 max-w-full"
            style={{ maxHeight: 180, objectFit: "contain", display: "block" }}
            onPointerDown={(e) => e.stopPropagation()}
            onError={(e) => { (e.target as HTMLVideoElement).style.display = "none" }}
          />
        ) : (
          <img
            src={comment.gifUrl}
            alt="GIF"
            className="rounded-sm mt-1 max-w-full"
            style={{ maxHeight: 180, objectFit: "contain", display: "block" }}
            onPointerDown={(e) => e.stopPropagation()}
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
          />
        )
      ) : (
        <p className="font-mono text-[12.5px] text-[#d0d0d0] leading-[1.55] break-words">
          {comment.text}
        </p>
      )}

      {/* Bottom actions row — single move button */}
      {!comment.locked && onMoveTo && (
        <div className="flex items-center justify-end gap-1 mt-1.5" onPointerDown={(e) => e.stopPropagation()}>
          {showMover ? (
            <>
              {(isListMode ? LIST_MOVE_TIERS : ALL_MOVE_TIERS)
                .filter(t => t !== comment.tier)
                .map(t => (
                  <button
                    key={t}
                    onClick={(e) => { e.stopPropagation(); onMoveTo(comment.id, t); setShowMover(false) }}
                    className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded transition-colors hover:opacity-80"
                    style={{ color: TIER_COLOR[t], background: `${TIER_COLOR[t]}18`, border: `1px solid ${TIER_COLOR[t]}40` }}
                  >
                    {tierLabel(t, isListMode)}
                  </button>
                ))}
              <button
                onClick={(e) => { e.stopPropagation(); setShowMover(false) }}
                className="font-mono text-[9px] text-[#444] hover:text-[#888] px-1 py-0.5 rounded transition-colors"
              >
                ✕
              </button>
            </>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); setShowMover(true) }}
              title="Move to section"
              className="font-mono text-[9px] text-[#555] hover:text-[#aaa] transition-colors px-1 py-0.5 rounded hover:bg-[#222]"
            >
              → move
            </button>
          )}
        </div>
      )}

      {/* Hover actions */}
      <div className="absolute right-1.5 top-1.5 hidden group-hover:flex gap-0.5">
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={handleCopy}
          title="Copy comment"
          className="w-5 h-5 flex items-center justify-center rounded-sm bg-[#252525] hover:bg-[#333] font-mono text-[9px] text-[#888] hover:text-white transition-colors"
        >
          {copied ? "✓" : "⎘"}
        </button>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onLock(comment.id) }}
          title={comment.locked ? "Unlock" : "Lock"}
          className="w-5 h-5 flex items-center justify-center rounded-sm bg-[#252525] hover:bg-[#333] font-mono text-[9px] text-[#888] hover:text-white transition-colors"
        >
          {comment.locked ? "↑" : "⚓"}
        </button>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onDelete(comment.id) }}
          title={deleteTitle}
          className="w-5 h-5 flex items-center justify-center rounded-sm bg-[#252525] hover:bg-red-950 font-mono text-[9px] text-[#888] hover:text-red-400 transition-colors"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
