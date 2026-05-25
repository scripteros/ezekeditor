import { useRef } from 'react'
import { DiffEditor, OnMount, loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import { useEditorStore } from '../../store/editorStore'
import { useThemeStore } from '../../store/themeStore'
import { Check, X } from 'lucide-react'

loader.config({ monaco })

export default function MonacoDiffEditor() {
  const { isDiffMode, diffOriginalContent, diffModifiedContent, diffFilePath, acceptDiff, closeDiff } = useEditorStore()
  const { theme } = useThemeStore()
  const isDark = theme.type === 'dark'

  // Extract filename
  const fileName = diffFilePath.split(/[/\\]/).pop() || 'Arquivo'

  const handleEditorDidMount: OnMount = (_editor, monacoInstance) => {
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
        'diffEditor.insertedTextBackground': '#2ea04333',
        'diffEditor.removedTextBackground': '#da363333',
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
        'diffEditor.insertedTextBackground': '#1a7f3733',
        'diffEditor.removedTextBackground': '#d2222d33',
      },
    })

    monacoInstance.editor.setTheme(isDark ? 'ezek-dark' : 'ezek-light')
  }

  const getLanguage = () => {
    const ext = diffFilePath.split('.').pop()?.toLowerCase() || ''
    const map: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      json: 'json',
      css: 'css',
      html: 'html',
      md: 'markdown',
      py: 'python',
    }
    return map[ext] || 'plaintext'
  }

  if (!isDiffMode) return null

  return (
    <div className="flex flex-col h-full w-full bg-nova-bg">
      <div className="flex items-center justify-between px-4 py-2 border-b border-nova-border bg-nova-bg-secondary">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-nova-text">Revisão de Código</span>
          <span className="text-xs text-nova-text-muted bg-nova-bg px-2 py-0.5 rounded border border-nova-border">
            {fileName}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={closeDiff}
            className="flex items-center gap-1.5 px-3 py-1 text-xs text-nova-text-secondary bg-nova-bg hover:bg-nova-hover border border-nova-border rounded transition-colors"
          >
            <X size={14} />
            Descartar Alterações
          </button>
          <button
            onClick={acceptDiff}
            className="flex items-center gap-1.5 px-3 py-1 text-xs text-white bg-nova-accent hover:bg-nova-accent-hover rounded transition-colors shadow-sm"
          >
            <Check size={14} />
            Aceitar Alterações
          </button>
        </div>
      </div>
      <div className="flex-1 w-full h-full relative">
        <DiffEditor
          language={getLanguage()}
          original={diffOriginalContent}
          modified={diffModifiedContent}
          theme={isDark ? 'ezek-dark' : 'ezek-light'}
          options={{
            renderSideBySide: false, // Modo inline
            minimap: { enabled: false },
            fontSize: 14,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
            wordWrap: 'on',
            readOnly: false, // The modified side should be editable if true but DiffEditor behaves special.
            originalEditable: false,
            scrollbar: {
              vertical: 'visible',
              horizontal: 'visible',
              useShadows: false,
              verticalScrollbarSize: 10,
              horizontalScrollbarSize: 10,
            },
            padding: { top: 16 },
          }}
          onMount={handleEditorDidMount}
        />
      </div>
    </div>
  )
}
