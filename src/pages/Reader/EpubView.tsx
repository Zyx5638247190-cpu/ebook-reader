import type { RefObject } from 'react'
import type {
  BookRecord,
  ReaderNav,
  ReaderSettings,
  ReaderStatus,
  TocNode,
} from '../../types'
import { DragonMascot } from '../../components/DragonMascot'
import { useEpubRendition } from './useEpubRendition'

interface EpubViewProps {
  book: BookRecord
  settings: ReaderSettings
  navRef: RefObject<ReaderNav | null>
  onTocChange: (toc: TocNode[]) => void
  onActiveIndexChange: (index: number) => void
  onStatusChange: (status: ReaderStatus) => void
}

export function EpubView({
  book,
  settings,
  navRef,
  onTocChange,
  onActiveIndexChange,
  onStatusChange,
}: EpubViewProps) {
  const { containerRef, loading, error } = useEpubRendition({
    bookId: book.id,
    navRef,
    settings,
    onTocChange,
    onActiveIndexChange,
    onStatusChange,
  })

  return (
    <div className="relative h-full">
      <div
        ref={containerRef}
        className="mx-auto h-full w-full max-w-[820px] px-2"
        style={{ background: 'var(--reader-bg)' }}
      />

      {loading && !error && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-4"
          style={{ background: 'var(--reader-bg)' }}
        >
          <DragonMascot className="dragon-breathe h-24 w-24 opacity-90" />
          <p className="text-xs" style={{ color: 'var(--reader-muted)' }}>
            奶龙正在翻开书页…
          </p>
        </div>
      )}

      {error && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center"
          style={{ background: 'var(--reader-bg)' }}
        >
          <DragonMascot className="h-24 w-24 opacity-70" mood="sleepy" />
          <p className="text-sm" style={{ color: 'var(--reader-fg)' }}>
            {error}
          </p>
        </div>
      )}
    </div>
  )
}
