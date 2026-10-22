import type { TocNode } from '../types'

export interface RawTocItem {
  label: string
  href?: string
  subitems?: RawTocItem[]
}

export interface HrefParts {
  path: string
  anchor: string
}

export interface ResolvedTocHref {
  href?: string
  chapterIndex?: number
}

export interface SpineSectionInfo {
  index: number
  href: string
  linear: boolean
}

const URL_SCHEME = /^[a-z][a-z0-9+.-]*:/i

/** 封面、目录、版权页等非正文 spine 项，不应出现在兜底目录里 */
const NON_CONTENT_BASENAME =
  /^(?:cover|cover[-_]?page|title[-_]?page|titlepage|toc|nav|contents|copyright|colophon|acknowledg(?:e)?ments?|dedication)\.(?:x?html?|ncx)$/i

/** 把 href 拆成路径与锚点，并统一分隔符、解码百分号编码 */
export function splitHref(href: string): HrefParts {
  const hashIndex = href.indexOf('#')
  const rawPath = hashIndex >= 0 ? href.slice(0, hashIndex) : href
  const anchor = hashIndex >= 0 ? href.slice(hashIndex + 1) : ''

  let path = rawPath.replace(/\\/g, '/').replace(/^\.\//, '')
  try {
    path = decodeURIComponent(path)
  } catch {
    /* 非法百分号编码时保留原路径 */
  }

  return { path, anchor }
}

export function normalizeHref(href: string): string {
  return splitHref(href).path
}

export function dirname(path: string): string {
  const normalized = path.replace(/\\/g, '/')
  const index = normalized.lastIndexOf('/')
  return index >= 0 ? normalized.slice(0, index) : ''
}

/**
 * 目录 href 在 nav / ncx 文档里是相对路径，而 spine 的 href 相对 OPF。
 * 这里把前者还原成后者，避免目录点了没反应或高亮错位。
 */
export function resolveRelativePath(path: string, baseDir: string): string {
  if (!path || URL_SCHEME.test(path) || path.startsWith('/')) return path

  const stack: string[] = []
  for (const segment of `${baseDir}/${path}`.split('/')) {
    if (!segment || segment === '.') continue
    if (segment === '..') stack.pop()
    else stack.push(segment)
  }
  return stack.join('/')
}

function pathMatches(candidate: string, target: string): boolean {
  if (!candidate || !target) return false
  return (
    candidate === target ||
    candidate.endsWith(`/${target}`) ||
    target.endsWith(`/${candidate}`)
  )
}

function matchSpineIndex(path: string, spineHrefs: string[]): number {
  if (!path) return -1

  const exact = spineHrefs.indexOf(path)
  if (exact >= 0) return exact

  let best = -1
  for (let index = 0; index < spineHrefs.length; index += 1) {
    const href = spineHrefs[index]
    if (!href || !pathMatches(href, path)) continue
    if (best < 0 || href.length < spineHrefs[best].length) best = index
  }
  return best
}

export function resolveTocHref(
  href: string,
  spineHrefs: string[],
  baseDir = '',
): ResolvedTocHref {
  if (!href) return {}

  const { path, anchor } = splitHref(href)
  if (!path) return {}

  let index = matchSpineIndex(path, spineHrefs)
  let target = path

  if (index < 0) {
    const resolved = resolveRelativePath(path, baseDir)
    const resolvedIndex = matchSpineIndex(resolved, spineHrefs)
    if (resolvedIndex >= 0) {
      index = resolvedIndex
      target = resolved
    }
  }

  if (index >= 0) {
    target = spineHrefs[index]
  } else {
    target = resolveRelativePath(path, baseDir) || path
  }

  return {
    href: anchor ? `${target}#${anchor}` : target,
    chapterIndex: index >= 0 ? index : undefined,
  }
}

function cleanLabel(label: string): string {
  return label.replace(/\s+/g, ' ').trim() || '未命名章节'
}

export function flattenToc(
  items: RawTocItem[],
  spineHrefs: string[] = [],
  baseDir = '',
  level = 0,
): TocNode[] {
  return items.flatMap((item) => {
    const resolved = item.href ? resolveTocHref(item.href, spineHrefs, baseDir) : {}
    const node: TocNode = {
      label: cleanLabel(item.label ?? ''),
      level,
      href: resolved.href,
      chapterIndex: resolved.chapterIndex,
    }
    const children = item.subitems
      ? flattenToc(item.subitems, spineHrefs, baseDir, level + 1)
      : []
    return [node, ...children]
  })
}

/** 没有 nav / ncx 的 EPUB 至少要给出按 spine 排列的正文章节列表 */
export function isContentSectionHref(href: string): boolean {
  const { path } = splitHref(href)
  if (!path) return false
  const basename = path.slice(path.lastIndexOf('/') + 1)
  return !NON_CONTENT_BASENAME.test(basename)
}

export function tocFromSpine(
  spineHrefs: string[],
  sections: SpineSectionInfo[] = [],
): TocNode[] {
  const infoByIndex = new Map(sections.map((section) => [section.index, section]))

  return spineHrefs.flatMap((href, index) => {
    if (!href || !isContentSectionHref(href)) return []
    const info = infoByIndex.get(index)
    if (info && !info.linear) return []
    return [{ label: `第 ${index + 1} 章`, level: 0, href, chapterIndex: index }]
  })
}

function anchorMatches(candidateHref: string, target: HrefParts): boolean {
  if (!target.anchor) return false
  const candidate = splitHref(candidateHref)
  return candidate.anchor === target.anchor && pathMatches(candidate.path, target.path)
}

/** 当前位置对应的目录项：先精确锚点，再按路径匹配（兼容目录与 spine 的路径前缀差异） */
export function findTocIndex(toc: TocNode[], href: string): number {
  if (!href || toc.length === 0) return -1

  const target = splitHref(href)
  if (!target.path) return -1

  if (target.anchor) {
    const anchored = toc.findIndex(
      (node) => node.href !== undefined && anchorMatches(node.href, target),
    )
    if (anchored >= 0) return anchored
  }

  return toc.findIndex(
    (node) => node.href !== undefined && pathMatches(splitHref(node.href).path, target.path),
  )
}

/** 目录项可分两类：可跳转章节，以及只有标题的分组（如「第一卷」） */
export function isJumpableTocNode(node: TocNode): boolean {
  return node.chapterIndex !== undefined || node.href !== undefined
}
