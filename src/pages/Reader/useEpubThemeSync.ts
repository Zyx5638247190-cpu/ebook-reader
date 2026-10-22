import { useEffect } from 'react'
import type { RefObject } from 'react'
import type { Rendition } from 'epubjs'
import type { ReaderSettings } from '../../types'
import { FONT_SIZE_MAP } from '../../lib/constants'
import { applyEpubTheme } from '../../lib/epubTheme'

/**
 * EPUB 的主题与字号无法通过外层 CSS 变量同步，
 * 必须同时更新 iframe 内样式，并在重排后按 CFI 回到原位置。
 */
export function useEpubThemeSync(
  renditionRef: RefObject<Rendition | null>,
  currentCfiRef: RefObject<string>,
  settings: ReaderSettings,
  ready: boolean,
) {
  useEffect(() => {
    const rendition = renditionRef.current
    if (!rendition || !ready) return

    applyEpubTheme(rendition, settings.theme)
    rendition.themes.fontSize(`${FONT_SIZE_MAP[settings.fontSize]}px`)

    const cfi = currentCfiRef.current
    if (!cfi) return

    const timer = window.setTimeout(() => {
      rendition.display(cfi).catch(() => {
        /* 重排后 CFI 偶发失效时保持当前位置，不打扰用户 */
      })
    }, 120)

    return () => window.clearTimeout(timer)
  }, [renditionRef, currentCfiRef, settings.theme, settings.fontSize, ready])
}
