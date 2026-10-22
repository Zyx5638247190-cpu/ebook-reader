import { describe, expect, it } from 'vitest'
import { decodeTxt, readTxtMeta } from './txt'
import { splitTxtChapters } from './txtChapters'
import { locateTxtPosition, txtReadPercent } from './txtPosition'
import type { TxtChapter } from '../types'

function bytes(values: number[]): Uint8Array {
  return Uint8Array.from(values)
}

describe('decodeTxt', () => {
  it('识别 UTF-8 BOM 并去掉 BOM', () => {
    const body = new TextEncoder().encode('第一章 风')
    const buffer = new Uint8Array([0xef, 0xbb, 0xbf, ...body])
    const result = decodeTxt(buffer.buffer as ArrayBuffer)
    expect(result.encoding).toBe('UTF-8 BOM')
    expect(result.text).toBe('第一章 风')
  })

  it('识别 UTF-16LE BOM', () => {
    const buffer = new Uint8Array([0xff, 0xfe, 0x76, 0x59, 0x99, 0x9f])
    const result = decodeTxt(buffer.buffer as ArrayBuffer)
    expect(result.encoding).toBe('UTF-16LE')
    expect(result.text).toBe('奶龙')
  })

  it('非法 UTF-8 时降级 GBK', () => {
    const buffer = bytes([0xc4, 0xe3, 0xba, 0xc3])
    const result = decodeTxt(buffer.buffer as ArrayBuffer)
    expect(result.encoding).toBe('GBK')
    expect(result.text).toBe('你好')
  })

  it('统一换行并压缩多余空行', () => {
    const text = new TextEncoder().encode('第一行\r\n\r\n\r\n\r\n第二行\r结束')
    const result = decodeTxt(text.buffer as ArrayBuffer)
    expect(result.text).toBe('第一行\n\n第二行\n结束')
  })
})

describe('splitTxtChapters', () => {
  it('按章节标题切分', () => {
    const text = ['第一章 风', '正文一', '第二章 雨', '正文二', '第三章 雪', '正文三'].join('\n')
    const chapters = splitTxtChapters(text)
    expect(chapters.map((chapter) => chapter.title)).toEqual([
      '第一章 风',
      '第二章 雨',
      '第三章 雪',
    ])
  })

  it('首个标题前的正文归入「开始」章节', () => {
    const preface = '这是一段写在章节之前的引子文字，长度需要超过四十个字符才能被单独保留下来，所以再多写一点点内容。'
    const text = [preface, '第一章 风', '正文'].join('\n')
    const chapters = splitTxtChapters(text)
    expect(chapters[0].title).toBe('开始')
    expect(chapters[1].title).toBe('第一章 风')
  })

  it('没有章节标题时按固定字数切块', () => {
    const paragraph = '奶龙把书翻到下一页，窗外的风刚好吹动窗帘。\n'
    const chapters = splitTxtChapters(paragraph.repeat(600))
    expect(chapters.length).toBeGreaterThan(1)
    expect(chapters[0].title).toBe('第 1 节')
  })

  it('空文本返回空数组', () => {
    expect(splitTxtChapters('   \n  ')).toEqual([])
  })
})

describe('readTxtMeta', () => {
  it('从文件名和正文中提取书名、作者', () => {
    const meta = readTxtMeta('任意文件名.txt', '作者：奶龙饲养员\n正文')
    expect(meta.title).toBe('任意文件名')
    expect(meta.author).toBe('奶龙饲养员')
  })

  it('识别书名号与「书名-作者」形式', () => {
    expect(readTxtMeta('《月亮与奶龙》.txt', '正文').title).toBe('月亮与奶龙')
    const dash = readTxtMeta('奶龙的森林-小明.txt', '正文')
    expect(dash.title).toBe('奶龙的森林')
    expect(dash.author).toBe('小明')
  })

  it('没有作者信息时返回未知作者', () => {
    expect(readTxtMeta('无题.txt', '正文').author).toBe('未知作者')
  })
})

describe('splitTxtChapters 标题识别', () => {
  it('识别带空格的数字章节与全角数字', () => {
    const text = ['第 1 章 风', '正文一', '第１２３章 雪', '正文二'].join('\n')
    expect(splitTxtChapters(text).map((chapter) => chapter.title)).toEqual([
      '第 1 章 风',
      '第１２３章 雪',
    ])
  })

  it('识别卷标题，并给卷内章节缩进一级', () => {
    const text = ['第一卷 风起', '第一章 初见', '正文一', '第二章 再遇', '正文二'].join('\n')
    const chapters = splitTxtChapters(text)
    expect(chapters.map((chapter) => chapter.title)).toEqual(['第一章 初见', '第二章 再遇'])
    expect(chapters.map((chapter) => chapter.level)).toEqual([1, 1])
  })

  it('识别带括号的标题与英文 Chapter', () => {
    const text = ['【第一章 风】', '正文一', 'Chapter 12 The Rain', '正文二'].join('\n')
    expect(splitTxtChapters(text).map((chapter) => chapter.title)).toEqual([
      '第一章 风',
      'Chapter 12 The Rain',
    ])
  })

  it('识别番外等特殊章节', () => {
    const text = ['番外一 小房间', '正文一'].join('\n')
    expect(splitTxtChapters(text)[0].title).toBe('番外一 小房间')
  })

  it('以句号结尾的正文不会被误判为标题', () => {
    const text = ['第一章里，奶龙把书翻到下一页。', '后面还有更多正文内容。'].join('\n')
    expect(splitTxtChapters(text)[0].title).toBe('正文')
  })

  it('识别「第X节」', () => {
    const text = ['第 1 节 风', '正文一', '第2节 雨', '正文二'].join('\n')
    expect(splitTxtChapters(text).map((chapter) => chapter.title)).toEqual([
      '第 1 节 风',
      '第2节 雨',
    ])
  })

  it('识别带装饰符号的标题', () => {
    const text = ['=== 第一章 风 ===', '正文一', '## 第二章 雨', '正文二', '—— 番外 ——', '正文三'].join(
      '\n',
    )
    expect(splitTxtChapters(text).map((chapter) => chapter.title)).toEqual([
      '第一章 风',
      '第二章 雨',
      '番外',
    ])
  })

  it('保留成对括号，不误删「第一章（上）」的右括号', () => {
    const text = ['第一章（上）', '正文'].join('\n')
    expect(splitTxtChapters(text)[0].title).toBe('第一章（上）')
  })

  it('卷标题只影响它之后的章节层级', () => {
    const text = ['第一章 序', '正文一', '第一卷 风起', '第二章 初见', '正文二'].join('\n')
    const chapters = splitTxtChapters(text)
    expect(chapters.map((chapter) => [chapter.title, chapter.level, chapter.volumeTitle])).toEqual([
      ['第一章 序', 0, undefined],
      ['第二章 初见', 1, '第一卷 风起'],
    ])
  })
})

describe('locateTxtPosition', () => {
  const chapters: TxtChapter[] = [
    { index: 0, title: '第一章', start: 0, end: 100 },
    { index: 1, title: '第二章', start: 110, end: 210 },
  ]

  it('优先使用章节与章内字符偏移', () => {
    expect(
      locateTxtPosition(chapters, 210, { chapterIndex: 1, charOffset: 40, percent: 0.1 }),
    ).toEqual({ chapterIndex: 1, charOffset: 40 })
  })

  it('章节索引失效时按全书百分比降级', () => {
    expect(
      locateTxtPosition(chapters, 210, { chapterIndex: 9, charOffset: 30, percent: 0.6 }),
    ).toEqual({ chapterIndex: 1, charOffset: 16 })
  })

  it('字符偏移越界或旧记录缺少偏移时按百分比降级', () => {
    expect(
      locateTxtPosition(chapters, 210, { chapterIndex: 0, charOffset: 999, percent: 0.6 }),
    ).toEqual({ chapterIndex: 1, charOffset: 16 })
    expect(locateTxtPosition(chapters, 210, { chapterIndex: 0, percent: 0.6 })).toEqual({
      chapterIndex: 1,
      charOffset: 16,
    })
  })

  it('章节起点变化（重新切分）时不使用旧偏移', () => {
    // 章内偏移 50 本身合法，但该章已经不再从 0 开始，说明章节结构变了
    expect(
      locateTxtPosition(chapters, 210, {
        chapterIndex: 0,
        charOffset: 50,
        chapterStart: 30,
        percent: 0.6,
      }),
    ).toEqual({ chapterIndex: 1, charOffset: 16 })
  })

  it('章节起点一致时仍按字符偏移精确回位', () => {
    expect(
      locateTxtPosition(chapters, 210, {
        chapterIndex: 1,
        charOffset: 40,
        chapterStart: 110,
        percent: 0.1,
      }),
    ).toEqual({ chapterIndex: 1, charOffset: 40 })
  })

  it('百分比落在标题行等章节间隙时归入前一章末尾', () => {
    expect(
      locateTxtPosition(chapters, 210, { chapterIndex: 9, charOffset: 50, percent: 0.5 }),
    ).toEqual({ chapterIndex: 0, charOffset: 100 })
  })

  it('没有进度或章节为空时从头开始', () => {
    expect(locateTxtPosition(chapters, 210, null)).toEqual({ chapterIndex: 0, charOffset: 0 })
    expect(locateTxtPosition([], 210, null)).toEqual({ chapterIndex: 0, charOffset: 0 })
  })
})

describe('txtReadPercent', () => {
  const chapters: TxtChapter[] = [
    { index: 0, title: '第一章', start: 0, end: 100 },
    { index: 1, title: '第二章', start: 110, end: 210 },
  ]

  it('中间页按当前页起始字符计算', () => {
    expect(txtReadPercent(chapters, 210, 0, 0, 2, 0)).toBe(0)
    expect(txtReadPercent(chapters, 210, 0, 1, 2, 50)).toBeCloseTo(50 / 210)
    expect(txtReadPercent(chapters, 210, 1, 0, 3, 0)).toBeCloseTo(110 / 210)
  })

  it('读到最后一章的最后一页记为 100%，不再停在 9x%', () => {
    expect(txtReadPercent(chapters, 210, 1, 2, 3, 60)).toBe(1)
  })

  it('单章书只有一页时也直接记为读完', () => {
    const single: TxtChapter[] = [{ index: 0, title: '正文', start: 0, end: 500 }]
    expect(txtReadPercent(single, 500, 0, 0, 1, 0)).toBe(1)
  })

  it('空文本或未就绪时返回 0', () => {
    expect(txtReadPercent(chapters, 0, 0, 0, 1, 0)).toBe(0)
    expect(txtReadPercent([], 210, 0, 0, 1, 0)).toBe(0)
    expect(txtReadPercent(chapters, 210, 0, 0, 0, 0)).toBe(0)
  })
})
