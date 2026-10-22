import type { Rendition } from 'epubjs'
import type { ProgressRecord, ReaderSettings, TocNode } from '../../types'
import { loadEpubjs } from '../../lib/epub'
import { enrichSpineToc, readEpubToc, restoreEpubPosition } from '../../lib/epubNavigation'
import { applyEpubTypography } from '../../lib/epubTheme'
import { clampPercent } from '../../lib/text'

interface RelocatedLocation {
  start: {
    cfi: string
    href: string
    displayed?: { page: number; total: number }
  }
  /** epub.js 判定当前页已经是全书最后一页 */
  atEnd?: boolean
}

export interface RelocatedInfo {
  cfi: string
  href: string
  page: number
  total: number
  locationPercent: number | null
  /** 读到书末：百分比必须直接记 100% */
  atEnd: boolean
}

export interface EpubSession {
  rendition: Rendition
  ensureLocations: () => Promise<boolean>
  percentFromCfi: (cfi: string) => number | null
  destroy: () => void
}

/** 目录跳转：优先带锚点的 href，href 失效时退回 spine 序号 */
export function displayTocNode(rendition: Rendition | null, node: TocNode): void {
  if (!rendition) return

  const goBySpineIndex = () => {
    if (node.chapterIndex === undefined) return
    void rendition.display(node.chapterIndex).catch(() => undefined)
  }

  if (node.href) void rendition.display(node.href).catch(goBySpineIndex)
  else goBySpineIndex()
}

interface OpenEpubSessionOptions {
  container: HTMLElement
  bytes: ArrayBuffer
  settings: ReaderSettings
  saved: ProgressRecord | null
  guard: { disposed: boolean }
  onToc: (toc: TocNode[]) => void
  onRelocated: (info: RelocatedInfo) => void
  onPrev: () => void
  onNext: () => void
}

/**
 * 创建一次 EPUB 阅读会话：解析、目录、渲染、恢复位置。
 * 返回 null 表示会话在初始化期间已被销毁（组件卸载 / 换书）。
 */
export async function openEpubSession({
  container,
  bytes,
  settings,
  saved,
  guard,
  onToc,
  onRelocated,
  onPrev,
  onNext,
}: OpenEpubSessionOptions): Promise<EpubSession | null> {
  let ePub: typeof import('epubjs').default
  try {
    ePub = await loadEpubjs()
  } catch {
    throw new Error('EPUB 解析组件加载失败，请刷新页面后重试')
  }
  const book = ePub(bytes as unknown as string)

  const dispose = (rendition?: Rendition) => {
    rendition?.destroy()
    book.destroy()
  }

  try {
    await book.ready
    if (guard.disposed) {
      dispose()
      return null
    }

    const toc = await readEpubToc(book)
    if (guard.disposed) {
      dispose()
      return null
    }
    onToc(toc)

    // 无目录 EPUB 先展示「第 N 章」骨架，真实标题在后台补齐，不阻塞首屏
    void enrichSpineToc(book, toc)
      .then((refined) => {
        if (guard.disposed || refined === toc) return
        onToc(refined)
      })
      .catch(() => undefined)

    const rendition = book.renderTo(container, {
      width: '100%',
      height: '100%',
      flow: 'paginated',
      spread: 'none',
      allowScriptedContent: false,
    })
    applyEpubTypography(rendition, settings.theme, settings.fontSize)

    let locationsReady = false
    const ensureLocations = async () => {
      if (locationsReady) return true
      try {
        await book.locations.generate(1600)
        locationsReady = true
      } catch {
        /* locations 生成失败时保留按章节估算的百分比 */
      }
      return locationsReady
    }

    const percentFromCfi = (cfi: string): number | null => {
      try {
        if (book.locations.length() === 0) return null
        return clampPercent(book.locations.percentageFromCfi(cfi))
      } catch {
        return null
      }
    }

    rendition.on('relocated', (event: unknown) => {
      if (guard.disposed) return
      const location = event as RelocatedLocation
      if (!location?.start?.cfi) return

      const { cfi, href } = location.start
      onRelocated({
        cfi,
        href,
        page: location.start.displayed?.page ?? 1,
        total: location.start.displayed?.total ?? 1,
        locationPercent: percentFromCfi(cfi),
        atEnd: Boolean(location.atEnd),
      })
    })

    rendition.on('keyup', (event: KeyboardEvent) => {
      if (guard.disposed) return
      if (event.key === 'ArrowLeft' || event.key === 'PageUp') onPrev()
      else if (event.key === 'ArrowRight' || event.key === 'PageDown' || event.key === ' ')
        onNext()
    })

    await restoreEpubPosition(rendition, book, saved, ensureLocations)
    if (guard.disposed) {
      dispose(rendition)
      return null
    }

    return {
      rendition,
      ensureLocations,
      percentFromCfi,
      destroy: () => dispose(rendition),
    }
  } catch (error) {
    dispose()
    throw error
  }
}
