import type { RankedComment, ReelData, RankingMode } from "../../shared/messages"

export interface SavedSession {
  reelUrl: string
  reelData: ReelData
  comments: RankedComment[]
  rankingMode: RankingMode
  savedAt: number
}

const DB_NAME = "cool-comments"
const STORE = "sessions"
const DB_VERSION = 1

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: "reelUrl" })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function saveSession(session: Omit<SavedSession, "savedAt">): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite")
    tx.objectStore(STORE).put({ ...session, savedAt: Date.now() })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function loadLastSession(): Promise<SavedSession | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly")
    const store = tx.objectStore(STORE)
    const all: SavedSession[] = []

    store.openCursor().onsuccess = (e) => {
      const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result
      if (cursor) {
        all.push(cursor.value as SavedSession)
        cursor.continue()
      } else {
        if (all.length === 0) return resolve(null)
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
    const tx = db.transaction(STORE, "readonly")
    const req = tx.objectStore(STORE).get(reelUrl)
    req.onsuccess = () => resolve((req.result as SavedSession) ?? null)
    req.onerror = () => reject(req.error)
  })
}

export async function deleteSession(reelUrl: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite")
    tx.objectStore(STORE).delete(reelUrl)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function listSessions(): Promise<Pick<SavedSession, "reelUrl" | "reelData" | "savedAt">[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly")
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => {
      const rows = (req.result as SavedSession[]).map(({ reelUrl, reelData, savedAt }) => ({
        reelUrl,
        reelData,
        savedAt,
      }))
      rows.sort((a, b) => b.savedAt - a.savedAt)
      resolve(rows)
    }
    req.onerror = () => reject(req.error)
  })
}
