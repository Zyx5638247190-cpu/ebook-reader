import { useEffect, useMemo, useRef, useState } from 'react'
import { useLibraryStore, readCover } from '../stores/libraryStore'
import { useReaderStore } from '../stores/readerStore'
import { AppHeader } from '../components/AppHeader'
import { BookCard } from '../components/BookCard'
import { DragonMascot } from '../components/DragonMascot'
import { EmptyState } from '../components/EmptyState'
import { Toast } from '../components/Toast'

export default function Bookshelf() {
  const books = useLibraryStore((state) => state.books)
  const ready = useLibraryStore((state) => state.ready)
  const importing = useLibraryStore((state) => state.importing)
  const notice = useLibraryStore((state) => state.notice)
  const init = useLibraryStore((state) => state.init)
  const importFiles = useLibraryStore((state) => state.importFiles)
  const removeBook = useLibraryStore((state) => state.removeBook)
  const clearNotice = useLibraryStore((state) => state.clearNotice)
  const openBook = useReaderStore((state) => state.openBook)

  const inputRef = useRef<HTMLInputElement>(null)
  const [covers, setCovers] = useState<Record<string, string>>({})
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    init()
  }, [init])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(clearNotice, 5000)
    return () => window.clearTimeout(timer)
  }, [notice, clearNotice])

  useEffect(() => {
    const next: Record<string, string> = {}
    for (const book of books) {
      if (!book.hasCover) continue
      const cover = readCover(book.id)
      if (cover) next[book.id] = cover
    }
    setCovers(next)
  }, [books])

  const sortedBooks = useMemo(
    () => [...books].sort((a, b) => b.lastReadAt - a.lastReadAt),
    [books],
  )

  async function handleFiles(files: File[] | FileList | null) {
    if (!files || files.length === 0) return
    await importFiles(Array.from(files))
    if (inputRef.current) inputRef.current.value = ''
  }

  async function loadSample(kind: 'txt' | 'epub') {
    try {
      const file = kind === 'txt' ? '/samples/nailong-story.txt' : '/samples/nailong-demo.epub'
      const fileName = kind === 'txt' ? '奶龙的睡前故事.txt' : '奶龙与月亮.epub'
      const response = await fetch(file)
      if (!response.ok) throw new Error('示例文件不存在')
      const blob = await response.blob()
      await importFiles([new File([blob], fileName, { type: blob.type })])
    } catch (error) {
      console.warn(error)
      useLibraryStore.setState({
        notice: { type: 'error', text: '示例加载失败，请直接导入本地文件' },
      })
    }
  }

  return (
    <div
      className="library-backdrop min-h-full"
      onDragOver={(event) => {
        event.preventDefault()
        setDragging(true)
      }}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) setDragging(false)
      }}
      onDrop={(event) => {
        event.preventDefault()
        setDragging(false)
        void handleFiles(event.dataTransfer.files)
      }}
    >
      <AppHeader
        count={books.length}
        importing={importing}
        onImport={() => inputRef.current?.click()}
      />

      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".txt,.epub,text/plain,application/epub+zip"
        className="hidden"
        onChange={(event) => void handleFiles(event.target.files)}
      />

      <main className="mx-auto max-w-6xl px-6 pb-20 pt-8">
        {ready && books.length === 0 && (
          <EmptyState
            importing={importing}
            onImport={() => inputRef.current?.click()}
            onLoadSample={(kind) => void loadSample(kind)}
          />
        )}

        {books.length > 0 && (
          <>
            <div className="mb-6 flex items-end justify-between">
              <div>
                <h2 className="text-base font-semibold text-ink-900">我的书架</h2>
                <p className="mt-1 text-xs text-ink-500">最近阅读的书排在最前面</p>
              </div>
              <span className="rounded-full border border-line bg-white/70 px-3 py-1 text-xs text-ink-500">
                共 {books.length} 本
              </span>
            </div>

            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {sortedBooks.map((book) => (
                <BookCard
                  key={book.id}
                  book={book}
                  coverUrl={covers[book.id]}
                  onOpen={() => openBook(book.id)}
                  onRemove={() => void removeBook(book.id)}
                />
              ))}
            </div>
          </>
        )}
      </main>

      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-brand-100/60 backdrop-blur-sm">
          <div className="rounded-3xl border-2 border-dashed border-brand-500 bg-cream-50/95 px-10 py-8 text-center shadow-soft">
            <DragonMascot className="dragon-breathe mx-auto mb-2 h-24 w-24" />
            <p className="text-base font-medium text-ink-900">松手，奶龙帮你把书搬上书架</p>
            <p className="mt-1 text-xs text-ink-500">支持 TXT 与 EPUB，可一次拖入多本</p>
          </div>
        </div>
      )}

      {notice && <Toast notice={notice} onClose={clearNotice} />}
    </div>
  )
}
