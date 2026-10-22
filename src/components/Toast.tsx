import { CheckCircle2, X, XCircle } from 'lucide-react'
import type { Notice } from '../stores/libraryStore'
import { cn } from '../lib/text'

interface ToastProps {
  notice: Notice
  onClose: () => void
}

export function Toast({ notice, onClose }: ToastProps) {
  const isError = notice.type === 'error'

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-8 z-50 flex justify-center px-6">
      <div
        role="status"
        className={cn(
          'pointer-events-auto flex max-w-xl items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-soft backdrop-blur-md',
          isError
            ? 'border-danger-200 bg-danger-50/95 text-danger-700'
            : 'border-brand-200 bg-cream-50/95 text-ink-900',
        )}
      >
        {isError ? (
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
        ) : (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
        )}
        <span className="leading-relaxed">{notice.text}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭提示"
          className="ml-1 rounded-md p-0.5 opacity-60 transition hover:opacity-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
