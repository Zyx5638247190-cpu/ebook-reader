import { useEffect, useRef, useState } from 'react'
import type { TxtChapter } from '../../types'
import { loadContent } from '../../lib/bookStorage'
import { loadProgress } from '../../lib/storage'
import { splitTxtChapters } from '../../lib/txtChapters'
import { locateTxtPosition } from '../../lib/txtPosition'

/**
 * 载入 TXT 全文、章节结构与上次进度。
 * pendingOffset 是恢复位置的唯一输入，lastChapter 用于区分「换章」与「重排」。
 */
export function useTxtContent(bookId: string) {
  const [text, setText] = useState('')
  const [chapters, setChapters] = useState<TxtChapter[]>([])
  const [chapterIndex, setChapterIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const pendingOffsetRef = useRef<number | null>(null)
  const lastChapterRef = useRef<number | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    setChapters([])
    setText('')

    loadContent(bookId)
      .then((content) => {
        if (!active) return
        if (!content?.text) {
          setError('找不到书籍内容，请重新导入')
          setLoading(false)
          return
        }

        const parsed = splitTxtChapters(content.text)
        if (parsed.length === 0) {
          setError('这本书没有可阅读的正文')
          setLoading(false)
          return
        }

        const saved = loadProgress(bookId)
        const position = locateTxtPosition(parsed, content.text.length, saved)

        pendingOffsetRef.current = position.charOffset
        lastChapterRef.current = null
        setText(content.text)
        setChapters(parsed)
        setChapterIndex(position.chapterIndex)
        setLoading(false)
      })
      .catch(() => {
        if (!active) return
        setError('读取书籍失败，文件可能已损坏')
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [bookId])

  return {
    text,
    chapters,
    chapterIndex,
    setChapterIndex,
    loading,
    error,
    pendingOffsetRef,
    lastChapterRef,
  }
}
