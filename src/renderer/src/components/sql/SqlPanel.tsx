import { useEffect, useMemo, useRef, useState } from 'react'
import Editor, { OnMount, loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import {
  AlertCircle,
  Check,
  Cloud,
  Columns3,
  Database,
  Edit2,
  FileJson,
  HardDrive,
  PanelLeftClose,
  PanelLeftOpen,
  LayoutPanelTop,
  ListTree,
  Maximize2,
  Moon,
  Plus,
  Play,
  Save,
  Server,
  Sun,
  Table2,
  Trash2,
  X,
} from 'lucide-react'
import { useSqlStore } from '../../store/sqlStore'
import type { DbConfig, DbProvider, RedisServerConfig, SqlQueryResult } from '../../../shared/types/sql'

loader.config({ monaco })

function ResultBody({ result, view, surfaceTheme }: { result: SqlQueryResult | null; view: 'table' | 'json' | 'text'; surfaceTheme: 'dark' | 'light' }) {
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())
  const [sortConfig, setSortConfig] = useState<{ column: string; direction: 'asc' | 'desc' } | null>(null)
  const [visibleRowLimit, setVisibleRowLimit] = useState(100)
  const isLight = surfaceTheme === 'light'
  const mutedText = isLight ? 'text-slate-500' : 'text-nova-text-muted'
  const bodyText = isLight ? 'text-slate-700' : 'text-nova-text-secondary'
  const headerBg = isLight ? 'bg-slate-100' : 'bg-[#161616]'
  const rowEven = isLight ? 'bg-white' : 'bg-[#101010]'
  const rowOdd = isLight ? 'bg-slate-50' : 'bg-[#181818]'
  const border = isLight ? 'border-slate-200' : 'border-nova-border/50'
  const columns = result?.columns || []
  const columnTypes = result?.columnTypes || {}

  useEffect(() => {
    setSelectedRows(new Set())
    setSortConfig(null)
    setVisibleRowLimit(100)
  }, [result?.query])

  const rows = useMemo(() => {
    const baseRows = (result?.rows || []).map((row, index) => ({ row, index }))
    if (!sortConfig) return baseRows

    const columnIndex = columns.indexOf(sortConfig.column)
    const getValue = (row: any) => Array.isArray(row) ? row[columnIndex] : row[sortConfig.column]

    return [...baseRows].sort((a, b) => {
      const aValue = getValue(a.row)
      const bValue = getValue(b.row)
      if (aValue == null && bValue == null) return 0
      if (aValue == null) return sortConfig.direction === 'asc' ? -1 : 1
      if (bValue == null) return sortConfig.direction === 'asc' ? 1 : -1
      const aNumber = Number(aValue)
      const bNumber = Number(bValue)
      const compare = !Number.isNaN(aNumber) && !Number.isNaN(bNumber)
        ? aNumber - bNumber
        : String(aValue).localeCompare(String(bValue), undefined, { numeric: true, sensitivity: 'base' })
      return sortConfig.direction === 'asc' ? compare : -compare
    })
  }, [columns, result?.rows, sortConfig])

  const getCellValue = (row: any, column: string, columnIndex: number) => {
    return Array.isArray(row) ? row[columnIndex] : row[column]
  }

  const serializeValue = (value: any) => {
    if (value === null || value === undefined) return ''
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  }

  const toDelimited = (targetRows: Array<{ row: any }>, delimiter: ',' | '\t') => {
    const escapeCsv = (value: string) => {
      if (delimiter === '\t') return value.replace(/\t/g, ' ').replace(/\r?\n/g, ' ')
      return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
    }

    const header = columns.map(col => escapeCsv(col)).join(delimiter)
    const body = targetRows.map(({ row }) => (
      columns.map((col, index) => escapeCsv(serializeValue(getCellValue(row, col, index)))).join(delimiter)
    ))
    return [header, ...body].join('\n')
  }

  const selectedRowItems = rows.filter(({ index }) => selectedRows.has(index))
  const rowsForAction = selectedRowItems.length > 0 ? selectedRowItems : rows
  const visibleRows = rows.slice(0, visibleRowLimit)

  const copyText = async (text: string) => {
    await navigator.clipboard.writeText(text)
  }

  const exportCsv = () => {
    if (!columns.length || rowsForAction.length === 0) return
    const csv = toDelimited(rowsForAction, ',')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `consulta-sql-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const toggleSort = (column: string) => {
    setSortConfig(current => {
      if (!current || current.column !== column) return { column, direction: 'asc' }
      if (current.direction === 'asc') return { column, direction: 'desc' }
      return null
    })
  }

  const toggleRow = (index: number) => {
    setSelectedRows(current => {
      const next = new Set(current)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const toggleAllVisible = () => {
    setSelectedRows(current => {
      const visible = visibleRows.map(({ index }) => index)
      const allVisibleSelected = visible.every(index => current.has(index))
      const next = new Set(current)
      visible.forEach(index => {
        if (allVisibleSelected) next.delete(index)
        else next.add(index)
      })
      return next
    })
  }

  if (!result) {
    return (
      <div className={`h-full flex items-center justify-center text-xs ${mutedText}`}>
        Execute a consulta da aba ativa para visualizar os resultados.
      </div>
    )
  }

  if (!result.success) {
    return <div className="p-4 text-sm text-nova-error font-mono whitespace-pre-wrap">{result.error}</div>
  }

  if (view === 'json') {
    return (
      <pre className={`p-4 text-xs ${bodyText} font-mono whitespace-pre-wrap`}>
        {JSON.stringify(result.rows || [], null, 2)}
      </pre>
    )
  }

  if (view === 'text') {
    const lines = (result.rows || []).slice(0, 500).map(row => {
      if (Array.isArray(row)) return row.map(cell => cell === null ? 'null' : String(cell)).join(' | ')
      return columns.map(col => row[col] === null ? 'null' : String(row[col])).join(' | ')
    })
    return (
      <pre className={`p-4 text-xs ${bodyText} font-mono whitespace-pre-wrap`}>
        {[columns.join(' | '), ...lines].filter(Boolean).join('\n')}
      </pre>
    )
  }

  if (!result.rows || result.rows.length === 0) {
    return <div className={`p-4 text-xs ${mutedText} italic`}>Comando executado com sucesso. Nenhuma linha retornada.</div>
  }

  return (
    <div className="min-w-full">
      <div className={`sticky top-0 z-20 flex items-center justify-between gap-2 border-b px-3 py-2 ${isLight ? 'border-slate-200 bg-white' : 'border-nova-border bg-[#101010]'}`}>
        <span className={`text-[11px] ${mutedText}`}>
          {selectedRows.size > 0 ? `${selectedRows.size} linha(s) selecionada(s)` : 'Arraste o mouse para selecionar texto. Use o checkbox para selecionar linhas.'}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => copyText(toDelimited(rowsForAction, '\t'))}
            className={`rounded border px-2 py-1 text-[11px] ${isLight ? 'border-slate-200 text-slate-700 hover:bg-slate-100' : 'border-nova-border text-nova-text-secondary hover:bg-nova-hover hover:text-nova-text'}`}
          >
            Copiar {selectedRows.size > 0 ? 'seleção' : 'tabela'}
          </button>
          <button
            onClick={exportCsv}
            className={`rounded border px-2 py-1 text-[11px] ${isLight ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50' : 'border-nova-accent/30 text-nova-accent hover:bg-nova-accent/10'}`}
          >
            Exportar CSV
          </button>
        </div>
      </div>
      <table className="w-full text-left border-collapse text-xs">
        <thead className={`sticky top-[37px] z-10 shadow-sm border-b ${isLight ? 'border-slate-200' : 'border-nova-border'}`}>
          <tr>
            <th className={`px-3 py-1.5 ${mutedText} font-medium w-12 border-r ${border} ${headerBg}`}>
              <input
                type="checkbox"
                checked={visibleRows.length > 0 && visibleRows.every(({ index }) => selectedRows.has(index))}
                onChange={toggleAllVisible}
              />
            </th>
            <th className={`px-3 py-1.5 ${mutedText} font-medium w-12 border-r ${border} ${headerBg}`}>#</th>
            {columns.map((col, i) => (
              <th key={i} className={`px-3 py-1.5 border-r ${border} ${headerBg} whitespace-nowrap`}>
                <button
                  onClick={() => toggleSort(col)}
                  className={`flex w-full items-center justify-between gap-2 text-left font-medium ${isLight ? 'text-slate-900' : 'text-nova-text'}`}
                  title="Ordenar coluna"
                >
                  <span className="flex items-center gap-2">
                    <span>{col}</span>
                    {columnTypes[col] && (
                      <span className={`rounded border px-1.5 py-0.5 text-[9px] font-normal uppercase ${isLight ? 'border-slate-200 bg-white text-slate-500' : 'border-nova-border bg-nova-bg text-nova-text-muted'}`}>
                        {columnTypes[col]}
                      </span>
                    )}
                  </span>
                  <span className={mutedText}>
                    {sortConfig?.column === col ? (sortConfig.direction === 'asc' ? 'ASC' : 'DESC') : ''}
                  </span>
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibleRows.map(({ row, index }, visibleIndex) => (
            <tr
              key={index}
              className={`border-b ${border} ${selectedRows.has(index) ? (isLight ? 'bg-emerald-50' : 'bg-nova-accent/10') : visibleIndex % 2 === 0 ? rowEven : rowOdd} ${isLight ? 'hover:bg-emerald-50' : 'hover:bg-nova-hover/80'}`}
            >
              <td className={`px-3 py-1 ${mutedText} border-r ${border} text-center select-none`}>
                <input
                  type="checkbox"
                  checked={selectedRows.has(index)}
                  onClick={event => event.stopPropagation()}
                  onChange={() => toggleRow(index)}
                />
              </td>
              <td className={`px-3 py-1 ${mutedText} border-r ${border} text-right select-none font-mono opacity-80`}>{index + 1}</td>
              {columns.map((col, j) => {
                const cell = getCellValue(row, col, j)
                const value = serializeValue(cell)
                return (
                  <td
                    key={j}
                    className={`border-r ${border} max-w-[260px] px-3 py-1 ${bodyText} select-text whitespace-nowrap truncate`}
                    title={`Duplo clique para copiar: ${value}`}
                    onDoubleClick={() => {
                        copyText(value)
                      }}
                  >
                    {cell === null ? <span className={`${mutedText} italic opacity-70`}>null</span> : value}
                  </td>
                )
              })}
            </tr>
          ))}
          {rows.length > visibleRowLimit && (
            <tr>
              <td colSpan={columns.length + 2} className={`px-3 py-2 text-center text-xs ${mutedText} italic ${isLight ? 'bg-slate-100' : 'bg-nova-bg-secondary/30'}`}>
                <div className="flex items-center justify-center gap-3">
                  <span>Mostrando {visibleRows.length} de {rows.length} linhas.</span>
                  <button
                    onClick={() => setVisibleRowLimit(limit => limit + 100)}
                    className={`rounded border px-3 py-1 text-[11px] not-italic ${isLight ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50' : 'border-nova-accent/30 text-nova-accent hover:bg-nova-accent/10'}`}
                  >
                    Carregar mais 100
                  </button>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

export default function SqlPanel() {
  const {
    connections,
    redisServers,
    activeRedisServerId,
    activeConnectionId,
    setActiveConnection,
    addConnection,
    updateConnection,
    removeConnection,
    addRedisServer,
    updateRedisServer,
    removeRedisServer,
    setActiveRedisServer,
    testConnection,
    testRedisConnection,
    executeQuery,
    cancelQuery,
    isExecuting,
    sqlTabs,
    activeSqlTabId,
    createSqlTab,
    updateSqlTab,
    closeSqlTab,
    setActiveSqlTab,
    tabResults,
    queryResults,
    clearTabResult,
    editorLayout,
    resultView,
    setEditorLayout,
    setResultView,
    sqlResultTheme,
    setSqlResultTheme,
  } = useSqlStore()

  const [isAdding, setIsAdding] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<Partial<DbConfig>>({ provider: 'postgres' })
  const [redisForm, setRedisForm] = useState<Partial<RedisServerConfig>>({ redisMode: 'local', redisPort: 6379, redisEnabled: true })
  const [editingRedisId, setEditingRedisId] = useState<string | null>(null)
  const [showRedisForm, setShowRedisForm] = useState(false)
  const [testStatus, setTestStatus] = useState<{status: 'idle'|'testing'|'success'|'error', msg?: string}>({status: 'idle'})
  const [redisTestStatus, setRedisTestStatus] = useState<{status: 'idle'|'testing'|'success'|'error', msg?: string}>({status: 'idle'})
  const [sidebarWidth, setSidebarWidth] = useState(256)
  const [showConnections, setShowConnections] = useState(true)
  const [editorHeight, setEditorHeight] = useState(52)
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)

  const activeTab = useMemo(() => {
    return sqlTabs.find(tab => tab.id === activeSqlTabId) || sqlTabs[0] || null
  }, [activeSqlTabId, sqlTabs])
  const activeResult = activeTab ? tabResults[activeTab.id] || (activeConnectionId ? queryResults[activeConnectionId] : null) || null : (activeConnectionId ? queryResults[activeConnectionId] : null)

  useEffect(() => {
    if (!activeSqlTabId && sqlTabs[0]) setActiveSqlTab(sqlTabs[0].id)
  }, [activeSqlTabId, setActiveSqlTab, sqlTabs])

  const startSidebarResize = (e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = sidebarWidth

    const onMouseMove = (event: MouseEvent) => {
      setSidebarWidth(Math.max(120, Math.min(window.innerWidth - 80, startWidth + event.clientX - startX)))
    }
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  const startEditorResize = (e: React.MouseEvent) => {
    e.preventDefault()
    const startY = e.clientY
    const startHeight = editorHeight

    const onMouseMove = (event: MouseEvent) => {
      setEditorHeight(Math.max(28, Math.min(78, startHeight + ((event.clientY - startY) / Math.max(window.innerHeight, 1)) * 100)))
    }
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  const handleSaveConnection = () => {
    if (!form.name || !form.provider) return
    if (editId) {
      updateConnection(editId, form)
      setEditId(null)
    } else {
      addConnection({ ...form, id: Date.now().toString() } as DbConfig)
      setIsAdding(false)
    }
  }

  const handleTest = async () => {
    setTestStatus({ status: 'testing' })
    const res = await testConnection(form as DbConfig)
    setTestStatus(res.success
      ? { status: 'success', msg: 'Conexão bem sucedida!' }
      : { status: 'error', msg: res.error || 'Erro ao conectar' })
  }

  const handleRedisTest = async () => {
    setRedisTestStatus({ status: 'testing' })
    const res = await testRedisConnection((showRedisForm ? redisForm : form) as RedisServerConfig)
    setRedisTestStatus(res.success
      ? { status: 'success', msg: 'Redis conectado. A memória da IA expira em 7 dias.' }
      : { status: 'error', msg: res.error || 'Erro ao conectar no Redis' })
  }

  const handleSaveRedisServer = () => {
    if (!redisForm.name) return
    const payload = {
      redisMode: 'local',
      redisPort: 6379,
      redisEnabled: true,
      ...redisForm,
    } as RedisServerConfig

    if (editingRedisId) {
      updateRedisServer(editingRedisId, payload)
    } else {
      addRedisServer({ ...payload, id: `redis-${Date.now()}` })
    }

    setShowRedisForm(false)
    setEditingRedisId(null)
    setRedisForm({ redisMode: 'local', redisPort: 6379, redisEnabled: true })
    setRedisTestStatus({ status: 'idle' })
  }

  const handleEditRedisServer = (server: RedisServerConfig) => {
    setRedisForm(server)
    setEditingRedisId(server.id)
    setShowRedisForm(true)
    setRedisTestStatus({ status: 'idle' })
  }

  const startNewRedisServer = () => {
    setRedisForm({ redisMode: 'local', redisPort: 6379, redisEnabled: true })
    setEditingRedisId(null)
    setShowRedisForm(true)
    setRedisTestStatus({ status: 'idle' })
  }

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
  }

  const handleCreateTab = () => {
    createSqlTab('select *\nfrom ')
  }

  const handleRenameTab = (tabId: string, currentTitle: string) => {
    const title = window.prompt('Nome da aba SQL', currentTitle)
    if (title && title.trim()) {
      updateSqlTab(tabId, { title: title.trim(), isDirty: true })
    }
  }

  const handleSaveTab = () => {
    if (!activeTab) return
    updateSqlTab(activeTab.id, { isDirty: false })
  }

  const renderRedisFields = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <label className="space-y-1 md:col-span-2">
        <span className="block text-xs text-nova-text-secondary">Nome do servidor Redis</span>
        <input value={redisForm.name || ''} onChange={e => setRedisForm({...redisForm, name: e.target.value})} className="w-full bg-nova-bg border border-nova-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-nova-accent text-nova-text" placeholder="Redis local" />
      </label>
      <div className="md:col-span-2 grid grid-cols-2 gap-2">
        {[
          { id: 'local', label: 'Local', icon: HardDrive },
          { id: 'cloud', label: 'Nuvem', icon: Cloud },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setRedisForm({ ...redisForm, redisMode: id as any, redisTls: id === 'cloud' ? true : redisForm.redisTls })}
            className={`flex items-center justify-center gap-2 rounded border px-3 py-2 text-xs transition-colors ${
              (redisForm.redisMode || 'local') === id
                ? 'border-nova-accent bg-nova-accent/10 text-nova-accent'
                : 'border-nova-border text-nova-text-secondary hover:bg-nova-hover hover:text-nova-text'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>
      <label className="space-y-1 md:col-span-2">
        <span className="block text-xs text-nova-text-secondary">URL Redis <span className="text-nova-text-muted text-[10px]">(opcional)</span></span>
        <input value={redisForm.redisUrl || ''} onChange={e => setRedisForm({...redisForm, redisUrl: e.target.value})} className="w-full bg-nova-bg border border-nova-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-nova-accent text-nova-text" placeholder="redis://localhost:6379 ou rediss://usuario:senha@host:porta" />
      </label>
      <label className="space-y-1">
        <span className="block text-xs text-nova-text-secondary">Host</span>
        <input value={redisForm.redisHost || ''} onChange={e => setRedisForm({...redisForm, redisHost: e.target.value})} className="w-full bg-nova-bg border border-nova-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-nova-accent text-nova-text" placeholder="localhost" />
      </label>
      <label className="space-y-1">
        <span className="block text-xs text-nova-text-secondary">Porta</span>
        <input type="number" value={redisForm.redisPort || ''} onChange={e => setRedisForm({...redisForm, redisPort: parseInt(e.target.value) || undefined})} className="w-full bg-nova-bg border border-nova-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-nova-accent text-nova-text" placeholder="6379" />
      </label>
      <label className="space-y-1">
        <span className="block text-xs text-nova-text-secondary">Usuário</span>
        <input value={redisForm.redisUsername || ''} onChange={e => setRedisForm({...redisForm, redisUsername: e.target.value})} className="w-full bg-nova-bg border border-nova-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-nova-accent text-nova-text" placeholder="default" />
      </label>
      <label className="space-y-1">
        <span className="block text-xs text-nova-text-secondary">Senha</span>
        <input type="password" value={redisForm.redisPassword || ''} onChange={e => setRedisForm({...redisForm, redisPassword: e.target.value})} className="w-full bg-nova-bg border border-nova-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-nova-accent text-nova-text" />
      </label>
      <label className="space-y-1">
        <span className="block text-xs text-nova-text-secondary">Database</span>
        <input type="number" value={redisForm.redisDatabase ?? ''} onChange={e => setRedisForm({...redisForm, redisDatabase: e.target.value === '' ? undefined : parseInt(e.target.value)})} className="w-full bg-nova-bg border border-nova-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-nova-accent text-nova-text" placeholder="0" />
      </label>
      <label className="flex items-center gap-2 pt-6 text-xs text-nova-text-secondary">
        <input type="checkbox" checked={Boolean(redisForm.redisTls)} onChange={e => setRedisForm({...redisForm, redisTls: e.target.checked})} />
        Usar TLS/SSL
      </label>
    </div>
  )

  const renderRedisManager = () => (
    <div className="rounded border border-nova-border bg-nova-bg-secondary/20 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-nova-text">
            <Database size={14} className="text-nova-accent" />
            Servidores Redis da memória IA
          </div>
          <p className="mt-1 text-[11px] text-nova-text-muted">Apenas um Redis pode ficar ativo. Ao ativar um, os outros ficam desativados.</p>
        </div>
        <button onClick={startNewRedisServer} className="flex items-center gap-1.5 rounded border border-nova-border px-2 py-1.5 text-xs text-nova-text-secondary hover:bg-nova-hover hover:text-nova-text">
          <Plus size={13} />
          Redis
        </button>
      </div>

      {showRedisForm && (
        <div className="mb-3 rounded border border-nova-border bg-nova-bg p-3">
          {renderRedisFields()}
          <div className="mt-3 flex items-center justify-between gap-3">
            <button onClick={handleRedisTest} disabled={redisTestStatus.status === 'testing'} className="px-3 py-1.5 text-xs text-nova-text-secondary border border-nova-border rounded hover:bg-nova-hover transition-colors flex items-center gap-2">
              {redisTestStatus.status === 'testing' ? <span className="w-3 h-3 border-2 border-nova-text-secondary border-t-transparent rounded-full animate-spin" /> : <Play size={13} />}
              Testar Redis
            </button>
            <div className="flex items-center gap-2">
              {redisTestStatus.status !== 'idle' && (
                <span className={`text-[11px] ${redisTestStatus.status === 'success' ? 'text-nova-success' : 'text-nova-error'}`}>{redisTestStatus.msg}</span>
              )}
              <button onClick={() => { setShowRedisForm(false); setEditingRedisId(null); setRedisTestStatus({status: 'idle'}) }} className="px-3 py-1.5 text-xs text-nova-text-secondary hover:text-nova-text">Cancelar</button>
              <button onClick={handleSaveRedisServer} disabled={!redisForm.name} className="px-3 py-1.5 text-xs bg-nova-accent text-nova-bg font-medium rounded hover:opacity-90 disabled:opacity-50">Salvar Redis</button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
        {redisServers.length === 0 && (
          <div className="rounded border border-dashed border-nova-border px-3 py-4 text-center text-xs text-nova-text-muted">Nenhum servidor Redis salvo.</div>
        )}
        {redisServers.map(server => {
          const active = activeRedisServerId === server.id
          return (
            <div key={server.id} className={`rounded border p-3 ${active ? 'border-nova-accent bg-nova-accent/10' : 'border-nova-border bg-nova-bg/70'}`}>
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-semibold text-nova-text">
                    {server.redisMode === 'cloud' ? <Cloud size={14} className={active ? 'text-nova-accent' : 'text-nova-text-secondary'} /> : <HardDrive size={14} className={active ? 'text-nova-accent' : 'text-nova-text-secondary'} />}
                    <span className="truncate">{server.name}</span>
                  </div>
                  <p className="mt-1 truncate text-[11px] text-nova-text-muted">{server.redisUrl || `${server.redisHost || 'localhost'}:${server.redisPort || 6379}`}</p>
                </div>
                <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${active ? 'bg-nova-accent text-nova-bg' : 'bg-nova-bg-secondary text-nova-text-muted'}`}>
                  {active ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <button onClick={() => setActiveRedisServer(active ? null : server.id)} className={`rounded px-2 py-1 text-[11px] font-semibold ${active ? 'border border-nova-border text-nova-text-secondary hover:bg-nova-hover' : 'bg-nova-accent text-nova-bg hover:opacity-90'}`}>
                  {active ? 'Desativar' : 'Ativar'}
                </button>
                <div className="flex items-center gap-1">
                  <button onClick={() => handleEditRedisServer(server)} className="rounded p-1.5 text-nova-text-secondary hover:bg-nova-hover hover:text-nova-accent" title="Editar Redis">
                    <Edit2 size={13} />
                  </button>
                  <button onClick={() => removeRedisServer(server.id)} className="rounded p-1.5 text-nova-text-secondary hover:bg-nova-hover hover:text-nova-error" title="Remover Redis">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )

  const renderConnectionForm = () => (
    <div className="p-5 max-w-2xl w-full flex-1 overflow-y-auto mx-auto">
      <h3 className="text-base font-medium text-nova-text mb-4">{editId ? 'Editar Conexão' : 'Nova Conexão'}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="space-y-1 md:col-span-2">
          <span className="block text-xs text-nova-text-secondary">Nome</span>
          <input value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})} className="w-full bg-nova-bg-secondary border border-nova-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-nova-accent text-nova-text" placeholder="Minha conexão" />
        </label>

        <label className="space-y-1">
          <span className="block text-xs text-nova-text-secondary">Provedor</span>
          <select value={form.provider} onChange={e => setForm({...form, provider: e.target.value as DbProvider})} className="w-full bg-nova-bg-secondary border border-nova-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-nova-accent text-nova-text">
            <option value="postgres">PostgreSQL</option>
            <option value="mysql">MySQL</option>
            <option value="oracle">Oracle</option>
          </select>
        </label>

        <label className="space-y-1">
          <span className="block text-xs text-nova-text-secondary">Database / Service Name</span>
          <input value={form.database || ''} onChange={e => setForm({...form, database: e.target.value})} className="w-full bg-nova-bg-secondary border border-nova-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-nova-accent text-nova-text" placeholder="db_name" />
        </label>

        <label className="space-y-1">
          <span className="block text-xs text-nova-text-secondary">Host</span>
          <input value={form.host || ''} onChange={e => setForm({...form, host: e.target.value})} className="w-full bg-nova-bg-secondary border border-nova-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-nova-accent text-nova-text" placeholder="localhost" />
        </label>

        <label className="space-y-1">
          <span className="block text-xs text-nova-text-secondary">Porta</span>
          <input type="number" value={form.port || ''} onChange={e => setForm({...form, port: parseInt(e.target.value) || undefined})} className="w-full bg-nova-bg-secondary border border-nova-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-nova-accent text-nova-text" placeholder={form.provider === 'postgres' ? '5432' : form.provider === 'mysql' ? '3306' : '1521'} />
        </label>

        {form.provider === 'oracle' && (
          <>
            <label className="space-y-1 md:col-span-2">
              <span className="block text-xs text-nova-text-secondary">Connect String</span>
              <input value={form.connectString || ''} onChange={e => setForm({...form, connectString: e.target.value})} className="w-full bg-nova-bg-secondary border border-nova-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-nova-accent text-nova-text" placeholder="(DESCRIPTION=...)" />
            </label>
            <label className="space-y-1 md:col-span-2">
              <span className="block text-xs text-nova-text-secondary">Oracle Client Path</span>
              <input value={form.oracleClientLib || ''} onChange={e => setForm({...form, oracleClientLib: e.target.value})} className="w-full bg-nova-bg-secondary border border-nova-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-nova-accent text-nova-text" placeholder="C:\\Oracle\\instantclient_21_15" />
            </label>
          </>
        )}

        <label className="space-y-1">
          <span className="block text-xs text-nova-text-secondary">Usuário</span>
          <input value={form.username || ''} onChange={e => setForm({...form, username: e.target.value})} className="w-full bg-nova-bg-secondary border border-nova-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-nova-accent text-nova-text" />
        </label>

        <label className="space-y-1">
          <span className="block text-xs text-nova-text-secondary">Senha</span>
          <input type="password" value={form.password || ''} onChange={e => setForm({...form, password: e.target.value})} className="w-full bg-nova-bg-secondary border border-nova-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-nova-accent text-nova-text" />
        </label>

        <div className="md:col-span-2 mt-2">
          {renderRedisManager()}
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 mt-6 border-t border-nova-border">
        <button onClick={handleTest} disabled={testStatus.status === 'testing'} className="px-3 py-1.5 text-sm text-nova-text-secondary border border-nova-border rounded hover:bg-nova-hover transition-colors flex items-center gap-2">
          {testStatus.status === 'testing' ? <span className="w-3 h-3 border-2 border-nova-text-secondary border-t-transparent rounded-full animate-spin" /> : <Play size={14} />}
          Testar
        </button>

        <div className="flex items-center gap-2">
          <button onClick={() => { setIsAdding(false); setEditId(null); setRedisTestStatus({status: 'idle'}) }} className="px-3 py-1.5 text-sm text-nova-text-secondary hover:text-nova-text transition-colors">Cancelar</button>
          <button onClick={handleSaveConnection} disabled={!form.name} className="px-4 py-1.5 text-sm bg-nova-accent text-nova-bg font-medium rounded hover:opacity-90 disabled:opacity-50 transition-colors">Salvar</button>
        </div>
      </div>

      {testStatus.status !== 'idle' && (
        <div className={`mt-4 p-3 rounded text-sm flex items-start gap-2 ${testStatus.status === 'success' ? 'bg-nova-success/10 text-nova-success border border-nova-success/20' : 'bg-nova-error/10 text-nova-error border border-nova-error/20'}`}>
          {testStatus.status === 'success' ? <Check size={16} className="mt-0.5" /> : <AlertCircle size={16} className="mt-0.5" />}
          <div className="flex-1 break-words">{testStatus.msg}</div>
        </div>
      )}
    </div>
  )

  return (
    <div className="flex h-full w-full bg-nova-bg">
      {!showConnections && (
        <button
          onClick={() => setShowConnections(true)}
          className="h-full w-8 shrink-0 border-r border-nova-border bg-nova-bg-secondary/60 text-nova-text-secondary hover:bg-nova-hover hover:text-nova-text flex items-center justify-center"
          title="Mostrar conexões"
        >
          <PanelLeftOpen size={15} />
        </button>
      )}
      {showConnections && (
      <aside className="relative border-r border-nova-border flex flex-col bg-nova-bg-secondary/50 shrink-0" style={{ width: sidebarWidth }}>
        <div className="absolute right-0 top-0 bottom-0 w-[4px] cursor-ew-resize hover:bg-nova-accent/30 transition-colors z-10 translate-x-1/2" onMouseDown={startSidebarResize} />
        <div className="flex items-center justify-between p-3 border-b border-nova-border">
          <span className="text-xs font-medium text-nova-text uppercase tracking-wider flex items-center gap-2">
            <Database size={14} /> Conexões
          </span>
          <button onClick={() => { setIsAdding(true); setEditId(null); setForm({ provider: 'postgres', redisMode: 'local', redisPort: 6379 }); setTestStatus({status: 'idle'}); setRedisTestStatus({status: 'idle'}) }} className={`p-1 rounded transition-colors ${sqlResultTheme === 'light' ? 'text-emerald-700 hover:bg-emerald-50' : 'text-nova-text-secondary hover:text-nova-text hover:bg-nova-hover'}`} title="Nova conexão">
            <Plus size={14} />
          </button>
          <button onClick={() => setShowConnections(false)} className={`p-1 rounded transition-colors ${sqlResultTheme === 'light' ? 'text-emerald-700 hover:bg-emerald-50' : 'text-nova-text-secondary hover:text-nova-text hover:bg-nova-hover'}`} title="Ocultar conexões">
            <PanelLeftClose size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {connections.length === 0 && (
            <div className="text-xs text-nova-text-muted text-center py-4 px-3">Nenhuma conexão configurada.</div>
          )}
          {connections.map(c => (
            <button key={c.id} className={`group w-full flex items-center justify-between px-3 py-2 text-sm cursor-pointer border-l-2 transition-colors ${activeConnectionId === c.id ? 'border-nova-accent bg-nova-accent/10 text-nova-text' : 'border-transparent text-nova-text-secondary hover:bg-nova-hover'}`} onClick={() => { setActiveConnection(c.id); setIsAdding(false); setEditId(null) }}>
              <span className="flex items-center gap-2 min-w-0">
                <Server size={14} className={activeConnectionId === c.id ? `${sqlResultTheme === 'light' ? 'text-emerald-700' : 'text-nova-accent'} shrink-0` : 'shrink-0'} />
                <span className="truncate">{c.name}</span>
                {(c.redisEnabled || c.redisUrl) && <Database size={12} className="shrink-0 text-nova-success" />}
              </span>
              <span className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <span onClick={(e) => { e.stopPropagation(); setForm({ redisMode: 'local', redisPort: 6379, ...c }); setEditId(c.id); setIsAdding(true); setTestStatus({status: 'idle'}); setRedisTestStatus({status: 'idle'}) }} className="p-1 hover:text-nova-accent" title="Editar"><Edit2 size={12} /></span>
                <span onClick={(e) => { e.stopPropagation(); removeConnection(c.id) }} className="p-1 hover:text-nova-error" title="Remover"><Trash2 size={12} /></span>
              </span>
            </button>
          ))}
        </div>
      </aside>
      )}

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-nova-bg">
        {isAdding || editId ? renderConnectionForm() : (
          <>
            <div className="h-10 min-h-10 flex items-center justify-between gap-2 px-3 border-b border-nova-border bg-nova-bg-secondary/30">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  onClick={() => setShowConnections(value => !value)}
                  className="flex items-center gap-1.5 rounded border border-nova-border px-2 py-1.5 text-xs font-bold text-nova-text-secondary hover:bg-nova-hover hover:text-nova-text"
                  title={showConnections ? 'Ocultar conexões' : 'Mostrar conexões'}
                >
                  {showConnections ? <PanelLeftClose size={13} /> : <PanelLeftOpen size={13} />}
                  Conexões
                </button>
                <button onClick={() => window.dispatchEvent(new CustomEvent('ezek:open-sql-workspace'))} className="flex items-center gap-1.5 rounded bg-nova-accent px-3 py-1.5 text-xs font-bold text-nova-statusbar-text hover:bg-nova-accent-hover">
                  <Plus size={13} />
                  Abrir folhas SQL
                </button>
                <button onClick={handleRun} disabled={!activeConnectionId || !activeTab?.query.trim() || isExecuting} className="flex items-center gap-1.5 rounded border border-nova-border px-3 py-1.5 text-xs font-bold text-nova-text-secondary hover:bg-nova-hover hover:text-nova-text disabled:opacity-50">
                  <Play size={13} fill="currentColor" />
                  Executar folha ativa
                </button>
                {isExecuting && (
                  <button onClick={cancelQuery} className="rounded border border-nova-error/30 bg-nova-error/10 px-2 py-1.5 text-xs text-nova-error hover:bg-nova-error/20">Cancelar</button>
                )}
                {!activeConnectionId && <span className="text-xs text-nova-warning">Selecione uma conexão para executar.</span>}
              </div>

              <div className="flex items-center gap-1">
                <span className="max-w-[220px] truncate text-xs text-nova-text-muted">
                  {activeTab ? `Resultado de: ${activeTab.title}` : 'Nenhuma folha SQL ativa'}
                </span>
              </div>
            </div>

            <div className={`flex-1 min-h-0 flex flex-col overflow-hidden ${sqlResultTheme === 'light' ? 'bg-white' : 'bg-[#101010]'}`}>
                  <div className="h-9 min-h-9 flex items-center justify-between px-3 border-b border-nova-border bg-nova-bg-secondary/70">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-medium text-nova-text">Resultados</span>
                      {activeResult?.success && (
                        <span className="text-[11px] text-nova-text-muted bg-nova-bg border border-nova-border px-2 py-0.5 rounded-full">
                          {activeResult.rowCount ?? activeResult.rows?.length ?? 0} linhas ({activeResult.executionTimeMs ?? 0}ms)
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {[
                        { id: 'table', icon: Table2, title: 'Tabela' },
                        { id: 'json', icon: FileJson, title: 'JSON' },
                        { id: 'text', icon: ListTree, title: 'Texto' },
                      ].map(({ id, icon: Icon, title }) => (
                        <button key={id} onClick={() => setResultView(id as any)} className={`p-1.5 rounded ${resultView === id ? (sqlResultTheme === 'light' ? 'text-emerald-700 bg-emerald-50' : 'text-nova-accent bg-nova-accent/10') : (sqlResultTheme === 'light' ? 'text-emerald-700 hover:bg-emerald-50' : 'text-nova-text-secondary hover:text-nova-text hover:bg-nova-hover')}`} title={title}>
                          <Icon size={14} />
                        </button>
                      ))}
                      <button
                        onClick={() => setSqlResultTheme(sqlResultTheme === 'dark' ? 'light' : 'dark')}
                        className={`p-1.5 rounded ${sqlResultTheme === 'light' ? 'text-emerald-700 hover:bg-emerald-50' : 'text-nova-text-secondary hover:text-nova-text hover:bg-nova-hover'}`}
                        title={sqlResultTheme === 'dark' ? 'Resultados claros' : 'Resultados escuros'}
                      >
                        {sqlResultTheme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                      </button>
                      {activeTab && activeResult && (
                        <button onClick={() => clearTabResult(activeTab.id)} className={`p-1.5 rounded ${sqlResultTheme === 'light' ? 'text-emerald-700 hover:bg-emerald-50' : 'text-nova-text-secondary hover:text-nova-text hover:bg-nova-hover'}`} title="Limpar resultados">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 overflow-auto">
                    <ResultBody result={activeResult} view={resultView} surfaceTheme={sqlResultTheme} />
                  </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
