import type { BookRecord, ProgressRecord, ReaderSettings } from '../types'
import { readRaw, removeRaw, writeRaw } from './localStore'

const BOOKS_KEY = 'reader:books'
const SETTINGS_KEY = 'reader:settings'
const progressKey = (bookId: string) => `reader:progress:${bookId}`

const DEFAULT_SETTINGS: ReaderSettings = { fontSize: 'medium', theme: 'sepia' }

function readJSON<T>(key: string): T | null {
  try {
    const raw = readRaw(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function writeJSON(key: string, value: unknown) {
  try {
    writeRaw(key, JSON.stringify(value))
  } catch (error) {
    // 元数据/进度写入失败不能阻断阅读，阅读页仍可用；导入内容会单独提示配额问题
    console.warn(`写入本地存储失败：${key}`, error)
  }
}

export function loadBooks(): BookRecord[] {
  const rows = readJSON<BookRecord[]>(BOOKS_KEY)
  if (!Array.isArray(rows)) return []
  return rows.filter((row) => row && typeof row.id === 'string')
}

export function saveBooks(books: BookRecord[]) {
  writeJSON(BOOKS_KEY, books)
}

export function loadSettings(): ReaderSettings {
  const saved = readJSON<Partial<ReaderSettings>>(SETTINGS_KEY)
  const fontSize = saved?.fontSize
  const theme = saved?.theme
  return {
    fontSize:
      fontSize === 'small' || fontSize === 'medium' || fontSize === 'large'
        ? fontSize
        : DEFAULT_SETTINGS.fontSize,
    theme: theme === 'light' || theme === 'sepia' || theme === 'dark' ? theme : DEFAULT_SETTINGS.theme,
  }
}

export function saveSettings(settings: ReaderSettings) {
  writeJSON(SETTINGS_KEY, settings)
}

export function loadProgress(bookId: string): ProgressRecord | null {
  const row = readJSON<ProgressRecord>(progressKey(bookId))
  if (!row || typeof row.percent !== 'number') return null
  return row
}

export function saveProgress(bookId: string, progress: ProgressRecord) {
  writeJSON(progressKey(bookId), progress)
}

export function removeProgress(bookId: string) {
  removeRaw(progressKey(bookId))
}
