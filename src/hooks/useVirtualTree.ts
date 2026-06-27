/**
 * useVirtualTree.ts — Virtual file tree hook for CodeDroid v4.
 *
 * Flattens the expanded tree into a single array and virtualizes the DOM
 * so only visible rows are rendered. Handles 10k+ file projects smoothly.
 *
 * Usage:
 *   const { flatRows, containerProps, rowProps, totalHeight, offsetY } =
 *     useVirtualTree({ nodes, rowHeight: 22, containerHeight: 500 })
 */

import { useState, useRef, useCallback, useEffect } from 'react'

export interface FlatRow {
  key: string
  depth: number
  name: string
  path: string
  isDir: boolean
  isExpanded: boolean
}

interface UseVirtualTreeOptions {
  rows: FlatRow[]
  rowHeight?: number
  containerHeight?: number
  overscan?: number         // extra rows above/below viewport
}

export function useVirtualTree({
  rows,
  rowHeight = 22,
  containerHeight = 400,
  overscan = 5,
}: UseVirtualTreeOptions) {
  const [scrollTop, setScrollTop] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const totalHeight = rows.length * rowHeight
  const startIdx = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan)
  const endIdx   = Math.min(rows.length - 1,
    Math.ceil((scrollTop + containerHeight) / rowHeight) + overscan)

  const visibleRows = rows.slice(startIdx, endIdx + 1)
  const offsetY = startIdx * rowHeight

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  return {
    visibleRows,
    totalHeight,
    offsetY,
    startIdx,
    containerRef,
    handleScroll,
  }
}

/**
 * Flatten an expanded tree into a sorted array of FlatRows.
 * Only expanded directories have their children included.
 */
export function flattenTree(
  nodes: Array<{ name: string; path: string; isDir: boolean; children?: any[] }>,
  expanded: Set<string>,
  depth = 0,
): FlatRow[] {
  const rows: FlatRow[] = []
  const sorted = [...nodes].sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  })

  for (const node of sorted) {
    const isExpanded = node.isDir && expanded.has(node.path)
    rows.push({
      key:        node.path,
      depth,
      name:       node.name,
      path:       node.path,
      isDir:      node.isDir,
      isExpanded,
    })
    if (isExpanded && node.children) {
      rows.push(...flattenTree(node.children, expanded, depth + 1))
    }
  }
  return rows
}