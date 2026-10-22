/**
 * 统一存储入口：优先 localStorage；浏览器完全禁用站点存储时，
 * 降级为「内存 + 开发服务器文件存储」，保证刷新后数据仍在。
 *
 * - 配额满：仍然使用 localStorage，写入时抛出 StorageQuotaError。
 * - 存储被禁用：内存为主，写操作同步到 `/__reader/store`（仅 dev / preview 可用）。
 * - 没有服务端接口（纯静态部署）时只保留内存，功能仍可用。
 */
export class StorageQuotaError extends Error {
  constructor(message = '本地存储空间不足，请移除部分书籍后再导入') {
    super(message)
    this.name = 'StorageQuotaError'
  }
}

export function isQuotaError(error: unknown): boolean {
  if (!(error instanceof DOMException)) return false
  return (
    error.name === 'QuotaExceededError' ||
    error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    error.code === 22 ||
    error.code === 1014
  )
}

const REMOTE_BASE = '/__reader/store'
const KEY_PREFIX = 'reader:'
const PROBE_KEY = 'reader:storage-probe'
const REMOTE_TIMEOUT_MS = 1500

/** persistent：localStorage；server：服务端文件兜底；memory：仅本次页面 */
export type StorageMode = 'persistent' | 'server' | 'memory'

type LocalMode = 'persistent' | 'memory'

const memory = new Map<string, string>()
const pendingWrites = new Set<Promise<void>>()
let mode: LocalMode | null = null
let remote = false
let remoteAttempted = false
let remoteTask: Promise<void> | null = null

function detectMode(): LocalMode {
  try {
    if (!globalThis.localStorage) return 'memory'
    globalThis.localStorage.setItem(PROBE_KEY, '1')
    globalThis.localStorage.removeItem(PROBE_KEY)
    return 'persistent'
  } catch (error) {
    // 配额满不代表不可访问，读与删仍然有效，交给写入侧报配额错误
    return isQuotaError(error) ? 'persistent' : 'memory'
  }
}

function currentMode(): LocalMode {
  if (mode === null) mode = detectMode()
  return mode
}

/** 当前存储方式（用于界面提示与测试） */
export function getStorageMode(): StorageMode {
  if (currentMode() === 'persistent') return 'persistent'
  return remote ? 'server' : 'memory'
}

/** 当前数据是否能跨刷新保留 */
export function isStoragePersistent(): boolean {
  return getStorageMode() !== 'memory'
}

/** 挂载前调用：存储被禁用时先拉取服务端快照，再渲染界面 */
export async function initStorage(): Promise<void> {
  if (currentMode() === 'persistent') return
  await enableRemote()
}

/**
 * 启用服务端兜底（只尝试一次，避免纯静态部署时每次写入都打无效请求）。
 * 快照只补内存里没有的键：本次会话写入的值比磁盘旧值更新。
 */
function enableRemote(): Promise<void> {
  if (remote) return Promise.resolve()
  if (remoteAttempted) return remoteTask ?? Promise.resolve()

  remoteAttempted = true
  const controller = new AbortController()
  const timer = globalThis.setTimeout(() => controller.abort(), REMOTE_TIMEOUT_MS)

  remoteTask = (async () => {
    try {
      const response = await fetch(`${REMOTE_BASE}/snapshot`, {
        method: 'POST',
        signal: controller.signal,
      })
      if (!response.ok) return
      const data = (await response.json()) as { entries?: Record<string, string> }
      for (const [key, value] of Object.entries(data.entries ?? {})) {
        if (key.startsWith(KEY_PREFIX) && typeof value === 'string' && !memory.has(key)) {
          memory.set(key, value)
        }
      }
      remote = true
    } catch {
      // 没有服务端存储接口时保持纯内存模式
    } finally {
      globalThis.clearTimeout(timer)
    }
  })()

  return remoteTask
}

/** localStorage 在运行中被禁用：立刻接管，把已有内存数据同步到服务端 */
async function activateRemote(): Promise<void> {
  await enableRemote()
  if (!remote) return
  await Promise.all([...memory].map(([key, value]) => queueRemote('write', { key, value })))
}

function queueRemote(action: 'write' | 'remove', payload: unknown): Promise<void> {
  const task = (async () => {
    try {
      await fetch(`${REMOTE_BASE}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } catch {
      // 同步失败保留内存数据，不打断阅读
    }
  })()

  pendingWrites.add(task)
  void task.finally(() => pendingWrites.delete(task))
  return task
}

/** 等待所有服务端写入完成（导入、移出书架后调用，避免立刻刷新丢数据） */
export async function flushStorage(): Promise<void> {
  while (pendingWrites.size > 0) {
    await Promise.all([...pendingWrites])
  }
}

export function readRaw(key: string): string | null {
  if (currentMode() === 'persistent') {
    try {
      const value = globalThis.localStorage.getItem(key)
      if (value !== null) return value
    } catch {
      // 运行过程中被禁用（权限变更、隐私模式限制），降级到内存
      mode = 'memory'
      void activateRemote()
    }
  }
  return memory.get(key) ?? null
}

export function writeRaw(key: string, value: string): void {
  if (currentMode() === 'persistent') {
    try {
      globalThis.localStorage.setItem(key, value)
      return
    } catch (error) {
      if (isQuotaError(error)) throw new StorageQuotaError()
      // 非配额错误说明存储被拒绝访问，本页后续读写都走内存
      mode = 'memory'
      void activateRemote()
    }
  }

  memory.set(key, value)
  if (remote) void queueRemote('write', { key, value })
}

export function removeRaw(key: string): void {
  memory.delete(key)

  if (currentMode() === 'persistent') {
    try {
      globalThis.localStorage.removeItem(key)
    } catch {
      mode = 'memory'
      void activateRemote()
    }
  }

  if (remote) void queueRemote('remove', { key })
}

/** 仅供测试：重置探测结果，模拟不同的浏览器存储环境 */
export function resetStorageModeForTest(): void {
  mode = null
  remote = false
  remoteAttempted = false
  remoteTask = null
  memory.clear()
  pendingWrites.clear()
}
