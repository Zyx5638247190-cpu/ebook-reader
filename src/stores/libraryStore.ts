import { create } from 'zustand'
import type { BookRecord, ProgressRecord } from '../types'
import { loadBooks, saveBooks, saveProgress, removeProgress } from '../lib/storage'
import {
  assertCanStore,
  loadCover,
  removeBookData,
  saveCover,
  saveEpubContent,
  saveTxtContent,
} from '../lib/bookStorage'
import { decodeTxt, readTxtMeta } from '../lib/txt'
import { splitTxtChapters } from '../lib/txtChapters'
import { readEpubMeta } from '../lib/epub'
import { flushStorage, getStorageMode } from '../lib/localStore'

const MAX_FILE_SIZE = 100 * 1024 * 1024

export interface Notice {
  type: 'success' | 'error'
  text: string
}

interface LibraryState {
  books: BookRecord[]
  ready: boolean
  importing: boolean
  notice: Notice | null
  init: () => void
  importFiles: (files: File[]) => Promise<void>
  removeBook: (bookId: string) => Promise<void>
  recordProgress: (bookId: string, progress: ProgressRecord) => void
  clearNotice: () => void
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  books: [],
  ready: false,
  importing: false,
  notice: null,

  init: () => {
    if (get().ready) return
    set({ books: loadBooks(), ready: true })
  },

  importFiles: async (files) => {
    if (files.length === 0) return
    set({ importing: true, notice: null })

    const added: BookRecord[] = []
    const errors: string[] = []
    const existing = get().books

    for (const file of files) {
      try {
        if (file.size > MAX_FILE_SIZE) throw new Error('文件超过 100MB')

        const duplicate = existing.some(
          (book) => book.fileName === file.name && book.fileSize === file.size,
        )
        if (duplicate) throw new Error('已在书架中')

        const ext = file.name.split('.').pop()?.toLowerCase()
        if (ext !== 'txt' && ext !== 'epub') throw new Error('仅支持 .txt 与 .epub')

        const buffer = await file.arrayBuffer()
        const id = crypto.randomUUID()
        const now = Date.now()
        const fallbackTitle = file.name.replace(/\.[^.]+$/, '').trim() || '未命名书籍'

        if (ext === 'txt') {
          const { text } = decodeTxt(buffer)
          if (!text.trim()) throw new Error('文件内容为空')

          const chapters = splitTxtChapters(text)
          const meta = readTxtMeta(file.name, text)
          assertCanStore(file.size, 'txt', text.length)
          await saveTxtContent(id, text)

          added.push({
            id,
            title: meta.title,
            author: meta.author,
            format: 'txt',
            fileName: file.name,
            fileSize: file.size,
            hasCover: false,
            totalChapters: chapters.length,
            progress: 0,
            lastChapter: 0,
            lastReadAt: now,
            importedAt: now,
          })
        } else {
          // 先按文件体积拦截，避免为一个注定存不下的 EPUB 做完整解析
          assertCanStore(file.size, 'epub')
          const meta = await readEpubMeta(buffer)
          await saveEpubContent(id, buffer)
          const hasCover = meta.cover ? await saveCover(id, meta.cover) : false

          added.push({
            id,
            title: meta.title === '未命名书籍' ? fallbackTitle : meta.title,
            author: meta.author,
            format: 'epub',
            fileName: file.name,
            fileSize: file.size,
            hasCover,
            totalChapters: meta.totalChapters,
            progress: 0,
            lastChapter: 0,
            lastReadAt: now,
            importedAt: now,
          })
        }
      } catch (error) {
        errors.push(`${file.name}：${error instanceof Error ? error.message : '导入失败'}`)
      }
    }

    if (added.length > 0) {
      const books = [...added, ...get().books]
      saveBooks(books)
      set({ books })
      // 服务端兜底模式下等落盘完成，避免导入后立刻刷新丢数据
      await flushStorage()
    }

    set({
      importing: false,
      notice:
        errors.length > 0
          ? { type: 'error', text: errors.join('；') }
          : {
              type: 'success',
              text:
                getStorageMode() === 'memory'
                  ? `已导入 ${added.length} 本书（浏览器禁止站点存储，刷新后会丢失）`
                  : `已导入 ${added.length} 本书`,
            },
    })
  },

  removeBook: async (bookId) => {
    const books = get().books.filter((book) => book.id !== bookId)
    saveBooks(books)
    removeProgress(bookId)
    await removeBookData(bookId)
    await flushStorage()
    set({ books, notice: { type: 'success', text: '已移出书架' } })
  },

  recordProgress: (bookId, progress) => {
    saveProgress(bookId, progress)
    const books = get().books.map((book) =>
      book.id === bookId
        ? {
            ...book,
            progress: progress.percent,
            lastChapter: progress.chapterIndex,
            lastReadAt: progress.updatedAt,
          }
        : book,
    )
    if (books.some((book) => book.id === bookId)) {
      saveBooks(books)
      set({ books })
    }
  },

  clearNotice: () => set({ notice: null }),
}))

/** 供书架做封面展示：localStorage 里存的是 data URL，可直接给 <img> */
export function readCover(bookId: string): string | undefined {
  return loadCover(bookId)
}
