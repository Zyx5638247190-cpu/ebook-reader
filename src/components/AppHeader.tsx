import { Loader2, Plus } from 'lucide-react'
import { DragonMascot } from './DragonMascot'

interface AppHeaderProps {
  count: number
  importing: boolean
  onImport: () => void
}

export function AppHeader({ count, importing, onImport }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-line/70 bg-cream-50/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-4">
        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-brand-300 to-brand-400 shadow-card">
          <DragonMascot className="absolute top-1 h-14 w-14" />
        </div>

        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-wide text-ink-900">奶龙书屋</h1>
          <p className="truncate text-xs text-ink-500">
            {count > 0 ? `书架上有 ${count} 本书，慢慢读` : '把喜欢的故事，慢慢读完'}
          </p>
        </div>

        <button
          type="button"
          onClick={onImport}
          disabled={importing}
          className="ml-auto flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-300 to-brand-400 px-5 py-2.5 text-sm font-medium text-ink-900 shadow-card transition hover:brightness-105 active:scale-[0.98] disabled:cursor-wait disabled:opacity-70"
        >
          {importing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" strokeWidth={2.4} />
          )}
          {importing ? '正在导入' : '导入书籍'}
        </button>
      </div>
    </header>
  )
}
