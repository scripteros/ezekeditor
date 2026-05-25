import { useState, useEffect } from 'react'
import { Plus, ChevronDown, ChevronUp, Trash2, Bug, TerminalSquare, X } from 'lucide-react'
import { useTerminalStore } from '../../store/terminalStore'
import { useLogStore } from '../../store/logStore'
import TerminalPanel from './TerminalPanel'
import LogPanel from './LogPanel'
import SqlPanel from '../sql/SqlPanel'
import SecurityPanel from '../security/SecurityPanel'

export default function BottomPanel() {
  const { terminals, activeTerminalId, setActiveTerminal, createNewTerminal } = useTerminalStore()
  const { logs, clearLogs } = useLogStore()
  
  const [isVisible, setIsVisible] = useState(true)
  const [panelHeight, setPanelHeight] = useState(250)
  const [activeTab, setActiveTab] = useState<'terminal' | 'logs' | 'sql' | 'security'>('terminal')

  useEffect(() => {
    const handleOpenSqlTab = () => {
      setActiveTab('sql')
      setIsVisible(true)
    }
    window.addEventListener('ezek:open-sql-tab', handleOpenSqlTab)
    return () => window.removeEventListener('ezek:open-sql-tab', handleOpenSqlTab)
  }, [])

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault()
    const startY = e.clientY
    const startHeight = panelHeight

    const onMouseMove = (e: MouseEvent) => {
      const diff = startY - e.clientY
      setPanelHeight(Math.max(100, Math.min(600, startHeight + diff)))
    }

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  if (!isVisible) {
    return (
      <div className="border-t border-nova-border bg-nova-bg-secondary flex gap-2">
        <button
          onClick={() => { setActiveTab('terminal'); setIsVisible(true) }}
          className="flex items-center gap-1 px-3 py-1 text-xs text-nova-text-secondary hover:text-nova-text"
        >
          <ChevronUp size={14} />
          Terminal
        </button>
        <button
          onClick={() => { setActiveTab('logs'); setIsVisible(true) }}
          className="flex items-center gap-1 px-3 py-1 text-xs text-nova-text-secondary hover:text-nova-text"
        >
          <ChevronUp size={14} />
          Logs {logs.length > 0 && <span className="text-nova-text-muted">({logs.length})</span>}
        </button>
        <button
          onClick={() => { setActiveTab('sql'); setIsVisible(true) }}
          className="flex items-center gap-1 px-3 py-1 text-xs text-nova-text-secondary hover:text-nova-text"
        >
          <ChevronUp size={14} />
          SQL
        </button>
        <button
          onClick={() => { setActiveTab('security'); setIsVisible(true) }}
          className="flex items-center gap-1 px-3 py-1 text-xs text-nova-text-secondary hover:text-nova-text"
        >
          <ChevronUp size={14} />
          Segurança
        </button>
      </div>
    )
  }

  return (
    <div
      className="border-t border-nova-border bg-nova-terminal-bg flex flex-col relative"
      style={{ height: panelHeight }}
    >
      <div
        className="h-[4px] cursor-ns-resize bg-transparent hover:bg-nova-accent/30 transition-colors absolute -top-[2px] left-0 right-0 z-10"
        onMouseDown={startResize}
      />
      <div className="h-[35px] min-h-[35px] flex items-center justify-between px-4 bg-nova-bg-secondary border-b border-nova-border select-none">
        <div className="flex items-center gap-1 h-full py-1.5">
          <button
            onClick={() => setActiveTab('terminal')}
            className={`flex items-center gap-1.5 h-full px-3 text-xs tracking-wide rounded-md transition-colors ${
              activeTab === 'terminal'
                ? 'text-[#f3f4f6] bg-[#101916] border border-nova-accent/10'
                : 'text-nova-text-secondary hover:text-nova-text'
            }`}
          >
            Terminal
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-1.5 h-full px-3 text-xs tracking-wide rounded-md transition-colors ${
              activeTab === 'logs'
                ? 'text-[#f3f4f6] bg-[#101916] border border-nova-accent/10'
                : 'text-nova-text-secondary hover:text-nova-text'
            }`}
          >
            Logs
            {logs.length > 0 && (
              <span className="bg-nova-bg px-1.5 py-0.5 rounded-full text-[10px] text-nova-text-muted">
                {logs.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('sql')}
            className={`flex items-center gap-1.5 h-full px-3 text-xs tracking-wide rounded-md transition-colors ${
              activeTab === 'sql'
                ? 'text-[#f3f4f6] bg-[#101916] border border-nova-accent/10'
                : 'text-nova-text-secondary hover:text-nova-text'
            }`}
          >
            SQL
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`flex items-center gap-1.5 h-full px-3 text-xs tracking-wide rounded-md transition-colors ${
              activeTab === 'security'
                ? 'text-[#f3f4f6] bg-[#101916] border border-nova-accent/10'
                : 'text-nova-text-secondary hover:text-nova-text'
            }`}
          >
            <Bug size={12} className={activeTab === 'security' ? 'text-nova-accent' : 'text-nova-text-muted'} />
            Segurança
          </button>
        </div>
        
        <div className="flex items-center gap-2">
          {activeTab === 'logs' && (
            <button
              onClick={clearLogs}
              className="p-1 rounded text-nova-text-secondary hover:text-nova-text hover:bg-nova-hover transition-colors"
              title="Limpar Logs"
            >
              <Trash2 size={14} />
            </button>
          )}
          <button
            onClick={() => setIsVisible(false)}
            className="p-1 rounded text-nova-text-secondary hover:text-nova-text hover:bg-nova-hover transition-colors"
            title="Ocultar Painel"
          >
            <ChevronDown size={14} />
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-hidden relative bg-nova-bg">
        <div className={`absolute inset-0 ${activeTab === 'terminal' ? 'z-10 opacity-100' : '-z-10 opacity-0 pointer-events-none'}`}>
          <TerminalPanel />
        </div>
        <div className={`absolute inset-0 ${activeTab === 'logs' ? 'z-10 opacity-100' : '-z-10 opacity-0 pointer-events-none'}`}>
          <LogPanel />
        </div>
        <div className={`absolute inset-0 ${activeTab === 'sql' ? 'z-10 opacity-100' : '-z-10 opacity-0 pointer-events-none'}`}>
          <SqlPanel />
        </div>
        <div className={`absolute inset-0 ${activeTab === 'security' ? 'z-10 opacity-100' : '-z-10 opacity-0 pointer-events-none'}`}>
          <SecurityPanel />
        </div>
      </div>
    </div>
  )
}
