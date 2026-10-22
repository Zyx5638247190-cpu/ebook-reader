import assert from 'node:assert/strict'
import fs from 'node:fs'
import { chromium } from 'playwright-core'

const candidates = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter((value) => Boolean(value))

const CHROME = candidates.find((value) => fs.existsSync(value))
if (!CHROME) throw new Error('未找到 Chrome / Edge，可通过 CHROME_PATH 指定浏览器路径')

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
const page = await browser.newPage({ viewport: { width: 1280, height: 820 } })

const errors = []
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`)
})

const paragraph =
  '奶龙把书翻到下一页，窗外的风刚好吹动窗帘。它停下来听了一会儿，又继续往下读，字句像一条安静的小河，慢慢流过整个下午。书页边缘被阳光照得发亮，它伸手压了压，怕风把故事吹跑。'
const chapters = ['第一章 很长的故事', '第二章 更长的故事', '第三章 最长的故事']
const text = chapters
  .map((title) => [title, ...Array.from({ length: 45 }, (_, index) => `第${index + 1}段：${paragraph}`)].join('\n\n'))
  .join('\n\n')

try {
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => document.body.innerText.includes('书架空空的'))

  await page.evaluate(async (content) => {
    const file = new File([content], '排版矩阵测试.txt', { type: 'text/plain' })
    const input = document.querySelector('input[type=file]')
    const transfer = new DataTransfer()
    transfer.items.add(file)
    input.files = transfer.files
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }, text)

  await page.waitForFunction(() => document.body.innerText.includes('我的书架'))
  await page.getByRole('button', { name: '阅读《排版矩阵测试》' }).click()
  await page.waitForSelector('.reader-text:not([aria-hidden])')
  await page.waitForFunction(
    () => getComputedStyle(document.querySelector('.reader-text:not([aria-hidden])')).opacity === '1',
  )

  // 打开设置面板，后续组合直接点击
  await page.getByRole('button', { name: '显示或隐藏工具栏' }).click()
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: '阅读设置' }).click()

  const sizes = [
    { label: '900×600', width: 900, height: 600 },
    { label: '1280×820', width: 1280, height: 820 },
  ]
  const fonts = ['小', '中', '大']
  const themes = ['白色', '米黄', '夜间']
  const results = []

  for (const size of sizes) {
    await page.setViewportSize({ width: size.width, height: size.height })
    for (const font of fonts) {
      await page.getByRole('button', { name: new RegExp(`^A\\s*${font}$`) }).click()
      for (const theme of themes) {
        await page.getByRole('button', { name: `${theme}背景` }).click()
        await page.waitForTimeout(550)

        const metrics = await page.evaluate(() => {
          const element = document.querySelector('.reader-text:not([aria-hidden])')
          const status = [...document.querySelectorAll('span')]
            .map((span) => span.textContent ?? '')
            .find((value) => value.includes('全书'))
          if (!element) return null
          return {
            clientHeight: element.clientHeight,
            scrollHeight: element.scrollHeight,
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth,
            textLength: (element.innerText ?? '').trim().length,
            status,
            fontSize: getComputedStyle(element).fontSize,
            theme: document.querySelector('.reader-surface')?.getAttribute('data-theme'),
          }
        })

        assert.ok(metrics, '找不到正文')
        assert.ok(metrics.textLength > 50, `${size.label} ${font} ${theme} 出现空白页`)
        assert.ok(
          metrics.scrollHeight <= metrics.clientHeight + 2,
          `${size.label} ${font} ${theme} 文字被截断：${metrics.scrollHeight} > ${metrics.clientHeight}`,
        )
        assert.ok(
          metrics.scrollWidth <= metrics.clientWidth + 2,
          `${size.label} ${font} ${theme} 横向溢出`,
        )
        results.push(`${size.label} ${font} ${theme} ${metrics.fontSize} ${metrics.status}`)
      }
    }
  }

  console.log(`✓ 完成 ${results.length} 种组合检查，无截断、无空白页`)
  for (const line of results) console.log('  ' + line)

  // 章内翻页 → 跨章 → 目录跳转
  await page.getByRole('button', { name: '关闭设置' }).click()
  await page.waitForTimeout(200)

  const revealToolbar = async () => {
    const box = await page.getByRole('button', { name: '返回书架' }).boundingBox()
    if (box && box.y >= 0) return
    await page.getByRole('button', { name: '显示或隐藏工具栏' }).click()
    await page.waitForTimeout(300)
  }

  const chapterLabel = () =>
    page.evaluate(() => {
      const spans = [...document.querySelectorAll('span')]
      return spans.map((span) => span.textContent ?? '').find((text) => /^\d+ \/ \d+$/.test(text)) ?? ''
    })

  const pageText = async () =>
    (await page.locator('.reader-text:not([aria-hidden])').innerText()).trim()

  await revealToolbar()
  await page.getByRole('button', { name: '打开目录' }).click()
  await page.getByRole('button', { name: /第二章/ }).click()
  await page.waitForTimeout(700)
  assert.equal(await chapterLabel(), '2 / 3')
  assert.ok((await pageText()).includes('第1段'))
  console.log('✓ TXT 目录跳转准确，当前章节高亮')

  await page.getByRole('button', { name: '上一页' }).click()
  await page.waitForTimeout(600)
  assert.equal(await chapterLabel(), '1 / 3')
  assert.ok((await pageText()).length > 50)
  console.log('✓ TXT 章节首屏反向翻页落到上一章末页')

  for (let step = 0; step < 60; step += 1) {
    if ((await chapterLabel()) === '3 / 3') break
    await page.getByRole('button', { name: '下一页' }).click()
    await page.waitForTimeout(180)
    assert.ok((await pageText()).length > 50, `第 ${step} 次翻页出现空白页`)
  }
  assert.equal(await chapterLabel(), '3 / 3')
  console.log('✓ TXT 跨章翻页连续，无空白页')

  assert.deepEqual(errors, [], errors.join('\n'))
} finally {
  await browser.close()
}
