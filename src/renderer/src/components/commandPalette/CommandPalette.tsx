import { useEffect, useRef, useState } from 'react'
import { useCommandPaletteStore } from '../../store/commandPaletteStore'
import { useEditorStore } from '../../store/editorStore'
import { useExplorerStore } from '../../store/explorerStore'
import { useThemeStore } from '../../store/themeStore'
import { useTerminalStore } from '../../store/terminalStore'
import { useSidebarStore } from '../../store/sidebarStore'
import { Search, File, FolderOpen, Terminal, Palette, X, GitBranch } from 'lucide-react'
import { getApi } from '../../utils/platform'

interface CommandItem {
  id: string
  label: string
  description?: string
  icon: React.ReactNode
  action: () => void
}

export default function CommandPalette() {
  const { isOpen, searchQuery, setSearchQuery, closePalette } = useCommandPaletteStore()
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const { openFile } = useEditorStore()
  const { rootPath, setRootPath } = useExplorerStore()
  const { setTheme } = useThemeStore()
  const { createNewTerminal } = useTerminalStore()
  const { toggleSidebar, setActiveView } = useSidebarStore()

  const commands: CommandItem[] = [
    {
      id: 'open-folder',
      label: 'Abrir Pasta',
      description: 'Open a folder in the editor',
      icon: <FolderOpen size={14} />,
      action: async () => {
        const api = getApi()
        if (api) {
          const folder = await api.selectFolder()
          if (folder) setRootPath(folder)
        }
      },
    },
    {
      id: 'new-terminal',
      label: 'Novo Terminal',
      description: 'Criar uma nova instância de terminal',
      icon: <Terminal size={14} />,
      action: () => createNewTerminal(),
    },
    {
      id: 'toggle-sidebar',
      label: 'Toggle Sidebar',
      description: 'Mostrar ou ocultar a barra lateral',
      icon: <Search size={14} />,
      action: () => toggleSidebar(),
    },
    {
      id: 'view-explorer',
      label: 'View: Explorer',
      description: 'Show the file explorer',
      icon: <File size={14} />,
      action: () => setActiveView('explorer'),
    },
    {
      id: 'view-search',
      label: 'Exibir: Pesquisa',
      description: 'Mostrar o painel de pesquisa',
      icon: <Search size={14} />,
      action: () => setActiveView('search'),
    },
    {
      id: 'view-git',
      label: 'Exibir: Controle de Versão',
      description: 'Mostrar o painel de controle de versão',
      icon: <GitBranch size={14} />,
      action: () => setActiveView('git'),
    },
    {
      id: 'theme-dark',
      label: 'Tema: Ezek Dark',
      description: 'Alternar para o tema escuro',
      icon: <Palette size={14} />,
      action: () => setTheme('ezek-dark'),
    },
    {
      id: 'theme-light',
      label: 'Tema: Ezek Light',
      description: 'Alternar para o tema claro',
      icon: <Palette size={14} />,
      action: () => setTheme('ezek-light'),
    },
  ]

  const filtered = searchQuery
    ? commands.filter(c =>
        c.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : commands

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
      setSelectedIndex(0)
    }
  }, [isOpen])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      closePalette()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(i => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      filtered[selectedIndex].action()
      closePalette()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      <div className="absolute inset-0 bg-black/50" onClick={closePalette} />
      <div className="relative w-[600px] max-w-[90vw] bg-nova-bg-secondary border border-nova-border rounded-lg shadow-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-nova-border">
          <Search size={16} className="text-nova-text-muted flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setSelectedIndex(0) }}
            onKeyDown={handleKeyDown}
            placeholder="Digite um comando ou pesquise..."
            className="flex-1 bg-transparent text-sm text-nova-text outline-none placeholder:text-nova-text-muted"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-nova-text-muted hover:text-nova-text">
              <X size={14} />
            </button>
          )}
        </div>
        <div className="max-h-[300px] overflow-y-auto scrollbar-thin">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-nova-text-muted">
              No commands found
            </div>
          ) : (
            filtered.map((cmd, i) => (
              <button
                key={cmd.id}
                onClick={() => { cmd.action(); closePalette() }}
                onMouseEnter={() => setSelectedIndex(i)}
                className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                  i === selectedIndex ? 'bg-nova-accent text-white' : 'text-nova-text hover:bg-nova-hover'
                }`}
              >
                <span className={i === selectedIndex ? 'text-white' : 'text-nova-text-muted'}>
                  {cmd.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm truncate ${i === selectedIndex ? 'text-white' : 'text-nova-text'}`}>
                    {cmd.label}
                  </div>
                  {cmd.description && (
                    <div className={`text-xs truncate ${i === selectedIndex ? 'text-white/70' : 'text-nova-text-muted'}`}>
                      {cmd.description}
                    </div>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
