import { useCallback, useEffect, useRef, useState } from 'react'
import type { MutableRefObject, RefObject } from 'react'
import type { PageSlice, ReaderNav, TxtChapter, TocNode } from '../../types'
import {
  buildPaginateKey,
  getCachedPages,
  pageIndexForOffset,
  paginateChapter,
  setCachedPages,
} from '../../lib/pagination'

interface UseTxtPaginationOptions {
  bookId: string
  text: string
  chapters: TxtChapter[]
  chapterIndex: number
  setChapterIndex: (index: number) => void
  loading: boolean
  error: string | null
  fontSize: string
  pendingOffsetRef: MutableRefObject<number | null>
  lastChapterRef: MutableRefObject<number | null>
  navRef: RefObject<ReaderNav | null>
}

/**
 * 测量式分页：字号、尺寸、章节变化时重算，并按章内字符偏移回位。
 */
export function useTxtPagination({
  bookId,
  text,
  chapters,
  chapterIndex,
  setChapterIndex,
  loading,
  error,
  fontSize,
  pendingOffsetRef,
  lastChapterRef,
  navRef,
}: UseTxtPaginationOptions) {
  const [pages, setPages] = useState<PageSlice[]>([])
  const [pageIndex, setPageIndex] = useState(0)
  const [box, setBox] = useState({ width: 0, height: 0 })
  const [ready, setReady] = useState(false)

  const boxRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const currentOffsetRef = useRef(0)

  useEffect(() => {
    const el = boxRef.current
    if (!el) return

    const update = () => {
      const next = { width: el.clientWidth, height: el.clientHeight }
      setBox((prev) =>
        Math.abs(prev.width - next.width) > 1 || Math.abs(prev.height - next.height) > 1
          ? next
          : prev,
      )
    }

    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [loading])

  useEffect(() => {
    if (loading || error || chapters.length === 0) return
    if (box.width < 80 || box.height < 40) return

    const chapter = chapters[chapterIndex]
    const measure = measureRef.current
    if (!chapter || !measure) return

    const chapterText = text.slice(chapter.start, chapter.end)
    const key = buildPaginateKey(
      bookId,
      chapterIndex,
      fontSize,
      box.width,
      box.height,
      chapterText.length,
    )

    let cancelled = false
    setReady(false)

    const frame = requestAnimationFrame(() => {
      if (cancelled) return

      let result = getCachedPages(key)
      if (!result) {
        result = paginateChapter(chapterText, measure, box.height)
        setCachedPages(key, result)
      }
      if (cancelled) return

      const chapterChanged = lastChapterRef.current !== chapterIndex
      const target =
        pendingOffsetRef.current ?? (chapterChanged ? 0 : currentOffsetRef.current)
      pendingOffsetRef.current = null
      lastChapterRef.current = chapterIndex

      const index = pageIndexForOffset(result, target)
      currentOffsetRef.current = result[index]?.start ?? 0
      setPages(result)
      setPageIndex(index)
      setReady(true)
    })

    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
    }
  }, [
    loading,
    error,
    chapters,
    chapterIndex,
    text,
    box.width,
    box.height,
    fontSize,
    bookId,
    pendingOffsetRef,
    lastChapterRef,
  ])

  useEffect(() => {
    if (pages[pageIndex]) currentOffsetRef.current = pages[pageIndex].start
  }, [pages, pageIndex])

  const changeChapter = useCallback(
    (index: number, offset: number) => {
      pendingOffsetRef.current = offset
      setReady(false)
      setPages([])
      setChapterIndex(index)
    },
    [pendingOffsetRef, setChapterIndex],
  )

  const goNext = useCallback(() => {
    if (!ready) return
    if (pageIndex < pages.length - 1) {
      setPageIndex(pageIndex + 1)
      return
    }
    if (chapterIndex < chapters.length - 1) {
      changeChapter(chapterIndex + 1, 0)
    }
  }, [ready, pageIndex, pages.length, chapterIndex, chapters.length, changeChapter])

  const goPrev = useCallback(() => {
    if (!ready) return
    if (pageIndex > 0) {
      setPageIndex(pageIndex - 1)
      return
    }
    if (chapterIndex > 0) {
      changeChapter(chapterIndex - 1, Number.MAX_SAFE_INTEGER)
    }
  }, [ready, pageIndex, chapterIndex, changeChapter])

  const goToChapter = useCallback(
    (node: TocNode) => {
      if (node.chapterIndex === undefined) return
      if (node.chapterIndex === chapterIndex) return
      changeChapter(node.chapterIndex, 0)
    },
    [chapterIndex, changeChapter],
  )

  useEffect(() => {
    navRef.current = { next: goNext, prev: goPrev, goToChapter }
    return () => {
      navRef.current = null
    }
  }, [navRef, goNext, goPrev, goToChapter])

  return { boxRef, measureRef, pages, pageIndex, ready, changeChapter }
}
