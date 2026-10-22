import type { BookFormat } from '../types'
import { StorageQuotaError, readRaw, removeRaw, writeRaw } from './localStore'

export { StorageQuotaError }

/**
 * 书籍内容与封面统一存 localStorage。
 *
 * 注意容量：localStorage 按 origin 计约 5MB（以字符计），EPUB 需要转 Base64，
 * 体积会膨胀约 1/3。因此导入前先做一次预估，超限时给出明确提示，
 * 而不是等 setItem 抛出难以理解的配额错误。
 */
export const LOCAL_STORAGE_LIMITS = {
  txtChars: 4_000_000,
  epubBytes: 3_000_000,
  coverBytes: 700_000,
} as const

const contentKey = (bookId: string) => `reader:content:${bookId}`
const coverKey = (bookId: string) => `reader:cover:${bookId}`

/** 分块转换，避免大文件触发 String.fromCharCode 的参数上限 */
function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000
  let binary = ''
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }
  return btoa(binary)
}

function fromBase64(value: string): ArrayBuffer {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes.buffer
}

export function assertCanStore(fileSize: number, format: BookFormat, textLength = 0) {
  if (format === 'epub' && fileSize > LOCAL_STORAGE_LIMITS.epubBytes) {
    throw new StorageQuotaError(
      'EPUB 超过 3MB，localStorage 空间不足，暂时无法导入。可换用更小的文件。',
    )
  }
  if (format === 'txt' && textLength > LOCAL_STORAGE_LIMITS.txtChars) {
    throw new StorageQuotaError(
      'TXT 超过约 400 万字，localStorage 空间不足，暂时无法导入。',
    )
  }
}

export interface StoredContent {
  text?: string
  bytes?: ArrayBuffer
}

export async function saveTxtContent(bookId: string, text: string) {
  if (text.length > LOCAL_STORAGE_LIMITS.txtChars) {
    throw new StorageQuotaError('TXT 超过约 400 万字，localStorage 空间不足，暂时无法导入。')
  }
  writeRaw(contentKey(bookId), JSON.stringify({ type: 'txt', text }))
}

export async function saveEpubContent(bookId: string, bytes: ArrayBuffer) {
  assertCanStore(bytes.byteLength, 'epub')
  writeRaw(contentKey(bookId), JSON.stringify({ type: 'epub', data: toBase64(bytes) }))
}

export async function loadContent(bookId: string): Promise<StoredContent | null> {
  const raw = readRaw(contentKey(bookId))
  if (!raw) return null

  try {
    const row = JSON.parse(raw) as { type?: string; text?: string; data?: string }
    if (row.type === 'txt' && typeof row.text === 'string') return { text: row.text }
    if (row.type === 'epub' && typeof row.data === 'string') {
      return { bytes: fromBase64(row.data) }
    }
  } catch {
    /* 内容损坏：按缺失处理，由阅读页提示重新导入 */
  }
  return null
}

/** 封面存 data URL；过大或配额不足时返回 false，回退到占位封面 */
export async function saveCover(bookId: string, blob: Blob): Promise<boolean> {
  if (blob.size > LOCAL_STORAGE_LIMITS.coverBytes) return false

  const base64 = toBase64(await blob.arrayBuffer())
  const mime = blob.type || 'image/png'
  try {
    writeRaw(coverKey(bookId), `data:${mime};base64,${base64}`)
    return true
  } catch (error) {
    if (error instanceof StorageQuotaError) return false
    throw error
  }
}

export function loadCover(bookId: string): string | undefined {
  return readRaw(coverKey(bookId)) ?? undefined
}

export function removeBookData(bookId: string) {
  removeRaw(contentKey(bookId))
  removeRaw(coverKey(bookId))
}
