import assert from 'node:assert/strict'
import fs from 'node:fs'
import { chromium } from 'playwright-core'

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((value) => fs.existsSync(value))

const BASE = process.env.BASE_URL ?? 'http://localhost:5183/'
const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 820 } })

async function statusText() {
  return (
    (await page.evaluate(() => {
      const spans = [...document.querySelectorAll('span')]
      return spans.map((span) => span.textContent ?? '').find((text) => text.includes('全书')) ?? ''
    })) ?? ''
  )
}

await page.goto(BASE)
await page.getByRole('heading', { name: '奶龙书屋' }).waitFor()
if ((await page.getByText('我的书架').count()) === 0) {
  await page.getByRole('button', { name: '试试示例 TXT' }).click()
  await page.getByText('我的书架').waitFor()
}
await page.getByRole('button', { name: '阅读《奶龙的睡前故事》' }).click()
await page.waitForSelector('.reader-text:not([aria-hidden])')

let previous = ''
for (let index = 0; index < 40; index += 1) {
  await page.getByRole('button', { name: '下一页' }).click({ force: true })
  await page.waitForTimeout(220)
  const current = await statusText()
  console.log('TXT 翻页：', current.trim())
  if (current && current === previous && current.includes('100%')) break
  previous = current
}
assert.match(previous, /全书 100%/, 'TXT 读到最后一页应为 100%')

await page.getByRole('button', { name: '返回书架' }).click()
await page.getByText('我的书架').waitFor()

await page.setInputFiles('input[type=file]', 'public/samples/nailong-demo.epub')
await page.getByRole('button', { name: '阅读《奶龙与月亮》' }).waitFor({ timeout: 15000 })
await page.getByRole('button', { name: '阅读《奶龙与月亮》' }).click()
await page.waitForSelector('iframe')
await page.waitForFunction(() => {
  const frame = document.querySelector('iframe')
  return Boolean(frame && frame.contentDocument?.body?.innerText)
})
await page.waitForTimeout(1200)

previous = ''
for (let index = 0; index < 80; index += 1) {
  await page.getByRole('button', { name: '下一页' }).click({ force: true })
  await page.waitForTimeout(320)
  const current = await statusText()
  console.log('EPUB 翻页：', current.trim())
  if (current && current === previous && current.includes('100%')) break
  previous = current
}
assert.match(previous, /全书 100%/, 'EPUB 读到最后一页应为 100%')

console.log('两种格式读到末尾都显示 100%')
await browser.close()
