import { useRef } from 'react'
import Editor, { OnMount, OnChange, loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import { useEditorStore } from '../../store/editorStore'
import { useThemeStore } from '../../store/themeStore'

loader.config({ monaco })

export default function MonacoEditor() {
  const { openFiles, activeFileId, updateFileContent } = useEditorStore()
  const { theme } = useThemeStore()
  const activeFile = openFiles.find(f => f.id === activeFileId)
  const editorRef = useRef<any>(null)
  const isDark = theme.type === 'dark'

  const handleEditorDidMount: OnMount = (editor, monacoInstance) => {
    editorRef.current = editor

    monacoInstance.editor.defineTheme('ezek-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '5A7A5A', fontStyle: 'italic' },
        { token: 'keyword', foreground: '2EA043' },
        { token: 'string', foreground: 'CE9178' },
        { token: 'number', foreground: 'B5CEA8' },
        { token: 'type', foreground: '3FB950' },
        { token: 'function', foreground: 'DCDCAA' },
        { token: 'variable', foreground: '9CDCFE' },
        { token: 'constant', foreground: '4FC1FF' },
        { token: 'operator', foreground: 'D4D4D4' },
        { token: 'identifier', foreground: '9CDCFE' },
        { token: 'predefined', foreground: 'DCDCAA' },
      ],
      colors: {
        'editor.background': '#0f1a12',
        'editor.foreground': '#d4e6d4',
        'editor.lineHighlightBackground': '#1a2d1f',
        'editor.selectionBackground': '#1a3a2f',
        'editorCursor.foreground': '#aeafad',
        'editorLineNumber.foreground': '#5a7a5a',
        'editorLineNumber.activeForeground': '#8aaa8a',
        'editorBracketMatch.background': '#1a3a2f',
        'editorBracketMatch.border': '#2ea043',
        'editorWidget.background': '#152018',
        'editorWidget.border': '#2a3d2f',
        'editorSuggestWidget.background': '#152018',
        'editorSuggestWidget.border': '#2a3d2f',
        'editorSuggestWidget.selectedBackground': '#1a3a2f',
        'editorHoverWidget.background': '#152018',
        'editorHoverWidget.border': '#2a3d2f',
        'editorWhitespace.foreground': '#1a2d1f',
        'editorRuler.foreground': '#1a2d1f',
        'minimap.background': '#0f1a12',
      },
    })

    monacoInstance.editor.defineTheme('ezek-light', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '8aaa8a', fontStyle: 'italic' },
        { token: 'keyword', foreground: '1a7f37' },
        { token: 'string', foreground: 'a31515' },
        { token: 'number', foreground: '098658' },
        { token: 'type', foreground: '267f99' },
        { token: 'function', foreground: '795e26' },
        { token: 'variable', foreground: '001080' },
        { token: 'constant', foreground: '0070c0' },
        { token: 'operator', foreground: '000000' },
      ],
      colors: {
        'editor.background': '#ffffff',
        'editor.foreground': '#1a2d1f',
        'editor.lineHighlightBackground': '#e8f0e8',
        'editor.selectionBackground': '#d0f0d0',
        'editorCursor.foreground': '#000000',
        'editorLineNumber.foreground': '#8aaa8a',
        'editorLineNumber.activeForeground': '#4a6a4a',
        'editorBracketMatch.background': '#d0f0d0',
        'editorBracketMatch.border': '#1a7f37',
        'editorWidget.background': '#f0f7f0',
        'editorWidget.border': '#d0e0d0',
        'editorSuggestWidget.background': '#ffffff',
        'editorSuggestWidget.border': '#d0e0d0',
        'editorSuggestWidget.selectedBackground': '#d0f0d0',
        'editorHoverWidget.background': '#ffffff',
        'editorHoverWidget.border': '#d0e0d0',
        'editorWhitespace.foreground': '#e8f0e8',
        'editorRuler.foreground': '#e8f0e8',
        'minimap.background': '#ffffff',
      },
    })

    monacoInstance.editor.setTheme(isDark ? 'ezek-dark' : 'ezek-light')

    editor.onDidChangeCursorSelection((e) => {
      const selection = editor.getModel()?.getValueInRange(e.selection) || ''
      useEditorStore.getState().setSelectedText(selection)
    })
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
    <div className="h-full w-full" onContextMenu={(e) => e.preventDefault()}>
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
          fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', Consolas, monospace",
          fontLigatures: true,
          minimap: { enabled: true, showSlider: 'mouseover' },
          scrollBeyondLastLine: false,
          lineNumbers: 'on',
          renderLineHighlight: 'line',
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          smoothScrolling: true,
          autoClosingBrackets: 'always',
          autoClosingQuotes: 'always',
          autoIndent: 'full',
          formatOnPaste: true,
          bracketPairColorization: { enabled: true },
          guides: { bracketPairs: true, indentation: true },
          wordWrap: 'off',
          tabSize: 2,
          insertSpaces: true,
          automaticLayout: true,
          padding: { top: 8 },
          folding: true,
          foldingHighlight: true,
          suggestOnTriggerCharacters: true,
          quickSuggestions: { other: true, comments: false, strings: true },
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
    </div>
  )
}
