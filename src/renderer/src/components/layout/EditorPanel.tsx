import { useEditorStore } from '../../store/editorStore'
import { useExplorerStore } from '../../store/explorerStore'
import { X, FolderOpen, Loader2, Play, Database } from 'lucide-react'
import MonacoEditor from '../editor/MonacoEditor'
import MonacoDiffEditor from '../editor/MonacoDiffEditor'
import ImageViewer from '../editor/ImageViewer'
import { useEffect, useRef, useState } from 'react'
import { getApi } from '../../utils/platform'
import logo from '../../assets/logo.png'
import { useSqlStore } from '../../store/sqlStore'
import MarketplaceCatalog from '../extensions/MarketplaceCatalog'
import { useSidebarStore } from '../../store/sidebarStore'
import SettingsView from '../settings/SettingsView'
import SqlEditorWorkspace from '../sql/SqlEditorWorkspace'
import SecurityPanel from '../security/SecurityPanel'
import BacklogWorkspace from '../backlog/BacklogPanel'

export default function EditorPanel() {
  const { openFiles, activeFileId, setActiveFile, closeFile, isLoadingFile, isDiffMode } = useEditorStore()
  const { setRootPath } = useExplorerStore()
  const { executeQuery, activeConnectionId, isExecuting } = useSqlStore()
  const { activeView } = useSidebarStore()
  const tabsRef = useRef<HTMLDivElement>(null)
  const [showSqlWorkspace, setShowSqlWorkspace] = useState(false)
  const [showSecurityWorkspace, setShowSecurityWorkspace] = useState(false)
  const tabListRef = useRef<HTMLDivElement>(null)
  
  const activeFile = openFiles.find(f => f.id === activeFileId)
  
  const handleRunQuery = () => {
    if (activeFile && activeFile.language === 'sql') {
      if (!activeConnectionId) {
        alert('Selecione ou configure uma conexão SQL no painel inferior primeiro!')
        return
      }
      
      // Attempt to get selected text via Monaco API if possible
      const selectedText = useEditorStore.getState().selectedText
      const queryToRun = selectedText && selectedText.trim().length > 0 ? selectedText : activeFile.content
      executeQuery(queryToRun)
    }
  }

  const isImageFile = (filename: string) => {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.tiff', '.ico']
    return imageExtensions.some(ext => filename.toLowerCase().endsWith(ext))
  }

  const handleSelectFolder = async () => {
    const api = getApi()
    if (api) {
      const folder = await api.selectFolder()
      if (folder) {
        setRootPath(folder)
      }
    }
  }

  useEffect(() => {
    const handleOpenSqlWorkspace = () => {
      setShowSecurityWorkspace(false)
      setShowSqlWorkspace(true)
    }
    const handleCloseSqlWorkspace = () => setShowSqlWorkspace(false)
    const handleOpenSecurityWorkspace = () => {
      setShowSqlWorkspace(false)
      setShowSecurityWorkspace(true)
    }
    const handleCloseSecurityWorkspace = () => setShowSecurityWorkspace(false)
    window.addEventListener('ezek:open-sql-workspace', handleOpenSqlWorkspace)
    window.addEventListener('ezek:close-sql-workspace', handleCloseSqlWorkspace)
    window.addEventListener('ezek:open-security-workspace', handleOpenSecurityWorkspace)
    window.addEventListener('ezek:close-security-workspace', handleCloseSecurityWorkspace)
    return () => {
      window.removeEventListener('ezek:open-sql-workspace', handleOpenSqlWorkspace)
      window.removeEventListener('ezek:close-sql-workspace', handleCloseSqlWorkspace)
      window.removeEventListener('ezek:open-security-workspace', handleOpenSecurityWorkspace)
      window.removeEventListener('ezek:close-security-workspace', handleCloseSecurityWorkspace)
    }
  }, [])

  useEffect(() => {
    const handleSave = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (activeFileId) {
          useEditorStore.getState().saveFile(activeFileId)
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        if (activeFile && activeFile.language === 'sql') {
          e.preventDefault()
          handleRunQuery()
        }
      }
    }
    window.addEventListener('keydown', handleSave)
    return () => window.removeEventListener('keydown', handleSave)
  }, [activeFileId, activeFile, handleRunQuery])

  if (activeView === 'extensions') {
    return <MarketplaceCatalog />
  }

  if (activeView === 'settings') {
    return <SettingsView />
  }

  if (activeView === 'backlog') {
    return <BacklogWorkspace />
  }

  if (showSqlWorkspace) {
    return <SqlEditorWorkspace />
  }

  if (showSecurityWorkspace) {
    return <SecurityPanel />
  }

  if (openFiles.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-nova-bg">
        <div className="text-center flex flex-col items-center">
          <img src={logo} alt="Ezek" className="w-96 md:w-[450px] h-auto max-h-80 mx-auto mb-8 opacity-100 brightness-150 drop-shadow-lg object-contain" />
          <p className="text-nova-text-secondary mb-2">Abra um arquivo ou pasta para começar a editar</p>
          <div className="flex items-center gap-3 justify-center mb-8">
            <button
              onClick={handleSelectFolder}
              className="flex items-center gap-2 px-4 py-2 bg-nova-accent text-white rounded-md hover:bg-nova-accent-hover transition-colors"
            >
              <FolderOpen size={16} />
              Abrir Pasta
            </button>
            <a
              href="https://github.com/scripteros/ezek-editor"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-nova-bg-tertiary text-nova-text rounded-md border border-nova-border hover:bg-nova-hover transition-colors"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="opacity-80">
                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
              </svg>
              GitHub
            </a>
          </div>
          <div className="text-xs text-nova-text-muted mt-8 opacity-70">
            Desenvolvido por Ezequiel Oliveira
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-nova-bg">
      <div ref={tabsRef} className="h-tab bg-nova-bg-secondary flex items-center overflow-x-auto scrollbar-thin border-b border-nova-border">
        {openFiles.map(file => (
          <div
            key={file.id}
            onClick={() => {
              setActiveFile(file.id)
            }}
            className={`group flex items-center gap-1.5 px-3 h-full cursor-pointer text-tabs border-r border-nova-border whitespace-nowrap transition-colors ${
              file.id === activeFileId
                ? 'bg-nova-tab-active text-nova-text border-t-2 border-t-nova-accent'
                : 'bg-nova-tab-inactive text-nova-text-secondary hover:bg-nova-hover'
            }`}
          >
            {file.isDirty && (
              <span className="w-2 h-2 rounded-full bg-nova-text-muted flex-shrink-0" />
            )}
            <span className={file.id === activeFileId ? 'text-nova-text' : ''}>
              {file.fileName}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); closeFile(file.id) }}
              className="ml-1 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-nova-bg-tertiary transition-opacity"
            >
              <X size={12} />
            </button>
          </div>
        ))}
        <div className="ml-auto flex items-center gap-2 pr-4">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('ezek:open-sql-workspace'))}
            className="flex items-center gap-1.5 px-3 py-1 bg-nova-bg-tertiary text-nova-text-secondary rounded border border-nova-border hover:bg-nova-hover hover:text-nova-accent transition-colors text-xs font-medium"
            title="Alternar para folhas SQL"
          >
            <Database size={12} />
            SQL
          </button>
          {activeFile && activeFile.language === 'sql' && (
            <>
            {isExecuting ? (
              <button
                onClick={() => useSqlStore.getState().cancelQuery()}
                className="flex items-center gap-1.5 px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-500 rounded border border-red-500/30 transition-colors text-xs font-medium"
              >
                <Loader2 size={12} className="animate-spin" /> Cancelar Query
              </button>
            ) : (
              <button
                onClick={handleRunQuery}
                className="flex items-center gap-1.5 px-3 py-1 bg-nova-accent/20 hover:bg-nova-accent/30 text-nova-accent rounded border border-nova-accent/30 transition-colors text-xs font-medium"
              >
                <Play size={12} fill="currentColor" /> Executar (Ctrl+Enter)
              </button>
            )}
            </>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-hidden relative">
        {isLoadingFile && (
          <div className="absolute inset-0 bg-nova-bg/80 flex items-center justify-center z-30">
            <Loader2 size={16} className="animate-spin" />
          </div>
        )}
        
        <div className="absolute inset-0 z-10">
          {isDiffMode ? (
            <MonacoDiffEditor />
          ) : activeFile && (
            isImageFile(activeFile.fileName) ? (
              <ImageViewer filePath={activeFile.filePath} fileName={activeFile.fileName} />
            ) : (
              <MonacoEditor />
            )
          )}
        </div>
      </div>
    </div>
  )
}
