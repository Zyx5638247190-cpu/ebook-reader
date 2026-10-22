import type { Book as EpubBook } from 'epubjs'
import type { TocNode } from '../types'
import { isJumpableTocNode } from './epubToc'
import { readEpubToc } from './epubNavigation'

let epubLoader: Promise<typeof import('epubjs').default> | null = null

/** epub.js 体积较大，按需加载，避免拖慢只有 TXT 的启动路径 */
export function loadEpubjs() {
  if (!epubLoader) {
    epubLoader = import('epubjs')
      .then((module) => module.default)
      .catch((error: unknown) => {
        epubLoader = null
        throw error
      })
  }
  return epubLoader
}

export interface EpubMeta {
  title: string
  author: string
  cover?: Blob
  toc: TocNode[]
  totalChapters: number
}

function normalizeCreator(creator: unknown): string {
  if (Array.isArray(creator)) {
    return creator.filter(Boolean).join('、') || '未知作者'
  }
  if (typeof creator === 'string' && creator.trim()) return creator.trim()
  return '未知作者'
}

/**
 * 只读取元数据、封面和目录，读完立即销毁，避免和阅读页的 rendition 抢占资源。
 */
export async function readEpubMeta(bytes: ArrayBuffer): Promise<EpubMeta> {
  let ePub: typeof import('epubjs').default
  try {
    ePub = await loadEpubjs()
  } catch {
    throw new Error('EPUB 解析组件加载失败，请刷新页面后重试')
  }
  const book: EpubBook = ePub(bytes as unknown as string)

  try {
    await book.ready

    const metadata = book.packaging.metadata
    let cover: Blob | undefined

    try {
      const coverUrl = await book.coverUrl()
      if (coverUrl) {
        const response = await fetch(coverUrl)
        cover = await response.blob()
        if (coverUrl.startsWith('blob:')) URL.revokeObjectURL(coverUrl)
      }
    } catch {
      /* 无封面或封面损坏时使用占位封面 */
    }

    const toc = await readEpubToc(book)

    return {
      title: (metadata.title || '').trim() || '未命名书籍',
      author: normalizeCreator(metadata.creator),
      cover,
      toc,
      totalChapters: toc.filter(isJumpableTocNode).length,
    }
  } finally {
    book.destroy()
  }
}
