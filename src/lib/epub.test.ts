import { describe, expect, it, vi } from 'vitest'
import type { Book, Rendition } from 'epubjs'
import type { ProgressRecord } from '../types'
import { restoreEpubPosition } from './epubNavigation'
import { findTocIndex, flattenToc, isContentSectionHref, resolveTocHref, tocFromSpine } from './epubToc'

function progress(overrides: Partial<ProgressRecord> = {}): ProgressRecord {
  return {
    chapterIndex: 0,
    pageIndex: 0,
    percent: 0,
    updatedAt: 0,
    ...overrides,
  }
}

function makeRendition(calls: Array<string | undefined>) {
  const display = vi.fn(async (target?: string) => {
    calls.push(target)
    if (target === 'cfi-bad') throw new Error('bad cfi')
    if (target === 'href-bad') throw new Error('bad href')
  })
  return { display } as unknown as Rendition
}

function makeBook(cfi: string | null): Book {
  return {
    locations: {
      cfiFromPercentage: () => cfi,
    },
  } as unknown as Book
}

describe('restoreEpubPosition', () => {
  it('优先使用精确 CFI', async () => {
    const calls: Array<string | undefined> = []
    await restoreEpubPosition(
      makeRendition(calls),
      makeBook('cfi-percent'),
      progress({ cfi: 'cfi-ok', href: 'href-ok', percent: 0.5 }),
      async () => true,
    )
    expect(calls).toEqual(['cfi-ok'])
  })

  it('CFI 失效时退回章节 href', async () => {
    const calls: Array<string | undefined> = []
    await restoreEpubPosition(
      makeRendition(calls),
      makeBook('cfi-percent'),
      progress({ cfi: 'cfi-bad', href: 'href-ok', percent: 0.5 }),
      async () => true,
    )
    expect(calls).toEqual(['cfi-bad', 'href-ok'])
  })

  it('CFI 与 href 都失效时按全书百分比定位', async () => {
    const calls: Array<string | undefined> = []
    const ensure = vi.fn(async () => true)
    await restoreEpubPosition(
      makeRendition(calls),
      makeBook('cfi-percent'),
      progress({ cfi: 'cfi-bad', href: 'href-bad', percent: 0.5 }),
      ensure,
    )
    expect(ensure).toHaveBeenCalledOnce()
    expect(calls).toEqual(['cfi-bad', 'href-bad', 'cfi-percent'])
  })

  it('全部失效时从头打开', async () => {
    const calls: Array<string | undefined> = []
    await restoreEpubPosition(
      makeRendition(calls),
      makeBook('cfi-percent'),
      progress({ cfi: 'cfi-bad', href: 'href-bad', percent: 0 }),
      async () => true,
    )
    expect(calls).toEqual(['cfi-bad', 'href-bad', undefined])
  })

  it('locations 生成失败也不会阻塞打开', async () => {
    const calls: Array<string | undefined> = []
    await restoreEpubPosition(
      makeRendition(calls),
      makeBook('cfi-percent'),
      progress({ cfi: 'cfi-bad', percent: 0.4 }),
      async () => {
        throw new Error('locations failed')
      },
    )
    expect(calls).toEqual(['cfi-bad', undefined])
  })

  it('没有历史进度时直接显示第一页', async () => {
    const calls: Array<string | undefined> = []
    await restoreEpubPosition(makeRendition(calls), makeBook(null), null, async () => true)
    expect(calls).toEqual([undefined])
  })
})

describe('flattenToc', () => {
  it('保留嵌套层级，并把 nav 相对 href 对齐到 spine', () => {
    const toc = flattenToc(
      [
        {
          label: '第一卷 月亮与书架',
          href: '',
          subitems: [{ label: '第一章 借来的月亮', href: 'chapter1.xhtml' }],
        },
      ],
      ['Text/chapter1.xhtml', 'Text/chapter2.xhtml'],
      'Text',
    )

    expect(toc.map((node) => node.label)).toEqual(['第一卷 月亮与书架', '第一章 借来的月亮'])
    expect(toc.map((node) => node.level)).toEqual([0, 1])
    expect(toc[0].href).toBeUndefined()
    expect(toc[1]).toMatchObject({ href: 'Text/chapter1.xhtml', chapterIndex: 0 })
  })

  it('目录 href 已经是 OPF 相对路径时不会重复加前缀', () => {
    const toc = flattenToc(
      [{ label: '第一章', href: 'Text/chapter1.xhtml' }],
      ['Text/chapter1.xhtml'],
      'OEBPS',
    )
    expect(toc[0].href).toBe('Text/chapter1.xhtml')
  })

  it('路径无法匹配 spine 时保留解析后的路径与锚点', () => {
    expect(resolveTocHref('chapter1.xhtml#p3', [], 'Text')).toEqual({
      href: 'Text/chapter1.xhtml#p3',
      chapterIndex: undefined,
    })
    expect(resolveTocHref('chapter1.xhtml#p3', ['Text/chapter1.xhtml'], 'Text')).toEqual({
      href: 'Text/chapter1.xhtml#p3',
      chapterIndex: 0,
    })
  })
})

describe('tocFromSpine', () => {
  it('没有目录时按 spine 生成可跳转章节，并保留真实 spine 序号', () => {
    expect(tocFromSpine(['a.xhtml', '', 'c.xhtml'])).toEqual([
      { label: '第 1 章', level: 0, href: 'a.xhtml', chapterIndex: 0 },
      { label: '第 3 章', level: 0, href: 'c.xhtml', chapterIndex: 2 },
    ])
  })

  it('跳过封面、目录页与非线性 spine 项', () => {
    const hrefs = ['cover.xhtml', 'Text/ch1.xhtml', 'nav.xhtml', 'Text/ch2.xhtml']
    const sections = [
      { index: 0, href: 'cover.xhtml', linear: true },
      { index: 1, href: 'Text/ch1.xhtml', linear: true },
      { index: 2, href: 'nav.xhtml', linear: true },
      { index: 3, href: 'Text/ch2.xhtml', linear: false },
    ]
    expect(tocFromSpine(hrefs, sections)).toEqual([
      { label: '第 2 章', level: 0, href: 'Text/ch1.xhtml', chapterIndex: 1 },
    ])
  })

  it('识别常见的非正文文件名', () => {
    expect(isContentSectionHref('OEBPS/cover.xhtml')).toBe(false)
    expect(isContentSectionHref('OEBPS/Text/titlepage.xhtml')).toBe(false)
    expect(isContentSectionHref('OEBPS/toc.ncx')).toBe(false)
    expect(isContentSectionHref('OEBPS/Text/chapter1.xhtml')).toBe(true)
    expect(isContentSectionHref('OEBPS/Text/contents-of-heart.xhtml')).toBe(true)
  })
})

describe('findTocIndex', () => {
  const toc = [
    { label: '第一节', level: 0, href: 'Text/chapter1.xhtml#p1' },
    { label: '第二节', level: 0, href: 'Text/chapter2.xhtml' },
  ]

  it('优先按锚点精确匹配', () => {
    expect(findTocIndex(toc, 'Text/chapter1.xhtml#p1')).toBe(0)
  })

  it('忽略目录与 spine 的路径前缀差异', () => {
    expect(findTocIndex(toc, 'chapter2.xhtml')).toBe(1)
  })

  it('未知位置返回 -1', () => {
    expect(findTocIndex(toc, 'Text/chapter9.xhtml')).toBe(-1)
  })
})
