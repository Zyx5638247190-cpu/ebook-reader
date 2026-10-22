import fs from 'node:fs'
import { chromium } from 'playwright-core'

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((value) => fs.existsSync(value))

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const page = await browser.newPage()
await page.goto('http://localhost:5177/')
const result = await page.evaluate(() => {
  localStorage.clear()
  let low = 0
  let high = 20_000_000
  let best = 0
  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    try {
      localStorage.setItem('probe', 'a'.repeat(mid))
      best = mid
      low = mid + 1
    } catch {
      high = mid - 1
    }
  }
  localStorage.removeItem('probe')
  return { maxChars: best, maxMiB: best / 1024 / 1024 }
})
console.log(result)
await browser.close()
