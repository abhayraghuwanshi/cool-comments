import type { ReelData } from "../../shared/messages"

interface Props {
  reel: ReelData
}

export function ReelInfoPanel({ reel }: Props) {
  return (
    <div className="p-3 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        {reel.profilePicUrl ? (
          <img
            src={reel.profilePicUrl}
            alt={reel.username}
            className="w-9 h-9 rounded-full object-cover shrink-0 border border-[#333]"
          />
        ) : (
          <div className="w-9 h-9 rounded-full bg-[#333] shrink-0 flex items-center justify-center text-gray-400 text-sm">
            {reel.username[0]?.toUpperCase() ?? "?"}
          </div>
        )}
        <span className="text-white text-sm font-semibold truncate">@{reel.username}</span>
      </div>

      {reel.caption && (
        <p className="text-gray-300 text-xs leading-relaxed line-clamp-4">{reel.caption}</p>
      )}

      <div className="flex flex-col gap-1 text-xs text-gray-500">
        {reel.likesCount && (
          <span>❤️ {reel.likesCount}</span>
        )}
        {reel.commentsCount && (
          <span>💬 {reel.commentsCount}</span>
        )}
      </div>

      <a
        href={reel.reelUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-orange-400 hover:text-orange-300 truncate"
      >
        Open reel ↗
      </a>
    </div>
  )
}
