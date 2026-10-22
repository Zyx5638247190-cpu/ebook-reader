import { Check, Type, X } from 'lucide-react'
import type { FontSize, ReaderSettings, ReaderTheme } from '../../types'
import { FONT_SIZE_LABEL, THEME_META } from '../../lib/constants'
import { cn } from '../../lib/text'
import { DragonMascot } from '../../components/DragonMascot'

interface SettingsPanelProps {
  open: boolean
  settings: ReaderSettings
  onClose: () => void
  onChangeFontSize: (size: FontSize) => void
  onChangeTheme: (theme: ReaderTheme) => void
}

const FONT_OPTIONS: Array<{ id: FontSize; px: number }> = [
  { id: 'small', px: 16 },
  { id: 'medium', px: 19 },
  { id: 'large', px: 23 },
]

const THEME_OPTIONS: ReaderTheme[] = ['light', 'sepia', 'dark']

export function SettingsPanel({
  open,
  settings,
  onClose,
  onChangeFontSize,
  onChangeTheme,
}: SettingsPanelProps) {
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
          'absolute right-0 top-0 flex h-full w-[330px] max-w-[86vw] flex-col shadow-soft transition-transform duration-300 ease-out',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
        style={{
          background: 'var(--panel-bg)',
          color: 'var(--panel-fg)',
          borderLeft: '1px solid var(--panel-line)',
        }}
        aria-label="阅读设置"
      >
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--panel-line)' }}
        >
          <h2 className="text-sm font-medium">阅读设置</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭设置"
            className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-brand-300/25"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="panel-scroll flex-1 overflow-y-auto px-5 py-5">
          <section>
            <div className="mb-3 flex items-center gap-2 text-xs" style={{ color: 'var(--panel-muted)' }}>
              <Type className="h-3.5 w-3.5" />
              <span>字号</span>
              <span className="ml-auto">即时生效</span>
            </div>

            <div
              className="grid grid-cols-3 gap-2 rounded-2xl p-1.5"
              style={{ background: 'color-mix(in srgb, var(--panel-line) 45%, transparent)' }}
            >
              {FONT_OPTIONS.map((option) => {
                const active = settings.fontSize === option.id
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => onChangeFontSize(option.id)}
                    className={cn(
                      'flex flex-col items-center justify-center gap-1 rounded-xl py-3 transition',
                      active ? 'bg-brand-300 text-ink-900 shadow-sm' : 'hover:bg-brand-300/15',
                    )}
                    aria-pressed={active}
                  >
                    <span className="font-reading leading-none" style={{ fontSize: `${option.px}px` }}>
                      A
                    </span>
                    <span className="text-[11px]">{FONT_SIZE_LABEL[option.id]}</span>
                  </button>
                )
              })}
            </div>
          </section>

          <section className="mt-7">
            <div className="mb-3 flex items-center gap-2 text-xs" style={{ color: 'var(--panel-muted)' }}>
              <span className="h-3.5 w-3.5 rounded-full bg-gradient-to-br from-brand-300 to-brand-500" />
              <span>背景</span>
              <span className="ml-auto">米黄最护眼</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {THEME_OPTIONS.map((theme) => {
                const meta = THEME_META[theme]
                const active = settings.theme === theme
                return (
                  <button
                    key={theme}
                    type="button"
                    onClick={() => onChangeTheme(theme)}
                    className={cn(
                      'relative overflow-hidden rounded-xl border p-1.5 text-left transition',
                      active ? 'border-brand-500 ring-2 ring-brand-400/40' : 'border-transparent hover:border-brand-300/60',
                    )}
                    aria-pressed={active}
                    aria-label={`${meta.label}背景`}
                  >
                    <div
                      className="flex h-16 flex-col justify-center gap-1.5 rounded-lg px-2.5"
                      style={{ background: meta.bg, color: meta.fg }}
                    >
                      <span className="h-1 w-9 rounded-full bg-current opacity-40" />
                      <span className="h-1 w-full rounded-full bg-current opacity-25" />
                      <span className="h-1 w-4/5 rounded-full bg-current opacity-25" />
                    </div>
                    <div className="mt-1.5 flex items-center justify-between px-0.5">
                      <span className="text-[11px]">{meta.label}</span>
                      {active && <Check className="h-3 w-3 text-brand-500" />}
                    </div>
                  </button>
                )
              })}
            </div>
          </section>

          <section
            className="mt-7 rounded-2xl border p-4"
            style={{
              borderColor: 'var(--panel-line)',
              background: 'color-mix(in srgb, var(--panel-line) 40%, transparent)',
            }}
          >
            <p className="text-xs leading-relaxed" style={{ color: 'var(--panel-muted)' }}>
              小提示：晚上读久了，把背景换成夜间，奶龙也会把亮度调低一点。
            </p>
          </section>
        </div>

        <div
          className="flex items-center gap-3 px-5 py-4"
          style={{ borderTop: '1px solid var(--panel-line)' }}
        >
          <DragonMascot className="h-12 w-12 shrink-0" mood="sleepy" />
          <p className="text-[11px] leading-relaxed" style={{ color: 'var(--panel-muted)' }}>
            设置会自动保存，下次打开还是你喜欢的模样。
          </p>
        </div>
      </aside>
    </div>
  )
}
