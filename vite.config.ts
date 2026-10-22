import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readerStoragePlugin } from './scripts/viteStorage'

export default defineConfig({
  // 相对路径，保证部署到 GitHub Pages 子路径（/ebook-reader/）时资源不 404
  base: './',
  plugins: [react(), tailwindcss(), readerStoragePlugin()],
  // epubjs 的部分依赖仍引用 global，浏览器环境需指向 globalThis
  define: { global: 'globalThis' },
  optimizeDeps: { include: ['epubjs'] },
  server: { port: 5173 },
})
