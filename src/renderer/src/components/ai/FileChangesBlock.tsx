import React from 'react'
import { FileCode, ChevronRight, CheckSquare } from 'lucide-react'

interface FileChange {
  path: string
  add: number
  del: number
  originalContent?: string
  newContent?: string
}

interface FileChangesBlockProps {
  changes: FileChange[]
  onReview?: () => void
  onOpenDiff?: (path: string, original?: string, modified?: string) => void
}

export function FileChangesBlock({ changes, onReview, onOpenDiff }: FileChangesBlockProps) {
  if (!changes || changes.length === 0) return null

  const totalAdd = changes.reduce((acc, c) => acc + c.add, 0)
  const totalDel = changes.reduce((acc, c) => acc + c.del, 0)

  return (
    <div className="mt-3 flex flex-col gap-2">
      {/* Header */}
      <div className="flex items-center justify-between text-xs text-[#a1a1aa]">
        <div className="flex items-center gap-2">
          <span>{changes.length} file{changes.length > 1 ? 's' : ''} changed</span>
          <div className="flex gap-1 font-mono text-[11px]">
            {totalAdd > 0 && <span className="text-nova-success">+{totalAdd}</span>}
            {totalDel > 0 && <span className="text-nova-error">-{totalDel}</span>}
          </div>
        </div>
        <button 
          onClick={onReview}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-[#1a231f] hover:bg-[#202b26] border border-[#2b3a33] rounded-md transition-colors text-nova-text"
        >
          <CheckSquare size={12} className="text-nova-accent opacity-80" />
          <span>Review</span>
        </button>
      </div>

      {/* File List */}
      <div className="bg-[#0f1714] border border-[#1a231f] rounded-lg overflow-hidden flex flex-col">
        {changes.map((change, idx) => {
          // Extract basename and simple path
          const parts = change.path.split(/[/\\]/)
          const basename = parts.pop() || change.path
          const parentDir = parts.length > 0 ? parts.slice(-2).join('/') : ''

          return (
            <div 
              key={idx}
              className={`flex items-center gap-3 px-3 py-2 text-xs hover:bg-[#1a231f] transition-colors cursor-pointer group ${
                idx < changes.length - 1 ? 'border-b border-[#1a231f]' : ''
              }`}
              onClick={() => onOpenDiff?.(change.path, change.originalContent, change.newContent)}
            >
              <div className="flex items-center justify-center w-4 h-4 rounded bg-[#1a231f] text-nova-accent">
                <div className="w-1.5 h-1.5 bg-nova-accent rounded-full"></div>
              </div>
              
              <div className="flex gap-1.5 font-mono text-[10px] w-12 shrink-0">
                <span className="text-nova-success">+{change.add}</span>
                <span className="text-nova-error">-{change.del}</span>
              </div>

              <div className="flex items-center gap-2 overflow-hidden flex-1">
                <span className="text-nova-text font-medium truncate group-hover:text-white transition-colors">{basename}</span>
                <span className="text-[#a1a1aa] text-[10px] truncate opacity-50">.../{parentDir}/{basename}</span>
                <span className="text-[10px] text-nova-accent opacity-0 group-hover:opacity-100 transition-opacity ml-auto">Ver diff</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
