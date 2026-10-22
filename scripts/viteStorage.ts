import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'

/**
 * 开发 / 预览服务器上的本地文件存储。
 *
 * 某些浏览器环境会完全禁用 localStorage 与 IndexedDB（阻止所有 Cookie 和站点数据、
 * 沙盒 iframe 等）。此时前端降级为内存存储，并把数据同步到 `.reader-data/`，
 * 保证刷新后书籍、进度、设置仍在。打包成纯静态站点后该接口不存在，
 * 前端会继续使用内存存储。
 */
const STORAGE_PREFIX = '/__reader/store'
const KEY_PREFIX = 'reader:'
const MAX_BODY_BYTES = 20 * 1024 * 1024

type Next = () => void

function fileNameFor(key: string): string {
  return `${Buffer.from(key, 'utf8').toString('base64url')}.txt`
}

function keyFromFileName(name: string): string | null {
  if (!name.endsWith('.txt')) return null
  try {
    return Buffer.from(name.slice(0, -4), 'base64url').toString('utf8')
  } catch {
    return null
  }
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  let size = 0

  for await (const chunk of req) {
    const buffer = chunk as Buffer
    size += buffer.length
    if (size > MAX_BODY_BYTES) throw new Error('请求体过大')
    chunks.push(buffer)
  }

  return Buffer.concat(chunks).toString('utf8')
}

function sendJson(res: ServerResponse, status: number, data: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(data))
}

function parseKey(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith(KEY_PREFIX)) return null
  return value
}

async function handleSnapshot(dataDir: string, res: ServerResponse) {
  const entries: Record<string, string> = {}
  const files = await readdir(dataDir).catch(() => [] as string[])

  await Promise.all(
    files.map(async (name) => {
      const key = keyFromFileName(name)
      if (!key?.startsWith(KEY_PREFIX)) return
      entries[key] = await readFile(join(dataDir, name), 'utf8')
    }),
  )

  sendJson(res, 200, { entries })
}

async function handleWrite(dataDir: string, req: IncomingMessage, res: ServerResponse) {
  const body = JSON.parse(await readBody(req)) as { key?: unknown; value?: unknown }
  const key = parseKey(body.key)
  if (!key || typeof body.value !== 'string') {
    sendJson(res, 400, { error: '无效的存储键或内容' })
    return
  }

  await mkdir(dataDir, { recursive: true })
  await writeFile(join(dataDir, fileNameFor(key)), body.value, 'utf8')
  sendJson(res, 200, { ok: true })
}

async function handleRemove(dataDir: string, req: IncomingMessage, res: ServerResponse) {
  const body = JSON.parse(await readBody(req)) as { key?: unknown }
  const key = parseKey(body.key)
  if (!key) {
    sendJson(res, 400, { error: '无效的存储键' })
    return
  }

  await unlink(join(dataDir, fileNameFor(key))).catch(() => undefined)
  sendJson(res, 200, { ok: true })
}

function createMiddleware(dataDir: string) {
  return async (req: IncomingMessage, res: ServerResponse, next: Next) => {
    const path = (req.url ?? '').split('?')[0]
    if (!path.startsWith(STORAGE_PREFIX) || req.method !== 'POST') {
      next()
      return
    }

    try {
      if (path === `${STORAGE_PREFIX}/snapshot`) {
        await handleSnapshot(dataDir, res)
        return
      }
      if (path === `${STORAGE_PREFIX}/write`) {
        await handleWrite(dataDir, req, res)
        return
      }
      if (path === `${STORAGE_PREFIX}/remove`) {
        await handleRemove(dataDir, req, res)
        return
      }
      sendJson(res, 404, { error: '未知的存储接口' })
    } catch (error) {
      sendJson(res, 500, {
        error: error instanceof Error ? error.message : '本地文件存储失败',
      })
    }
  }
}

export function readerStoragePlugin(): Plugin {
  const dataDir = resolve('.reader-data')
  const middleware = createMiddleware(dataDir)

  return {
    name: 'nailong-reader-storage',
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}
