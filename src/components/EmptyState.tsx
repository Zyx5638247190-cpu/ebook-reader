import { BookPlus, FileText, Loader2 } from 'lucide-react'
import { DragonMascot } from './DragonMascot'

interface EmptyStateProps {
  onImport: () => void
  onLoadSample: (kind: 'txt' | 'epub') => void
  importing: boolean
}

export function EmptyState({ onImport, onLoadSample, importing }: EmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center px-6 py-14 text-center"
      aria-busy={importing}
    >
      <div className="relative">
        <div
          className="pointer-events-none absolute inset-6 rounded-full bg-brand-200/60 blur-2xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -left-11 top-9 h-16 w-12 -rotate-12 rounded-md bg-gradient-to-br from-brand-200 to-brand-300 opacity-70 shadow-card"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -right-10 top-16 h-14 w-11 rotate-12 rounded-md bg-gradient-to-br from-brand-300 to-brand-400 opacity-60 shadow-card"
          aria-hidden="true"
        />

        <div className="dragon-float relative">
          <DragonMascot className="dragon-breathe h-44 w-44" />
        </div>

        <div className="absolute -right-10 top-0 w-32 rounded-2xl rounded-bl-sm border border-line bg-white/90 px-3 py-2 text-left text-xs leading-relaxed text-ink-700 shadow-card sm:-right-16 sm:w-36">
          书架空空的，先喂我一本吧～
        </div>
      </div>

      <h2 className="mt-7 text-xl font-semibold text-ink-900">奶龙在等它的第一本书</h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-500">
        支持导入 TXT 与 EPUB。阅读位置会自动记住，字号和底色随你心情切换，眼睛累了就换成米黄。
      </p>

      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={onImport}
          disabled={importing}
          className="flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-300 to-brand-400 px-6 py-3 text-sm font-medium text-ink-900 shadow-card transition hover:brightness-105 active:scale-[0.98] disabled:cursor-wait disabled:opacity-70"
        >
          {importing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <BookPlus className="h-4 w-4" />
          )}
          {importing ? '正在导入' : '选择一本书'}
        </button>

        <button
          type="button"
          onClick={() => onLoadSample('txt')}
          disabled={importing}
          className="flex items-center gap-2 rounded-full border border-line bg-white/70 px-4 py-3 text-sm text-ink-700 transition hover:border-brand-300 hover:bg-white disabled:cursor-wait disabled:opacity-60"
        >
          <FileText className="h-4 w-4 text-brand-500" />
          试试示例 TXT
        </button>

        <button
          type="button"
          onClick={() => onLoadSample('epub')}
          disabled={importing}
          className="flex items-center gap-2 rounded-full border border-line bg-white/70 px-4 py-3 text-sm text-ink-700 transition hover:border-brand-300 hover:bg-white disabled:cursor-wait disabled:opacity-60"
        >
          <FileText className="h-4 w-4 text-brand-500" />
          试试示例 EPUB
        </button>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-[11px] text-ink-500/90">
        <span className="rounded-full border border-line bg-white/70 px-2.5 py-1">
          TXT · UTF-8 / GBK / UTF-16
        </span>
        <span className="rounded-full border border-line bg-white/70 px-2.5 py-1">
          EPUB 2 / 3
        </span>
        <span className="rounded-full border border-line bg-white/70 px-2.5 py-1">
          拖进窗口也可以
        </span>
      </div>

      {importing && (
        <p className="mt-4 text-xs text-ink-500" role="status">
          奶龙正在把书搬上书架…
        </p>
      )}
    </div>
  )
}
