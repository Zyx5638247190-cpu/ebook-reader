import type { ReaderStatus } from '../../types'
import { formatPercent } from '../../lib/text'

interface ReaderStatusBarProps {
  status: ReaderStatus
}

/** 底部状态条：页码 / 总页数 + 全书百分比，以及一条始终可见的进度条 */
export function ReaderStatusBar({ status }: ReaderStatusBarProps) {
  const percent = Math.round(status.percent * 100)
  const pageText = status.pageLabel || '正在打开'
  const valueText = [status.chapterLabel, pageText, `全书 ${percent}%`]
    .filter(Boolean)
    .join(' ')

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-center justify-center pb-2.5">
        <span
          role="status"
          aria-live="polite"
          className="rounded-full px-3 py-1 text-[11px] tabular-nums backdrop-blur-sm"
          style={{ color: 'var(--reader-muted)', background: 'var(--chrome-bg)' }}
        >
          {status.chapterLabel && (
            <>
              {status.chapterLabel}
              <span className="mx-1.5 opacity-40">·</span>
            </>
          )}
          {pageText}
          <span className="mx-1.5 opacity-40">·</span>
          全书 {formatPercent(status.percent)}
        </span>
      </div>

      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px]"
        style={{ background: 'var(--reader-line)' }}
        role="progressbar"
        aria-label="阅读进度"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={valueText}
      >
        <div
          className="h-full rounded-r-full bg-gradient-to-r from-brand-300 to-brand-500 transition-[width] duration-300 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </>
  )
}
