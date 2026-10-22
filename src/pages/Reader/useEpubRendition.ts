import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type {
  ProgressRecord,
  ReaderNav,
  ReaderSettings,
  ReaderStatus,
  TocNode,
} from '../../types'
import { loadContent } from '../../lib/bookStorage'
import { loadProgress } from '../../lib/storage'
import { findTocIndex } from '../../lib/epubToc'
import { buildTocOrder, estimateTocPercent } from '../../lib/tocProgress'
import { displayTocNode, openEpubSession, type EpubSession, type RelocatedInfo } from './epubSession'
import { useEpubThemeSync } from './useEpubThemeSync'
import { useReaderProgress } from './useReaderProgress'

interface UseEpubRenditionOptions {
  bookId: string
  navRef: RefObject<ReaderNav | null>
  settings: ReaderSettings
  onTocChange: (toc: TocNode[]) => void
  onActiveIndexChange: (index: number) => void
  onStatusChange: (status: ReaderStatus) => void
}

/**
 * 封装 epub.js 会话的初始化、CFI 恢复、主题注入、翻页与进度写入。
 * 组件只负责展示，所有 rendition 操作都收敛在这里。
 */
export function useEpubRendition({
  bookId,
  navRef,
  settings,
  onTocChange,
  onActiveIndexChange,
  onStatusChange,
}: UseEpubRenditionOptions) {
  const containerRef = useRef<HTMLDivElement>(null)
  const renditionRef = useRef<EpubSession['rendition'] | null>(null)
  const tocRef = useRef<TocNode[]>([])
  const tocOrderRef = useRef(new Map<number, number>())
  const tocCountRef = useRef(0)
  const activeIndexRef = useRef(0)
  const currentCfiRef = useRef('')
  const currentPageRef = useRef(1)
  const atEndRef = useRef(false)
  const locationsReadyRef = useRef(false)
  const lastStatusRef = useRef<ReaderStatus>({ pageLabel: '', percent: 0 })
  const settingsRef = useRef(settings)

  const [loading, setLoading] = useState(true)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<ProgressRecord | null>(null)

  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  useEffect(() => {
    const guard = { disposed: false }
    let session: EpubSession | null = null

    setLoading(true)
    setError(null)
    setReady(false)
    setProgress(null)
    locationsReadyRef.current = false
    tocRef.current = []
    tocOrderRef.current = new Map()
    tocCountRef.current = 0
    activeIndexRef.current = 0
    currentCfiRef.current = ''
    currentPageRef.current = 1
    atEndRef.current = false

    const estimateByChapter = (page: number, total: number) =>
      estimateTocPercent(
        tocOrderRef.current.get(activeIndexRef.current),
        tocCountRef.current,
        page,
        total,
      )

    const handleRelocated = (info: RelocatedInfo) => {
      currentCfiRef.current = info.cfi
      currentPageRef.current = info.page
      atEndRef.current = info.atEnd

      const index = findTocIndex(tocRef.current, info.href)
      if (index >= 0) {
        activeIndexRef.current = index
        onActiveIndexChange(index)
      }

      const percent = info.atEnd
        ? 1
        : (info.locationPercent ?? estimateByChapter(info.page, info.total))
      const chapterOrder = tocOrderRef.current.get(activeIndexRef.current)
      const status: ReaderStatus = {
        pageLabel: `本章 ${info.page} / ${info.total} 页`,
        chapterLabel: chapterOrder
          ? `第 ${chapterOrder} / ${tocCountRef.current} 章`
          : undefined,
        percent,
      }
      lastStatusRef.current = status
      onStatusChange(status)

      setProgress({
        chapterIndex: activeIndexRef.current,
        pageIndex: info.page,
        cfi: info.cfi,
        href: info.href,
        percent,
        updatedAt: Date.now(),
      })
    }

    async function init() {
      try {
        const content = await loadContent(bookId)
        if (guard.disposed) return
        if (!content?.bytes) {
          setError('找不到书籍内容，请重新导入')
          setLoading(false)
          return
        }

        const container = containerRef.current
        if (!container) {
          setError('阅读区域初始化失败')
          setLoading(false)
          return
        }

        session = await openEpubSession({
          container,
          bytes: content.bytes,
          settings: settingsRef.current,
          saved: loadProgress(bookId),
          guard,
          onToc: (toc) => {
            tocRef.current = toc
            const { order, count } = buildTocOrder(toc)
            tocOrderRef.current = order
            tocCountRef.current = count
            onTocChange(toc)
          },
          onRelocated: handleRelocated,
          onPrev: () => navRef.current?.prev(),
          onNext: () => navRef.current?.next(),
        })

        if (!session || guard.disposed) return
        renditionRef.current = session.rendition
        setLoading(false)
        setReady(true)

        void session.ensureLocations().then((done) => {
          if (guard.disposed || !done) return
          locationsReadyRef.current = true
          const cfi = currentCfiRef.current
          if (!cfi) return
          const percent = atEndRef.current
            ? 1
            : (session?.percentFromCfi(cfi) ?? lastStatusRef.current.percent)
          lastStatusRef.current = { ...lastStatusRef.current, percent }
          onStatusChange(lastStatusRef.current)
          setProgress((previous) =>
            previous ? { ...previous, percent, updatedAt: Date.now() } : previous,
          )
        })
      } catch (error) {
        if (guard.disposed) return
        const message = error instanceof Error ? error.message : ''
        setError(
          message.includes('组件加载失败') ? message : 'EPUB 解析失败，文件可能已损坏',
        )
        setLoading(false)
      }
    }

    void init()

    return () => {
      guard.disposed = true
      session?.destroy()
      renditionRef.current = null
    }
  }, [bookId, navRef, onActiveIndexChange, onStatusChange, onTocChange])

  useReaderProgress(bookId, progress)
  useEpubThemeSync(renditionRef, currentCfiRef, settings, ready)

  useEffect(() => {
    navRef.current = {
      next: () => {
        void renditionRef.current?.next().catch(() => undefined)
      },
      prev: () => {
        void renditionRef.current?.prev().catch(() => undefined)
      },
      goToChapter: (node) => displayTocNode(renditionRef.current, node),
    }
    return () => {
      navRef.current = null
    }
  }, [navRef])

  return { containerRef, loading, ready, error }
}
