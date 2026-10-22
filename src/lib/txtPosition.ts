import type { TxtChapter } from '../types'
import { clampPercent } from './text'

export interface SavedTxtProgress {
  chapterIndex: number
  charOffset?: number
  /** 保存时该章在全文中的起点，用来识别章节被重新切分 */
  chapterStart?: number
  percent: number
}

export interface TxtPosition {
  chapterIndex: number
  charOffset: number
}

/**
 * 全书阅读进度：以当前页的起始字符为准；读到最后一页直接记 100%。
 * 若只按起始位置计算，最后一页的起点永远到不了文本末尾，会出现「读完了却显示 9x%」。
 */
export function txtReadPercent(
  chapters: TxtChapter[],
  textLength: number,
  chapterIndex: number,
  pageIndex: number,
  pageCount: number,
  pageStart: number,
): number {
  if (textLength <= 0 || chapters.length === 0 || pageCount <= 0) return 0

  const chapter = chapters[chapterIndex]
  if (!chapter) return 0

  const atBookEnd = chapterIndex === chapters.length - 1 && pageIndex >= pageCount - 1
  if (atBookEnd) return 1

  return clampPercent((chapter.start + Math.max(0, pageStart)) / textLength)
}

/**
 * TXT 进度恢复：章节 + 章内字符偏移是首选；章节结构变化、偏移越界或旧记录
 * 缺少 charOffset 时，按全书百分比重新定位，避免跳回章首。
 */
export function locateTxtPosition(
  chapters: TxtChapter[],
  textLength: number,
  saved: SavedTxtProgress | null,
): TxtPosition {
  if (chapters.length === 0) return { chapterIndex: 0, charOffset: 0 }
  if (!saved) return { chapterIndex: 0, charOffset: 0 }

  const chapter = chapters[saved.chapterIndex]
  // 同一个章节下标可能因重新切分指向了别的章节，此时章内偏移已不可信
  const sameChapter =
    chapter !== undefined &&
    (saved.chapterStart === undefined || saved.chapterStart === chapter.start)

  if (chapter && sameChapter) {
    const length = Math.max(0, chapter.end - chapter.start)
    const offset = saved.charOffset
    if (typeof offset === 'number' && Number.isFinite(offset) && offset >= 0 && offset <= length) {
      return { chapterIndex: saved.chapterIndex, charOffset: offset }
    }
  }

  const target = Math.round(clampPercent(saved.percent) * Math.max(0, textLength))
  let index = chapters.findIndex(
    (item) => target >= item.start && (target < item.end || item.end === textLength),
  )
  if (index < 0) {
    // 目标落在标题行等章节间隙时，归入它前面最近的一章
    for (let i = chapters.length - 1; i >= 0; i -= 1) {
      if (chapters[i].start <= target) {
        index = i
        break
      }
    }
  }
  if (index < 0) return { chapterIndex: 0, charOffset: 0 }

  const chapterStart = chapters[index].start
  const chapterLength = chapters[index].end - chapterStart
  return {
    chapterIndex: index,
    charOffset: Math.max(0, Math.min(target - chapterStart, chapterLength)),
  }
}
