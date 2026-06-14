/**
 * ErrorDecorations.ts
 * Applies VS Code-style inline error decorations to Monaco Editor.
 * Red squiggles + gutter icons + inline message + overview ruler marks.
 */

import type { InlineError } from '../../stores/appStore'

// Keep track of decoration IDs so we can clear them
let _decorationIds: string[] = []

/**
 * Apply error decorations to a Monaco editor instance.
 * Call with an empty array to clear all decorations.
 */
export function applyErrorDecorations(
  editor: any,   // monaco.editor.IStandaloneCodeEditor
  monaco: any,   // the monaco namespace
  errors: InlineError[],
): void {
  if (!editor || !monaco) return

  const model = editor.getModel()
  if (!model) return

  if (!errors.length) {
    _decorationIds = editor.deltaDecorations(_decorationIds, [])
    return
  }

  const decorations = errors.map(err => {
    const lineContent = model.getLineContent(err.line) || ''
    // Underline from column to end of line (or use provided column)
    const startCol  = err.column ?? 1
    const endCol    = lineContent.length + 1

    return {
      range: new monaco.Range(err.line, startCol, err.line, endCol),
      options: {
        // Red squiggly underline
        className: 'agent-error-underline',
        // Gutter icon
        glyphMarginClassName: 'agent-error-glyph',
        // Inline message to the right of the line
        after: {
          content: `  ⚠ ${err.errorType}: ${err.message.slice(0, 80)}`,
          inlineClassName: 'agent-error-inline-msg',
        },
        // Hover tooltip
        hoverMessage: {
          value: `**${err.errorType}**: ${err.message}\n\n*Line ${err.line}${err.column ? `, col ${err.column}` : ''}*`,
        },
        // Overview ruler (right scroll bar) red mark
        overviewRuler: {
          color: '#ff4444',
          darkColor: '#ff4444',
          position: monaco.editor.OverviewRulerLane.Right,
        },
        // Minimap mark
        minimap: {
          color: '#ff4444',
          position: monaco.editor.MinimapPosition.Gutter,
        },
        isWholeLine: false,
        stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
      },
    }
  })

  _decorationIds = editor.deltaDecorations(_decorationIds, decorations)
}

/**
 * Clear all agent error decorations from an editor.
 */
export function clearErrorDecorations(editor: any): void {
  if (!editor) return
  _decorationIds = editor.deltaDecorations(_decorationIds, [])
}