import { useState } from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import type { RankedComment } from "../../shared/messages"

interface Props {
  comment: RankedComment
  tierColor: string
  index: number
  isDragging?: boolean
  deleteTitle?: string
  onLock: (id: string) => void
  onDelete: (id: string) => void
}

export function CommentCard({ comment, tierColor, index, isDragging = false, deleteTitle = "Move to Draft", onLock, onDelete }: Props) {
  const [copied, setCopied] = useState(false)

  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation()
    navigator.clipboard.writeText(comment.text).then(() => {
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

      {/* Comment text */}
      <p className="font-mono text-[12.5px] text-[#d0d0d0] leading-[1.55] break-words">
        {comment.text}
      </p>

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
