import { useDroppable } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import type { RankedComment, Tier } from "../../shared/messages"
import { CommentCard } from "./CommentCard"

const TIER_COLOR: Record<Tier, string> = {
  S: '#FF6B35',
  A: '#39FF14',
  B: '#00B4FF',
  C: '#CC44FF',
  D: '#FFB300',
  F: '#FF1744',
  DRAFT: '#4a4a4a',
  GIF: '#FFD700',
}

interface Props {
  tier: Tier
  comments: RankedComment[]
  globalOffset: number
  isDraft?: boolean
  customLabel?: string
  deleteTitle?: string
  onLock: (id: string) => void
  onDelete: (id: string) => void
}

export function TierRow({ tier, comments, globalOffset, isDraft, customLabel, deleteTitle, onLock, onDelete }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: tier })
  const color = TIER_COLOR[tier]

  return (
    <div
      className="border-b border-[#1a1a1a] transition-colors duration-150"
      style={{ background: isOver ? `${color}08` : 'transparent' }}
    >
      {/* Tier header */}
      {isDraft ? (
        <div className="flex items-center gap-3 px-3 pt-3 pb-1">
          <span
            className="font-mono text-[11px] font-bold tracking-[0.25em] uppercase select-none"
            style={{ color: '#555' }}
          >
            ↓ DRAFT
          </span>
          <div className="flex-1 flex items-center gap-2 overflow-hidden">
            <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, #33333360, transparent)' }} />
            <span className="font-mono text-[10px] text-[#444] shrink-0 tabular-nums">
              {comments.length > 0 ? comments.length : '—'}
            </span>
          </div>
        </div>
      ) : customLabel ? (
        <div className="flex items-center gap-3 px-3 pt-3 pb-1">
          <span
            className="font-mono text-[12px] font-bold tracking-[0.2em] uppercase select-none"
            style={{ color: '#888' }}
          >
            {customLabel}
          </span>
          <div className="flex-1 flex items-center gap-2 overflow-hidden">
            <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, #44444460, transparent)' }} />
            <span className="font-mono text-[10px] text-[#555] shrink-0 tabular-nums">
              {comments.length > 0 ? comments.length : '—'}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 px-3 pt-2.5 pb-1">
          <span
            className="leading-none select-none"
            style={{
              fontSize: 48,
              fontFamily: '"Bebas Neue", Impact, "Arial Narrow", Arial, sans-serif',
              color,
              lineHeight: 1,
            }}
          >
            {tier}
          </span>
          <div className="flex-1 flex items-center gap-2 overflow-hidden">
            <div
              className="flex-1 h-px"
              style={{ background: `linear-gradient(to right, ${color}60, transparent)` }}
            />
            <span className="font-mono text-[10px] text-[#555] shrink-0 tabular-nums">
              {comments.length > 0 ? comments.length : '—'}
            </span>
          </div>
        </div>
      )}

      {/* Comments */}
      <div ref={setNodeRef} className="px-3 pb-2.5 flex flex-col gap-1.5" style={{ minHeight: 36 }}>
        <SortableContext items={comments.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {comments.map((comment, i) => (
            <CommentCard
              key={comment.id}
              comment={comment}
              tierColor={color}
              index={globalOffset + i}
              deleteTitle={deleteTitle}
              onLock={onLock}
              onDelete={onDelete}
            />
          ))}
        </SortableContext>

        {comments.length === 0 && (
          <div
            className="flex items-center justify-center rounded-sm"
            style={{ height: 28, border: `1px dashed ${color}30` }}
          >
            <span className="font-mono text-[9px] tracking-[0.2em] uppercase" style={{ color: `${color}50` }}>
              drop here
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
