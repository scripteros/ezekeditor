import { useRef, useEffect, useState, memo, useCallback } from 'react'
import * as monaco from 'monaco-editor'
import { useEditorStore } from '../../store/editorStore'
import { useThemeStore } from '../../store/themeStore'
import { Loader2 } from 'lucide-react'
import logo from '../../assets/logo.png'

const THEME_DARK: monaco.editor.IStandaloneThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '6A9955' },
    { token: 'keyword', foreground: '569CD6' },
    { token: 'string', foreground: 'CE9178' },
    { token: 'number', foreground: 'B5CEA8' },
    { token: 'type', foreground: '4EC9B0' },
    { token: 'function', foreground: 'DCDCAA' },
    { token: 'variable', foreground: '9CDCFE' },
    { token: 'constant', foreground: '4FC1FF' },
  ],
  colors: {
    'editor.background': '#0f1a15',
    'editor.foreground': '#e6e9ef',
    'editor.lineHighlightBackground': '#1a2a2233',
    'editor.selectionBackground': '#264f7844',
    'editorCursor.foreground': '#59d27c',
    'editorLineNumber.foreground': '#5a6d6a',
    'editorLineNumber.activeForeground': '#59d27c',
    'editorIndentGuide.background': '#1a2a22',
    'editorIndentGuide.activeBackground': '#2a3a32',
    'editor.selectionHighlightBackground': '#59d27c22',
    'editorBracketMatch.background': '#59d27c33',
    'editorBracketMatch.border': '#59d27c',
    'editorWidget.background': '#0f1a15',
    'editorWidget.border': '#1a2a22',
    'editorSuggestWidget.background': '#0f1a15',
    'editorSuggestWidget.border': '#1a2a22',
    'editorSuggestWidget.selectedBackground': '#1a2a22',
    'editorHoverWidget.background': '#0f1a15',
    'editorHoverWidget.border': '#1a2a22',
    'editorRuler.foreground': '#1a2a22',
    'editorBracketHighlight.foreground1': '#59d27c',
    'editorBracketHighlight.foreground2': '#569CD6',
    'editorBracketHighlight.foreground3': '#CE9178',
    'minimap.background': '#0a0f0d',
  },
}

const THEME_LIGHT: monaco.editor.IStandaloneThemeData = {
  base: 'vs',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '008000' },
    { token: 'keyword', foreground: '0000FF' },
    { token: 'string', foreground: 'A31515' },
    { token: 'number', foreground: '098658' },
    { token: 'type', foreground: '267F99' },
    { token: 'function', foreground: '795E26' },
  ],
  colors: {
    'editor.background': '#fcfcfc',
    'editor.foreground': '#333333',
    'editor.lineHighlightBackground': '#e8e8e833',
    'editor.selectionBackground': '#add6ff',
    'editorCursor.foreground': '#000000',
    'editorLineNumber.foreground': '#888888',
    'editorLineNumber.activeForeground': '#333333',
    'editorIndentGuide.background': '#e0e0e0',
    'editorWidget.background': '#fcfcfc',
    'editorWidget.border': '#e0e0e0',
    'minimap.background': '#f0f0f0',
  },
}

// Memoized component to avoid recreating the editor on every parent render
const MonacoEditor = memo(function MonacoEditor() {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const editorContainerRef = useRef<HTMLDivElement>(null)
  const activeFile = useEditorStore(s => {
    const file = s.openFiles.find(f => f.id === s.activeFileId)
    return file || null
  })
  const updateFileContent = useEditorStore(s => s.updateFileContent)
  const isDark = useThemeStore(s => s.isDark)
  const [isReady, setIsReady] = useState(false)
  const isUpdatingRef = useRef(false)
  const previousContentRef = useRef<string>('')

  useEffect(() => {
    if (!editorContainerRef.current) return

    const savedFontLigatures = localStorage.getItem('editor:fontLigatures') !== 'false'
    const savedFontSize = parseInt(localStorage.getItem('editor:fontSize') || '13', 10)
    const savedMinimap = localStorage.getItem('editor:minimap') !== 'false'

    // Register themes once
    if (!monaco.editor.getTheme('nova-dark')) {
      monaco.editor.defineTheme('nova-dark', THEME_DARK)
      monaco.editor.defineTheme('nova-light', THEME_LIGHT)
    }

    const editor = monaco.editor.create(editorContainerRef.current, {
      value: '',
      language: 'plaintext',
      theme: isDark ? 'nova-dark' : 'nova-light',
      fontSize: savedFontSize,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace",
      fontLigatures: savedFontLigatures,
      fontWeight: '400',
      lineHeight: 1.6,
      minimap: { enabled: savedMinimap, scale: 1, showSlider: 'mouseover' },
      scrollBeyondLastLine: false,
      scrollbar: {
        vertical: 'hidden',
        horizontal: 'hidden',
        alwaysConsumeMouseWheel: false,
      },
      smoothScrolling: true,
      cursorBlinking: 'smooth',
      cursorSmoothCaretAnimation: 'on',
      folding: false,
      foldingHighlight: false,
      automaticLayout: false,
      wordWrap: 'off',
      tabSize: 2,
      renderLineHighlight: 'line',
      renderWhitespace: 'selection',
      bracketPairColorization: { enabled: true },
      autoClosingBrackets: 'always',
      autoClosingQuotes: 'always',
      formatOnPaste: false,
      suggest: {
        showMethods: true,
        showFunctions: true,
        showConstructors: false,
        showFields: false,
        showVariables: false,
        showClasses: false,
        showStructs: false,
        showInterfaces: false,
        showModules: false,
        showProperties: false,
        showEvents: false,
        showOperators: false,
        showUnits: false,
        showValues: false,
        showConstants: false,
        showEnums: false,
        showEnumMembers: false,
        showKeywords: true,
        showWords: true,
        showColors: false,
        showFiles: false,
        showReferences: false,
        showSnippets: true,
      },
      quickSuggestions: false,
      parameterHints: { enabled: false },
      hover: { enabled: false, delay: 500, sticky: false },
      occurrencesHighlight: 'off',
      selectionHighlight: false,
      codeLens: false,
      colorDecorators: false,
      links: false,
      documentHighlight: { show: false },
      lightbulb: { enabled: false },
    })

    editorRef.current = editor

    // Optimized resize handler
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width > 0 && height > 0) {
          editor.layout({ width, height })
        }
      }
    })
    
    if (editorContainerRef.current) {
      resizeObserver.observe(editorContainerRef.current)
    }

    // Debounced content change handler
    let changeTimeout: number | null = null
    const changeDisposable = editor.onDidChangeModelContent(() => {
      if (changeTimeout !== null) return
      changeTimeout = window.setTimeout(() => {
        changeTimeout = null
        const value = editor.getValue()
        const id = activeFile?.id
        if (id && !isUpdatingRef.current) {
          updateFileContent(id, value)
        }
      }, 100) // 100ms debounce
    })

    // Focus handler for layout
    editor.focus()

    setIsReady(true)

    return () => {
      if (changeTimeout !== null) clearTimeout(changeTimeout)
      changeDisposable.dispose()
      resizeObserver.disconnect()
      editor.dispose()
      editorRef.current = null
      setIsReady(false)
    }
    // Only recreate editor when theme changes (stale is intentional for deps)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDark])

  // Update content when active file changes
  useEffect(() => {
    const editor = editorRef.current
    if (!editor || !activeFile) return

    const newContent = activeFile.content || ''
    if (previousContentRef.current !== newContent) {
      isUpdatingRef.current = true
      previousContentRef.current = newContent

      const model = editor.getModel()
      const position = editor.getPosition()

      // Only update if content actually changed
      if (model && model.getValue() !== newContent) {
        editor.setValue(newContent)
      }

      // Set language
      monaco.editor.setModelLanguage(model || editor.getModel()!, activeFile.language)

      isUpdatingRef.current = false
    }
  }, [activeFile?.id, activeFile?.content, activeFile?.language])

  // Resize when active file changes
  useEffect(() => {
    const editor = editorRef.current
    if (editor && editorContainerRef.current) {
      const rect = editorContainerRef.current.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        editor.layout({ width: rect.width, height: rect.height })
      }
    }
  }, [activeFile?.id])

  if (!activeFile) {
    return (
      <div className="flex-1 flex items-center justify-center bg-nova-bg">
        <div className="text-center">
          <img src={logo} alt="Nova" className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p className="text-nova-text-muted text-sm">Selecione um arquivo para editar</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 relative">
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-nova-bg z-10">
          <Loader2 className="animate-spin text-nova-accent" size={20} />
        </div>
      )}
      <div ref={editorContainerRef} className="w-full h-full" />
    </div>
  )
})

export default MonacoEditor
