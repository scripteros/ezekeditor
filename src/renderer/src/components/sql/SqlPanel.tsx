import { useState } from 'react'
import { Plus, Database, Play, Check, X, Server, Trash2, Edit2, AlertCircle } from 'lucide-react'
import { useSqlStore } from '../../store/sqlStore'
import { DbConfig, DbProvider } from '../../../shared/types/sql'

export default function SqlPanel() {
  const { connections, activeConnectionId, setActiveConnection, addConnection, updateConnection, removeConnection, testConnection, queryResults, isExecuting, clearResults } = useSqlStore()
  
  const [isAdding, setIsAdding] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<Partial<DbConfig>>({ provider: 'postgres' })
  const [testStatus, setTestStatus] = useState<{status: 'idle'|'testing'|'success'|'error', msg?: string}>({status: 'idle'})
  const [sidebarWidth, setSidebarWidth] = useState(256)

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = sidebarWidth

    const onMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - startX
      setSidebarWidth(Math.max(150, Math.min(600, startWidth + diff)))
    }

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  const handleSave = () => {
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
    if (res.success) {
      setTestStatus({ status: 'success', msg: 'Conexão bem sucedida!' })
    } else {
      setTestStatus({ status: 'error', msg: res.error || 'Erro ao conectar' })
    }
  }

  const activeResult = activeConnectionId ? queryResults[activeConnectionId] : null

  return (
    <div className="flex h-full w-full bg-nova-bg">
      {/* Sidebar de Conexões */}
      <div 
        className="relative border-r border-nova-border flex flex-col bg-nova-bg-secondary/50 flex-shrink-0"
        style={{ width: sidebarWidth }}
      >
        {/* Resize Handle */}
        <div
          className="absolute right-0 top-0 bottom-0 w-[4px] cursor-ew-resize hover:bg-nova-accent/30 transition-colors z-10 translate-x-1/2"
          onMouseDown={startResize}
        />
        <div className="flex items-center justify-between p-3 border-b border-nova-border">
          <span className="text-xs font-medium text-nova-text uppercase tracking-wider flex items-center gap-2">
            <Database size={14} /> Conexões
          </span>
          <button 
            onClick={() => { setIsAdding(true); setEditId(null); setForm({ provider: 'postgres' }); setTestStatus({status: 'idle'}) }}
            className="p-1 rounded text-nova-text-secondary hover:text-nova-text hover:bg-nova-hover transition-colors"
          >
            <Plus size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {connections.length === 0 && !isAdding && (
            <div className="text-xs text-nova-text-muted text-center py-4 px-2">
              Nenhuma conexão configurada.
            </div>
          )}
          {connections.map(c => (
            <div 
              key={c.id} 
              className={`group flex items-center justify-between px-3 py-2 text-sm cursor-pointer border-l-2 transition-colors ${
                activeConnectionId === c.id 
                  ? 'border-nova-accent bg-nova-accent/10 text-nova-text' 
                  : 'border-transparent text-nova-text-secondary hover:bg-nova-hover'
              }`}
              onClick={() => { setActiveConnection(c.id); setIsAdding(false); setEditId(null) }}
            >
              <div className="flex items-center gap-2 truncate">
                <Server size={14} className={activeConnectionId === c.id ? 'text-nova-accent' : ''} />
                <span className="truncate">{c.name}</span>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={(e) => { e.stopPropagation(); setForm(c); setEditId(c.id); setIsAdding(true); setTestStatus({status: 'idle'}) }}
                  className="p-1 hover:text-nova-accent"
                >
                  <Edit2 size={12} />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); removeConnection(c.id) }}
                  className="p-1 hover:text-nova-error"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-nova-bg">
        {isAdding || editId ? (
          <div className="p-6 max-w-lg mx-auto w-full flex-1 overflow-y-auto">
            <h3 className="text-lg font-medium text-nova-text mb-4">
              {editId ? 'Editar Conexão' : 'Nova Conexão'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-nova-text-secondary mb-1">Nome</label>
                <input 
                  type="text" 
                  value={form.name || ''} 
                  onChange={e => setForm({...form, name: e.target.value})}
                  className="w-full bg-nova-bg-secondary border border-nova-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-nova-accent text-nova-text"
                  placeholder="Minha Conexão"
                />
              </div>

              <div>
                <label className="block text-xs text-nova-text-secondary mb-1">Provedor</label>
                <select 
                  value={form.provider} 
                  onChange={e => setForm({...form, provider: e.target.value as DbProvider})}
                  className="w-full bg-nova-bg-secondary border border-nova-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-nova-accent text-nova-text"
                >
                  <option value="postgres">PostgreSQL</option>
                  <option value="mysql">MySQL</option>
                  <option value="oracle">Oracle</option>
                </select>
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs text-nova-text-secondary mb-1">Host</label>
                  <input 
                    type="text" 
                    value={form.host || ''} 
                    onChange={e => setForm({...form, host: e.target.value})}
                    className="w-full bg-nova-bg-secondary border border-nova-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-nova-accent text-nova-text"
                    placeholder="localhost"
                  />
                </div>
                <div className="w-24">
                  <label className="block text-xs text-nova-text-secondary mb-1">Porta</label>
                  <input 
                    type="number" 
                    value={form.port || ''} 
                    onChange={e => setForm({...form, port: parseInt(e.target.value) || undefined})}
                    className="w-full bg-nova-bg-secondary border border-nova-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-nova-accent text-nova-text"
                    placeholder={form.provider === 'postgres' ? '5432' : form.provider === 'mysql' ? '3306' : '1521'}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-nova-text-secondary mb-1">Database / Service Name</label>
                <input 
                  type="text" 
                  value={form.database || ''} 
                  onChange={e => setForm({...form, database: e.target.value})}
                  className="w-full bg-nova-bg-secondary border border-nova-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-nova-accent text-nova-text"
                  placeholder="db_name"
                />
              </div>

              {form.provider === 'oracle' && (
                <>
                  <div>
                    <label className="block text-xs text-nova-text-secondary mb-1">Connect String (Opcional - sobrescreve host/porta/db se preenchido)</label>
                    <input 
                      type="text" 
                      value={form.connectString || ''} 
                      onChange={e => setForm({...form, connectString: e.target.value})}
                      className="w-full bg-nova-bg-secondary border border-nova-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-nova-accent text-nova-text"
                      placeholder="(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=sepprod)(PORT=1521))(CONNECT_DATA=(SERVICE_NAME=sepprod)))"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-nova-text-secondary mb-1">Oracle Client Path (Obrigatório para Thick mode)</label>
                    <input 
                      type="text" 
                      value={form.oracleClientLib || ''} 
                      onChange={e => setForm({...form, oracleClientLib: e.target.value})}
                      className="w-full bg-nova-bg-secondary border border-nova-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-nova-accent text-nova-text"
                      placeholder="C:\Oracle\instantclient_21_15"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs text-nova-text-secondary mb-1 flex items-center gap-1">URL Servidor Redis <span className="text-nova-text-muted text-[10px]">(Cache para IA - Opcional)</span></label>
                <input 
                  type="text" 
                  value={form.redisUrl || ''} 
                  onChange={e => setForm({...form, redisUrl: e.target.value})}
                  className="w-full bg-nova-bg-secondary border border-nova-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-nova-accent text-nova-text"
                  placeholder="redis://localhost:6379"
                />
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs text-nova-text-secondary mb-1">Usuário</label>
                  <input 
                    type="text" 
                    value={form.username || ''} 
                    onChange={e => setForm({...form, username: e.target.value})}
                    className="w-full bg-nova-bg-secondary border border-nova-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-nova-accent text-nova-text"
                    placeholder="postgres"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-nova-text-secondary mb-1">Senha</label>
                  <input 
                    type="password" 
                    value={form.password || ''} 
                    onChange={e => setForm({...form, password: e.target.value})}
                    className="w-full bg-nova-bg-secondary border border-nova-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-nova-accent text-nova-text"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 mt-6 border-t border-nova-border">
                <button
                  onClick={handleTest}
                  disabled={testStatus.status === 'testing'}
                  className="px-3 py-1.5 text-sm text-nova-text-secondary border border-nova-border rounded hover:bg-nova-hover transition-colors flex items-center gap-2"
                >
                  {testStatus.status === 'testing' ? (
                    <span className="w-3 h-3 border-2 border-nova-text-secondary border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Play size={14} />
                  )}
                  Testar
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setIsAdding(false); setEditId(null) }}
                    className="px-3 py-1.5 text-sm text-nova-text-secondary hover:text-nova-text transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={!form.name}
                    className="px-4 py-1.5 text-sm bg-nova-accent text-nova-bg font-medium rounded hover:opacity-90 disabled:opacity-50 transition-colors"
                  >
                    Salvar
                  </button>
                </div>
              </div>

              {testStatus.status !== 'idle' && (
                <div className={`p-3 rounded text-sm flex items-start gap-2 ${testStatus.status === 'success' ? 'bg-nova-success/10 text-nova-success border border-nova-success/20' : 'bg-nova-error/10 text-nova-error border border-nova-error/20'}`}>
                  {testStatus.status === 'success' ? <Check size={16} className="mt-0.5" /> : <AlertCircle size={16} className="mt-0.5" />}
                  <div className="flex-1 break-words">
                    {testStatus.msg}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : !activeConnectionId ? (
          <div className="flex-1 flex items-center justify-center text-nova-text-muted">
            Selecione uma conexão ou crie uma nova para visualizar resultados.
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
            {/* Header / Toolbar */}
            <div className="flex items-center justify-between p-2 border-b border-nova-border bg-nova-bg-secondary/30">
              <div className="flex items-center gap-3 px-2">
                <span className="text-sm text-nova-text font-medium">Resultados</span>
                {isExecuting && (
                  <span className="flex items-center gap-1.5 text-xs text-nova-accent">
                    <span className="w-2.5 h-2.5 border-2 border-nova-accent border-t-transparent rounded-full animate-spin" />
                    Executando...
                  </span>
                )}
                {activeResult && activeResult.success && (
                  <span className="text-xs text-nova-text-muted bg-nova-bg border border-nova-border px-2 py-0.5 rounded-full">
                    {activeResult.rowCount} linhas ({activeResult.executionTimeMs}ms)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {activeResult && (
                  <button 
                    onClick={() => clearResults(activeConnectionId)}
                    className="p-1 rounded text-nova-text-secondary hover:text-nova-text hover:bg-nova-hover transition-colors"
                    title="Limpar"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Results Body */}
            <div className="flex-1 overflow-auto bg-[#101010]">
              {!activeResult ? (
                <div className="h-full flex items-center justify-center text-xs text-nova-text-muted">
                  Execute uma query no editor com esta conexão ativa.
                </div>
              ) : !activeResult.success ? (
                <div className="p-4 text-sm text-nova-error font-mono whitespace-pre-wrap">
                  {activeResult.error}
                </div>
              ) : activeResult.rows && activeResult.rows.length > 0 ? (
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-nova-bg-secondary z-10 shadow-sm border-b border-nova-border">
                    <tr>
                      <th className="px-3 py-1.5 text-nova-text-secondary font-medium w-12 border-r border-nova-border border-b-0 bg-[#161616]"></th>
                      {activeResult.columns?.map((col, i) => (
                        <th key={i} className="px-3 py-1.5 text-nova-text font-medium border-r border-nova-border border-b-0 bg-[#161616] whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeResult.rows.slice(0, 100).map((row, i) => (
                      <tr key={i} className={`border-b border-nova-border/50 hover:bg-nova-hover/80 ${i % 2 === 0 ? 'bg-[#101010]' : 'bg-[#181818]'}`}>
                        <td className="px-3 py-1 text-nova-text-muted border-r border-nova-border/50 text-right select-none font-mono opacity-60">
                          {i + 1}
                        </td>
                        {Array.isArray(row) ? (
                           row.map((cell, j) => (
                             <td key={j} className="px-3 py-1 text-nova-text-secondary border-r border-nova-border/50 whitespace-nowrap truncate max-w-[250px]" title={String(cell)}>
                               {cell === null ? <span className="text-nova-text-muted/50 italic">null</span> : String(cell)}
                             </td>
                           ))
                        ) : (
                           activeResult.columns?.map((col, j) => (
                             <td key={j} className="px-3 py-1 text-nova-text-secondary border-r border-nova-border/50 whitespace-nowrap truncate max-w-[250px]" title={String(row[col])}>
                               {row[col] === null ? <span className="text-nova-text-muted/50 italic">null</span> : typeof row[col] === 'object' ? JSON.stringify(row[col]) : String(row[col])}
                             </td>
                           ))
                        )}
                      </tr>
                    ))}
                    {activeResult.rows.length > 100 && (
                      <tr>
                        <td colSpan={(activeResult.columns?.length || 0) + 1} className="px-3 py-2 text-center text-xs text-nova-text-muted italic bg-nova-bg-secondary/30">
                          Mostrando apenas os primeiros 100 resultados de {activeResult.rows.length}.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              ) : (
                <div className="p-4 text-xs text-nova-text-muted italic">
                  Comando executado com sucesso. Nenhuma linha retornada.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
