import { create } from 'zustand'
import type { FileNode } from '../../../shared/types'
import { getApi } from '../utils/platform'

interface ExplorerState {
  rootPath: string | null
  rootFiles: FileNode[]
  expandedPaths: Set<string>
  selectedPath: string | null
  isLoading: boolean
  error: string | null
  setRootPath: (path: string | null) => void
  loadDirectory: (dirPath: string) => Promise<void>
  toggleExpand: (dirPath: string) => void
  selectFile: (filePath: string) => void
  refreshFiles: () => Promise<void>
  createNewFile: (parentPath: string) => Promise<void>
  createNewFolder: (parentPath: string) => Promise<void>
  deleteEntry: (filePath: string) => Promise<void>
  renameEntry: (oldPath: string, newPath: string) => Promise<void>
}

export const useExplorerStore = create<ExplorerState>((set, get) => ({
  rootPath: null,
  rootFiles: [],
  expandedPaths: new Set(),
  selectedPath: null,
  isLoading: false,
  error: null,

  setRootPath: (path) => {
    set({ rootPath: path })
    if (path) get().loadDirectory(path)
  },

  loadDirectory: async (dirPath) => {
    const api = getApi()
    if (!api) return
    set({ isLoading: true, error: null })
    try {
      const files = await api.readDirectory(dirPath)
      set({ rootFiles: files, isLoading: false })
    } catch (err) {
      set({ isLoading: false, error: 'Falha ao carregar diretório' })
    }
  },

  toggleExpand: (dirPath) => {
    const expanded = new Set(get().expandedPaths)
    if (expanded.has(dirPath)) {
      expanded.delete(dirPath)
    } else {
      expanded.add(dirPath)
    }
    set({ expandedPaths: expanded })
  },

  selectFile: (filePath) => {
    set({ selectedPath: filePath })
  },

  refreshFiles: async () => {
    const { rootPath } = get()
    if (rootPath) await get().loadDirectory(rootPath)
  },

  createNewFile: async (parentPath) => {
    const api = getApi()
    if (!api) return
    const name = prompt('Nome do arquivo:')
    if (!name) return
    const filePath = `${parentPath}/${name}`
    await api.createFile(filePath)
    await get().refreshFiles()
  },

  createNewFolder: async (parentPath) => {
    const api = getApi()
    if (!api) return
    const name = prompt('Nome da pasta:')
    if (!name) return
    const dirPath = `${parentPath}/${name}`
    await api.createDirectory(dirPath)
    await get().refreshFiles()
  },

  deleteEntry: async (filePath) => {
    const api = getApi()
    if (!api) return
    if (!confirm('Tem certeza que deseja deletar?')) return
    await api.deleteFile(filePath)
    await get().refreshFiles()
  },

  renameEntry: async (oldPath, newPath) => {
    const api = getApi()
    if (!api) return
    await api.renameFile(oldPath, newPath)
    await get().refreshFiles()
  },
}))
