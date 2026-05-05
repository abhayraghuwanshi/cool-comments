export type Tier = "S" | "A" | "B" | "C" | "D" | "F"
export type RankingMode = "default" | "savage" | "indian"

export interface ReelData {
  username: string
  profilePicUrl: string
  caption: string
  reelUrl: string
  likesCount: string
  commentsCount: string
  thumbnailUrl?: string
}

export interface RawComment {
  id: string
  username: string
  text: string
  likesCount: string
  isReply?: boolean
}

export interface RankedComment extends RawComment {
  tier: Tier
  locked: boolean
}

export type MessageType =
  | "SCRAPE_REEL"
  | "SCRAPE_RESULT"
  | "RANK_COMMENTS"
  | "RANK_RESULT"
  | "GENERATE_SCRIPT"
  | "SCRIPT_RESULT"
  | "ERROR"

export interface ScrapeResultPayload {
  reel: ReelData
  comments: RawComment[]
}

export interface RankCommentsPayload {
  reel: ReelData
  comments: RawComment[]
  mode: RankingMode
  reelContext?: string
}

export interface GenerateScriptPayload {
  reel: ReelData
  byTier: Partial<Record<Tier, { text: string; username: string }[]>>
  mode: RankingMode
  reelContext?: string
}

export interface Message {
  type: MessageType
  payload?: unknown
  error?: string
}
