import type { ReelData } from "../../shared/messages"

interface Props {
  reel: ReelData
}

export function ReelInfoPanel({ reel }: Props) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 border-b border-[#222] bg-[#141414]">
      {/* Profile pic */}
      {reel.profilePicUrl ? (
        <img
          src={reel.profilePicUrl}
          alt=""
          className="w-8 h-8 rounded-full object-cover shrink-0"
          style={{ border: '1px solid #333' }}
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-[#2a2a2a] shrink-0 flex items-center justify-center font-display text-[13px] text-[#555]">
          {reel.username?.[0]?.toUpperCase() ?? '?'}
        </div>
      )}

      {/* Username + caption stacked */}
      <div className="flex-1 min-w-0">
        <p className="font-ui text-[14px] font-bold text-white leading-tight truncate">
          {reel.username ? `@${reel.username}` : 'Unknown reel'}
        </p>
        {reel.caption && (
          <p className="font-mono text-[10px] text-[#555] truncate mt-0.5 leading-none">
            {reel.caption}
          </p>
        )}
      </div>

      {/* Stats + link */}
      <div className="flex items-center gap-2.5 shrink-0">
        {reel.likesCount && (
          <span className="font-mono text-[10px] text-[#666]">♥ {reel.likesCount}</span>
        )}
        <a
          href={reel.reelUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-[12px] text-[#555] hover:text-white transition-colors"
          title="Open reel"
        >
          ↗
        </a>
      </div>
    </div>
  )
}
