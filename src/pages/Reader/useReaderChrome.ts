import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * 阅读页工具栏的显隐控制：顶部悬停或点击中间区域唤出，2.8 秒无操作后自动收起。
 */
export function useReaderChrome() {
  const [chromeVisible, setChromeVisible] = useState(true)
  const hideTimerRef = useRef<number | null>(null)
  const lastRevealAtRef = useRef(0)
  const chromeVisibleRef = useRef(true)

  const scheduleHide = useCallback(() => {
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current)
    hideTimerRef.current = window.setTimeout(() => setChromeVisible(false), 2800)
  }, [])

  const revealChrome = useCallback(() => {
    lastRevealAtRef.current = Date.now()
    setChromeVisible(true)
    scheduleHide()
  }, [scheduleHide])

  useEffect(() => {
    chromeVisibleRef.current = chromeVisible
  }, [chromeVisible])

  useEffect(() => {
    revealChrome()
    return () => {
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current)
    }
  }, [revealChrome])

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      if (event.clientY < 72) revealChrome()
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [revealChrome])

  const toggleChrome = useCallback(() => {
    // 鼠标移入顶部会先触发 reveal，若紧接着点击中间区域，不应立刻又收起
    if (Date.now() - lastRevealAtRef.current < 400) {
      setChromeVisible(true)
      scheduleHide()
      return
    }

    if (chromeVisibleRef.current) {
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current)
      setChromeVisible(false)
    } else {
      setChromeVisible(true)
      scheduleHide()
    }
  }, [scheduleHide])

  return { chromeVisible, revealChrome, toggleChrome }
}
