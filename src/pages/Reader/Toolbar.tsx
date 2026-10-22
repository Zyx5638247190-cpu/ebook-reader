import { ArrowLeft, ListTree, Settings2 } from 'lucide-react'
import { cn } from '../../lib/text'

interface ToolbarProps {
  visible: boolean
  title: string
  author: string
  onBack: () => void
  onOpenToc: () => void
  onOpenSettings: () => void
  onInteract: () => void
}

const iconButton =
  'flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-brand-300/25 active:scale-95'

export function Toolbar({
  visible,
  title,
  author,
  onBack,
  onOpenToc,
  onOpenSettings,
  onInteract,
}: ToolbarProps) {
  return (
    <div
      className={cn(
        'absolute inset-x-0 top-0 z-40 transition-transform duration-300 ease-out',
        visible ? 'translate-y-0' : '-translate-y-full',
      )}
      style={{
        background: 'var(--chrome-bg)',
        borderColor: 'var(--panel-line)',
        color: 'var(--panel-fg)',
      }}
      onMouseEnter={onInteract}
    >
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-1 px-3">
        <button type="button" className={iconButton} onClick={onBack} aria-label="返回书架">
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div className="min-w-0 flex-1 px-2 text-center">
          <p className="truncate text-sm font-medium">{title}</p>
          <p className="truncate text-[11px]" style={{ color: 'var(--panel-muted)' }}>
            {author}
          </p>
        </div>

        <button type="button" className={iconButton} onClick={onOpenToc} aria-label="打开目录">
          <ListTree className="h-5 w-5" />
        </button>
        <button type="button" className={iconButton} onClick={onOpenSettings} aria-label="阅读设置">
          <Settings2 className="h-5 w-5" />
        </button>
      </div>
      <div className="h-px" style={{ background: 'var(--panel-line)' }} />
    </div>
  )
}
