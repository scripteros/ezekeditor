import { Files, Search, GitFork, Sun, Moon, Puzzle, Network } from 'lucide-react'
import { useSidebarStore } from '../../store/sidebarStore'
import { useThemeStore } from '../../store/themeStore'
import { useGitStore } from '../../store/gitStore'
import { useExplorerStore } from '../../store/explorerStore'
import { useEffect } from 'react'
import AIActivityButton from '../ai/AIActivityButton'

const activities = [
  { id: 'explorer', icon: Files, label: 'Explorador' },
  { id: 'search', icon: Search, label: 'Pesquisar' },
  { id: 'git', icon: GitFork, label: 'Git' },
  { id: 'ldap', icon: Network, label: 'LDAP / AD' },
  { id: 'extensions', icon: Puzzle, label: 'Extensões de IA' },
] as const

export default function ActivityBar() {
  const { activeView, setActiveView } = useSidebarStore()
  const { theme, setTheme } = useThemeStore()
  const { refreshStatus, status, isGitRepo } = useGitStore()
  const { rootPath } = useExplorerStore()
  const isDark = theme.type === 'dark'

  useEffect(() => {
    if (rootPath) {
      refreshStatus(rootPath)
    }
  }, [rootPath, refreshStatus])

  return (
    <div className="w-activity bg-nova-activitybar border-r border-nova-border flex flex-col items-center py-2 gap-1">
      <div className="flex flex-col items-center gap-1 flex-1">
        {activities.map(({ id, icon: Icon, label }) => {
          const isGitView = id === 'git'
          const gitChangesCount = status ? (status.staged?.length || 0) + (status.unstaged?.length || 0) : 0
          
          return (
            <button
              key={id}
              title={isGitView && !isGitRepo ? 'Git não inicializado' : label}
              onClick={() => {
                if (isGitView && rootPath) {
                  refreshStatus(rootPath)
                }
                setActiveView(id as any)
              }}
              className={`w-10 h-10 flex items-center justify-center rounded transition-all relative ${
                activeView === id
                  ? 'text-nova-text bg-nova-hover'
                  : 'text-nova-text-muted hover:text-nova-text hover:bg-nova-hover'
              } ${isGitView && !isGitRepo ? 'opacity-50' : ''}`}
            >
              {activeView === id && (
                <div className="absolute left-0 w-[2px] h-5 bg-nova-accent rounded-r-full" />
              )}
              <Icon size={22} />
              {isGitView && isGitRepo && gitChangesCount > 0 && (
                <div className="absolute -top-1 -right-1 bg-nova-accent text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {gitChangesCount}
                </div>
              )}
            </button>
          )
        })}
      </div>
      <div className="flex flex-col items-center gap-1 pb-2">
        <button
          title={isDark ? 'Modo Claro' : 'Modo Escuro'}
          onClick={() => setTheme(isDark ? 'ezek-light' : 'ezek-dark')}
          className="w-10 h-10 flex items-center justify-center rounded text-nova-text-muted hover:text-nova-text hover:bg-nova-hover transition-all"
        >
          {isDark ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        <AIActivityButton />
      </div>
    </div>
  )
}
