import { useState, useEffect } from 'react'
import {
  Monitor, Cpu, HardDrive, Search, RefreshCw,
  Layers, MousePointer, Code, Terminal, Trash2,
  Copy, ChevronDown, ChevronRight, Zap, AlertTriangle,
  Eye, ExternalLink, Database, Brain
} from 'lucide-react'
import { useWinProcStore } from '../../store/winProcStore'

export default function WinProcessPanel() {
  const {
    processes, windows, selectedPid, selectedWindowHandle,
    memoryStrings, memoryDumpLoading, memoryHex, uiTree,
    isLoading, error,
    refreshProcesses, refreshWindows, dumpMemory,
    readMemoryRegion, getUITree,
    setSelectedPid, setSelectedWindowHandle, clearResults,
  } = useWinProcStore()

  const [activeTab, setActiveTab] = useState<'processes' | 'windows' | 'inspect'>('processes')
  const [searchFilter, setSearchFilter] = useState('')
  const [expandedProcesses, setExpandedProcesses] = useState<Set<number>>(new Set())
  const [memoryFilter, setMemoryFilter] = useState('')

  // Auto-refresh on mount
  useEffect(() => {
    refreshProcesses()
    refreshWindows()
  }, [])

  const filteredProcesses = processes.filter(p => {
    if (!searchFilter) return true
    const q = searchFilter.toLowerCase()
    return p.name.toLowerCase().includes(q) || p.windowTitle.toLowerCase().includes(q)
  })

  const filteredStrings = memoryStrings.filter(s =>
    !memoryFilter || s.toLowerCase().includes(memoryFilter.toLowerCase())
  )

  const toggleExpand = (pid: number) => {
    setExpandedProcesses(prev => {
      const next = new Set(prev)
      next.has(pid) ? next.delete(pid) : next.add(pid)
      return next
    })
  }

  const selectedProc = processes.find(p => p.pid === selectedPid)

  return (
    <div className="h-full flex flex-col bg-nova-bg">
      {/* Header */}
      <div className="border-b border-nova-border bg-nova-bg-secondary shrink-0">
        <div className="h-10 px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Monitor size={15} className="text-cyan-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-nova-text">
              Windows Process Inspector
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { refreshProcesses(); refreshWindows() }}
              className="flex items-center gap-1 px-2 py-1 rounded text-[9px] bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20"
            >
              <RefreshCw size={10} className={isLoading ? 'animate-spin' : ''} />
              Atualizar
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="h-8 px-2 flex items-center gap-0.5 border-t border-nova-border">
          {[
            ['processes', 'Processos', Cpu],
            ['windows', 'Janelas', Layers],
            ['inspect', 'Inspeção', Search],
          ].map(([tab, label, Icon]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`h-7 px-3 rounded-t text-[10px] font-medium flex items-center gap-1.5 transition-colors ${
                activeTab === tab
                  ? 'bg-nova-bg text-cyan-400 border-t border-l border-r border-nova-border'
                  : 'text-nova-text-muted hover:text-nova-text'
              }`}
            >
              <Icon size={11} />
              {label}
              {tab === 'processes' && <span className="text-[9px] text-nova-text-muted">({processes.length})</span>}
              {tab === 'windows' && <span className="text-[9px] text-nova-text-muted">({windows.length})</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: List */}
        <div className="w-[380px] border-r border-nova-border flex flex-col min-h-0 flex-shrink-0">
          {activeTab !== 'inspect' && (
            <div className="p-2 border-b border-nova-border shrink-0">
              <div className="flex items-center gap-2 bg-nova-input-bg border border-nova-input-border rounded px-2 py-1">
                <Search size={11} className="text-nova-text-muted flex-shrink-0" />
                <input
                  value={searchFilter}
                  onChange={e => setSearchFilter(e.target.value)}
                  placeholder={activeTab === 'processes' ? 'Filtrar processos...' : 'Filtrar janelas...'}
                  className="flex-1 bg-transparent text-[10px] text-nova-text outline-none"
                />
              </div>
            </div>
          )}

          <div className="flex-1 overflow-auto scrollbar-thin">
            {/* Process List */}
            {activeTab === 'processes' && (
              <>
                {filteredProcesses.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-nova-text-muted p-4">
                    <div className="text-center">
                      <Cpu size={28} className="mx-auto mb-2 opacity-30" />
                      <p className="text-xs">Nenhum processo encontrado</p>
                      <p className="text-[9px] mt-1 opacity-60">Use o PowerShell como admin para mais detalhes</p>
                    </div>
                  </div>
                ) : (
                  <div className="divide-y divide-nova-border">
                    {filteredProcesses.map(proc => (
                      <div key={proc.pid}>
                        <div
                          className={`px-3 py-2 cursor-pointer hover:bg-nova-bg-secondary/50 transition-colors ${
                            proc.pid === selectedPid ? 'bg-cyan-500/10 border-l-2 border-l-cyan-400' : ''
                          }`}
                          onClick={() => {
                            setSelectedPid(proc.pid === selectedPid ? null : proc.pid)
                            toggleExpand(proc.pid)
                          }}
                        >
                          <div className="flex items-center gap-2">
                            {expandedProcesses.has(proc.pid) ? <ChevronDown size={10} className="text-nova-text-muted" /> : <ChevronRight size={10} className="text-nova-text-muted" />}
                            <span className="text-[10px] font-bold text-nova-text truncate flex-1">
                              {proc.name}
                            </span>
                            <span className="text-[9px] text-cyan-400 font-mono">PID {proc.pid}</span>
                          </div>
                          {proc.windowTitle && (
                            <p className="text-[9px] text-nova-text-muted mt-0.5 ml-4 truncate">{proc.windowTitle}</p>
                          )}
                          <div className="flex items-center gap-3 mt-1 ml-4">
                            <span className="text-[9px] text-nova-text-muted">{proc.memoryMB.toFixed(0)} MB</span>
                            <span className="text-[9px] text-nova-text-muted">{proc.threadCount} threads</span>
                          </div>
                        </div>
                        {/* Expanded actions */}
                        {expandedProcesses.has(proc.pid) && (
                          <div className="px-3 py-2 bg-nova-bg-secondary/50 border-t border-nova-border flex gap-1 ml-4">
                            <button
                              onClick={(e) => { e.stopPropagation(); dumpMemory(proc.pid); setActiveTab('inspect') }}
                              className="flex items-center gap-1 px-2 py-1 rounded text-[9px] bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20"
                            >
                              <Database size={9} />
                              Dump Memória
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                navigator.clipboard.writeText(`PID: ${proc.pid}\nNome: ${proc.name}\nPath: ${proc.executablePath}\nMemória: ${proc.memoryMB} MB\nThreads: ${proc.threadCount}`)
                              }}
                              className="flex items-center gap-1 px-2 py-1 rounded text-[9px] text-nova-text-muted hover:bg-nova-hover"
                            >
                              <Copy size={9} /> Copiar
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Window List */}
            {activeTab === 'windows' && (
              <>
                {windows.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-nova-text-muted p-4">
                    <div className="text-center">
                      <Layers size={28} className="mx-auto mb-2 opacity-30" />
                      <p className="text-xs">Nenhuma janela visível</p>
                      <button onClick={refreshWindows} className="mt-2 text-[10px] text-cyan-400 hover:underline">
                        Atualizar lista
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="divide-y divide-nova-border">
                    {windows.filter(w => {
                      if (!searchFilter) return true
                      const q = searchFilter.toLowerCase()
                      return (w.title || '').toLowerCase().includes(q) || (w.processName || '').toLowerCase().includes(q) || (w.className || '').toLowerCase().includes(q)
                    }).map(win => (
                      <div
                        key={win.handle}
                        className={`px-3 py-2 cursor-pointer hover:bg-nova-bg-secondary/50 ${
                          win.handle === selectedWindowHandle ? 'bg-cyan-500/10 border-l-2 border-l-cyan-400' : ''
                        }`}
                        onClick={() => {
                          if (win.handle === selectedWindowHandle) {
                            setSelectedWindowHandle(null)
                          } else {
                            setSelectedWindowHandle(win.handle)
                            getUITree(win.handle)
                            setActiveTab('inspect')
                          }
                        }}
                      >
                        <p className="text-[10px] font-bold text-nova-text truncate">{win.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[9px] text-nova-text-muted">{win.processName || `PID ${win.processId}`}</span>
                          <span className="text-[9px] font-mono text-cyan-400/70">{win.className}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[8px] text-nova-text-muted">
                            {win.rect.right - win.rect.left}x{win.rect.bottom - win.rect.top}
                          </span>
                          <span className="text-[8px] text-nova-text-muted">
                            @ ({win.rect.left}, {win.rect.top})
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Inspect quick nav when on inspect tab */}
            {activeTab === 'inspect' && (
              <div className="p-2 text-center text-nova-text-muted">
                <p className="text-[9px]">Selecione um processo ou janela nas outras abas</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Inspection Results */}
        <div className="flex-1 flex flex-col min-h-0 bg-nova-bg-secondary overflow-auto">
          {activeTab === 'inspect' && !selectedPid && !selectedWindowHandle ? (
            <div className="flex items-center justify-center h-full text-nova-text-muted">
              <div className="text-center max-w-sm">
                <Search size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm font-semibold text-nova-text mb-1">Inspeção de Processo</p>
                <p className="text-[10px] leading-relaxed">
                  Selecione um processo na aba <span className="text-cyan-400">Processos</span> para fazer dump de memória,
                  ou uma janela na aba <span className="text-cyan-400">Janelas</span> para inspecionar a árvore de UI.
                </p>
                <div className="mt-4 p-3 bg-nova-bg rounded-lg border border-nova-border text-left space-y-1">
                  <p className="text-[10px] font-bold text-cyan-400">Funcionalidades:</p>
                  <p className="text-[9px] text-nova-text-muted">- Dump de strings da memória do processo</p>
                  <p className="text-[9px] text-nova-text-muted">- Leitura de regiões de memória (hex)</p>
                  <p className="text-[9px] text-nova-text-muted">- Árvore de UI Automation</p>
                  <p className="text-[9px] text-nova-text-muted">- Classes, nomes, IDs de automação</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {/* Selected process info */}
              {selectedProc && (
                <div className="p-3 bg-nova-bg rounded-lg border border-nova-border">
                  <div className="flex items-center gap-2">
                    <Cpu size={14} className="text-cyan-400" />
                    <span className="text-[11px] font-bold text-nova-text">{selectedProc.name}</span>
                    <span className="text-[9px] font-mono text-cyan-400">PID {selectedProc.pid}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <div className="bg-nova-bg-secondary rounded p-1.5">
                      <span className="text-[8px] text-nova-text-muted block">Memória</span>
                      <span className="text-[10px] font-bold text-nova-text">{selectedProc.memoryMB.toFixed(0)} MB</span>
                    </div>
                    <div className="bg-nova-bg-secondary rounded p-1.5">
                      <span className="text-[8px] text-nova-text-muted block">Threads</span>
                      <span className="text-[10px] font-bold text-nova-text">{selectedProc.threadCount}</span>
                    </div>
                    <div className="bg-nova-bg-secondary rounded p-1.5">
                      <span className="text-[8px] text-nova-text-muted block">Handle</span>
                      <span className="text-[10px] font-bold font-mono text-nova-text">{selectedProc.mainWindowHandle}</span>
                    </div>
                  </div>
                  <div className="flex gap-1 mt-2">
                    <button
                      onClick={() => dumpMemory(selectedProc.pid)}
                      disabled={memoryDumpLoading}
                      className="flex items-center gap-1 px-2 py-1 rounded text-[9px] bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 disabled:opacity-40"
                    >
                      {memoryDumpLoading ? <RefreshCw size={9} className="animate-spin" /> : <Database size={9} />}
                      Dump Strings
                    </button>
                  </div>
                </div>
              )}

              {/* Memory Strings */}
              {memoryStrings.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[11px] font-bold text-nova-text flex items-center gap-1.5">
                      <Database size={11} className="text-cyan-400" />
                      Strings da Memória ({memoryStrings.length})
                    </h3>
                    <div className="flex items-center gap-2">
                      <input
                        value={memoryFilter}
                        onChange={e => setMemoryFilter(e.target.value)}
                        placeholder="Filtrar strings..."
                        className="bg-nova-input-bg border border-nova-input-border rounded px-2 py-0.5 text-[9px] outline-none w-40"
                      />
                      <button onClick={() => navigator.clipboard.writeText(memoryStrings.join('\n'))} className="p-1 text-nova-text-muted hover:text-nova-accent">
                        <Copy size={11} />
                      </button>
                      <button onClick={clearResults} className="p-1 text-nova-text-muted hover:text-red-400">
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                  <div className="bg-[#0a0f0d] border border-nova-border rounded-lg max-h-[400px] overflow-auto">
                    <div className="divide-y divide-nova-border/20">
                      {filteredStrings.map((str, i) => (
                        <div key={i} className="px-3 py-1.5 flex items-center gap-2 hover:bg-cyan-500/5">
                          <span className="text-[8px] font-mono text-nova-text-muted w-6 text-right">{i + 1}</span>
                          <span className="text-[10px] font-mono text-green-400 break-all">{str}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Memory Hex */}
              {memoryHex && (
                <div>
                  <h3 className="text-[11px] font-bold text-nova-text mb-2 flex items-center gap-1.5">
                    <Code size={11} className="text-cyan-400" />
                    Hex Dump
                  </h3>
                  <pre className="bg-[#0a0f0d] border border-nova-border rounded-lg p-3 text-[10px] font-mono text-green-400 max-h-[300px] overflow-auto whitespace-pre-wrap select-text">
                    {memoryHex}
                  </pre>
                </div>
              )}

              {/* UI Tree */}
              {uiTree.length > 0 && (
                <div>
                  <h3 className="text-[11px] font-bold text-nova-text mb-2 flex items-center gap-1.5">
                    <Layers size={11} className="text-cyan-400" />
                    Árvore de UI Automation
                  </h3>
                  <div className="bg-[#0a0f0d] border border-nova-border rounded-lg max-h-[400px] overflow-auto">
                    <pre className="p-3 text-[10px] font-mono leading-relaxed whitespace-pre-wrap select-text">
                      {uiTree.map((line, i) => {
                        const indent = line.match(/^(\s*)/)?.[1]?.length || 0
                        const color = indent === 0 ? 'text-cyan-400' : indent === 2 ? 'text-yellow-400/80' : indent <= 6 ? 'text-green-400/70' : 'text-nova-text-muted'
                        return <div key={i} className={color}>{line}</div>
                      })}
                    </pre>
                  </div>
                </div>
              )}

              {/* Memory Dump Loading */}
              {memoryDumpLoading && (
                <div className="flex items-center gap-3 p-4 bg-cyan-500/5 rounded-lg border border-cyan-500/20">
                  <RefreshCw size={16} className="text-cyan-400 animate-spin" />
                  <div>
                    <p className="text-[10px] font-bold text-cyan-400">Analisando memória...</p>
                    <p className="text-[9px] text-nova-text-muted">Lendo regiões de memória do processo. Isso pode levar alguns segundos.</p>
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                  <AlertTriangle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-[10px] text-red-400">{error}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Status bar */}
      <div className="h-6 px-3 border-t border-nova-border bg-nova-bg-secondary flex items-center justify-between shrink-0">
        <span className="text-[9px] text-nova-text-muted">
          {processes.length} processos | {windows.length} janelas
        </span>
        {selectedPid && (
          <span className="text-[9px] text-cyan-400 font-mono">PID {selectedPid} selecionado</span>
        )}
      </div>
    </div>
  )
}
