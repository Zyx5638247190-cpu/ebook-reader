import assert from 'node:assert/strict'
import fs from 'node:fs'
import { chromium } from 'playwright-core'

/**
 * 回归检查：浏览器完全禁用站点存储时，书架不出现警告横幅，
 * 且书籍经服务端文件兜底后刷新仍能读回。
 */
const candidates = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].filter(Boolean)

const CHROME = candidates.find((value) => fs.existsSync(value))
if (!CHROME) throw new Error('未找到 Chrome / Edge')

async function resolveBase() {
  if (process.env.BASE_URL) return process.env.BASE_URL
  for (const port of [5173, 5174, 5175, 5176, 5177]) {
    const url = `http://localhost:${port}/`
    try {
      const response = await fetch(url)
      const html = await response.text()
      if (html.includes('奶龙书屋')) return url
    } catch {
      /* 端口未监听，继续尝试下一个 */
    }
  }
  throw new Error('未找到开发服务器，请先运行 npm run dev，或通过 BASE_URL 指定地址')
}

const BASE = await resolveBase()

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const context = await browser.newContext({ viewport: { width: 1280, height: 820 } })

// 模拟「浏览器完全禁止站点存储」：localStorage 与 IndexedDB 都抛异常
await context.addInitScript(() => {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    get() {
      throw new DOMException('storage blocked', 'SecurityError')
    },
  })
  Object.defineProperty(window, 'indexedDB', {
    configurable: true,
    get() {
      throw new DOMException('storage blocked', 'SecurityError')
    },
  })
})

const page = await context.newPage()
const errors = []
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))

await page.goto(BASE)
await page.getByRole('heading', { name: '奶龙书屋' }).waitFor({ timeout: 10000 })
await page.getByText(/^(把喜欢的故事|书架上有 \d+ 本书)/).waitFor({ timeout: 10000 })

assert.equal(
  await page.getByText('浏览器禁止本站保存数据').count(),
  0,
  '书架不应出现存储警告横幅',
)
assert.equal(
  await page.getByText('刷新后会丢失').count(),
  0,
  '服务端兜底生效时不应提示数据会丢失',
)

if ((await page.getByText('我的书架').count()) === 0) {
  await page.getByRole('button', { name: '试试示例 TXT' }).click()
  await page.getByText('我的书架').waitFor({ timeout: 15000 })
}

const readCount = async () =>
  (
    await page.getByText(/^书架上有 \d+ 本书/).textContent()
  )?.trim()
const before = await readCount()
assert.match(before ?? '', /书架上有 [1-9]\d* 本书/)
console.log('导入后：', before)

await page.waitForTimeout(600)
await page.reload()
await page.getByText('我的书架').waitFor({ timeout: 10000 })

const after = await readCount()
console.log('刷新后：', after)
assert.equal(after, before, '刷新后书架应保持一致')

assert.equal(
  await page.getByText('浏览器禁止本站保存数据').count(),
  0,
  '刷新后也不应出现警告',
)
assert.equal(errors.length, 0, `页面错误：${errors.join('\n')}`)

console.log('禁用站点存储时：无警告横幅，刷新后数据仍在')
await browser.close()
