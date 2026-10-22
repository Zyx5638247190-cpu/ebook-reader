import type { Book as EpubBook, Rendition } from 'epubjs'
import type { ProgressRecord, TocNode } from '../types'
import { clampPercent } from './text'
import {
  dirname,
  flattenToc,
  isJumpableTocNode,
  tocFromSpine,
  type RawTocItem,
  type SpineSectionInfo,
} from './epubToc'

interface SpineSection {
  index: number
  href: string
  linear?: boolean
}

/** spine href 以 OPF 为基准，目录 href 以 nav / ncx 为基准，两者需要对齐 */
export function readSpineHrefs(book: EpubBook): string[] {
  const hrefs: string[] = []
  book.spine.each((section: SpineSection) => {
    if (typeof section?.index === 'number' && typeof section.href === 'string') {
      hrefs[section.index] = section.href
    }
  })
  return hrefs.map((href) => href ?? '')
}

/** 保留 spine 序号与 linear 标记，兜底目录用它过滤封面、版权页等非正文项 */
export function readSpineSections(book: EpubBook): SpineSectionInfo[] {
  const sections: Array<SpineSectionInfo | undefined> = []
  book.spine.each((section: SpineSection) => {
    if (typeof section?.index === 'number' && typeof section.href === 'string') {
      sections[section.index] = {
        index: section.index,
        href: section.href,
        linear: section.linear !== false,
      }
    }
  })
  return sections.filter((section): section is SpineSectionInfo => Boolean(section))
}

export function tocBaseDir(book: EpubBook): string {
  return dirname(book.packaging?.navPath || book.packaging?.ncxPath || '')
}

/**
 * 解析目录：优先 nav / ncx，缺失或损坏时退回 spine，
 * 保证侧边栏始终有完整章节列表可跳转。
 */
export async function readEpubToc(book: EpubBook): Promise<TocNode[]> {
  const spineHrefs = readSpineHrefs(book)
  const baseDir = tocBaseDir(book)

  try {
    const navigation = await book.loaded.navigation
    const toc = flattenToc(navigation.toc as RawTocItem[], spineHrefs, baseDir)
    if (toc.some(isJumpableTocNode)) return toc
  } catch {
    /* nav / ncx 缺失或损坏，使用 spine 兜底 */
  }

  return tocFromSpine(spineHrefs, readSpineSections(book))
}

const GENERATED_LABEL = /^第 \d+ 章$/
const MAX_TITLE_LOOKUPS = 120

function cleanSectionTitle(raw: string | null | undefined): string {
  return (raw ?? '').replace(/\s+/g, ' ').trim().slice(0, 60)
}

/**
 * 无目录 EPUB 的兜底标题：逐个读取 section 的首个 h1–h4（其次 <title>），
 * 让侧边栏显示真实章节名而不是「第 N 章」。只在标题全是占位符时执行，
 * 并限制读取数量，避免超大书籍拖慢首次打开。
 */
export async function enrichSpineToc(book: EpubBook, toc: TocNode[]): Promise<TocNode[]> {
  const jumpable = toc.filter((node) => node.chapterIndex !== undefined)
  if (jumpable.length === 0 || !jumpable.every((node) => GENERATED_LABEL.test(node.label))) {
    return toc
  }

  const titles = new Map<number, string>()
  for (const node of jumpable.slice(0, MAX_TITLE_LOOKUPS)) {
    const index = node.chapterIndex
    if (index === undefined) continue

    const section = book.spine.get(index)
    if (!section) continue

    try {
      await (section.load(book.load.bind(book)) as unknown as Promise<unknown>)
      const document = section.document
      const heading = document?.querySelector('h1, h2, h3, h4')
      const title =
        cleanSectionTitle(heading?.textContent) ||
        cleanSectionTitle(document?.querySelector('title')?.textContent)
      if (title) titles.set(index, title)
    } catch {
      /* 单节读取失败时保留「第 N 章」占位标题 */
    }
  }

  if (titles.size === 0) return toc
  return toc.map((node) => {
    if (node.chapterIndex === undefined) return node
    const title = titles.get(node.chapterIndex)
    return title ? { ...node, label: title } : node
  })
}

/**
 * EPUB 进度降级链：精确 CFI → 章节 href → 全书百分比 → 从头开始。
 * 每一级失败都继续下一级，保证任何情况下都能打开书。
 */
export async function restoreEpubPosition(
  rendition: Rendition,
  epubBook: EpubBook,
  saved: ProgressRecord | null,
  ensureLocations: () => Promise<unknown>,
): Promise<void> {
  if (saved?.cfi) {
    try {
      await rendition.display(saved.cfi)
      return
    } catch {
      /* CFI 失效，继续降级 */
    }
  }

  if (saved?.href) {
    try {
      await rendition.display(saved.href)
      return
    } catch {
      /* 章节路径失效，继续降级 */
    }
  }

  if (saved && saved.percent > 0) {
    try {
      await ensureLocations()
      const cfi = epubBook.locations.cfiFromPercentage(clampPercent(saved.percent))
      if (cfi) {
        await rendition.display(cfi)
        return
      }
    } catch {
      /* 百分比映射失败，从头开始 */
    }
  }

  await rendition.display()
}
