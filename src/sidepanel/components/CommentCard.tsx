import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import type { RankedComment } from "../../shared/messages"

interface Props {
  comment: RankedComment
  isDragging?: boolean
  onLock: (id: string) => void
  onDelete: (id: string) => void
}

export function CommentCard({ comment, isDragging = false, onLock, onDelete }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isSortableDragging } =
    useSortable({
      id: comment.id,
      disabled: comment.locked,
    })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.3 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={isDragging ? {} : style}
      className={`group flex items-start gap-1.5 bg-[#1e1e1e] rounded px-2 py-1.5 text-xs cursor-grab active:cursor-grabbing
        border border-transparent hover:border-[#333] transition-colors
        ${comment.locked ? "border-[#333] cursor-default" : ""}
        ${isDragging ? "shadow-lg shadow-black/50 rotate-1" : ""}
      `}
      {...(comment.locked ? {} : { ...attributes, ...listeners })}
    >
      <div className="flex-1 min-w-0">
        <span className="text-orange-400 font-semibold mr-1">@{comment.username}</span>
        <span className="text-gray-200 break-words">{comment.text}</span>
        {comment.likesCount && comment.likesCount !== "0" && (
          <span className="ml-1 text-gray-500">❤️{comment.likesCount}</span>
        )}
      </div>

      <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onLock(comment.id)}
          title={comment.locked ? "Unlock" : "Lock"}
          className="text-gray-500 hover:text-white p-0.5"
        >
          {comment.locked ? "📌" : "🔓"}
        </button>
        <button
          onClick={() => onDelete(comment.id)}
          title="Delete"
          className="text-gray-500 hover:text-red-400 p-0.5"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
