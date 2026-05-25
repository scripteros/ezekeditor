import { 
  Minus, 
  Square, 
  X, 
  File, 
  FolderOpen, 
  Save, 
  Eye, 
  EyeOff, 
  MessageSquare, 
  Terminal,
  Search,
  Settings,
  User,
  SplitSquareHorizontal,
  Edit,
  MousePointer2,
  Play,
  HelpCircle
} from 'lucide-react'
import { useExplorerStore } from '../../store/explorerStore'
import { useAIStore } from '../../store/aiStore'
import { useTerminalStore } from '../../store/terminalStore'
import { useSidebarStore } from '../../store/sidebarStore'
import { useEditorStore } from '../../store/editorStore'
import { useEffect, useState } from 'react'
import { isElectron, getApi } from '../../utils/platform'

export default function TitleBar() {
  const { rootPath } = useExplorerStore()
  const { isPanelOpen: isAIPanelOpen, togglePanel: toggleAIPanel } = useAIStore()
  const { isOpen: isSidebarOpen, toggleSidebar } = useSidebarStore()
  const { getActiveFile } = useEditorStore()
  const [isMaximized, setIsMaximized] = useState(false)
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const [isBottomPanelVisible, setIsBottomPanelVisible] = useState(true)
  const activeFile = getActiveFile()
  const displayTitle = activeFile ? activeFile.fileName : 'Ezek'
  const api = getApi()

  // Menu items seguindo padrão VSCode/Cursor
  const menuItems = [
    { id: 'file', label: 'Arquivo' },
    { id: 'edit', label: 'Editar' },
    { id: 'selection', label: 'Seleção' },
    { id: 'view', label: 'Exibir' },
    { id: 'go', label: 'Ir' },
    { id: 'run', label: 'Executar' },
    { id: 'terminal', label: 'Terminal' },
    { id: 'help', label: 'Ajuda' }
  ]

  useEffect(() => {
    if (api) {
      api.isMaximized().then(setIsMaximized)
    }
  }, [])

  // Versão para navegador (sem Electron)
  if (!api) {
    return (
      <div className="h-[30px] bg-emerald-900 flex items-center select-none border-b border-emerald-800">
        {/* Logo pequena */}
        <div className="flex items-center px-3">
          <img 
            src="/ico.png" 
            alt="Ezek IDE" 
            className="w-4 h-4"
            onError={(e) => {
              // Fallback para o ícone gradiente se a imagem não carregar
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              target.parentElement!.innerHTML = '<div class="w-4 h-4 rounded bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center text-[8px] text-white font-bold">E</div>';
            }}
          />
        </div>
        
        {/* Menu horizontal */}
        <div className="flex items-center">
          {menuItems.map(item => (
            <button
              key={item.id}
              onMouseEnter={() => setActiveMenu(item.id)}
              onMouseLeave={() => setActiveMenu(null)}
              className={`px-3 py-1 text-[13px] font-normal transition-all duration-200 ${
                activeMenu === item.id 
                  ? 'bg-emerald-600/20 text-emerald-400' 
                  : 'text-[#cccccc]/70 hover:bg-emerald-600/10 hover:text-emerald-400'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        
        {/* Centro - Nome do arquivo ativo */}
        <div className="flex-1 flex justify-center items-center px-4">
          <span className="text-[13px] text-[#cccccc] font-medium tracking-wide">
            {displayTitle}
          </span>
        </div>
        
        {/* Ícones lado direito */}
        <div className="flex items-center">
          <button
            title="Dividir Editor"
            className="w-8 h-[30px] flex items-center justify-center text-[#cccccc]/70 hover:text-emerald-400 hover:bg-emerald-600/10 transition-all duration-200"
          >
            <SplitSquareHorizontal size={13} />
          </button>
          <button
            title="Pesquisar"
            className="w-8 h-[30px] flex items-center justify-center text-[#cccccc]/70 hover:text-emerald-400 hover:bg-emerald-600/10 transition-all duration-200"
          >
            <Search size={13} />
          </button>
          <button
            title="Configurações"
            className="w-8 h-[30px] flex items-center justify-center text-[#cccccc]/70 hover:text-emerald-400 hover:bg-emerald-600/10 transition-all duration-200"
          >
            <Settings size={13} />
          </button>
          <button
            title="Perfil"
            className="w-8 h-[30px] flex items-center justify-center text-[#cccccc]/70 hover:text-emerald-400 hover:bg-emerald-600/10 transition-all duration-200"
          >
            <User size={13} />
          </button>
          
          {/* Separador */}
          <div className="w-px h-4 bg-[#2b2b2b] mx-1" />
          
          {/* Controles da janela (simulados) */}
          <button className="w-8 h-[30px] flex items-center justify-center text-[#cccccc]/70 hover:text-emerald-400 hover:bg-emerald-600/10 transition-all duration-200">
            <Minus size={12} />
          </button>
          <button className="w-8 h-[30px] flex items-center justify-center text-[#cccccc]/70 hover:text-emerald-400 hover:bg-emerald-600/10 transition-all duration-200">
            <Square size={10} />
          </button>
          <button className="w-8 h-[30px] flex items-center justify-center text-[#cccccc]/70 hover:text-white hover:bg-[#e74c3c] transition-all duration-200">
            <X size={12} />
          </button>
        </div>
      </div>
    )
  }

  // Versão Electron com funcionalidades completas
  return (
    <div 
      className="h-[30px] bg-emerald-900 flex items-center select-none border-b border-emerald-800" 
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Logo pequena */}
      <div className="flex items-center px-3" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <img 
          src="/ico.png" 
          alt="Ezek IDE" 
          className="w-4 h-4"
          onError={(e) => {
            // Fallback para o ícone gradiente se a imagem não carregar
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            target.parentElement!.innerHTML = '<div class="w-4 h-4 rounded bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center text-[8px] text-white font-bold">E</div>';
          }}
        />
      </div>
      
      {/* Menu horizontal */}
      <div className="flex items-center" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        {menuItems.map(item => {
          const isFileMenu = item.id === 'file'
          return (
            <div 
              key={item.id} 
              className="relative"
              onMouseEnter={() => setActiveMenu(item.id)}
              onMouseLeave={() => setActiveMenu(null)}
            >
              <button
                onClick={() => isFileMenu ? setActiveMenu(activeMenu === item.id ? null : item.id) : undefined}
                className={`px-3 py-1 text-[13px] font-normal transition-all duration-200 ${
                activeMenu === item.id 
                  ? 'bg-emerald-600/20 text-emerald-400' 
                  : 'text-[#cccccc]/70 hover:bg-emerald-600/10 hover:text-emerald-400'
                }`}
              >
                {item.label}
              </button>
              
              {/* Dropdown apenas para File menu */}
              {isFileMenu && activeMenu === item.id && (
                <div className="absolute top-full left-0 bg-[#252526] border border-[#3c3c3c] shadow-xl z-50 min-w-[200px] py-1 rounded-sm">
                  <button 
                    onClick={() => {
                      api.openFileDialog?.();
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-2 text-left text-[13px] text-[#cccccc]/90 hover:text-[#cccccc] hover:bg-[#2d2d30] flex items-center gap-3"
                  >
                    <File size={14} /> Novo Arquivo
                  </button>
                  <button 
                    onClick={() => {
                      api.openFolderDialog?.();
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-2 text-left text-[13px] text-[#cccccc]/90 hover:text-[#cccccc] hover:bg-[#2d2d30] flex items-center gap-3"
                  >
                    <FolderOpen size={14} /> Abrir Pasta
                  </button>
                  <div className="border-t border-[#3c3c3c] my-1" />
                  <button 
                    onClick={() => {
                      api.saveFile?.();
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-2 text-left text-[13px] text-[#cccccc]/90 hover:text-[#cccccc] hover:bg-[#2d2d30] flex items-center gap-3"
                  >
                    <Save size={14} /> Salvar
                  </button>
                  <button 
                    onClick={() => {
                      useEditorStore.getState().toggleAutoSave();
                    }}
                    className="w-full px-3 py-2 text-left text-[13px] text-[#cccccc]/90 hover:text-[#cccccc] hover:bg-[#2d2d30] flex items-center justify-between"
                  >
                    <span className="flex items-center gap-3"><Save size={14} /> Auto-Salvar</span>
                    {useEditorStore.getState().autoSave && <div className="w-2 h-2 rounded-full bg-emerald-500"></div>}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
      
      {/* Centro - Nome do arquivo ativo */}
      <div className="flex-1 flex justify-center items-center px-4">
        <span className="text-[13px] text-[#cccccc] font-medium tracking-wide">
          {displayTitle}
        </span>
      </div>
      
      {/* Ícones lado direito */}
      <div className="flex items-center" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button
          title="Dividir Editor"
          className="w-8 h-[30px] flex items-center justify-center text-[#cccccc]/70 hover:text-emerald-400 hover:bg-emerald-600/10 transition-all duration-200"
        >
          <SplitSquareHorizontal size={13} />
        </button>
        <button
          title="Pesquisar"
          className="w-8 h-[30px] flex items-center justify-center text-[#cccccc]/70 hover:text-emerald-400 hover:bg-emerald-600/10 transition-all duration-200"
        >
          <Search size={13} />
        </button>
        <button
          onClick={() => setActiveMenu('settings')}
          title="Configurações"
          className="w-8 h-[30px] flex items-center justify-center text-[#cccccc]/70 hover:text-emerald-400 hover:bg-emerald-600/10 transition-all duration-200"
        >
          <Settings size={13} />
        </button>
        <button
          title="Perfil"
          className="w-8 h-[30px] flex items-center justify-center text-[#cccccc]/70 hover:text-emerald-400 hover:bg-emerald-600/10 transition-all duration-200"
        >
          <User size={13} />
        </button>
        
        {/* Separador */}
        <div className="w-px h-4 bg-[#2b2b2b] mx-1" />
        
        {/* Controles da janela */}
        <button 
          onClick={() => api.minimizeWindow()} 
          title="Minimizar"
          className="w-8 h-[30px] flex items-center justify-center text-[#cccccc]/70 hover:text-emerald-400 hover:bg-emerald-600/10 transition-all duration-200"
        >
          <Minus size={12} />
        </button>
        <button 
          onClick={() => api.maximizeWindow().then(() => api.isMaximized().then(setIsMaximized))} 
          title={isMaximized ? 'Restaurar' : 'Maximizar'}
          className="w-8 h-[30px] flex items-center justify-center text-[#cccccc]/70 hover:text-emerald-400 hover:bg-emerald-600/10 transition-all duration-200"
        >
          <Square size={10} />
        </button>
        <button 
          onClick={() => api.closeWindow()} 
          title="Fechar"
          className="w-8 h-[30px] flex items-center justify-center text-[#cccccc]/70 hover:text-white hover:bg-[#e74c3c] transition-all duration-200"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  )
}
