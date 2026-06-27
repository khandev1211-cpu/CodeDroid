/**
 * useResizable.ts — drag-to-resize hook for CodeDroid v4 panels.
 *
 * Usage:
 *   const { size, handleMouseDown } = useResizable({
 *     direction: 'horizontal',   // or 'vertical'
 *     initial: 240,
 *     min: 160, max: 600,
 *     onEnd: (v) => updateSettings({ sidebarWidth: v }),
 *   })
 */

import { useState, useCallback, useEffect, useRef } from 'react'

interface UseResizableOptions {
  direction: 'horizontal' | 'vertical'
  initial: number
  min?: number
  max?: number
  onEnd?: (value: number) => void
  reverse?: boolean   // drag left/up to grow (for right-side panels)
}

export function useResizable({
  direction,
  initial,
  min = 100,
  max = 1200,
  onEnd,
  reverse = false,
}: UseResizableOptions) {
  const [size, setSize] = useState(initial)
  const [dragging, setDragging] = useState(false)
  const startPos = useRef(0)
  const startSize = useRef(initial)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setDragging(true)
    startPos.current  = direction === 'horizontal' ? e.clientX : e.clientY
    startSize.current = size
  }, [direction, size])

  useEffect(() => {
    if (!dragging) return

    const onMove = (e: MouseEvent) => {
      const pos   = direction === 'horizontal' ? e.clientX : e.clientY
      const delta = (pos - startPos.current) * (reverse ? -1 : 1)
      const next  = Math.max(min, Math.min(max, startSize.current + delta))
      setSize(next)
    }

    const onUp = (e: MouseEvent) => {
      setDragging(false)
      const pos   = direction === 'horizontal' ? e.clientX : e.clientY
      const delta = (pos - startPos.current) * (reverse ? -1 : 1)
      const final = Math.max(min, Math.min(max, startSize.current + delta))
      onEnd?.(Math.round(final))
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragging, direction, min, max, reverse, onEnd])

  // Sync if initial changes externally (e.g. loaded from settings)
  useEffect(() => { setSize(initial) }, [initial])

  return { size, dragging, handleMouseDown }
}