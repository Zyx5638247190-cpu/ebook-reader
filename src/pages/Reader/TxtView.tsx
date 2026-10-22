import { useEffect, useMemo } from 'react'
import type { RefObject } from 'react'
import type {
  BookRecord,
  ProgressRecord,
  ReaderNav,
  ReaderSettings,
  ReaderStatus,
  TocNode,
} from '../../types'
import { toParagraphHtml } from '../../lib/text'
import { txtReadPercent } from '../../lib/txtPosition'
import { DragonMascot } from '../../components/DragonMascot'
import { useReaderProgress } from './useReaderProgress'
import { useTxtContent } from './useTxtContent'
import { useTxtPagination } from './useTxtPagination'

interface TxtViewProps {
  book: BookRecord
  settings: ReaderSettings
  navRef: RefObject<ReaderNav | null>
  onTocChange: (toc: TocNode[]) => void
  onActiveIndexChange: (index: number) => void
  onStatusChange: (status: ReaderStatus) => void
}

export function TxtView({
  book,
  settings,
  navRef,
  onTocChange,
  onActiveIndexChange,
  onStatusChange,
}: TxtViewProps) {
  const {
    text,
    chapters,
    chapterIndex,
    setChapterIndex,
    loading,
    error,
    pendingOffsetRef,
    lastChapterRef,
  } = useTxtContent(book.id)

  const { boxRef, measureRef, pages, pageIndex, ready } = useTxtPagination({
    bookId: book.id,
    text,
    chapters,
    chapterIndex,
    setChapterIndex,
    loading,
    error,
    fontSize: settings.fontSize,
    pendingOffsetRef,
    lastChapterRef,
    navRef,
  })

  const currentSlice = pages[pageIndex]
  const currentChapter = chapters[chapterIndex]

  // 目录与当前章节：卷标题作为不可跳转的分组节点插入
  const { tocNodes, chapterToTocIndex } = useMemo(() => {
    const nodes: TocNode[] = []
    const indexMap = new Map<number, number>()
    let lastVolume: string | undefined

    for (const chapter of chapters) {
      if (chapter.volumeTitle && chapter.volumeTitle !== lastVolume) {
        nodes.push({ label: chapter.volumeTitle, level: 0 })
        lastVolume = chapter.volumeTitle
      }
      indexMap.set(chapter.index, nodes.length)
      nodes.push({
        label: chapter.title,
        level: chapter.level ?? 0,
        chapterIndex: chapter.index,
      })
    }

    return { tocNodes: nodes, chapterToTocIndex: indexMap }
  }, [chapters])

  useEffect(() => {
    onTocChange(tocNodes)
  }, [tocNodes, onTocChange])

  useEffect(() => {
    onActiveIndexChange(chapterToTocIndex.get(chapterIndex) ?? 0)
  }, [chapterIndex, chapterToTocIndex, onActiveIndexChange])

  // 页码与百分比
  const percent = useMemo(() => {
    if (!ready || !currentSlice || !currentChapter) return 0
    return txtReadPercent(
      chapters,
      text.length,
      chapterIndex,
      pageIndex,
      pages.length,
      currentSlice.start,
    )
  }, [
    ready,
    currentSlice,
    currentChapter,
    chapters,
    text.length,
    chapterIndex,
    pageIndex,
    pages.length,
  ])

  useEffect(() => {
    if (!ready || !currentSlice || !currentChapter) return
    onStatusChange({
      pageLabel: `本章 ${pageIndex + 1} / ${pages.length} 页`,
      chapterLabel: `第 ${chapterIndex + 1} / ${chapters.length} 章`,
      percent,
    })
  }, [
    ready,
    currentSlice,
    currentChapter,
    pageIndex,
    pages.length,
    chapterIndex,
    chapters.length,
    percent,
    onStatusChange,
  ])

  // 进度以章内字符偏移为唯一真值，重新分页后仍能回到原句附近
  const progress = useMemo<ProgressRecord | null>(() => {
    if (!ready || !currentSlice || !currentChapter) return null
    return {
      chapterIndex,
      pageIndex,
      charOffset: currentSlice.start,
      chapterStart: currentChapter.start,
      percent,
      updatedAt: Date.now(),
    }
  }, [ready, currentSlice, currentChapter, chapterIndex, pageIndex, percent])

  useReaderProgress(book.id, progress)

  const pageHtml = useMemo(() => {
    if (!currentChapter || !currentSlice) return ''
    return toParagraphHtml(
      text.slice(currentChapter.start + currentSlice.start, currentChapter.start + currentSlice.end),
    )
  }, [text, currentChapter, currentSlice])

  return (
    <div className="flex h-full flex-col">
      <div className="mx-auto flex h-full w-full max-w-[760px] flex-col px-6 pb-2">
        {loading && !error && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4">
            <DragonMascot className="dragon-breathe h-24 w-24 opacity-90" />
            <p className="text-xs" style={{ color: 'var(--reader-muted)' }}>
              奶龙正在把书搬过来…
            </p>
          </div>
        )}

        {error && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <DragonMascot className="h-24 w-24 opacity-70" mood="sleepy" />
            <p className="text-sm" style={{ color: 'var(--reader-fg)' }}>
              {error}
            </p>
          </div>
        )}

        {!loading && !error && (
          <>
            <div
              className="flex shrink-0 items-center gap-3 pb-3 pt-1 text-[11px]"
              style={{ color: 'var(--reader-muted)' }}
            >
              <span className="truncate">{currentChapter?.title}</span>
              <span className="ml-auto shrink-0 tabular-nums">
                {chapterIndex + 1} / {chapters.length}
              </span>
            </div>

            <div ref={boxRef} className="relative min-h-0 flex-1">
              <div
                className="reader-text h-full overflow-hidden"
                style={{ opacity: ready ? 1 : 0 }}
                dangerouslySetInnerHTML={{ __html: pageHtml }}
              />

              <div
                ref={measureRef}
                aria-hidden="true"
                inert
                className="reader-text pointer-events-none absolute left-0 top-0 w-full opacity-0"
              />

              {!ready && (
                <div
                  className="absolute inset-0 flex items-center justify-center text-xs"
                  style={{ color: 'var(--reader-muted)' }}
                >
                  奶龙正在排版…
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
