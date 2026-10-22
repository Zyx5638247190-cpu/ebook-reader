import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { ReaderNav, ReaderStatus, TocNode } from '../../types'
import { useLibraryStore } from '../../stores/libraryStore'
import { useReaderStore } from '../../stores/readerStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { FONT_SIZE_MAP } from '../../lib/constants'
import { DragonMascot } from '../../components/DragonMascot'
import { Toolbar } from './Toolbar'
import { TocSidebar } from './TocSidebar'
import { SettingsPanel } from './SettingsPanel'
import { TxtView } from './TxtView'
import { EpubView } from './EpubView'
import { PageTurnZones } from './PageTurnZones'
import { ReaderStatusBar } from './ReaderStatusBar'
import { useReaderChrome } from './useReaderChrome'

interface ReaderProps {
  bookId: string
}

export default function Reader({ bookId }: ReaderProps) {
  const book = useLibraryStore((state) => state.books.find((item) => item.id === bookId))
  const closeBook = useReaderStore((state) => state.closeBook)
  const { fontSize, theme, setFontSize, setTheme } = useSettingsStore()
  const { chromeVisible, revealChrome, toggleChrome } = useReaderChrome()

  const navRef = useRef<ReaderNav | null>(null)
  const swipeAccumRef = useRef(0)
  const swipeResetTimerRef = useRef<number | null>(null)
  const lastSwipeTurnRef = useRef(0)

  const [toc, setToc] = useState<TocNode[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [status, setStatus] = useState<ReaderStatus>({ pageLabel: '', percent: 0 })
  const [tocOpen, setTocOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    setToc([])
    setActiveIndex(0)
    setStatus({ pageLabel: '', percent: 0 })
  }, [bookId])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setTocOpen(false)
        setSettingsOpen(false)
        return
      }
      if (tocOpen || settingsOpen) return

      if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        event.preventDefault()
        navRef.current?.prev()
        revealChrome()
      } else if (
        event.key === 'ArrowRight' ||
        event.key === 'PageDown' ||
        event.key === ' '
      ) {
        event.preventDefault()
        navRef.current?.next()
        revealChrome()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [tocOpen, settingsOpen, revealChrome])

  // 触控板 / 鼠标横向滑动翻页，纵向滚动不劫持
  useEffect(() => {
    const onWheel = (event: WheelEvent) => {
      if (tocOpen || settingsOpen) return
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return

      event.preventDefault()

      if (swipeResetTimerRef.current) window.clearTimeout(swipeResetTimerRef.current)
      swipeResetTimerRef.current = window.setTimeout(() => {
        swipeAccumRef.current = 0
      }, 220)

      if (Math.sign(event.deltaX) !== Math.sign(swipeAccumRef.current)) {
        swipeAccumRef.current = 0
      }
      swipeAccumRef.current += event.deltaX

      const now = Date.now()
      if (now - lastSwipeTurnRef.current < 420) return
      if (Math.abs(swipeAccumRef.current) < 70) return

      const forward = swipeAccumRef.current > 0
      swipeAccumRef.current = 0
      lastSwipeTurnRef.current = now
      if (forward) navRef.current?.next()
      else navRef.current?.prev()
      revealChrome()
    }

    window.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      window.removeEventListener('wheel', onWheel)
      if (swipeResetTimerRef.current) window.clearTimeout(swipeResetTimerRef.current)
    }
  }, [tocOpen, settingsOpen, revealChrome])

  const handlePrev = useCallback(() => {
    navRef.current?.prev()
    revealChrome()
  }, [revealChrome])

  const handleNext = useCallback(() => {
    navRef.current?.next()
    revealChrome()
  }, [revealChrome])

  if (!book) {
    return (
      <div className="library-backdrop flex h-full flex-col items-center justify-center gap-4">
        <DragonMascot className="h-28 w-28 opacity-80" mood="sleepy" />
        <p className="text-sm text-ink-500">这本书已经不在书架上了</p>
        <button
          type="button"
          onClick={closeBook}
          className="rounded-full bg-gradient-to-r from-brand-300 to-brand-400 px-5 py-2.5 text-sm font-medium text-ink-900 shadow-card"
        >
          返回书架
        </button>
      </div>
    )
  }

  const readerStyle = {
    '--reader-font-size': `${FONT_SIZE_MAP[fontSize]}px`,
  } as CSSProperties

  const viewProps = {
    book,
    settings: { fontSize, theme },
    navRef,
    onTocChange: setToc,
    onActiveIndexChange: setActiveIndex,
    onStatusChange: setStatus,
  }

  return (
    <div
      className="reader-surface relative flex h-full flex-col overflow-hidden"
      data-theme={theme}
      style={readerStyle}
    >
      <Toolbar
        visible={chromeVisible}
        title={book.title}
        author={book.author}
        onBack={closeBook}
        onOpenToc={() => {
          setTocOpen(true)
          setSettingsOpen(false)
        }}
        onOpenSettings={() => {
          setSettingsOpen(true)
          setTocOpen(false)
        }}
        onInteract={revealChrome}
      />

      <main className="relative min-h-0 flex-1 pb-10 pt-16">
        {book.format === 'txt' ? <TxtView {...viewProps} /> : <EpubView {...viewProps} />}
        <PageTurnZones onPrev={handlePrev} onNext={handleNext} onToggleChrome={toggleChrome} />
      </main>

      <ReaderStatusBar status={status} />

      <TocSidebar
        open={tocOpen}
        bookTitle={book.title}
        toc={toc}
        activeIndex={activeIndex}
        onClose={() => setTocOpen(false)}
        onSelect={(node) => {
          navRef.current?.goToChapter(node)
          setTocOpen(false)
        }}
      />

      <SettingsPanel
        open={settingsOpen}
        settings={{ fontSize, theme }}
        onClose={() => setSettingsOpen(false)}
        onChangeFontSize={setFontSize}
        onChangeTheme={setTheme}
      />
    </div>
  )
}
