import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  flushStorage,
  getStorageMode,
  initStorage,
  isStoragePersistent,
  readRaw,
  resetStorageModeForTest,
  writeRaw,
} from './localStore'

class BlockedStorage implements Storage {
  get length() {
    return 0
  }
  clear() {}
  getItem() {
    return null
  }
  key() {
    return null
  }
  removeItem() {
    throw new DOMException('denied', 'SecurityError')
  }
  setItem() {
    throw new DOMException('denied', 'SecurityError')
  }
}

class WorkingStorage implements Storage {
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

function jsonResponse(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  resetStorageModeForTest()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('存储方式探测', () => {
  it('localStorage 可用时直接用本地存储，不请求服务端', async () => {
    vi.stubGlobal('localStorage', new WorkingStorage())
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await initStorage()

    expect(getStorageMode()).toBe('persistent')
    expect(isStoragePersistent()).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('站点存储被禁用但服务端可用时降级为 server，刷新后仍能读回', async () => {
    vi.stubGlobal('localStorage', new BlockedStorage())
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/snapshot')) {
        return jsonResponse({ entries: { 'reader:books': '[{"id":"b1"}]' } })
      }
      return jsonResponse({ ok: true })
    })
    vi.stubGlobal('fetch', fetchMock)

    await initStorage()
    expect(getStorageMode()).toBe('server')
    expect(isStoragePersistent()).toBe(true)
    expect(readRaw('reader:books')).toBe('[{"id":"b1"}]')

    writeRaw('reader:books', '[{"id":"b2"}]')
    await flushStorage()

    expect(readRaw('reader:books')).toBe('[{"id":"b2"}]')
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/write'),
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('服务端接口也不可用时保持纯内存模式，并明确告知不持久化', async () => {
    vi.stubGlobal('localStorage', new BlockedStorage())
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline')
      }),
    )

    await initStorage()

    expect(getStorageMode()).toBe('memory')
    expect(isStoragePersistent()).toBe(false)

    writeRaw('reader:settings', '{"theme":"sepia"}')
    expect(readRaw('reader:settings')).toBe('{"theme":"sepia"}')
  })

  it('服务端只补充内存中缺失的键，不覆盖本次会话的写入', async () => {
    vi.stubGlobal('localStorage', new BlockedStorage())
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) =>
      String(input).endsWith('/snapshot')
        ? jsonResponse({ entries: { 'reader:settings': '{"theme":"dark"}' } })
        : jsonResponse({ ok: true }),
    )

    // 服务端快照返回前先写入的设置应保留
    await initStorage()

    expect(readRaw('reader:settings')).toBe('{"theme":"dark"}')
  })
})
