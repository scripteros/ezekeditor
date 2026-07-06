import { useState } from 'react'
import { ChevronRight, ChevronDown, FolderSearch, Brain } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface ThinkingBlockProps {
  steps?: any[]
  actions?: any[]
}

export function ThinkingBlock({ steps, actions }: ThinkingBlockProps) {
  const [exploringOpen, setExploringOpen] = useState(false)
  const [thinkingOpen, setThinkingOpen] = useState(false)

  const hasSteps = steps && steps.length > 0
  const hasActions = actions && actions.length > 0
  
  if (!hasSteps && !hasActions) return null

  // Process actions into analyzed files
  const analyzedFiles = actions?.filter(a => a.type === 'read_file' || a.type === 'write_file').map(a => a.filePath) || []
  const uniqueFiles = Array.from(new Set(analyzedFiles))

  // Combine steps descriptions for thinking block
  const thinkingText = steps?.map(s => s.description).join('\n\n') || ''

  return (
    <div className="flex flex-col gap-2 mb-3 mt-1 text-sm font-sans">
      
      {uniqueFiles.length > 0 && (
        <div className="flex flex-col">
          <button 
            onClick={() => setExploringOpen(!exploringOpen)}
            className="flex items-center gap-1.5 text-nova-text-muted hover:text-nova-text transition-colors w-max select-none text-[12px]"
          >
            {exploringOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span>Exploring {uniqueFiles.length} file{uniqueFiles.length > 1 ? 's' : ''}</span>
          </button>
          
          {exploringOpen && (
            <div className="mt-2 ml-5 flex flex-col gap-1.5 border-l-2 border-nova-accent/20 pl-3">
              {uniqueFiles.map((file, idx) => {
                const parts = file.split(/[/\\]/)
                const basename = parts.pop() || file
                const ext = basename.split('.').pop()?.toUpperCase() || 'FILE'
                return (
                  <div key={idx} className="flex items-center gap-2 text-[11px] text-[#a1a1aa]">
                    <span>Analyzed</span>
                    <span className="text-nova-accent opacity-80 font-mono text-[9px] px-1 bg-nova-accent/10 rounded">{ext}</span>
                    <span className="text-nova-text font-medium">{basename}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {thinkingText && (
        <div className="flex flex-col">
          <button 
            onClick={() => setThinkingOpen(!thinkingOpen)}
            className="flex items-center gap-1.5 text-nova-text-muted hover:text-nova-text transition-colors w-max select-none text-[12px]"
          >
            {thinkingOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span>Thinking.</span>
          </button>
          
          {thinkingOpen && (
            <div className="mt-2 ml-5 border-l-2 border-[#152b21] pl-3 text-[12px] text-[#a1a1aa] leading-relaxed max-h-48 overflow-y-auto scrollbar-thin">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {thinkingText}
              </ReactMarkdown>
            </div>
          )}
        </div>
      )}

    </div>
  )
}
