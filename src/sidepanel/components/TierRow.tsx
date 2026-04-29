import { useDroppable } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import type { RankedComment, Tier } from "../../shared/messages"
import { CommentCard } from "./CommentCard"

const TIER_COLORS: Record<Tier, string> = {
  S: "bg-[#ff7f00]",
  A: "bg-[#00c853]",
  B: "bg-[#2979ff]",
  C: "bg-[#aa00ff]",
  D: "bg-[#ff6d00]",
  F: "bg-[#d50000]",
}

interface Props {
  tier: Tier
  comments: RankedComment[]
  onLock: (id: string) => void
  onDelete: (id: string) => void
}

export function TierRow({ tier, comments, onLock, onDelete }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: tier })

  return (
    <div
      ref={setNodeRef}
      className={`flex gap-0 min-h-[52px] rounded transition-colors ${isOver ? "bg-[#1e1e1e]" : "bg-[#141414]"}`}
    >
      <div
        className={`w-10 shrink-0 flex items-center justify-center font-black text-lg text-white rounded-l ${TIER_COLORS[tier]}`}
      >
        {tier}
      </div>

      <SortableContext items={comments.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div className="flex-1 flex flex-col gap-1 p-1 min-h-[52px]">
          {comments.map((comment) => (
            <CommentCard
              key={comment.id}
              comment={comment}
              onLock={onLock}
              onDelete={onDelete}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  )
}
