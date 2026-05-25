import { useState } from 'react'
import AIChatPanel from '../ai/AIChatPanel'
import DiffView from '../ai/DiffView'
import { Settings, Sparkles, X } from 'lucide-react'
import { useAIStore } from '../../store/aiStore'

type RightView = 'ai' | 'settings' | null

export default function RightPanel() {
  const { isPanelOpen, togglePanel, panelWidth } = useAIStore()
  const [activeView, setActiveView] = useState<RightView>('ai')

  if (!isPanelOpen) return null

  return (
    <div 
      className="bg-nova-bg border-l border-nova-border flex flex-col transition-[width] duration-0 flex-shrink-0"
      style={{ width: panelWidth }}
    >
      <div className="h-[35px] min-h-[35px] flex items-center justify-between px-3 bg-nova-bg-secondary border-b border-nova-border">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveView('ai')}
            className={`p-1 rounded ${activeView === 'ai' ? 'bg-nova-accent text-white' : 'text-nova-text-muted hover:text-nova-text hover:bg-nova-hover'}`}
            title="Chat IA"
          >
            <Sparkles size={14} />
          </button>
          <button
            onClick={() => setActiveView('settings')}
            className={`p-1 rounded ${activeView === 'settings' ? 'bg-nova-accent text-white' : 'text-nova-text-muted hover:text-nova-text hover:bg-nova-hover'}`}
            title="Configurações"
          >
            <Settings size={14} />
          </button>
        </div>
        <button onClick={togglePanel} className="p-1 text-nova-text-muted hover:text-nova-text hover:bg-nova-hover rounded">
          <X size={14} />
        </button>
      </div>
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeView === 'ai' && <AIChatPanel />}
        {activeView === 'settings' && (
          <div className="p-4 text-sm text-nova-text-secondary">
            <h3 className="text-nova-text font-medium mb-2">Settings</h3>
            <p className="text-xs">Coming soon...</p>
          </div>
        )}
      </div>
    </div>
  )
}
