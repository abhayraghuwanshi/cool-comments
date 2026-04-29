import { useState } from "react"

interface Props {
  onAdd: (text: string) => void
  onClose: () => void
}

export function AddCommentModal({ onAdd, onClose }: Props) {
  const [text, setText] = useState("")

  const handleSubmit = () => {
    const trimmed = text.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setText("")
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end z-50" onClick={onClose}>
      <div
        className="w-full bg-[#1a1a1a] border-t border-[#333] p-4 flex flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-semibold text-white">Add a comment</p>
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type your meme comment..."
          rows={3}
          className="w-full bg-[#0f0f0f] border border-[#444] rounded px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-orange-500 resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSubmit()
            if (e.key === "Escape") onClose()
          }}
        />
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#222] text-gray-400 hover:text-white rounded text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!text.trim()}
            className="px-4 py-1.5 bg-orange-500 text-white rounded text-sm hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Add to C tier
          </button>
        </div>
      </div>
    </div>
  )
}
