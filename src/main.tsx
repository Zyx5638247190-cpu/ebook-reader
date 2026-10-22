import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { loadSettings } from './lib/storage'
import { initStorage } from './lib/localStore'

async function bootstrap() {
  // 浏览器禁用站点存储时，先从服务端取回快照，再按真实书库渲染
  try {
    await initStorage()
  } catch (error) {
    // 快照读取异常不应阻塞首屏，按内存模式继续
    console.warn('存储初始化失败，本次使用内存模式', error)
  }

  // 在挂载前读取设置，避免首屏主题闪烁
  const settings = loadSettings()
  document.documentElement.dataset.readerTheme = settings.theme

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void bootstrap()
