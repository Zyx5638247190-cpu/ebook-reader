import { describe, expect, it } from 'vitest'
import { pageIndexForOffset } from './pagination'

const pages = [
  { start: 0, end: 100 },
  { start: 100, end: 200 },
  { start: 200, end: 300 },
]

describe('pageIndexForOffset', () => {
  it('命中页首返回该页', () => {
    expect(pageIndexForOffset(pages, 0)).toBe(0)
    expect(pageIndexForOffset(pages, 100)).toBe(1)
    expect(pageIndexForOffset(pages, 250)).toBe(2)
  })

  it('页尾偏移属于下一页', () => {
    expect(pageIndexForOffset(pages, 99)).toBe(0)
    expect(pageIndexForOffset(pages, 199)).toBe(1)
  })

  it('超出范围时返回最后一页', () => {
    expect(pageIndexForOffset(pages, 9999)).toBe(2)
  })

  it('负数偏移回到第一页', () => {
    expect(pageIndexForOffset(pages, -10)).toBe(0)
  })

  it('无分页结果时返回 0', () => {
    expect(pageIndexForOffset([], 42)).toBe(0)
  })
})
