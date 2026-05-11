import { useState, useRef, useEffect } from "react"
import {
  DndContext, DragOverlay, closestCorners,
  PointerSensor, useSensor, useSensors,
  MeasuringStrategy,
  type DragStartEvent, type DragEndEvent, type DragMoveEvent,
} from "@dnd-kit/core"
import { arrayMove } from "@dnd-kit/sortable"
import type { RankedComment, RankingMode, Tier } from "../../shared/messages"
import { TierRow } from "./TierRow"
import { CommentCard } from "./CommentCard"
import { exportGif } from "../lib/exportGif"

const RANKED_TIERS: Tier[] = ["S", "A", "B", "C", "D", "F"]
const ALL_TIERS: Tier[] = [...RANKED_TIERS, "DRAFT", "GIF"]

const TIER_COLOR: Record<Tier, string> = {
  S: '#FF6B35', A: '#39FF14', B: '#00B4FF',
  C: '#CC44FF', D: '#FFB300', F: '#FF1744',
  DRAFT: '#4a4a4a', GIF: '#FFD700',
}

interface Props {
  comments: RankedComment[]
  onCommentsChange: (comments: RankedComment[]) => void
  rankingMode?: RankingMode
}

export function TierBoard({ comments, onCommentsChange, rankingMode }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [isExportingGif, setIsExportingGif] = useState(false)
  const isListMode = rankingMode === "scrape"

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const activeComment = activeId ? comments.find((c) => c.id === activeId) : null

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string)
  }

  const pointerYRef = useRef(0)
  const scrollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const track = (e: PointerEvent) => { pointerYRef.current = e.clientY }
    window.addEventListener("pointermove", track)
    return () => window.removeEventListener("pointermove", track)
  }, [])

  function stopScroll() {
    if (scrollTimerRef.current) { clearInterval(scrollTimerRef.current); scrollTimerRef.current = null }
  }

  function handleDragMove(_event: DragMoveEvent) {
    const container = document.getElementById("tier-board-export-root")
    if (!container) return
    const rect = container.getBoundingClientRect()
    const py = pointerYRef.current
    const EDGE = 80, SPEED = 14
    if (py < rect.top + EDGE) {
      if (!scrollTimerRef.current)
        scrollTimerRef.current = setInterval(() => { container.scrollTop -= SPEED }, 16)
    } else if (py > rect.bottom - EDGE) {
      if (!scrollTimerRef.current)
        scrollTimerRef.current = setInterval(() => { container.scrollTop += SPEED }, 16)
    } else {
      stopScroll()
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    stopScroll()
    const { active, over } = event
    setActiveId(null)
if (!over) return

    const draggedId = active.id as string
    const overId = over.id as string
    const isTierLabel = (ALL_TIERS as string[]).includes(overId)
    const dragged = comments.find((c) => c.id === draggedId)
    if (!dragged || dragged.locked) return

    // List mode: flat group for all non-DRAFT/non-GIF, keyed to "A"
    if (isListMode) {
      const isSpecial = (t: Tier) => t === "DRAFT" || t === "GIF"
      const sectionFor = (t: Tier) => isSpecial(t) ? t : "A"
      const sectionRank = (t: Tier) => t === "A" ? 0 : t === "DRAFT" ? 1 : 2

      const insertAt = (items: RankedComment[], item: RankedComment, index: number) => [
        ...items.slice(0, index),
        item,
        ...items.slice(index),
      ]

      const moveInListMode = (targetTier: Tier, targetId?: string) => {
        const targetSection = sectionFor(targetTier)
        const updatedDragged = {
          ...dragged,
          tier: targetSection === "A" ? "A" as Tier : targetSection,
        }

        const withoutDragged = comments.filter((c) => c.id !== draggedId)
        const grouped: Record<"A" | "DRAFT" | "GIF", RankedComment[]> = {
          A: withoutDragged.filter((c) => !isSpecial(c.tier)),
          DRAFT: withoutDragged.filter((c) => c.tier === "DRAFT"),
          GIF: withoutDragged.filter((c) => c.tier === "GIF"),
        }

        const targetItems = grouped[targetSection]
        const overIndex = targetId ? targetItems.findIndex((c) => c.id === targetId) : -1
        grouped[targetSection] = insertAt(
          targetItems,
          updatedDragged,
          overIndex >= 0 ? overIndex : targetItems.length,
        )

        onCommentsChange([
          ...grouped.A,
          ...grouped.DRAFT,
          ...grouped.GIF,
        ])
      }

      if (isTierLabel) {
        moveInListMode(overId as Tier)
        return
      }

      const overComment = comments.find((c) => c.id === overId)
      if (!overComment) return
      if (overId === draggedId) return

      const draggedSection = sectionFor(dragged.tier)
      const overSection = sectionFor(overComment.tier)
      if (draggedSection === overSection) {
        const sectionItems = comments.filter((c) => sectionFor(c.tier) === draggedSection)
        const oldIndex = sectionItems.findIndex((c) => c.id === draggedId)
        const newIndex = sectionItems.findIndex((c) => c.id === overId)
        if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return

        const reordered = arrayMove(sectionItems, oldIndex, newIndex)
        const otherItems = comments.filter((c) => sectionFor(c.tier) !== draggedSection)
        onCommentsChange([
          ...otherItems.filter((c) => sectionRank(sectionFor(c.tier)) < sectionRank(draggedSection)),
          ...reordered,
          ...otherItems.filter((c) => sectionRank(sectionFor(c.tier)) > sectionRank(draggedSection)),
        ])
        return
      }

      moveInListMode(overComment.tier, overId)
      return
    }

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

  const handleMoveTo = (id: string, tier: Tier) =>
    onCommentsChange(comments.map((c) => (c.id === id ? { ...c, tier, locked: false } : c)))

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
  const tierOffsets: Record<Tier, number> = { S: 0, A: 0, B: 0, C: 0, D: 0, F: 0, DRAFT: 0, GIF: 0 }
  for (const tier of ALL_TIERS) {
    tierOffsets[tier] = offset
    offset += comments.filter((c) => c.tier === tier).length
  }

  const draftComments = comments.filter((c) => c.tier === "DRAFT")
  const gifComments = comments.filter((c) => c.tier === "GIF")
  const listComments = comments.filter((c) => c.tier !== "DRAFT" && c.tier !== "GIF")

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      autoScroll={false}
      measuring={{ droppable: { strategy: MeasuringStrategy.WhileDragging } }}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col pb-6">
        {isListMode ? (
          <TierRow
            key="list"
            tier="A"
            comments={listComments}
            globalOffset={0}
            customLabel="COMMENTS"
            deleteTitle="Move to Draft"
            isListMode
            onLock={handleLock}
            onDelete={handleArchive}
            onMoveTo={handleMoveTo}
          />
        ) : (
          RANKED_TIERS.map((tier) => (
            <TierRow
              key={tier}
              tier={tier}
              comments={comments.filter((c) => c.tier === tier)}
              globalOffset={tierOffsets[tier]}
              deleteTitle="Move to Draft"
              onLock={handleLock}
              onDelete={handleArchive}
              onMoveTo={handleMoveTo}
            />
          ))
        )}

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
          isListMode={isListMode}
          onLock={handleLock}
          onDelete={handleDelete}
          onMoveTo={handleMoveTo}
        />

        {/* GIF section divider */}
        <div className="mx-3 mt-4 mb-0 flex items-center gap-2">
          <div className="flex-1 h-px bg-[#222]" />
        </div>

        {/* GIF section header with download button */}
        <div className="flex items-center gap-2 px-3 pt-3 pb-1">
          <span className="font-mono text-[11px] font-bold tracking-[0.25em] uppercase" style={{ color: '#FFD700' }}>
            ✦ GIF
          </span>
          <div className="flex-1 flex items-center gap-2 overflow-hidden">
            <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, #FFD70060, transparent)' }} />
            <span className="font-mono text-[10px] text-[#555] shrink-0 tabular-nums">
              {gifComments.length > 0 ? gifComments.length : '—'}
            </span>
          </div>
          <button
            onClick={async () => {
              if (isExportingGif || gifComments.length === 0) return
              setIsExportingGif(true)
              await exportGif(gifComments).catch((err) => {
                console.error("[GIF export error]", err)
                alert("GIF export failed: " + String(err))
              })
              setIsExportingGif(false)
            }}
            disabled={isExportingGif || gifComments.length === 0}
            title={gifComments.length === 0 ? "Drag comments here to include in GIF" : "Download animated GIF"}
            className={`font-ui text-[10px] font-semibold px-2 py-0.5 rounded transition-all flex items-center gap-1 disabled:opacity-40 ${
              isExportingGif
                ? "text-[#FFD700] bg-[#1a1a1a] cursor-wait"
                : gifComments.length === 0
                ? "text-[#333]"
                : "text-[#FFD700] bg-[#FFD700]/10 hover:bg-[#FFD700]/20"
            }`}
          >
            {isExportingGif
              ? <><span className="inline-block w-2 h-2 rounded-full border-2 border-[#FFD700]/25 border-t-[#FFD700] animate-spin" />encoding</>
              : "↓ Download GIF"}
          </button>
        </div>

        <TierRow
          tier="GIF"
          comments={gifComments}
          globalOffset={tierOffsets["GIF"]}
          deleteTitle="Move to Draft"
          isListMode={isListMode}
          onLock={handleLock}
          onDelete={handleArchive}
          onMoveTo={handleMoveTo}
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
