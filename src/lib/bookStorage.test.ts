import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isStoragePersistent, resetStorageModeForTest } from './localStore'
import {
  LOCAL_STORAGE_LIMITS,
  StorageQuotaError,
  loadContent,
  loadCover,
  removeBookData,
  saveCover,
  saveEpubContent,
  saveTxtContent,
} from './bookStorage'

class MemoryStorage implements Storage {
  protected map = new Map<string, string>()

  get length() {
    return this.map.size
  }

  clear() {
    this.map.clear()
  }

  getItem(key: string) {
    return this.map.get(key) ?? null
  }

  key(index: number) {
    return [...this.map.keys()][index] ?? null
  }

  removeItem(key: string) {
    this.map.delete(key)
  }

  setItem(key: string, value: string) {
    this.map.set(key, value)
  }
}

let storage: MemoryStorage

beforeEach(() => {
  storage = new MemoryStorage()
  vi.stubGlobal('localStorage', storage)
})

describe('TXT 内容存取', () => {
  it('写入后能读回同样的正文', async () => {
    await saveTxtContent('book-1', '第一章 风\n正文')
    await expect(loadContent('book-1')).resolves.toEqual({ text: '第一章 风\n正文' })
  })

  it('超过字符上限时给出配额错误', async () => {
    const text = '字'.repeat(LOCAL_STORAGE_LIMITS.txtChars + 1)
    await expect(saveTxtContent('book-2', text)).rejects.toBeInstanceOf(StorageQuotaError)
    await expect(loadContent('book-2')).resolves.toBeNull()
  })

  it('localStorage 抛配额异常时转换为可读错误', async () => {
    storage.setItem = () => {
      throw new DOMException('quota', 'QuotaExceededError')
    }
    await expect(saveTxtContent('book-3', '正文')).rejects.toBeInstanceOf(StorageQuotaError)
  })
})

describe('EPUB 内容存取', () => {
  it('Base64 往返后字节一致', async () => {
    const bytes = Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0xff, 0x80])
    await saveEpubContent('book-4', bytes.buffer)
    const content = await loadContent('book-4')
    expect(content?.bytes).toBeDefined()
    expect(Array.from(new Uint8Array(content?.bytes as ArrayBuffer))).toEqual(Array.from(bytes))
  })

  it('超过体积上限时拒绝写入', async () => {
    const bytes = new Uint8Array(LOCAL_STORAGE_LIMITS.epubBytes + 1)
    await expect(saveEpubContent('book-5', bytes.buffer)).rejects.toBeInstanceOf(
      StorageQuotaError,
    )
  })
})

describe('封面存取', () => {
  it('小封面存为 data URL，可直接给 img 使用', async () => {
    const blob = new Blob([Uint8Array.from([1, 2, 3])], { type: 'image/png' })
    await expect(saveCover('book-6', blob)).resolves.toBe(true)
    expect(loadCover('book-6')).toBe('data:image/png;base64,AQID')
  })

  it('过大的封面不写入，回退占位封面', async () => {
    const blob = new Blob([new Uint8Array(LOCAL_STORAGE_LIMITS.coverBytes + 1)])
    await expect(saveCover('book-7', blob)).resolves.toBe(false)
    expect(loadCover('book-7')).toBeUndefined()
  })
})

describe('移除书籍数据', () => {
  it('同时清理正文与封面', async () => {
    await saveTxtContent('book-8', '正文')
    await saveCover('book-8', new Blob([Uint8Array.from([9])], { type: 'image/png' }))
    await removeBookData('book-8')

    await expect(loadContent('book-8')).resolves.toBeNull()
    expect(loadCover('book-8')).toBeUndefined()
  })
})

describe('浏览器禁用本地存储时', () => {
  it('降级为内存存储，导入与读取仍可用', async () => {
    resetStorageModeForTest()

    const blocked = new MemoryStorage()
    blocked.setItem = () => {
      throw new DOMException('denied', 'SecurityError')
    }
    vi.stubGlobal('localStorage', blocked)

    await saveTxtContent('book-9', '正文')
    await expect(loadContent('book-9')).resolves.toEqual({ text: '正文' })
    expect(isStoragePersistent()).toBe(false)
  })
})
