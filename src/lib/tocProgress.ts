import type { TocNode } from '../types'
import { clampPercent } from './text'
import { isJumpableTocNode } from './epubToc'

export interface TocOrder {
  /** TocNode 下标 → 第几章（1 起） */
  order: Map<number, number>
  count: number
}

/** 只统计可跳转节点，卷分组不算一章 */
export function buildTocOrder(toc: TocNode[]): TocOrder {
  const order = new Map<number, number>()
  let count = 0

  toc.forEach((node, index) => {
    if (isJumpableTocNode(node)) {
      count += 1
      order.set(index, count)
    }
  })

  return { order, count }
}

/** locations 未就绪时，用章节序号 + 章内页比例估算全书百分比 */
export function estimateTocPercent(
  chapterOrder: number | undefined,
  chapterCount: number,
  page: number,
  total: number,
): number {
  const order = chapterOrder ?? 1
  const count = Math.max(1, chapterCount)
  const inChapter = total > 0 ? (page - 1) / total : 0
  return clampPercent((order - 1 + inChapter) / count)
}
