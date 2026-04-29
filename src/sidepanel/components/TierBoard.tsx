import { useState } from "react"
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core"
import { arrayMove } from "@dnd-kit/sortable"
import type { RankedComment, Tier } from "../../shared/messages"
import { TierRow } from "./TierRow"
import { CommentCard } from "./CommentCard"

const TIERS: Tier[] = ["S", "A", "B", "C", "D", "F"]

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

    const isTierLabel = (TIERS as string[]).includes(overId)
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
        const otherComments = comments.filter((c) => c.tier !== dragged.tier)
        const tierOrder = TIERS.indexOf(dragged.tier)
        const before = otherComments.filter((c) => TIERS.indexOf(c.tier) < tierOrder)
        const after = otherComments.filter((c) => TIERS.indexOf(c.tier) >= tierOrder)
        onCommentsChange([...before, ...reordered, ...after])
      }
    }
  }

  const handleLock = (id: string) => {
    onCommentsChange(comments.map((c) => (c.id === id ? { ...c, locked: !c.locked } : c)))
  }

  const handleDelete = (id: string) => {
    onCommentsChange(comments.filter((c) => c.id !== id))
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col gap-0.5 p-2">
        {TIERS.map((tier) => (
          <TierRow
            key={tier}
            tier={tier}
            comments={comments.filter((c) => c.tier === tier)}
            onLock={handleLock}
            onDelete={handleDelete}
          />
        ))}
      </div>

      <DragOverlay>
        {activeComment ? (
          <CommentCard comment={activeComment} isDragging onLock={() => {}} onDelete={() => {}} />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
