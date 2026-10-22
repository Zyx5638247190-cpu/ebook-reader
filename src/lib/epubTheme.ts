import type { Rendition } from 'epubjs'
import type { ReaderTheme } from '../types'
import { EPUB_THEME_COLORS, FONT_SIZE_MAP } from './constants'

/** CSS 变量无法进入 EPUB iframe，主题必须通过 rendition.themes 注入 */
export function applyEpubTheme(rendition: Rendition, theme: ReaderTheme) {
  const colors = EPUB_THEME_COLORS[theme]

  rendition.themes.register('light', {
    body: { background: '#FFFFFF', color: '#2B2B2B' },
  })
  rendition.themes.register('sepia', {
    body: { background: '#FBF3E0', color: '#4A3F35' },
  })
  rendition.themes.register('dark', {
    body: { background: '#1E1B18', color: '#C9C2B6' },
    img: { filter: 'brightness(0.8)' },
  })

  rendition.themes.select(theme)
  // EPUB 自带样式可能写死白底，必须强制覆盖
  rendition.themes.override('background', colors.bg, true)
  rendition.themes.override('color', colors.fg, true)
}

/** 初始化一次正文排版，主题与字号可随后单独更新 */
export function applyEpubTypography(
  rendition: Rendition,
  theme: ReaderTheme,
  fontSize: keyof typeof FONT_SIZE_MAP,
) {
  rendition.themes.default({
    body: {
      'font-family': '"Songti SC", "SimSun", "Noto Serif SC", serif',
      'line-height': '1.8',
      padding: '0 8%',
      'text-align': 'left',
      'word-break': 'break-word',
    },
    p: { margin: '0 0 0.8em', 'text-indent': '2em' },
    'h1, h2, h3': { 'line-height': '1.5', margin: '0.6em 0 0.8em' },
    img: { 'max-width': '100%', height: 'auto' },
    a: { color: 'inherit', 'text-decoration': 'none' },
  })

  applyEpubTheme(rendition, theme)
  rendition.themes.fontSize(`${FONT_SIZE_MAP[fontSize]}px`)
}
