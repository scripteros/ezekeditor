import React from 'react'

interface FileChange {
  path: string
  add: number
  del: number
  originalContent?: string
  newContent?: string
}

interface InlineFileEditsProps {
  changes?: FileChange[]
  onRevert?: () => void
  onOpenDiff?: (path: string, original?: string, modified?: string) => void
}

function getFileIcon(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase()
  if (ext === 'tsx' || ext === 'jsx') {
    return <span className="text-[#61dafb] font-bold text-[11px]">⚛️</span>
  }
  if (ext === 'ts') {
    return <span className="text-[#3178c6] font-bold text-[11px]">TS</span>
  }
  if (ext === 'js') {
    return <span className="text-[#f7df1e] font-bold text-[11px]">JS</span>
  }
  if (ext === 'md') {
    return <span className="text-[#ffffff] font-bold text-[11px]">📝</span>
  }
  if (ext === 'json') {
    return <span className="text-[#e3c626] font-bold text-[11px]">JSON</span>
  }
  if (ext === 'css') {
    return <span className="text-[#264de4] font-bold text-[11px]">CSS</span>
  }
  return <span className="text-[#a1a1aa] font-bold text-[11px]">📄</span>
}

export function InlineFileEdits({ changes, onRevert, onOpenDiff }: InlineFileEditsProps) {
  if (!changes || changes.length === 0) return null

  return (
    <div className="flex flex-col gap-3 my-4 font-sans select-none">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-nova-text-muted uppercase tracking-wider">Arquivos Modificados</span>
        {onRevert && (
          <button 
            onClick={onRevert}
            className="text-[10px] bg-[#1a231f] hover:bg-nova-error/20 hover:text-nova-error text-nova-text-muted px-2 py-0.5 rounded transition-colors border border-nova-border"
            title="Reverter todos os arquivos para o estado anterior a esta mensagem"
          >
            Reverter
          </button>
        )}
      </div>
      <div className="flex flex-col gap-3">
        {changes.map((change, idx) => {
          const basename = change.path.split(/[/\\]/).pop() || change.path
          
          return (
            <div 
              key={idx} 
              className="flex items-center gap-2.5 text-[13px] cursor-pointer hover:bg-nova-bg-tertiary p-1 rounded -ml-1 transition-colors group"
              onClick={() => onOpenDiff?.(change.path, change.originalContent, change.newContent)}
            >
              <span className="text-[#a1a1aa] group-hover:text-nova-text-secondary">Edited</span>
              
              <div className="flex items-center gap-1.5 flex-1">
                {getFileIcon(basename)}
                <span className="font-medium text-[#e4e4e7] group-hover:text-white transition-colors">{basename}</span>
                <span className="text-[10px] text-nova-text-muted opacity-0 group-hover:opacity-100 transition-opacity ml-2">Ver diff</span>
              </div>

              <div className="flex gap-1.5 font-mono text-[11px]">
                <span className="text-nova-success">+{change.add}</span>
                <span className="text-nova-error">-{change.del}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
