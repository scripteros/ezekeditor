import { useEffect, useMemo, useRef, useState } from 'react'
import Editor, { OnMount, OnChange, loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import { useEditorStore } from '../../store/editorStore'
import { useThemeStore } from '../../store/themeStore'
import { useSqlStore } from '../../store/sqlStore'
import logo from '../../assets/logo.png'

loader.config({ monaco })

export default function MonacoEditor() {
  const { openFiles, activeFileId, updateFileContent } = useEditorStore()
  const { theme } = useThemeStore()
  const activeFile = openFiles.find(f => f.id === activeFileId)
  const editorRef = useRef<any>(null)
  const [settingsVersion, setSettingsVersion] = useState(0)
  const editorSettings = useMemo(() => ({
    codeTheme: localStorage.getItem('ezek-settings-code-editor-theme') || 'auto',
    fontFamily: localStorage.getItem('ezek-settings-font') || "'JetBrains Mono', monospace",
    fontLigatures: localStorage.getItem('ezek-settings-ligatures') === 'true',
    pulseCursor: localStorage.getItem('ezek-settings-pulse') !== 'false',
    ghostText: localStorage.getItem('ezek-settings-ghost-text') !== 'false',
  }), [settingsVersion])
  const isDark = editorSettings.codeTheme === 'auto'
    ? theme.type === 'dark'
    : editorSettings.codeTheme === 'dark'

  useEffect(() => {
    const handleSettingsChanged = () => setSettingsVersion(version => version + 1)
    window.addEventListener('ezek-settings-changed', handleSettingsChanged)
    return () => window.removeEventListener('ezek-settings-changed', handleSettingsChanged)
  }, [])

  const handleEditorDidMount: OnMount = (editor, monacoInstance) => {
    editorRef.current = editor

    monacoInstance.editor.defineTheme('ezek-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '5f7d8d', fontStyle: 'italic' },
        { token: 'keyword', foreground: '43e6a1' },
        { token: 'string', foreground: '89ddff' },
        { token: 'number', foreground: 'c3e88d' },
        { token: 'type', foreground: '7dd3fc' },
        { token: 'function', foreground: 'facc15' },
        { token: 'variable', foreground: 'd7e8f4' },
        { token: 'constant', foreground: 'b794f6' },
        { token: 'operator', foreground: '80cbc4' },
        { token: 'identifier', foreground: 'd7e8f4' },
        { token: 'predefined', foreground: 'facc15' },
      ],
      colors: {
        'editor.background': '#00000000',
        'editor.foreground': '#d7e8f4',
        'editor.lineHighlightBackground': '#10283a',
        'editor.selectionBackground': '#173b4d',
        'editorCursor.foreground': '#43e6a1',
        'editorLineNumber.foreground': '#476777',
        'editorLineNumber.activeForeground': '#aec5cf',
        'editorBracketMatch.background': '#173b4d',
        'editorBracketMatch.border': '#43e6a1',
        'editorWidget.background': '#0b1b2b',
        'editorWidget.border': '#1d3444',
        'editorSuggestWidget.background': '#0b1b2b',
        'editorSuggestWidget.border': '#1d3444',
        'editorSuggestWidget.selectedBackground': '#123146',
        'editorHoverWidget.background': '#0b1b2b',
        'editorHoverWidget.border': '#1d3444',
        'editorWhitespace.foreground': '#193243',
        'editorRuler.foreground': '#193243',
        'minimap.background': '#00000000',
      },
    })

    monacoInstance.editor.defineTheme('ezek-light', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '748895', fontStyle: 'italic' },
        { token: 'keyword', foreground: '00a96d' },
        { token: 'string', foreground: 'a31515' },
        { token: 'number', foreground: '008f61' },
        { token: 'type', foreground: '267f99' },
        { token: 'function', foreground: '795e26' },
        { token: 'variable', foreground: '132635' },
        { token: 'constant', foreground: '0070c0' },
        { token: 'operator', foreground: '1d3444' },
      ],
      colors: {
        'editor.background': '#00000000',
        'editor.foreground': '#132635',
        'editor.lineHighlightBackground': '#edf2f6',
        'editor.selectionBackground': '#c4f1e2',
        'editorCursor.foreground': '#00bf7d',
        'editorLineNumber.foreground': '#93a4ad',
        'editorLineNumber.activeForeground': '#49606d',
        'editorBracketMatch.background': '#d7f7eb',
        'editorBracketMatch.border': '#00bf7d',
        'editorWidget.background': '#ffffff',
        'editorWidget.border': '#cddbe4',
        'editorSuggestWidget.background': '#ffffff',
        'editorSuggestWidget.border': '#cddbe4',
        'editorSuggestWidget.selectedBackground': '#d7f7eb',
        'editorHoverWidget.background': '#ffffff',
        'editorHoverWidget.border': '#cddbe4',
        'editorWhitespace.foreground': '#dfeaf0',
        'editorRuler.foreground': '#dfeaf0',
        'minimap.background': '#00000000',
      },
    })

    monacoInstance.editor.setTheme(isDark ? 'ezek-dark' : 'ezek-light')

    editor.onDidChangeCursorSelection((e) => {
      const selection = editor.getModel()?.getValueInRange(e.selection) || ''
      useEditorStore.getState().setSelectedText(selection)
    })

    if (activeFile?.language === 'sql') {
      editor.addAction({
        id: 'execute-sql',
        label: 'Executar SQL Selecionado/Atual',
        keybindings: [
          monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.Enter,
          monacoInstance.KeyCode.F5
        ],
        contextMenuGroupId: 'navigation',
        contextMenuOrder: 1,
        run: (ed) => {
          const sqlStore = useSqlStore.getState()
          if (!sqlStore.activeConnectionId) {
            alert('Selecione ou configure uma conexão SQL no painel inferior primeiro!')
            return
          }
          const selection = ed.getModel()?.getValueInRange(ed.getSelection()!) || ''
          const queryToRun = selection && selection.trim().length > 0 ? selection : ed.getValue()
          sqlStore.executeQuery(queryToRun)
          window.dispatchEvent(new CustomEvent('ezek:open-sql-tab'))
        }
      })
    }
  }

  const handleChange: OnChange = (value) => {
    if (activeFileId && value !== undefined) {
      updateFileContent(activeFileId, value)
    }
  }

  if (!activeFile) {
    return (
      <div className="h-full flex items-center justify-center text-nova-text-muted">
        <p>Nenhum arquivo selecionado</p>
      </div>
    )
  }

  return (
    <div
      className={`h-full w-full relative ${isDark ? 'bg-nova-bg' : 'bg-slate-50'}`}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Editor
        key={`${activeFile.id}-${isDark ? 'dark' : 'light'}`}
        height="100%"
        language={activeFile.language}
        value={activeFile.content}
        theme={isDark ? 'ezek-dark' : 'ezek-light'}
        onChange={handleChange}
        onMount={handleEditorDidMount}
        loading={
          <div className="h-full flex items-center justify-center text-nova-text-muted">
            <div className="flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-nova-accent border-t-transparent rounded-full animate-spin" />
              <p className="text-xs">Carregando editor...</p>
            </div>
          </div>
        }
        options={{
          fontSize: 14,
          fontFamily: editorSettings.fontFamily,
          fontLigatures: editorSettings.fontLigatures,
          minimap: { enabled: true, showSlider: 'mouseover' },
          scrollBeyondLastLine: false,
          lineNumbers: 'on',
          renderLineHighlight: 'line',
          cursorBlinking: editorSettings.pulseCursor ? 'smooth' : 'solid',
          cursorSmoothCaretAnimation: 'on',
          smoothScrolling: true,
          autoClosingBrackets: 'always',
          autoClosingQuotes: 'always',
          autoIndent: 'full',
          formatOnPaste: true,
          bracketPairColorization: { enabled: true },
          guides: {
            indentation: true,
            highlightActiveIndentation: true,
            bracketPairs: true,
            bracketPairsHorizontal: true,
          },
          wordWrap: 'off',
          tabSize: 2,
          insertSpaces: true,
          automaticLayout: true,
          padding: { top: 8 },
          folding: true,
          foldingHighlight: true,
          suggestOnTriggerCharacters: true,
          quickSuggestions: editorSettings.ghostText
            ? { other: true, comments: false, strings: true }
            : false,
          quickSuggestionsDelay: 50,
          parameterHints: { enabled: true, cycle: true },
          hover: { enabled: true, delay: 200 },
          suggest: {
            showKeywords: true,
            showSnippets: true,
            showClasses: true,
            showFunctions: true,
            showMethods: true,
            showFields: true,
            showVariables: true,
            showConstants: true,
            showStructs: true,
            showInterfaces: true,
            showEvents: true,
            showOperators: true,
            showUnits: true,
            showValues: true,
            showEnums: true,
            showReferences: true,
            showColors: true,
            showFiles: true,
            showFolders: true,
            showTypeParameters: true,
            showIssues: true,
            snippetsPreventQuickSuggestions: false,
          },
          snippetSuggestions: 'inline',
          tabCompletion: 'on',
          wordBasedSuggestions: 'allDocuments',
          selectionHighlight: true,
          occurrencesHighlight: 'multiFile',
          renderWhitespace: 'selection',
          matchBrackets: 'always',
          colorDecorators: true,
          codeLens: true,
          lightbulb: { enabled: true },
          links: true,
          acceptSuggestionOnCommitCharacter: true,
          acceptSuggestionOnEnter: 'smart',
        }}
      />
      
      {/* Watermark Logo */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.03] grayscale">
        <img src={logo} alt="Watermark" className="w-96 h-96 object-contain" />
      </div>
    </div>
  )
}
