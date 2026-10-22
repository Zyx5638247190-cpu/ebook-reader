import { useEffect, useRef } from 'react'
import type { ProgressRecord } from '../../types'
import { useLibraryStore } from '../../stores/libraryStore'

/**
 * 进度写入的唯一入口：
 * - 翻页后 debounce 800ms
 * - 阅读页卸载立即写
 * - 页面隐藏 / 关闭再兜底写一次
 */
export function useReaderProgress(bookId: string, progress: ProgressRecord | null) {
  const recordProgress = useLibraryStore((state) => state.recordProgress)
  const latestRef = useRef<ProgressRecord | null>(null)
  const lastChapterRef = useRef<number | null>(null)

  useEffect(() => {
    if (!progress) return
    latestRef.current = progress

    // 章节切换立即写，页内翻页仍走 800ms 防抖
    const chapterChanged = lastChapterRef.current !== progress.chapterIndex
    lastChapterRef.current = progress.chapterIndex
    if (chapterChanged) {
      recordProgress(bookId, progress)
      return
    }

    const timer = window.setTimeout(() => recordProgress(bookId, progress), 800)
    return () => window.clearTimeout(timer)
  }, [progress, bookId, recordProgress])

  useEffect(() => {
    const flush = () => {
      const latest = latestRef.current
      if (latest) recordProgress(bookId, { ...latest, updatedAt: Date.now() })
    }
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') flush()
    }

    window.addEventListener('beforeunload', flush)
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      window.removeEventListener('beforeunload', flush)
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', handleVisibility)
      flush()
    }
  }, [bookId, recordProgress])
}
