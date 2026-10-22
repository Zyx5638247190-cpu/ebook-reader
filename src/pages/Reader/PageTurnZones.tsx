import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PageTurnZonesProps {
  onPrev: () => void
  onNext: () => void
  onToggleChrome: () => void
}

/** 翻页热区：左 25% 上一页、右 25% 下一页、中间呼出工具栏 */
export function PageTurnZones({ onPrev, onNext, onToggleChrome }: PageTurnZonesProps) {
  return (
    <div className="absolute inset-0 z-20 flex">
      <button
        type="button"
        onClick={onPrev}
        aria-label="上一页"
        className="group flex h-full w-1/4 cursor-w-resize items-center justify-start pl-3"
      >
        <ChevronLeft
          className="h-9 w-9 opacity-0 transition group-hover:opacity-30"
          style={{ color: 'var(--reader-fg)' }}
        />
      </button>

      <button
        type="button"
        onClick={onToggleChrome}
        aria-label="显示或隐藏工具栏"
        className="h-full w-1/2 cursor-default"
      />

      <button
        type="button"
        onClick={onNext}
        aria-label="下一页"
        className="group flex h-full w-1/4 cursor-e-resize items-center justify-end pr-3"
      >
        <ChevronRight
          className="h-9 w-9 opacity-0 transition group-hover:opacity-30"
          style={{ color: 'var(--reader-fg)' }}
        />
      </button>
    </div>
  )
}
