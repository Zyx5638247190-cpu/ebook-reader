import type { TxtChapter } from '../types'

const NUMERAL = '0-9０-９零〇一二三四五六七八九十百千万两壹贰叁肆伍陆柒捌玖拾佰仟'
const HEADING_MAX_LENGTH = 60
const CHUNK_SIZE = 8000

/** 卷标题：第一卷 / 卷一 / 上卷 / 第三部 */
const VOLUME_HEADING = new RegExp(
  `^(?:第\\s*[${NUMERAL}]+\\s*[卷部篇集]|[上中下]\\s*[卷部篇]|卷\\s*[${NUMERAL}]+)[^\\n]{0,40}$`,
)

/** 章节标题：第X章 / 第X节 / 第X回 / Chapter N，允许「正文」前缀与无空格写法 */
const CHAPTER_HEADING = new RegExp(
  `^(?:正文\\s*)?(?:第\\s*[${NUMERAL}]+\\s*[章节回节]|Chapter\\s*[0-9IVXLC]+)[^\\n]{0,40}$`,
  'i',
)

/** 特殊章节：序章 / 楔子 / 番外 / 后记 等 */
const SPECIAL_HEADING = new RegExp(
  `^(?:序章|序幕|楔子|引子|前言|序言|自序|后记|尾声|终章|番外(?:篇)?\\s*[${NUMERAL}]*|完本感言|作者的话)` +
    `(?:[\\s\\u3000:：、.．·\\-—].*)?$`,
)

type HeadingKind = 'volume' | 'chapter' | 'special'

interface TxtHeading {
  title: string
  lineStart: number
  bodyStart: number
  kind: HeadingKind
}

const WRAPPERS: Array<[string, string]> = [
  ['【', '】'],
  ['[', ']'],
  ['（', '）'],
  ['(', ')'],
  ['「', '」'],
  ['『', '』'],
]

/** 只剥离成对的包裹符号，避免把「第一章（上）」的右括号误删 */
function cleanHeading(line: string): string {
  let title = line.trim()

  for (let round = 0; round < 2; round += 1) {
    let stripped = false
    for (const [open, close] of WRAPPERS) {
      if (
        title.startsWith(open) &&
        title.endsWith(close) &&
        title.length > open.length + close.length
      ) {
        title = title.slice(open.length, -close.length).trim()
        stripped = true
      }
    }
    if (!stripped) break
  }

  return title
}

/** 网文 TXT 常见的装饰符：=== 第一章 ===、## 第二章、—— 第三章 —— */
function stripDecoration(line: string): string {
  return line
    .replace(/^[\s=*#~·•—–-]+/, '')
    .replace(/[\s=*#~·•—–-]+$/, '')
}

function matchHeading(line: string): { title: string; kind: HeadingKind } | null {
  const trimmed = stripDecoration(line)
  if (!trimmed || trimmed.length > HEADING_MAX_LENGTH) return null
  // 含句读的短句通常是正文；标题里极少出现逗号、句号、分号
  if (/[。！？!?，；;]/.test(trimmed)) return null

  const title = cleanHeading(trimmed)
  if (!title || title.length > HEADING_MAX_LENGTH) return null
  if (/[。！？!?，；;]/.test(title)) return null

  if (VOLUME_HEADING.test(title)) return { title, kind: 'volume' }
  if (SPECIAL_HEADING.test(title)) return { title, kind: 'special' }
  if (CHAPTER_HEADING.test(title)) return { title, kind: 'chapter' }
  return null
}

function collectHeadings(text: string): TxtHeading[] {
  const headings: TxtHeading[] = []
  let offset = 0

  for (const line of text.split('\n')) {
    const matched = line.trim().length > 0 ? matchHeading(line) : null
    if (matched) {
      const leading = line.length - line.trimStart().length
      headings.push({
        title: matched.title,
        kind: matched.kind,
        lineStart: offset + leading,
        bodyStart: offset + line.length + 1,
      })
    }
    offset += line.length + 1
  }

  return headings
}

/** 按标题切章；标题太少或过于稀疏时回退为固定字数切块 */
export function splitTxtChapters(text: string): TxtChapter[] {
  if (!text.trim()) return []

  const headings = collectHeadings(text)
  const averageLength =
    headings.length > 0 ? text.length / headings.length : Number.POSITIVE_INFINITY
  const usable = headings.length > 0 && averageLength < 50000

  if (usable) {
    const chapters: TxtChapter[] = []
    const first = headings[0]
    let currentVolume: string | undefined

    if (first.lineStart > 40 && text.slice(0, first.lineStart).trim().length > 0) {
      chapters.push({ index: 0, title: '开始', start: 0, end: first.lineStart, level: 0 })
    }

    headings.forEach((heading, i) => {
      if (heading.kind === 'volume') {
        currentVolume = heading.title
        return
      }

      const end = headings[i + 1]?.lineStart ?? text.length
      if (end <= heading.bodyStart) return

      chapters.push({
        index: chapters.length,
        title: heading.title,
        start: heading.bodyStart,
        end,
        level: currentVolume ? 1 : 0,
        volumeTitle: currentVolume,
      })
    })

    if (chapters.length > 0) return chapters
  }

  return chunkChapters(text)
}

function chunkChapters(text: string): TxtChapter[] {
  if (text.trim().length === 0) return []
  if (text.length <= CHUNK_SIZE) {
    return [{ index: 0, title: '正文', start: 0, end: text.length, level: 0 }]
  }

  const chapters: TxtChapter[] = []
  let start = 0

  while (start < text.length) {
    let end = Math.min(start + CHUNK_SIZE, text.length)
    if (end < text.length) {
      const newline = text.lastIndexOf('\n', end)
      if (newline > start + CHUNK_SIZE * 0.4) end = newline + 1
    }
    chapters.push({ index: chapters.length, title: `第 ${chapters.length + 1} 节`, start, end })
    start = end
  }

  return chapters
}
