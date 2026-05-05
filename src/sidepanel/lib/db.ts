import type { RankedComment, ReelData, RankingMode, Tier } from "../../shared/messages"

export interface SavedSession {
  reelUrl: string
  reelData: ReelData
  comments: RankedComment[]
  rankingMode: RankingMode
  savedAt: number
}

const DB_NAME    = "cool-comments"
const STORE      = "sessions"
const AUDIO_STORE = "audio"
const DB_VERSION = 2

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (event) => {
      const db = req.result
      const old = event.oldVersion
      if (old < 1) db.createObjectStore(STORE, { keyPath: "reelUrl" })
      if (old < 2) db.createObjectStore(AUDIO_STORE, { keyPath: "reelUrl" })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror  = () => reject(req.error)
  })
}

// ── Sessions ─────────────────────────────────────────────────────────────────

export async function saveSession(session: Omit<SavedSession, "savedAt">): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite")
    tx.objectStore(STORE).put({ ...session, savedAt: Date.now() })
    tx.oncomplete = () => resolve()
    tx.onerror    = () => reject(tx.error)
  })
}

export async function loadLastSession(): Promise<SavedSession | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE, "readonly")
    const all: SavedSession[] = []
    tx.objectStore(STORE).openCursor().onsuccess = (e) => {
      const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result
      if (cursor) { all.push(cursor.value as SavedSession); cursor.continue() }
      else {
        if (!all.length) return resolve(null)
        all.sort((a, b) => b.savedAt - a.savedAt)
        resolve(all[0])
      }
    }
    tx.onerror = () => reject(tx.error)
  })
}

export async function loadSession(reelUrl: string): Promise<SavedSession | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, "readonly")
    const req = tx.objectStore(STORE).get(reelUrl)
    req.onsuccess = () => resolve((req.result as SavedSession) ?? null)
    req.onerror   = () => reject(req.error)
  })
}

export async function deleteSession(reelUrl: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite")
    tx.objectStore(STORE).delete(reelUrl)
    tx.oncomplete = () => resolve()
    tx.onerror    = () => reject(tx.error)
  })
}

export async function listSessions(): Promise<Pick<SavedSession, "reelUrl" | "reelData" | "savedAt">[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, "readonly")
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => {
      const rows = (req.result as SavedSession[]).map(({ reelUrl, reelData, savedAt }) => ({
        reelUrl, reelData, savedAt,
      }))
      rows.sort((a, b) => b.savedAt - a.savedAt)
      resolve(rows)
    }
    req.onerror = () => reject(req.error)
  })
}

// ── Audio blobs ───────────────────────────────────────────────────────────────

interface AudioRecord {
  reelUrl: string
  blobs: Partial<Record<Tier, Blob>>
}

export async function saveAudio(reelUrl: string, blobs: Map<Tier, Blob>): Promise<void> {
  const db = await openDB()
  const record: AudioRecord = {
    reelUrl,
    blobs: Object.fromEntries(blobs) as Partial<Record<Tier, Blob>>,
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AUDIO_STORE, "readwrite")
    tx.objectStore(AUDIO_STORE).put(record)
    tx.oncomplete = () => resolve()
    tx.onerror    = () => reject(tx.error)
  })
}

export async function loadAudio(reelUrl: string): Promise<Map<Tier, Blob> | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(AUDIO_STORE, "readonly")
    const req = tx.objectStore(AUDIO_STORE).get(reelUrl)
    req.onsuccess = () => {
      const record = req.result as AudioRecord | undefined
      if (!record) return resolve(null)
      resolve(new Map(Object.entries(record.blobs) as [Tier, Blob][]))
    }
    req.onerror = () => reject(req.error)
  })
}

export async function deleteAudio(reelUrl: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AUDIO_STORE, "readwrite")
    tx.objectStore(AUDIO_STORE).delete(reelUrl)
    tx.oncomplete = () => resolve()
    tx.onerror    = () => reject(tx.error)
  })
}
