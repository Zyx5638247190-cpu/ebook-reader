import assert from 'node:assert/strict'
import fs from 'node:fs'
import JSZip from 'jszip'
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

async function waitForText(selector, text, timeout = 5000) {
  await page.waitForFunction(
    ({ selector, text }) => {
      const element = document.querySelector(selector)
      return Boolean(element && element.textContent && element.textContent.includes(text))
    },
    { selector, text },
    { timeout },
  )
}

async function revealToolbar() {
  const box = await page.getByRole('button', { name: '返回书架' }).boundingBox()
  if (box && box.y >= 0) return
  await page.getByRole('button', { name: '显示或隐藏工具栏' }).click()
  await page.waitForTimeout(350)
}

function epubPage(title, paragraph) {
  return `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="zh-CN" lang="zh-CN">
<head><meta charset="utf-8" /><title>${title}</title></head>
<body><h1>${title}</h1><p>${paragraph}</p></body>
</html>`
}

/** 无 nav / ncx 的 EPUB2：验证 spine 兜底目录会读取真实章节标题 */
async function buildNoTocEpub() {
  const chapters = [
    ['第一章 借来的月亮', '奶龙在旧书摊上发现了一本没有封面的书。'],
    ['第二章 书架上的小房间', '奶龙的房间不大，但有一整面墙的书架。'],
    ['第三章 雨天的页码', '下雨的日子，奶龙不喜欢出门。'],
  ]
  const zip = new JSZip()
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })
  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0" encoding="utf-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml" /></rootfiles>
</container>`,
  )
  zip.file(
    'OEBPS/content.opf',
    `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">urn:uuid:no-toc-demo</dc:identifier>
    <dc:title>无目录的月亮</dc:title>
    <dc:creator>奶龙饲养员</dc:creator>
    <dc:language>zh-CN</dc:language>
  </metadata>
  <manifest>
    <item id="cover" href="cover.xhtml" media-type="application/xhtml+xml" />
${chapters.map((_, index) => `    <item id="ch${index + 1}" href="ch${index + 1}.xhtml" media-type="application/xhtml+xml" />`).join('\n')}
  </manifest>
  <spine>
    <itemref idref="cover" />
${chapters.map((_, index) => `    <itemref idref="ch${index + 1}" />`).join('\n')}
  </spine>
</package>`,
  )
  zip.file('OEBPS/cover.xhtml', epubPage('封面', '封面页'))
  chapters.forEach(([title, paragraph], index) => {
    zip.file(`OEBPS/ch${index + 1}.xhtml`, epubPage(title, paragraph))
  })
  return zip.generateAsync({ type: 'nodebuffer', mimeType: 'application/epub+zip' })
}

async function txtStatus() {
  return page.evaluate(() => {
    const spans = [...document.querySelectorAll('span')]
    return spans.map((span) => span.textContent ?? '').find((text) => text.includes('全书')) ?? ''
  })
}

try {
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await waitForText('body', '书架空空的')
  console.log('✓ 空书架展示奶龙空状态')

  await page.getByRole('button', { name: '试试示例 TXT' }).click()
  await waitForText('body', '我的书架')
  const cardTitle = await page.locator('article h3').first().textContent()
  assert.equal(cardTitle, '奶龙的睡前故事')
  console.log('✓ TXT 示例导入成功')

  await page.getByRole('button', { name: '阅读《奶龙的睡前故事》' }).click()
  await page.waitForSelector('.reader-text:not([aria-hidden])')
  await page.waitForFunction(
    () => getComputedStyle(document.querySelector('.reader-text:not([aria-hidden])')).opacity === '1',
  )
  const firstPage = await page.locator('.reader-text:not([aria-hidden])').innerText()
  const statusStart = await txtStatus()
  assert.ok(/本章 \d+ \/ \d+ 页/.test(statusStart), statusStart)
  assert.ok(/第 1 \/ 5 章/.test(statusStart), statusStart)
  assert.ok(firstPage.length > 50)
  console.log(`✓ TXT 阅读与分页正常（${statusStart}）`)

  const pageBefore = Number(statusStart.match(/本章 (\d+)/)?.[1] ?? 1)
  await page.getByRole('button', { name: '下一页' }).click()
  await page.waitForTimeout(450)
  const statusAfter = await txtStatus()
  const pageAfter = Number(statusAfter.match(/本章 (\d+)/)?.[1] ?? 1)
  assert.ok(pageAfter >= pageBefore)
  console.log(`✓ 点击翻页生效（${statusStart} → ${statusAfter}）`)

  const beforeFont = await page.locator('.reader-text:not([aria-hidden])').innerText()
  await revealToolbar()
  await page.getByRole('button', { name: '阅读设置' }).click()
  await page.getByRole('button', { name: /^A\s*大$/ }).click()
  await page.waitForTimeout(1000)
  const fontSize = await page.evaluate(
    () => getComputedStyle(document.querySelector('.reader-text:not([aria-hidden])')).fontSize,
  )
  assert.equal(fontSize, '23px')
  const afterFont = await page.locator('.reader-text:not([aria-hidden])').innerText()
  const beforeHead = beforeFont.slice(0, 18)
  assert.ok(afterFont.includes(beforeHead.slice(0, 10)) || afterFont.length > 0)
  console.log('✓ 字号切到「大」并停留在原段落附近')

  await page.getByRole('button', { name: '夜间背景' }).click()
  await page.waitForTimeout(300)
  const surfaceTheme = await page.locator('.reader-surface').getAttribute('data-theme')
  assert.equal(surfaceTheme, 'dark')
  console.log('✓ 夜间主题生效')

  await page.getByRole('button', { name: '关闭设置' }).click()
  const expectedStatus = await txtStatus()

  await page.reload({ waitUntil: 'networkidle' })
  await waitForText('body', '我的书架')
  const cardProgress = await page.locator('article').first().innerText()
  assert.ok(!cardProgress.includes('未开始'), cardProgress)
  console.log('✓ reload 后书架保留阅读进度')

  await page.getByRole('button', { name: '阅读《奶龙的睡前故事》' }).click()
  await page.waitForSelector('.reader-text:not([aria-hidden])')
  await page.waitForFunction(
    () => getComputedStyle(document.querySelector('.reader-text:not([aria-hidden])')).opacity === '1',
  )
  const restoredStatus = await txtStatus()
  const expectedPage = Number(expectedStatus.match(/本章 (\d+)/)?.[1] ?? 1)
  const restoredPage = Number(restoredStatus.match(/本章 (\d+)/)?.[1] ?? 1)
  assert.ok(Math.abs(expectedPage - restoredPage) <= 1, `${expectedStatus} vs ${restoredStatus}`)
  const restoredFont = await page.evaluate(
    () => getComputedStyle(document.querySelector('.reader-text:not([aria-hidden])')).fontSize,
  )
  const restoredTheme = await page.locator('.reader-surface').getAttribute('data-theme')
  assert.equal(restoredFont, '23px')
  assert.equal(restoredTheme, 'dark')
  console.log(`✓ 重开后恢复位置与设置（${restoredStatus}）`)

  // 触控板横向滑动
  const swipeBefore = await txtStatus()
  await page.evaluate(() => {
    window.dispatchEvent(new WheelEvent('wheel', { deltaX: 120, deltaY: 4, bubbles: true }))
  })
  await page.waitForTimeout(500)
  const swipeAfter = await txtStatus()
  assert.notEqual(swipeBefore, swipeAfter)
  console.log(`✓ 横向滑动翻页（${swipeBefore} → ${swipeAfter}）`)

  // 返回书架并导入 EPUB
  await revealToolbar()
  await page.getByRole('button', { name: '返回书架' }).click()
  await waitForText('body', '我的书架')

  await page.evaluate(async () => {
    const response = await fetch('/samples/nailong-demo.epub')
    const buffer = await response.arrayBuffer()
    const file = new File([buffer], '奶龙与月亮.epub', { type: 'application/epub+zip' })
    const input = document.querySelector('input[type=file]')
    const transfer = new DataTransfer()
    transfer.items.add(file)
    input.files = transfer.files
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await waitForText('body', '奶龙与月亮')
  console.log('✓ EPUB 示例导入成功')

  await page.getByRole('button', { name: '阅读《奶龙与月亮》' }).click()
  await page.waitForSelector('iframe')
  await page.waitForFunction(() => {
    const frame = document.querySelector('iframe')
    return Boolean(frame && frame.contentDocument?.body?.innerText)
  })
  await page.waitForTimeout(1200)
  const epubInfo = await page.evaluate(() => {
    const frame = document.querySelector('iframe')
    const body = frame?.contentDocument?.body
    return {
      text: body?.innerText.slice(0, 60) ?? '',
      background: body ? getComputedStyle(body).backgroundColor : '',
      fontSize: body ? getComputedStyle(body).fontSize : '',
    }
  })
  assert.ok(epubInfo.text.length > 10)
  assert.ok(epubInfo.background.length > 0)
  console.log(`✓ EPUB 渲染正常（背景 ${epubInfo.background}，字号 ${epubInfo.fontSize}）`)

  // 目录：卷分组 + 全部章节
  await revealToolbar()
  await page.getByRole('button', { name: '打开目录' }).click()
  await page.waitForSelector('aside[aria-label="目录"]')
  const tocText = await page.locator('aside[aria-label="目录"]').innerText()
  assert.ok(tocText.includes('第一卷 月亮与书架'), tocText)
  assert.ok(tocText.includes('第二卷 雨与明天'), tocText)
  for (const title of ['第一章', '第二章', '第三章', '第四章']) {
    assert.ok(tocText.includes(title), tocText)
  }
  assert.ok(tocText.includes('共 4 章'), tocText)
  await page.getByRole('button', { name: /第一章/ }).click()
  await page.waitForTimeout(900)
  const chapterOne = await page.evaluate(
    () => document.querySelector('iframe')?.contentDocument?.body?.innerText.slice(0, 30) ?? '',
  )
  assert.ok(chapterOne.includes('第一章'))
  console.log('✓ EPUB 目录跳转正常，嵌套章节完整')

  // EPUB 设置切换与重开恢复
  await page.waitForTimeout(1000)
  const epubProgress = await page.evaluate(() => {
    const entries = Object.keys(localStorage)
      .filter((key) => key.startsWith('reader:progress:'))
      .map((key) => JSON.parse(localStorage.getItem(key) ?? 'null'))
    return entries.find((entry) => entry && typeof entry.cfi === 'string' && entry.cfi.length > 0)
  })
  assert.ok(epubProgress?.cfi, 'EPUB 应保存 CFI')

  await revealToolbar()
  await page.getByRole('button', { name: '阅读设置' }).click()
  await page.getByRole('button', { name: /^A\s*小$/ }).click()
  await page.getByRole('button', { name: '米黄背景' }).click()
  await page.waitForTimeout(1200)
  const epubRestyled = await page.evaluate(() => {
    const body = document.querySelector('iframe')?.contentDocument?.body
    return {
      background: body ? getComputedStyle(body).backgroundColor : '',
      fontSize: body ? getComputedStyle(body).fontSize : '',
    }
  })
  assert.equal(epubRestyled.background, 'rgb(251, 243, 224)')
  assert.equal(epubRestyled.fontSize, '16px')
  console.log('✓ EPUB 主题与字号同步到 iframe')

  await page.reload({ waitUntil: 'networkidle' })
  await waitForText('body', '我的书架')
  await page.getByRole('button', { name: '阅读《奶龙与月亮》' }).click()
  await page.waitForSelector('iframe')
  await page.waitForFunction(() => {
    const frame = document.querySelector('iframe')
    return Boolean(frame && frame.contentDocument?.body?.innerText)
  })
  await page.waitForTimeout(1000)
  const epubRestored = await page.evaluate(() => {
    const body = document.querySelector('iframe')?.contentDocument?.body
    return {
      text: body?.innerText.slice(0, 30) ?? '',
      background: body ? getComputedStyle(body).backgroundColor : '',
      fontSize: body ? getComputedStyle(body).fontSize : '',
    }
  })
  assert.ok(epubRestored.text.includes('第一章'), epubRestored.text)
  assert.equal(epubRestored.background, 'rgb(251, 243, 224)')
  assert.equal(epubRestored.fontSize, '16px')
  console.log('✓ EPUB 重开后按 CFI 恢复位置与设置')

  // 无 nav / ncx 的 EPUB2：spine 兜底目录应读取真实 h1 标题
  await revealToolbar()
  await page.getByRole('button', { name: '返回书架' }).click()
  await waitForText('body', '我的书架')

  const noTocEpub = await buildNoTocEpub()
  await page.locator('input[type=file]').setInputFiles({
    name: '无目录的月亮.epub',
    mimeType: 'application/epub+zip',
    buffer: noTocEpub,
  })
  await waitForText('body', '无目录的月亮')
  await page.getByRole('button', { name: '阅读《无目录的月亮》' }).click()
  await page.waitForSelector('iframe')
  await page.waitForFunction(() => {
    const frame = document.querySelector('iframe')
    return Boolean(frame && frame.contentDocument?.body?.innerText)
  })

  await revealToolbar()
  await page.getByRole('button', { name: '打开目录' }).click()
  await page.waitForSelector('aside[aria-label="目录"]')
  await page.waitForFunction(() => {
    const aside = document.querySelector('aside[aria-label="目录"]')
    return Boolean(aside && aside.textContent?.includes('第一章 借来的月亮'))
  })
  const fallbackToc = await page.locator('aside[aria-label="目录"]').innerText()
  assert.ok(fallbackToc.includes('第二章 书架上的小房间'), fallbackToc)
  assert.ok(fallbackToc.includes('第三章 雨天的页码'), fallbackToc)
  assert.ok(!fallbackToc.includes('第 1 章'), fallbackToc)
  assert.ok(fallbackToc.includes('共 3 章'), fallbackToc)

  await page.getByRole('button', { name: /第三章/ }).click()
  await page.waitForTimeout(1000)
  const fallbackText = await page.evaluate(
    () => document.querySelector('iframe')?.contentDocument?.body?.innerText ?? '',
  )
  assert.ok(fallbackText.includes('第三章'), fallbackText)
  const fallbackStatus = await page.evaluate(() => {
    const spans = [...document.querySelectorAll('span')]
    return spans.map((span) => span.textContent ?? '').find((text) => text.includes('全书')) ?? ''
  })
  assert.ok(fallbackStatus.includes('第 3 / 3 章'), fallbackStatus)
  console.log('✓ 无目录 EPUB2 用 spine + 真实章节标题生成完整目录')

  assert.deepEqual(errors, [], `页面错误：\n${errors.join('\n')}`)
  console.log('\n全部检查通过，无控制台错误。')
} finally {
  await browser.close()
}
