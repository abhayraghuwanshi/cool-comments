const TIERS = ['S', 'A', 'B', 'C', 'D', 'F'] as const
const COLORS = ['#FF6B35', '#39FF14', '#00B4FF', '#CC44FF', '#FFB300', '#FF1744']

interface Props {
  message: string
}

export function LoadingState({ message }: Props) {
  return (
    <div className="flex flex-col items-center justify-center h-screen gap-6 bg-[#080808]">
      <div className="flex items-end gap-2">
        {TIERS.map((t, i) => (
          <span
            key={t}
            className="font-display text-5xl leading-none letter-pop select-none"
            style={{
              color: COLORS[i],
              animationDelay: `${i * 130}ms`,
              textShadow: `0 0 16px ${COLORS[i]}60`,
            }}
          >
            {t}
          </span>
        ))}
      </div>
      <p className="font-mono text-[10px] text-[#333] tracking-[0.25em] uppercase">{message}</p>
    </div>
  )
}
