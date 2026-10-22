import { Trash2 } from 'lucide-react'
import type { BookRecord } from '../types'
import { cn, formatPercent, formatSize } from '../lib/text'
import { DragonMascot } from './DragonMascot'

interface BookCardProps {
  book: BookRecord
  coverUrl?: string
  onOpen: () => void
  onRemove: () => void
}

export function BookCard({ book, coverUrl, onOpen, onRemove }: BookCardProps) {
  const started = book.progress > 0.001
  const finished = book.progress >= 0.999

  return (
    <article className="group relative">
      <button
        type="button"
        onClick={onOpen}
        className="block w-full text-left"
        aria-label={`阅读《${book.title}》`}
      >
        <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-brand-100 shadow-card ring-1 ring-line transition duration-200 group-hover:-translate-y-1 group-hover:shadow-soft">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={`《${book.title}》封面`}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="relative flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-brand-300 via-brand-200 to-brand-400 px-4">
              <span className="font-reading text-5xl text-ink-900/80">
                {book.title.slice(0, 1)}
              </span>
              <span className="mt-3 line-clamp-2 text-center text-xs leading-relaxed text-ink-700/80">
                {book.title}
              </span>
              <DragonMascot className="absolute -bottom-4 -right-5 h-24 w-24 opacity-25" />
            </div>
          )}

          <span className="absolute left-2.5 top-2.5 rounded-md bg-ink-900/65 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white/90 backdrop-blur-sm">
            {book.format}
          </span>

          {finished && (
            <span className="absolute right-2.5 top-2.5 rounded-md bg-brand-500/90 px-1.5 py-0.5 text-[10px] font-medium text-white">
              已读完
            </span>
          )}
        </div>

        <div className="mt-3 px-0.5">
          <h3 className="line-clamp-2 text-sm font-medium leading-snug text-ink-900">
            {book.title}
          </h3>
          <p className="mt-1 truncate text-xs text-ink-500">{book.author}</p>

          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-brand-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-300 to-brand-500 transition-[width] duration-300"
              style={{
                width: started ? `${Math.max(2, Math.round(book.progress * 100))}%` : '0%',
              }}
            />
          </div>

          <div className="mt-1.5 flex items-center justify-between text-[11px] text-ink-500">
            <span>
              {finished ? '读完了' : started ? `已读 ${formatPercent(book.progress)}` : '未开始'}
            </span>
            <span>{formatSize(book.fileSize)}</span>
          </div>
        </div>
      </button>

      <button
        type="button"
        onClick={() => {
          if (window.confirm(`确定把《${book.title}》移出书架吗？阅读进度也会一并删除。`)) {
            onRemove()
          }
        }}
        title="移出书架"
        aria-label={`移出《${book.title}》`}
        className={cn(
          'absolute bottom-2.5 right-2.5 rounded-lg bg-white/85 p-1.5 text-ink-500 shadow-sm backdrop-blur-sm',
          'opacity-0 transition hover:bg-white hover:text-danger-500 focus-visible:opacity-100 group-hover:opacity-100',
        )}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </article>
  )
}
