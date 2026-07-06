import { useState } from 'react'
import { Plus, AlertCircle, Trash2, TerminalSquare } from 'lucide-react'
import { useTerminalStore } from '../../store/terminalStore'
import TerminalComponent from '../terminal/Terminal'

export default function TerminalPanel() {
  const { terminals, activeTerminalId, createNewTerminal, setActiveTerminal, killTerminal, terminalError, clearError } = useTerminalStore()
  const [sidebarWidth, setSidebarWidth] = useState(192)

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = sidebarWidth

    const onMouseMove = (e: MouseEvent) => {
      const diff = startX - e.clientX
      setSidebarWidth(Math.max(100, Math.min(600, startWidth + diff)))
    }

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  const handleNewTerminal = () => {
    createNewTerminal()
  }

  return (
    <div className="h-full flex-1 overflow-hidden flex bg-nova-terminal-bg">
      {/* Left Area: Terminal instances */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {terminalError && (
          <div className="flex items-center gap-2 px-3 py-2 bg-nova-error/10 text-nova-error text-xs border-b border-nova-border">
            <AlertCircle size={12} />
            <span className="flex-1">{terminalError}</span>
            <button onClick={clearError} className="hover:underline">
              Dismiss
            </button>
          </div>
        )}
        
        {terminals.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-nova-text-muted">
            <p className="text-sm">Nenhum terminal ativo</p>
          </div>
        ) : (
          terminals.map(t => (
            <div key={t.id} className={`h-full w-full ${t.id === activeTerminalId ? 'block' : 'hidden'}`}>
              <TerminalComponent terminalId={t.id} />
            </div>
          ))
        )}
      </div>

      {/* Right Sidebar: Terminal List */}
      <div 
        className="border-l border-nova-border bg-[#08110d]/50 flex flex-col shrink-0 relative"
        style={{ width: sidebarWidth }}
      >
        <div 
          className="absolute -left-[2px] top-0 bottom-0 w-[4px] cursor-col-resize hover:bg-nova-accent/30 transition-colors z-10"
          onMouseDown={startResize}
        />
        <div className="flex items-center justify-end p-1 border-b border-nova-border/50 bg-[#0a1510]">
          <button
            onClick={handleNewTerminal}
            className="p-1 rounded text-nova-text-muted hover:text-nova-text hover:bg-nova-hover transition-colors"
            title="Novo Terminal"
          >
            <Plus size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin p-1 space-y-0.5">
          {terminals.map(t => (
            <div
              key={t.id}
              onClick={() => setActiveTerminal(t.id)}
              className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer group transition-colors ${
                t.id === activeTerminalId
                  ? 'bg-nova-bg border-l-2 border-nova-accent text-nova-text'
                  : 'text-nova-text-secondary hover:bg-nova-hover hover:text-nova-text border-l-2 border-transparent'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <TerminalSquare size={14} className={t.id === activeTerminalId ? 'text-nova-accent' : 'text-nova-text-muted group-hover:text-nova-text'} />
                <span className="text-xs truncate">{t.name}</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  killTerminal(t.id)
                }}
                className={`p-1 rounded hover:bg-nova-error/20 hover:text-nova-error transition-all ${
                  t.id === activeTerminalId ? 'opacity-100 text-nova-text-muted' : 'opacity-0 group-hover:opacity-100 text-nova-text-muted'
                }`}
                title="Fechar Terminal"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
