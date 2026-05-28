import React, { useState } from 'react'
import { useSidebarStore } from '../../store/sidebarStore'
import { Code2, Keyboard, Palette, RotateCw, Search, Shield, Terminal, MoreHorizontal } from 'lucide-react'

export default function SettingsSidebar() {
  const { activeSettingsSection, setActiveSettingsSection } = useSidebarStore()
  const [searchQuery, setSearchQuery] = useState('')

  const menuItems = [
    { id: 'appearance', label: 'Aparência', icon: Palette },
    { id: 'editor', label: 'Editor', icon: Code2 },
    { id: 'terminal', label: 'Terminal', icon: Terminal },
    { id: 'keybindings', label: 'Atalhos', icon: Keyboard },
    { id: 'sync', label: 'Sincronização', icon: RotateCw },
    { id: 'security', label: 'Segurança', icon: Shield }
  ]

  const filteredItems = menuItems.filter(item => 
    item.label.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="flex flex-col h-full bg-nova-sidebar text-nova-text font-sans select-none">
      <div className="p-4 border-b border-nova-border flex justify-between items-center bg-nova-sidebar">
        <h2 className="font-label-xs text-label-xs uppercase tracking-widest text-nova-text-secondary">Configurações</h2>
        <button className="p-1 rounded text-nova-text-muted hover:text-nova-accent hover:bg-nova-hover" title="Mais opções">
          <MoreHorizontal size={15} />
        </button>
      </div>

      <div className="p-4 flex-1 overflow-y-auto scrollbar-thin space-y-6">
        <div className="relative">
          <input 
            className="w-full bg-nova-input-bg border border-nova-input-border rounded px-3 py-2 pr-9 text-xs focus:ring-1 focus:ring-nova-accent focus:border-nova-accent outline-none transition-all placeholder:text-nova-text-muted text-nova-text" 
            placeholder="Buscar configurações" 
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          <Search className="absolute right-2.5 top-2.5 text-nova-text-muted" size={14} />
        </div>

        <nav className="flex flex-col gap-1">
          {filteredItems.map(item => {
            const isActive = activeSettingsSection === item.id
            const Icon = item.icon
            return (
              <button
                key={item.id}
                onClick={() => setActiveSettingsSection(item.id)}
                className={`flex items-center gap-2.5 p-2 rounded text-left transition-all ${
                  isActive 
                    ? 'text-nova-accent bg-nova-accent/10 font-medium' 
                    : 'text-nova-text-secondary hover:text-nova-text hover:bg-nova-hover'
                }`}
              >
                <Icon size={16} />
                <span className="text-xs font-semibold">{item.label}</span>
              </button>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
