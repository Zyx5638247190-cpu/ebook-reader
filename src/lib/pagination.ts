import type { PageSlice } from '../types'
import { toParagraphHtml } from './text'

const CACHE_LIMIT = 60
const cache = new Map<string, PageSlice[]>()

export function getCachedPages(key: string): PageSlice[] | undefined {
  return cache.get(key)
}

export function setCachedPages(key: string, pages: PageSlice[]) {
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value
    if (oldest) cache.delete(oldest)
  }
  cache.set(key, pages)
}

export function buildPaginateKey(
  bookId: string,
  chapterIndex: number,
  fontSize: string,
  width: number,
  height: number,
  textLength: number,
): string {
  return `${bookId}:${chapterIndex}:${fontSize}:${Math.round(width)}x${Math.round(height)}:${textLength}`
}

/**
 * 测量式分页：用与正文完全一致的离屏容器做二分查找，返回字符区间。
 * - 不整本分页，只处理当前章节
 * - 结果不受像素位置影响，字号或窗口变化后可重新计算
 */
export function paginateChapter(
  text: string,
  measureEl: HTMLElement,
  maxHeight: number,
): PageSlice[] {
  if (!text) return []

  const limit = Math.max(40, Math.floor(maxHeight))
  const pages: PageSlice[] = []
  let start = 0

  while (start < text.length) {
    let low = start + 1
    let high = Math.min(start + 4000, text.length)
    let best = start

    while (low <= high) {
      const mid = (low + high) >> 1
      measureEl.innerHTML = toParagraphHtml(text.slice(start, mid))
      if (measureEl.scrollHeight <= limit) {
        best = mid
        low = mid + 1
      } else {
        high = mid - 1
      }
    }

    let end = best > start ? best : Math.min(start + 1, text.length)

    // 回退到最近的换行，避免把一句话拆到两页
    if (best > start) {
      const newline = text.lastIndexOf('\n', end - 1)
      const threshold = start + Math.max(80, (end - start) * 0.55)
      if (newline > threshold) end = newline + 1
    }

    pages.push({ start, end })
    start = end

    // 极端尺寸下的安全阀，避免死循环
    if (pages.length > 20000) break
  }

  const visible = pages.filter((page) => text.slice(page.start, page.end).trim().length > 0)
  return visible.length > 0 ? visible : [{ start: 0, end: text.length }]
}

export function pageIndexForOffset(pages: PageSlice[], offset: number): number {
  if (pages.length === 0) return 0
  const index = pages.findIndex((page) => offset >= page.start && offset < page.end)
  if (index >= 0) return index
  return offset <= 0 ? 0 : pages.length - 1
}
