import type { FontSize, ReaderTheme } from '../types'

export const FONT_SIZE_MAP: Record<FontSize, number> = {
  small: 16,
  medium: 19,
  large: 23,
}

export const FONT_SIZE_LABEL: Record<FontSize, string> = {
  small: '小',
  medium: '中',
  large: '大',
}

export const THEME_META: Record<ReaderTheme, { label: string; bg: string; fg: string }> = {
  light: { label: '白色', bg: '#FFFFFF', fg: '#2B2B2B' },
  sepia: { label: '米黄', bg: '#FBF3E0', fg: '#4A3F35' },
  dark: { label: '夜间', bg: '#1E1B18', fg: '#C9C2B6' },
}

/** epub.js 在 iframe 内渲染，CSS 变量无法穿透，需单独注入 */
export const EPUB_THEME_COLORS: Record<ReaderTheme, { bg: string; fg: string }> = {
  light: { bg: '#FFFFFF', fg: '#2B2B2B' },
  sepia: { bg: '#FBF3E0', fg: '#4A3F35' },
  dark: { bg: '#1E1B18', fg: '#C9C2B6' },
}
