import { useEffect, useState, useCallback } from 'react'
import { useExplorerStore } from '../../store/explorerStore'
import { useEditorStore } from '../../store/editorStore'
import FileTreeNode from './FileTreeNode'
import { Plus, File, FolderPlus, RefreshCw, FolderOpen } from 'lucide-react'
import type { FileNode } from '../../../../shared/types'
import { getApi } from '../../utils/platform'

export default function FileExplorer() {
  const { rootPath, rootFiles, loadDirectory, setRootPath, refreshFiles } = useExplorerStore()
  const { openFile } = useEditorStore()
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; path: string } | null>(null)
  const [promptDialog, setPromptDialog] = useState<{ type: 'file' | 'folder', parent: string } | null>(null)
  const [promptValue, setPromptValue] = useState('')
  const api = getApi()

  useEffect(() => {
    if (rootPath && api) {
      loadDirectory(rootPath)
      api.watchDirectory(rootPath)
      const cleanup = api.onFileChanged(() => {
        refreshFiles()
      })
      return () => {
        cleanup()
        if (rootPath) api.unwatchDirectory(rootPath)
      }
    }
  }, [rootPath, loadDirectory, refreshFiles])

  useEffect(() => {
    const handleClick = () => setContextMenu(null)
    window.addEventListener('click', handleClick)
    return () => window.removeEventListener('click', handleClick)
  }, [])

  const handleSelectFolder = async () => {
    const folder = api ? await api.selectFolder() : null
    if (folder) setRootPath(folder)
  }

  const handleFileClick = (node: FileNode) => {
    if (node.isDirectory) return
    openFile(node.path)
  }

  const handleContextMenu = (e: React.MouseEvent, path: string) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, path })
  }

  const handleCreateFile = async () => {
    if (!rootPath) return
    setPromptDialog({ type: 'file', parent: rootPath })
    setPromptValue('')
    setContextMenu(null)
  }

  const handleCreateFolder = async () => {
    if (!rootPath) return
    setPromptDialog({ type: 'folder', parent: rootPath })
    setPromptValue('')
    setContextMenu(null)
  }

  const handleRevealInExplorer = async () => {
    if (contextMenu?.path) {
      await api?.osShowItemInFolder(contextMenu.path)
    }
    setContextMenu(null)
  }

  if (!rootPath) {
    return (
      <div className="p-4">
        <button
          onClick={handleSelectFolder}
          className="flex items-center gap-2 px-3 py-1.5 bg-nova-accent text-white rounded text-xs hover:bg-nova-accent-hover transition-colors w-full justify-center"
        >
          <FolderPlus size={14} />
          Open Folder
        </button>
        <p className="text-xs text-nova-text-muted mt-3 text-center">
          Abra uma pasta para explorar arquivos
        </p>
      </div>
    )
  }

  return (
    <div className="text-explorer">
      <div className="flex items-center justify-between px-2 py-1">
        <button
          onClick={handleSelectFolder}
          className="flex items-center gap-1 text-xs text-nova-text-muted hover:text-nova-text transition-colors"
        >
          {rootPath.split(/[/\\]/).pop()}
        </button>
        <div className="flex items-center gap-0.5">
          <button
            onClick={handleCreateFile}
            className="p-1 rounded text-nova-text-muted hover:text-nova-text hover:bg-nova-hover transition-colors"
            title="Novo Arquivo"
          >
            <Plus size={14} />
          </button>
          <button
            onClick={handleCreateFolder}
            className="p-1 rounded text-nova-text-muted hover:text-nova-text hover:bg-nova-hover transition-colors"
            title="Nova Pasta"
          >
            <FolderPlus size={14} />
          </button>
          <button
            onClick={() => refreshFiles()}
            className="p-1 rounded text-nova-text-muted hover:text-nova-text hover:bg-nova-hover transition-colors"
            title="Atualizar"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>
      <div className="px-1">
        {rootFiles.map(node => (
          <FileTreeNode
            key={node.path}
            node={node}
            depth={0}
            onFileClick={handleFileClick}
            onContextMenu={handleContextMenu}
          />
        ))}
      </div>
      {contextMenu && (
        <div
          className="fixed bg-nova-bg-secondary border border-nova-border rounded shadow-lg py-1 z-50 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={handleCreateFile}
            className="w-full text-left px-3 py-1.5 text-xs text-nova-text hover:bg-nova-hover flex items-center gap-2"
          >
            <File size={12} /> Novo Arquivo
          </button>
          <button
            onClick={handleCreateFolder}
            className="w-full text-left px-3 py-1.5 text-xs text-nova-text hover:bg-nova-hover flex items-center gap-2"
            title="Nova Pasta"
          >
            <FolderPlus size={12} /> Nova Pasta
          </button>
          <div className="h-px bg-nova-border my-1" />
          <button
            onClick={handleRevealInExplorer}
            className="w-full text-left px-3 py-1.5 text-xs text-nova-text hover:bg-nova-hover flex items-center gap-2"
            title="Abrir pasta no sistema"
          >
            <FolderOpen size={12} /> Revelar no Explorador
          </button>
        </div>
      )}

      {promptDialog && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center">
          <div className="bg-nova-bg border border-nova-border rounded p-4 shadow-xl w-80">
            <h3 className="text-sm font-medium mb-3 text-nova-text">
              {promptDialog.type === 'file' ? 'Novo Arquivo' : 'Nova Pasta'}
            </h3>
            <input
              autoFocus
              className="w-full bg-nova-input-bg border border-nova-input-border text-nova-text text-sm px-2 py-1.5 outline-none rounded mb-4"
              value={promptValue}
              onChange={e => setPromptValue(e.target.value)}
              onKeyDown={async e => {
                if (e.key === 'Enter') {
                  if (promptValue) {
                    const path = `${promptDialog.parent}/${promptValue}`
                    if (promptDialog.type === 'file') {
                      await api?.createFile(path)
                    } else {
                      await api?.createDirectory(path)
                    }
                    refreshFiles()
                  }
                  setPromptDialog(null)
                }
                if (e.key === 'Escape') setPromptDialog(null)
              }}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setPromptDialog(null)} className="px-3 py-1 text-xs hover:bg-nova-hover text-nova-text rounded">Cancelar</button>
              <button 
                onClick={async () => {
                  if (promptValue) {
                    const path = `${promptDialog.parent}/${promptValue}`
                    if (promptDialog.type === 'file') await api?.createFile(path)
                    else await api?.createDirectory(path)
                    refreshFiles()
                  }
                  setPromptDialog(null)
                }}
                className="px-3 py-1 text-xs bg-nova-accent text-white rounded hover:bg-nova-accent-hover"
              >
                Criar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
