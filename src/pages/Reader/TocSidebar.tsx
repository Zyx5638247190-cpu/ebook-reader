import { useEffect, useMemo, useRef } from 'react'
import { X } from 'lucide-react'
import type { TocNode } from '../../types'
import { isJumpableTocNode } from '../../lib/epubToc'
import { cn } from '../../lib/text'

interface TocSidebarProps {
  open: boolean
  bookTitle: string
  toc: TocNode[]
  activeIndex: number
  onClose: () => void
  onSelect: (node: TocNode) => void
}

export function TocSidebar({
  open,
  bookTitle,
  toc,
  activeIndex,
  onClose,
  onSelect,
}: TocSidebarProps) {
  const activeRef = useRef<HTMLButtonElement>(null)

  const orderByIndex = useMemo(() => {
    const order = new Map<number, number>()
    let count = 0
    toc.forEach((node, index) => {
      if (isJumpableTocNode(node)) order.set(index, (count += 1))
    })
    return order
  }, [toc])

  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => {
      activeRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }, 260)
    return () => window.clearTimeout(timer)
  }, [open, activeIndex])

  return (
    <div className={cn('fixed inset-0 z-50', !open && 'pointer-events-none')} inert={!open}>
      <div
        className={cn(
          'absolute inset-0 bg-ink-900/25 backdrop-blur-[2px] transition-opacity duration-300',
          open ? 'opacity-100' : 'opacity-0',
        )}
        onClick={onClose}
      />

      <aside
        className={cn(
          'absolute left-0 top-0 flex h-full w-[330px] max-w-[86vw] flex-col shadow-soft transition-transform duration-300 ease-out',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
        style={{
          background: 'var(--panel-bg)',
          color: 'var(--panel-fg)',
          borderRight: '1px solid var(--panel-line)',
        }}
        aria-label="目录"
      >
        <div
          className="flex items-start gap-3 px-5 pb-4 pt-5"
          style={{ borderBottom: '1px solid var(--panel-line)' }}
        >
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-widest" style={{ color: 'var(--panel-muted)' }}>
              目录
            </p>
            <h2 className="mt-1 line-clamp-2 text-sm font-medium leading-snug">{bookTitle}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭目录"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition hover:bg-brand-300/25"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="chapter-list flex-1 overflow-y-auto px-3 py-3">
          {toc.length === 0 && (
            <p className="px-3 py-6 text-center text-xs" style={{ color: 'var(--panel-muted)' }}>
              这本书没有目录，试着直接往下读吧
            </p>
          )}

          {toc.map((node, index) => {
            const active = index === activeIndex
            const order = orderByIndex.get(index)

            if (order === undefined) {
              return (
                <p
                  key={`group-${index}-${node.label}`}
                  className="mb-1 mt-3 px-3 text-[11px] font-medium tracking-wide first:mt-0"
                  style={{
                    paddingLeft: 12 + node.level * 14,
                    color: 'var(--panel-muted)',
                  }}
                >
                  {node.label}
                </p>
              )
            }

            return (
              <button
                key={`${node.label}-${index}`}
                ref={active ? activeRef : null}
                type="button"
                onClick={() => onSelect(node)}
                title={node.label}
                aria-current={active ? 'true' : undefined}
                className={cn(
                  'mb-0.5 flex w-full items-baseline gap-2 rounded-lg py-2 pr-3 text-left text-[13px] leading-relaxed transition',
                  active ? 'bg-brand-300/30 font-medium' : 'hover:bg-brand-300/15',
                )}
                style={{
                  paddingLeft: 12 + node.level * 14,
                  color: active ? 'var(--panel-fg)' : 'var(--panel-muted)',
                  boxShadow: active ? 'inset 2px 0 0 var(--color-brand-500)' : undefined,
                }}
              >
                <span className="w-5 shrink-0 text-[10px] tabular-nums opacity-60">{order}</span>
                <span className="line-clamp-3">{node.label}</span>
              </button>
            )
          })}
        </div>

        <div
          className="px-5 py-3 text-[11px]"
          style={{ borderTop: '1px solid var(--panel-line)', color: 'var(--panel-muted)' }}
        >
          共 {orderByIndex.size} 章 · 点击任意章节跳转
        </div>
      </aside>
    </div>
  )
}
