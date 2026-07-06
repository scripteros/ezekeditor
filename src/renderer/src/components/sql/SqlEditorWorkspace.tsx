import { useMemo, useRef } from 'react'
import Editor, { OnMount, loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import { Columns3, LayoutPanelTop, Maximize2, Moon, Play, Plus, Save, Sun, X } from 'lucide-react'
import { useSqlStore } from '../../store/sqlStore'

loader.config({ monaco })

export default function SqlEditorWorkspace() {
  const {
    activeConnectionId,
    executeQuery,
    cancelQuery,
    isExecuting,
    sqlTabs,
    activeSqlTabId,
    createSqlTab,
    updateSqlTab,
    closeSqlTab,
    setActiveSqlTab,
    editorLayout,
    setEditorLayout,
    sqlEditorTheme,
    setSqlEditorTheme,
  } = useSqlStore()

  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const activeTab = useMemo(() => {
    return sqlTabs.find(tab => tab.id === activeSqlTabId) || sqlTabs[0] || null
  }, [activeSqlTabId, sqlTabs])

  const handleEditorMount: OnMount = (editor) => {
    editorRef.current = editor
  }

  const handleRun = () => {
    if (!activeTab || !activeConnectionId) return
    const selection = editorRef.current?.getSelection()
    const selectedQuery = selection ? editorRef.current?.getModel()?.getValueInRange(selection) : ''
    const query = selectedQuery && selectedQuery.trim().length > 0 ? selectedQuery : activeTab.query
    if (!query.trim()) return
    executeQuery(query, activeTab.id)
    window.dispatchEvent(new CustomEvent('ezek:open-sql-tab'))
  }

  const handleRenameTab = (tabId: string, currentTitle: string) => {
    const title = window.prompt('Nome da aba SQL', currentTitle)
    if (title && title.trim()) {
      updateSqlTab(tabId, { title: title.trim(), isDirty: true })
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-nova-bg">
      <div className="h-tab min-h-tab flex items-center border-b border-nova-border bg-nova-bg-secondary overflow-hidden">
        <div className="flex h-full flex-1 items-center overflow-x-auto scrollbar-thin">
          {sqlTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSqlTab(tab.id)}
              onDoubleClick={() => handleRenameTab(tab.id, tab.title)}
              className={`group flex h-full min-w-[150px] max-w-[240px] items-center gap-2 border-r border-nova-border px-3 text-xs transition-colors ${
                activeTab?.id === tab.id
                  ? 'bg-nova-tab-active text-nova-text border-t-2 border-t-nova-accent'
                  : 'bg-nova-tab-inactive text-nova-text-secondary hover:bg-nova-hover'
              }`}
              title="Duplo clique para renomear"
            >
              {tab.isDirty && <span className="h-2 w-2 shrink-0 rounded-full bg-nova-accent" />}
              <span className="truncate">{tab.title}</span>
              <span
                onClick={(event) => {
                  event.stopPropagation()
                  closeSqlTab(tab.id)
                }}
                className="ml-auto rounded p-0.5 opacity-0 transition-opacity hover:bg-nova-bg-tertiary group-hover:opacity-100"
                title="Fechar aba"
              >
                <X size={12} />
              </span>
            </button>
          ))}
        </div>
        <button
          onClick={() => createSqlTab('select *\nfrom ')}
          className="flex h-full items-center border-l border-nova-border px-3 text-nova-text-secondary hover:bg-nova-hover hover:text-nova-text"
          title="Nova folha SQL"
        >
          <Plus size={15} />
        </button>
      </div>

      <div className="flex h-10 min-h-10 items-center justify-between gap-2 border-b border-nova-border bg-nova-bg-secondary/40 px-3">
        <div className="flex min-w-0 items-center gap-2">
          <button
            onClick={handleRun}
            disabled={!activeConnectionId || !activeTab?.query.trim() || isExecuting}
            className="flex items-center gap-1.5 rounded bg-nova-accent px-3 py-1.5 text-xs font-bold text-nova-statusbar-text hover:bg-nova-accent-hover disabled:opacity-50"
          >
            <Play size={13} fill="currentColor" />
            Executar
          </button>
          {isExecuting && (
            <button onClick={cancelQuery} className="rounded border border-nova-error/30 bg-nova-error/10 px-2 py-1.5 text-xs text-nova-error hover:bg-nova-error/20">
              Cancelar
            </button>
          )}
          <button
            onClick={() => activeTab && updateSqlTab(activeTab.id, { isDirty: false })}
            disabled={!activeTab}
            className="flex items-center gap-1.5 rounded border border-nova-border px-2 py-1.5 text-xs text-nova-text-secondary hover:bg-nova-hover hover:text-nova-text disabled:opacity-50"
          >
            <Save size={13} />
            Salvar folha
          </button>
          {!activeConnectionId && <span className="text-xs text-nova-warning">Selecione uma conexão no painel SQL inferior.</span>}
        </div>

        <div className="flex items-center gap-1">
          {[
            { id: 'split', icon: Columns3, title: 'Editor e resultados' },
            { id: 'editor', icon: Maximize2, title: 'Somente editor' },
            { id: 'results', icon: LayoutPanelTop, title: 'Somente resultados' },
          ].map(({ id, icon: Icon, title }) => (
            <button
              key={id}
              onClick={() => {
                setEditorLayout(id as any)
                window.dispatchEvent(new CustomEvent('ezek:open-sql-tab'))
              }}
              className={`rounded p-1.5 ${editorLayout === id ? 'bg-nova-accent/10 text-nova-accent' : 'text-nova-text-secondary hover:bg-nova-hover hover:text-nova-text'}`}
              title={title}
            >
              <Icon size={14} />
            </button>
          ))}
          <button
            onClick={() => setSqlEditorTheme(sqlEditorTheme === 'dark' ? 'light' : 'dark')}
            className="rounded p-1.5 text-nova-text-secondary hover:bg-nova-hover hover:text-nova-text"
            title={sqlEditorTheme === 'dark' ? 'Editor SQL claro' : 'Editor SQL escuro'}
          >
            {sqlEditorTheme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('ezek:close-sql-workspace'))}
            className="ml-1 rounded p-1.5 text-nova-text-secondary hover:bg-nova-hover hover:text-nova-text"
            title="Voltar ao editor de arquivos"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden">
        {activeTab ? (
          <Editor
            key={activeTab.id}
            height="100%"
            language="sql"
            theme={sqlEditorTheme === 'dark' ? 'vs-dark' : 'vs'}
            value={activeTab.query}
            onMount={handleEditorMount}
            onChange={value => updateSqlTab(activeTab.id, { query: value || '' })}
            options={{
              fontSize: 14,
              fontFamily: localStorage.getItem('ezek-settings-font') || "'JetBrains Mono', Consolas, monospace",
              fontLigatures: localStorage.getItem('ezek-settings-ligatures') === 'true',
              minimap: { enabled: true, showSlider: 'mouseover' },
              automaticLayout: true,
              scrollBeyondLastLine: false,
              lineNumbers: 'on',
              wordWrap: 'on',
              tabSize: 2,
              guides: {
                indentation: true,
                highlightActiveIndentation: true,
                bracketPairs: true,
                bracketPairsHorizontal: true,
              },
              bracketPairColorization: { enabled: true },
              padding: { top: 10, bottom: 10 },
              suggestOnTriggerCharacters: true,
              quickSuggestions: true,
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-nova-text-muted">
            Crie uma folha SQL para começar.
          </div>
        )}
      </div>
    </div>
  )
}
