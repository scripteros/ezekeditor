import { useSidebarStore } from '../../store/sidebarStore'
import FileExplorer from '../explorer/FileExplorer'
import SearchPanel from '../search/SearchPanel'
import GitPanel from '../git/GitPanel'
import AIExtensionsPanel from '../extensions/AIExtensionsPanel'
import LdapPanel from '../ldap/LdapPanel'
import SettingsSidebar from '../settings/SettingsSidebar'
import { Monitor } from 'lucide-react'

export default function Sidebar() {
  const { isOpen, activeView, width, setActiveView } = useSidebarStore()

  const viewTitles: Record<string, string> = {
    explorer: 'EXPLORADOR',
    search: 'PESQUISA',
    git: 'CONTROLE DE VERSÃO',
    ldap: 'ACTIVE DIRECTORY',
    extensions: 'MARKETPLACE',
    settings: 'CONFIGURAÇÕES',
  }

  return (
    <div
      className={`bg-nova-sidebar border-r border-nova-border flex flex-col overflow-hidden transition-[width] duration-0 flex-shrink-0 ${
        isOpen ? '' : '!w-0'
      }`}
      style={{ width: isOpen ? width : 0 }}
    >
      {isOpen && (
        <>
          {activeView !== 'extensions' && activeView !== 'settings' && (
            <div className="h-[35px] min-h-[35px] flex items-center px-4 text-xs font-semibold text-nova-text-secondary tracking-wider uppercase">
              {viewTitles[activeView || 'explorer'] || 'EXPLORER'}
            </div>
          )}
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {activeView === 'explorer' && <FileExplorer />}
            {activeView === 'git' && <GitPanel />}
            {activeView === 'search' && <SearchPanel />}
            {activeView === 'ldap' && <LdapPanel />}
            {activeView === 'extensions' && <AIExtensionsPanel />}
            {activeView === 'settings' && <SettingsSidebar />}
          </div>
          {/* Atalho para Windows Process Inspector */}
          <div className="border-t border-nova-border p-2 shrink-0">
            <button
              onClick={() => setActiveView('winproc')}
              className="w-full flex items-center gap-2 px-3 py-2 rounded text-[10px] text-nova-text-muted hover:bg-nova-hover hover:text-cyan-400 transition-colors"
            >
              <Monitor size={14} className="text-cyan-400" />
              <span>Windows Process Inspector</span>
              <span className="ml-auto text-[8px] text-nova-text-muted opacity-50">Abrir</span>
            </button>
          </div>
        </>
      )}
    </div>
  )
}
