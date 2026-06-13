export interface Theme {
  id: string
  name: string
  category: 'dark' | 'light' | 'new'
  colors: {
    bg:          string  // main background
    bgPanel:     string  // sidebar / panel bg
    bgEditor:    string  // editor background
    bgHover:     string  // hover state
    bgActive:    string  // active/selected
    bgInput:     string  // input fields
    border:      string  // borders
    borderLight: string  // subtle borders
    text:        string  // primary text
    textMuted:   string  // secondary text
    textDim:     string  // tertiary text
    accent:      string  // primary accent
    accentSoft:  string  // accent hover/bg
    accentText:  string  // text on accent bg
    keyword:     string  // syntax: keywords
    string:      string  // syntax: strings
    comment:     string  // syntax: comments
    number:      string  // syntax: numbers
    func:        string  // syntax: functions
    type:        string  // syntax: types
    operator:    string  // syntax: operators
    variable:    string  // syntax: variables
    tab:         string  // tab bar bg
    tabActive:   string  // active tab bg
    tabBorder:   string  // active tab indicator
    statusBar:   string  // status bar bg
    statusText:  string  // status bar text
    terminal:    string  // terminal bg
    termText:    string  // terminal text
    scrollbar:   string  // scrollbar thumb
    lineHighlight: string // current line highlight
    selection:   string  // selection bg
    gitAdded:    string
    gitModified: string
    gitDeleted:  string
  }
}

export const themes: Theme[] = [
  // ─── Classic Dark ─────────────────────────────────────────────────────────
  {
    id: 'vscode-dark',
    name: 'VS Code Dark+',
    category: 'dark',
    colors: {
      bg: '#1e1e1e', bgPanel: '#252526', bgEditor: '#1e1e1e',
      bgHover: '#2a2d2e', bgActive: '#094771', bgInput: '#3c3c3c',
      border: '#3e3e42', borderLight: '#2d2d30',
      text: '#cccccc', textMuted: '#969696', textDim: '#6b6b6b',
      accent: '#0078d4', accentSoft: '#1e3a5f', accentText: '#ffffff',
      keyword: '#569cd6', string: '#ce9178', comment: '#6a9955',
      number: '#b5cea8', func: '#dcdcaa', type: '#4ec9b0',
      operator: '#d4d4d4', variable: '#9cdcfe',
      tab: '#2d2d2d', tabActive: '#1e1e1e', tabBorder: '#0078d4',
      statusBar: '#007acc', statusText: '#ffffff',
      terminal: '#1e1e1e', termText: '#cccccc',
      scrollbar: '#424242', lineHighlight: '#2a2d2e',
      selection: '#264f78',
      gitAdded: '#4ec9b0', gitModified: '#e2c08d', gitDeleted: '#f14c4c',
    }
  },
  {
    id: 'one-dark',
    name: 'One Dark Pro',
    category: 'dark',
    colors: {
      bg: '#282c34', bgPanel: '#21252b', bgEditor: '#282c34',
      bgHover: '#2c313a', bgActive: '#3e4451', bgInput: '#1d2026',
      border: '#3e4451', borderLight: '#2c313a',
      text: '#abb2bf', textMuted: '#5c6370', textDim: '#3e4451',
      accent: '#61afef', accentSoft: '#1a2d44', accentText: '#ffffff',
      keyword: '#c678dd', string: '#98c379', comment: '#5c6370',
      number: '#d19a66', func: '#61afef', type: '#e5c07b',
      operator: '#56b6c2', variable: '#e06c75',
      tab: '#21252b', tabActive: '#282c34', tabBorder: '#61afef',
      statusBar: '#21252b', statusText: '#abb2bf',
      terminal: '#21252b', termText: '#abb2bf',
      scrollbar: '#3e4451', lineHighlight: '#2c313a',
      selection: '#3e4451',
      gitAdded: '#98c379', gitModified: '#e5c07b', gitDeleted: '#e06c75',
    }
  },
  {
    id: 'dracula',
    name: 'Dracula',
    category: 'dark',
    colors: {
      bg: '#282a36', bgPanel: '#21222c', bgEditor: '#282a36',
      bgHover: '#343746', bgActive: '#44475a', bgInput: '#21222c',
      border: '#44475a', borderLight: '#343746',
      text: '#f8f8f2', textMuted: '#6272a4', textDim: '#44475a',
      accent: '#bd93f9', accentSoft: '#3a2f52', accentText: '#f8f8f2',
      keyword: '#ff79c6', string: '#f1fa8c', comment: '#6272a4',
      number: '#bd93f9', func: '#50fa7b', type: '#8be9fd',
      operator: '#ff79c6', variable: '#f8f8f2',
      tab: '#21222c', tabActive: '#282a36', tabBorder: '#bd93f9',
      statusBar: '#191a21', statusText: '#f8f8f2',
      terminal: '#21222c', termText: '#f8f8f2',
      scrollbar: '#44475a', lineHighlight: '#44475a44',
      selection: '#44475a',
      gitAdded: '#50fa7b', gitModified: '#f1fa8c', gitDeleted: '#ff5555',
    }
  },
  {
    id: 'monokai-pro',
    name: 'Monokai Pro',
    category: 'dark',
    colors: {
      bg: '#2d2a2e', bgPanel: '#221f22', bgEditor: '#2d2a2e',
      bgHover: '#3a3640', bgActive: '#403e41', bgInput: '#221f22',
      border: '#403e41', borderLight: '#3a3640',
      text: '#fcfcfa', textMuted: '#939293', textDim: '#5b595c',
      accent: '#ff6188', accentSoft: '#4a2535', accentText: '#fcfcfa',
      keyword: '#ff6188', string: '#ffd866', comment: '#727072',
      number: '#ab9df2', func: '#a9dc76', type: '#78dce8',
      operator: '#ff6188', variable: '#fcfcfa',
      tab: '#221f22', tabActive: '#2d2a2e', tabBorder: '#ff6188',
      statusBar: '#221f22', statusText: '#939293',
      terminal: '#1a181a', termText: '#fcfcfa',
      scrollbar: '#5b595c', lineHighlight: '#3a3640',
      selection: '#403e41',
      gitAdded: '#a9dc76', gitModified: '#ffd866', gitDeleted: '#ff6188',
    }
  },
  {
    id: 'nord',
    name: 'Nord',
    category: 'dark',
    colors: {
      bg: '#2e3440', bgPanel: '#272c36', bgEditor: '#2e3440',
      bgHover: '#3b4252', bgActive: '#434c5e', bgInput: '#272c36',
      border: '#434c5e', borderLight: '#3b4252',
      text: '#d8dee9', textMuted: '#616e88', textDim: '#4c566a',
      accent: '#88c0d0', accentSoft: '#2a3d4a', accentText: '#2e3440',
      keyword: '#81a1c1', string: '#a3be8c', comment: '#616e88',
      number: '#b48ead', func: '#88c0d0', type: '#8fbcbb',
      operator: '#81a1c1', variable: '#d8dee9',
      tab: '#272c36', tabActive: '#2e3440', tabBorder: '#88c0d0',
      statusBar: '#242933', statusText: '#d8dee9',
      terminal: '#272c36', termText: '#d8dee9',
      scrollbar: '#4c566a', lineHighlight: '#3b4252',
      selection: '#434c5e',
      gitAdded: '#a3be8c', gitModified: '#ebcb8b', gitDeleted: '#bf616a',
    }
  },
  {
    id: 'github-dark',
    name: 'GitHub Dark',
    category: 'dark',
    colors: {
      bg: '#0d1117', bgPanel: '#161b22', bgEditor: '#0d1117',
      bgHover: '#21262d', bgActive: '#388bfd26', bgInput: '#21262d',
      border: '#30363d', borderLight: '#21262d',
      text: '#e6edf3', textMuted: '#8b949e', textDim: '#484f58',
      accent: '#388bfd', accentSoft: '#1f3460', accentText: '#ffffff',
      keyword: '#ff7b72', string: '#a5d6ff', comment: '#8b949e',
      number: '#79c0ff', func: '#d2a8ff', type: '#ffa657',
      operator: '#ff7b72', variable: '#e6edf3',
      tab: '#161b22', tabActive: '#0d1117', tabBorder: '#388bfd',
      statusBar: '#161b22', statusText: '#8b949e',
      terminal: '#0d1117', termText: '#e6edf3',
      scrollbar: '#30363d', lineHighlight: '#161b22',
      selection: '#264f78',
      gitAdded: '#3fb950', gitModified: '#e3b341', gitDeleted: '#f85149',
    }
  },
  {
    id: 'catppuccin',
    name: 'Catppuccin Mocha',
    category: 'dark',
    colors: {
      bg: '#1e1e2e', bgPanel: '#181825', bgEditor: '#1e1e2e',
      bgHover: '#313244', bgActive: '#45475a', bgInput: '#181825',
      border: '#45475a', borderLight: '#313244',
      text: '#cdd6f4', textMuted: '#7f849c', textDim: '#585b70',
      accent: '#cba6f7', accentSoft: '#352b4a', accentText: '#1e1e2e',
      keyword: '#cba6f7', string: '#a6e3a1', comment: '#585b70',
      number: '#fab387', func: '#89b4fa', type: '#f9e2af',
      operator: '#f38ba8', variable: '#cdd6f4',
      tab: '#181825', tabActive: '#1e1e2e', tabBorder: '#cba6f7',
      statusBar: '#11111b', statusText: '#cdd6f4',
      terminal: '#181825', termText: '#cdd6f4',
      scrollbar: '#45475a', lineHighlight: '#313244',
      selection: '#45475a',
      gitAdded: '#a6e3a1', gitModified: '#f9e2af', gitDeleted: '#f38ba8',
    }
  },
  {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    category: 'dark',
    colors: {
      bg: '#1a1b26', bgPanel: '#16161e', bgEditor: '#1a1b26',
      bgHover: '#24283b', bgActive: '#292e42', bgInput: '#16161e',
      border: '#292e42', borderLight: '#1f2335',
      text: '#c0caf5', textMuted: '#565f89', textDim: '#414868',
      accent: '#7aa2f7', accentSoft: '#1e2d52', accentText: '#ffffff',
      keyword: '#bb9af7', string: '#9ece6a', comment: '#565f89',
      number: '#ff9e64', func: '#7aa2f7', type: '#2ac3de',
      operator: '#89ddff', variable: '#c0caf5',
      tab: '#16161e', tabActive: '#1a1b26', tabBorder: '#7aa2f7',
      statusBar: '#16161e', statusText: '#565f89',
      terminal: '#16161e', termText: '#c0caf5',
      scrollbar: '#292e42', lineHighlight: '#292e42',
      selection: '#2d3f76',
      gitAdded: '#9ece6a', gitModified: '#e0af68', gitDeleted: '#f7768e',
    }
  },

  // ─── Light ────────────────────────────────────────────────────────────────
  {
    id: 'github-light',
    name: 'GitHub Light',
    category: 'light',
    colors: {
      bg: '#ffffff', bgPanel: '#f6f8fa', bgEditor: '#ffffff',
      bgHover: '#eaeef2', bgActive: '#ddeeff', bgInput: '#f6f8fa',
      border: '#d0d7de', borderLight: '#eaeef2',
      text: '#24292f', textMuted: '#57606a', textDim: '#8c959f',
      accent: '#0969da', accentSoft: '#dbeafe', accentText: '#ffffff',
      keyword: '#cf222e', string: '#0a3069', comment: '#6e7781',
      number: '#0550ae', func: '#8250df', type: '#953800',
      operator: '#cf222e', variable: '#24292f',
      tab: '#f6f8fa', tabActive: '#ffffff', tabBorder: '#0969da',
      statusBar: '#f6f8fa', statusText: '#57606a',
      terminal: '#f6f8fa', termText: '#24292f',
      scrollbar: '#d0d7de', lineHighlight: '#f6f8fa',
      selection: '#b6dcfe',
      gitAdded: '#2da44e', gitModified: '#e36209', gitDeleted: '#cf222e',
    }
  },

  // ─── NEW ORIGINAL THEMES ─────────────────────────────────────────────────
  {
    id: 'void-black',
    name: 'Void Black',
    category: 'new',
    colors: {
      bg: '#000000', bgPanel: '#0a0a0a', bgEditor: '#000000',
      bgHover: '#111111', bgActive: '#1a1a1a', bgInput: '#0a0a0a',
      border: '#1a1a1a', borderLight: '#111111',
      text: '#e8e8e8', textMuted: '#555555', textDim: '#2a2a2a',
      accent: '#ff3366', accentSoft: '#2a0011', accentText: '#ffffff',
      keyword: '#ff3366', string: '#66ffcc', comment: '#333333',
      number: '#ff9933', func: '#33ccff', type: '#cc66ff',
      operator: '#ff3366', variable: '#e8e8e8',
      tab: '#0a0a0a', tabActive: '#000000', tabBorder: '#ff3366',
      statusBar: '#000000', statusText: '#333333',
      terminal: '#000000', termText: '#e8e8e8',
      scrollbar: '#1a1a1a', lineHighlight: '#0d0d0d',
      selection: '#2a0011',
      gitAdded: '#66ffcc', gitModified: '#ff9933', gitDeleted: '#ff3366',
    }
  },
  {
    id: 'aurora',
    name: 'Aurora Borealis',
    category: 'new',
    colors: {
      bg: '#0a0e1a', bgPanel: '#060a14', bgEditor: '#0a0e1a',
      bgHover: '#111927', bgActive: '#1a2840', bgInput: '#060a14',
      border: '#1a2840', borderLight: '#111927',
      text: '#d4f1e8', textMuted: '#4d7a6a', textDim: '#2a4a3a',
      accent: '#00ffaa', accentSoft: '#00332a', accentText: '#000000',
      keyword: '#00ffaa', string: '#66aaff', comment: '#2a5a4a',
      number: '#ff66aa', func: '#aaffee', type: '#66ffdd',
      operator: '#00ccff', variable: '#d4f1e8',
      tab: '#060a14', tabActive: '#0a0e1a', tabBorder: '#00ffaa',
      statusBar: '#04080f', statusText: '#4d7a6a',
      terminal: '#060a14', termText: '#d4f1e8',
      scrollbar: '#1a2840', lineHighlight: '#111927',
      selection: '#00332a',
      gitAdded: '#00ffaa', gitModified: '#66aaff', gitDeleted: '#ff66aa',
    }
  },
  {
    id: 'sandstorm',
    name: 'Sandstorm',
    category: 'new',
    colors: {
      bg: '#1a1208', bgPanel: '#120d04', bgEditor: '#1a1208',
      bgHover: '#241a0c', bgActive: '#332511', bgInput: '#120d04',
      border: '#332511', borderLight: '#241a0c',
      text: '#f5deb3', textMuted: '#8b7355', textDim: '#4a3a25',
      accent: '#ffaa00', accentSoft: '#332200', accentText: '#000000',
      keyword: '#ffaa00', string: '#88cc44', comment: '#5a4a2a',
      number: '#ff6644', func: '#ffdd88', type: '#ffcc66',
      operator: '#ffaa00', variable: '#f5deb3',
      tab: '#120d04', tabActive: '#1a1208', tabBorder: '#ffaa00',
      statusBar: '#0e0a02', statusText: '#8b7355',
      terminal: '#120d04', termText: '#f5deb3',
      scrollbar: '#332511', lineHighlight: '#241a0c',
      selection: '#332200',
      gitAdded: '#88cc44', gitModified: '#ffaa00', gitDeleted: '#ff6644',
    }
  },
  {
    id: 'neon-city',
    name: 'Neon City',
    category: 'new',
    colors: {
      bg: '#0f0b1a', bgPanel: '#0a0714', bgEditor: '#0f0b1a',
      bgHover: '#180d2a', bgActive: '#241440', bgInput: '#0a0714',
      border: '#2d1460', borderLight: '#180d2a',
      text: '#e8d5ff', textMuted: '#7a5ca0', textDim: '#3d2670',
      accent: '#ff00ff', accentSoft: '#2a0030', accentText: '#ffffff',
      keyword: '#ff00ff', string: '#00ffff', comment: '#4a2a6a',
      number: '#ffff00', func: '#ff66ff', type: '#00ccff',
      operator: '#ff00aa', variable: '#e8d5ff',
      tab: '#0a0714', tabActive: '#0f0b1a', tabBorder: '#ff00ff',
      statusBar: '#070412', statusText: '#4a2a6a',
      terminal: '#0a0714', termText: '#e8d5ff',
      scrollbar: '#2d1460', lineHighlight: '#180d2a',
      selection: '#2a0030',
      gitAdded: '#00ffff', gitModified: '#ffff00', gitDeleted: '#ff00ff',
    }
  },
  {
    id: 'sakura',
    name: 'Sakura Dusk',
    category: 'new',
    colors: {
      bg: '#1a0f14', bgPanel: '#130a10', bgEditor: '#1a0f14',
      bgHover: '#24151c', bgActive: '#33202a', bgInput: '#130a10',
      border: '#3d2030', borderLight: '#24151c',
      text: '#ffe8f0', textMuted: '#9a6070', textDim: '#4a2535',
      accent: '#ff80aa', accentSoft: '#330015', accentText: '#ffffff',
      keyword: '#ff80aa', string: '#ff99bb', comment: '#5a3045',
      number: '#ffaacc', func: '#ffbbdd', type: '#ffddee',
      operator: '#ff6699', variable: '#ffe8f0',
      tab: '#130a10', tabActive: '#1a0f14', tabBorder: '#ff80aa',
      statusBar: '#0e0609', statusText: '#9a6070',
      terminal: '#130a10', termText: '#ffe8f0',
      scrollbar: '#3d2030', lineHighlight: '#24151c',
      selection: '#330015',
      gitAdded: '#99ffcc', gitModified: '#ffaacc', gitDeleted: '#ff6699',
    }
  },
  {
    id: 'glacier',
    name: 'Glacier',
    category: 'new',
    colors: {
      bg: '#0d1821', bgPanel: '#091420', bgEditor: '#0d1821',
      bgHover: '#13202e', bgActive: '#1a2d40', bgInput: '#091420',
      border: '#1a3050', borderLight: '#13202e',
      text: '#c8e8ff', textMuted: '#4a7090', textDim: '#1a3555',
      accent: '#44aaff', accentSoft: '#002244', accentText: '#ffffff',
      keyword: '#44aaff', string: '#88ddff', comment: '#2a5070',
      number: '#66bbff', func: '#aaddff', type: '#88ffee',
      operator: '#22aaee', variable: '#c8e8ff',
      tab: '#091420', tabActive: '#0d1821', tabBorder: '#44aaff',
      statusBar: '#06101a', statusText: '#4a7090',
      terminal: '#091420', termText: '#c8e8ff',
      scrollbar: '#1a3050', lineHighlight: '#13202e',
      selection: '#002244',
      gitAdded: '#88ffee', gitModified: '#66bbff', gitDeleted: '#ff6677',
    }
  },
]

export const defaultTheme = themes[0]

export function applyTheme(theme: Theme) {
  const root = document.documentElement
  const c = theme.colors
  const map: Record<string, string> = {
    '--bg': c.bg, '--bg-panel': c.bgPanel, '--bg-editor': c.bgEditor,
    '--bg-hover': c.bgHover, '--bg-active': c.bgActive, '--bg-input': c.bgInput,
    '--border': c.border, '--border-light': c.borderLight,
    '--text': c.text, '--text-muted': c.textMuted, '--text-dim': c.textDim,
    '--accent': c.accent, '--accent-soft': c.accentSoft, '--accent-text': c.accentText,
    '--syn-keyword': c.keyword, '--syn-string': c.string, '--syn-comment': c.comment,
    '--syn-number': c.number, '--syn-func': c.func, '--syn-type': c.type,
    '--syn-op': c.operator, '--syn-var': c.variable,
    '--tab': c.tab, '--tab-active': c.tabActive, '--tab-border': c.tabBorder,
    '--status-bar': c.statusBar, '--status-text': c.statusText,
    '--terminal': c.terminal, '--term-text': c.termText,
    '--scrollbar': c.scrollbar, '--line-hl': c.lineHighlight,
    '--selection': c.selection,
    '--git-added': c.gitAdded, '--git-modified': c.gitModified, '--git-deleted': c.gitDeleted,
  }
  for (const [k, v] of Object.entries(map)) root.style.setProperty(k, v)

  // Notify Monaco to re-apply theme (EditorArea listens to this event)
  window.dispatchEvent(new CustomEvent('codedroid-theme-change', { detail: theme }))
}

/** Build an xterm.js ITheme from our Theme colors */
export function getXtermTheme(theme: Theme) {
  const c = theme.colors
  return {
    background: c.terminal,
    foreground: c.termText,
    cursor: c.accent,
    cursorAccent: c.bg,
    selectionBackground: c.selection + 'aa',
    // ANSI colors — mapped to theme palette
    black:        theme.category === 'light' ? '#24292f' : '#000000',
    red:          c.gitDeleted,
    green:        c.gitAdded,
    yellow:       c.gitModified,
    blue:         c.accent,
    magenta:      c.keyword,
    cyan:         c.type,
    white:        c.text,
    brightBlack:  c.textDim,
    brightRed:    c.gitDeleted,
    brightGreen:  c.gitAdded,
    brightYellow: c.gitModified,
    brightBlue:   c.accent,
    brightMagenta:c.func,
    brightCyan:   c.type,
    brightWhite:  c.text,
  }
}