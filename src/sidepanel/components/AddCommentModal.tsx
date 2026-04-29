import { useState } from "react"

interface Props {
  onAdd: (text: string) => void
  onClose: () => void
}

export function AddCommentModal({ onAdd, onClose }: Props) {
  const [text, setText] = useState("")

  const handleSubmit = () => {
    const t = text.trim()
    if (!t) return
    onAdd(t)
    setText("")
  }

  return (
    <div className="fixed inset-0 bg-[#080808]/80 flex items-end z-50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full bg-[#0e0e0e] border-t border-[#1e1e1e] p-4 flex flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="font-ui text-[12px] font-bold tracking-widest text-[#444] uppercase">Add Comment</p>
          <button onClick={onClose} className="font-mono text-[10px] text-[#2a2a2a] hover:text-[#888] transition-colors">ESC</button>
        </div>

        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="type your comment..."
          rows={3}
          className="w-full bg-[#080808] border border-[#1a1a1a] focus:border-[#FF6B35]/40 rounded-sm px-3 py-2 font-mono text-[12px] text-[#c0c0c0] placeholder-[#222] outline-none resize-none transition-colors"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSubmit()
            if (e.key === "Escape") onClose()
          }}
        />

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="font-ui text-[11px] font-bold tracking-widest px-4 py-1.5 rounded-sm bg-[#111] border border-[#1e1e1e] text-[#333] hover:text-[#888] transition-colors"
          >
            CANCEL
          </button>
          <button
            onClick={handleSubmit}
            disabled={!text.trim()}
            className="font-ui text-[11px] font-bold tracking-widest px-4 py-1.5 rounded-sm bg-[#FF6B35] text-[#080808] hover:bg-[#ff8050] disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
          >
            ADD TO C →
          </button>
        </div>
      </div>
    </div>
  )
}
