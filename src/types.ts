export type BookFormat = 'txt' | 'epub'
export type FontSize = 'small' | 'medium' | 'large'
export type ReaderTheme = 'light' | 'sepia' | 'dark'

export interface BookRecord {
  id: string
  title: string
  author: string
  format: BookFormat
  fileName: string
  fileSize: number
  hasCover: boolean
  totalChapters: number
  progress: number
  lastChapter: number
  lastReadAt: number
  importedAt: number
}

export interface ReaderSettings {
  fontSize: FontSize
  theme: ReaderTheme
}

export interface ProgressRecord {
  chapterIndex: number
  pageIndex: number
  /** TXT：章内字符偏移，是恢复位置的唯一真值 */
  charOffset?: number
  /** TXT：保存时该章在全文中的起始偏移，用于识别章节重新切分 */
  chapterStart?: number
  /** EPUB：epub.js CFI */
  cfi?: string
  /** EPUB：章节 href，CFI 失效时兜底 */
  href?: string
  percent: number
  updatedAt: number
}

export interface TocNode {
  label: string
  level: number
  chapterIndex?: number
  href?: string
}

export interface PageSlice {
  start: number
  end: number
}

export interface TxtChapter {
  index: number
  title: string
  start: number
  end: number
  /** 有卷标题时，卷内章节缩进一级 */
  level?: number
  /** 所属卷标题；TXT 目录用它生成分组节点 */
  volumeTitle?: string
}

export interface ReaderStatus {
  /** 例如「本章 3 / 8 页」 */
  pageLabel: string
  /** 例如「第 2 / 5 章」；加载中可以为空 */
  chapterLabel?: string
  percent: number
}

export interface ReaderNav {
  next: () => void
  prev: () => void
  goToChapter: (node: TocNode) => void
}
