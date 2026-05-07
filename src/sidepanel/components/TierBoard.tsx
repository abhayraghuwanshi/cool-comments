import { useState } from "react"
import {
  DndContext, DragOverlay, closestCenter,
  PointerSensor, useSensor, useSensors,
  type DragStartEvent, type DragEndEvent,
} from "@dnd-kit/core"
import { arrayMove } from "@dnd-kit/sortable"
import type { RankedComment, Tier } from "../../shared/messages"
import { TierRow } from "./TierRow"
import { CommentCard } from "./CommentCard"

const RANKED_TIERS: Tier[] = ["S", "A", "B", "C", "D", "F"]
const ALL_TIERS: Tier[] = [...RANKED_TIERS, "DRAFT"]

const TIER_COLOR: Record<Tier, string> = {
  S: '#FF6B35', A: '#39FF14', B: '#00B4FF',
  C: '#CC44FF', D: '#FFB300', F: '#FF1744',
  DRAFT: '#4a4a4a',
}

interface Props {
  comments: RankedComment[]
  onCommentsChange: (comments: RankedComment[]) => void
}

export function TierBoard({ comments, onCommentsChange }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const activeComment = activeId ? comments.find((c) => c.id === activeId) : null

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)
    if (!over) return

    const draggedId = active.id as string
    const overId = over.id as string
    const isTierLabel = (ALL_TIERS as string[]).includes(overId)
    const dragged = comments.find((c) => c.id === draggedId)
    if (!dragged || dragged.locked) return

    if (isTierLabel) {
      onCommentsChange(
        comments.map((c) => (c.id === draggedId ? { ...c, tier: overId as Tier } : c))
      )
    } else {
      const overComment = comments.find((c) => c.id === overId)
      if (!overComment) return

      if (dragged.tier !== overComment.tier) {
        onCommentsChange(
          comments.map((c) => (c.id === draggedId ? { ...c, tier: overComment.tier } : c))
        )
      } else {
        const tierComments = comments.filter((c) => c.tier === dragged.tier)
        const oldIndex = tierComments.findIndex((c) => c.id === draggedId)
        const newIndex = tierComments.findIndex((c) => c.id === overId)
        if (oldIndex === newIndex) return
        const reordered = arrayMove(tierComments, oldIndex, newIndex)
        const others = comments.filter((c) => c.tier !== dragged.tier)
        const tierIdx = ALL_TIERS.indexOf(dragged.tier)
        onCommentsChange([
          ...others.filter((c) => ALL_TIERS.indexOf(c.tier) < tierIdx),
          ...reordered,
          ...others.filter((c) => ALL_TIERS.indexOf(c.tier) >= tierIdx),
        ])
      }
    }
  }

  const handleLock = (id: string) =>
    onCommentsChange(comments.map((c) => (c.id === id ? { ...c, locked: !c.locked } : c)))

  // Moves to draft instead of deleting
  const handleArchive = (id: string) =>
    onCommentsChange(comments.map((c) => (c.id === id ? { ...c, tier: "DRAFT" as Tier, locked: false } : c)))

  // Permanently removes (only used in the Draft section)
  const handleDelete = (id: string) =>
    onCommentsChange(comments.filter((c) => c.id !== id))

  // Global offsets for stagger animation
  let offset = 0
  const tierOffsets: Record<Tier, number> = { S: 0, A: 0, B: 0, C: 0, D: 0, F: 0, DRAFT: 0 }
  for (const tier of ALL_TIERS) {
    tierOffsets[tier] = offset
    offset += comments.filter((c) => c.tier === tier).length
  }

  const draftComments = comments.filter((c) => c.tier === "DRAFT")

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col pb-6">
        {RANKED_TIERS.map((tier) => (
          <TierRow
            key={tier}
            tier={tier}
            comments={comments.filter((c) => c.tier === tier)}
            globalOffset={tierOffsets[tier]}
            deleteTitle="Move to Draft"
            onLock={handleLock}
            onDelete={handleArchive}
          />
        ))}

        {/* Draft section divider */}
        <div className="mx-3 mt-4 mb-0 flex items-center gap-2">
          <div className="flex-1 h-px bg-[#222]" />
        </div>

        <TierRow
          tier="DRAFT"
          comments={draftComments}
          globalOffset={tierOffsets["DRAFT"]}
          isDraft
          deleteTitle="Delete permanently"
          onLock={handleLock}
          onDelete={handleDelete}
        />
      </div>

      <DragOverlay dropAnimation={null}>
        {activeComment ? (
          <CommentCard
            comment={activeComment}
            tierColor={TIER_COLOR[activeComment.tier]}
            index={0}
            isDragging
            onLock={() => {}}
            onDelete={() => {}}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
