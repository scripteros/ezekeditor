import { create } from 'zustand'
import type { OpenTab } from '../../../shared/types'
import { LANGUAGE_MAP } from '../../../shared/constants'
import { getApi } from '../utils/platform'

interface EditorState {
  openFiles: OpenTab[]
  activeFileId: string | null
  fileContents: Record<string, string>
  isLoadingFile: boolean
  
  openFile: (filePath: string) => Promise<void>
  closeFile: (fileId: string) => void
  setActiveFile: (fileId: string) => void
  updateFileContent: (fileId: string, content: string) => void
  saveFile: (fileId: string) => Promise<void>
  getActiveFile: () => OpenTab | null
  
  isDiffMode: boolean
  diffOriginalContent: string
  diffModifiedContent: string
  diffFilePath: string
  openDiff: (filePath: string, original: string, modified: string) => void
  closeDiff: () => void
  acceptDiff: () => Promise<void>
  
  autoSave: boolean
  toggleAutoSave: () => void
  
  selectedText: string
  setSelectedText: (text: string) => void
}

function getLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || ''
  return LANGUAGE_MAP[ext] || 'plaintext'
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 11)
}

const contentCache = new Map<string, { content: string; timestamp: number }>()
const CACHE_TTL = 30000

let autoSaveTimeout: Record<string, NodeJS.Timeout> = {}

export const useEditorStore = create<EditorState>((set, get) => ({
  openFiles: [],
  activeFileId: null,
  fileContents: {},
  isLoadingFile: false,
  isDiffMode: false,
  diffOriginalContent: '',
  diffModifiedContent: '',
  diffFilePath: '',
  autoSave: false,
  selectedText: '',

  toggleAutoSave: () => {
    set(state => ({ autoSave: !state.autoSave }))
  },
  
  setSelectedText: (text) => set({ selectedText: text }),

  openFile: async (filePath) => {
    const api = getApi()
    if (!api) return

    const existing = get().openFiles.find(f => f.filePath === filePath)
    if (existing) {
      set({ activeFileId: existing.id })
      return
    }

    set({ isLoadingFile: true })

    try {
      let content: string

      const cached = contentCache.get(filePath)
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        content = cached.content
      } else {
        content = await api.readFile(filePath)
        contentCache.set(filePath, { content, timestamp: Date.now() })
      }

      const fileName = filePath.split(/[/\\]/).pop() || filePath
      const id = generateId()
      const newTab: OpenTab = {
        id,
        filePath,
        fileName,
        isDirty: false,
        content,
        language: getLanguage(filePath),
      }

      set(state => ({
        openFiles: [...state.openFiles, newTab],
        activeFileId: id,
        fileContents: { ...state.fileContents, [id]: content },
        isLoadingFile: false,
      }))
    } catch (err) {
      set({ isLoadingFile: false })
      console.error('Error opening file:', err)
    }
  },

  closeFile: (fileId) => {
    set(state => {
      const remaining = state.openFiles.filter(f => f.id !== fileId)
      const { [fileId]: _, ...restContents } = state.fileContents
      let newActive = state.activeFileId
      if (state.activeFileId === fileId) {
        const idx = state.openFiles.findIndex(f => f.id === fileId)
        newActive = remaining[Math.min(idx, remaining.length - 1)]?.id || null
      }
      return {
        openFiles: remaining,
        activeFileId: newActive,
        fileContents: restContents,
      }
    })
  },

  setActiveFile: (fileId) => {
    set({ activeFileId: fileId })
  },

  updateFileContent: (fileId, content) => {
    set(state => ({
      fileContents: { ...state.fileContents, [fileId]: content },
      openFiles: state.openFiles.map(f =>
        f.id === fileId ? { ...f, content, isDirty: true } : f
      ),
    }))

    const state = get()
    if (state.autoSave) {
      if (autoSaveTimeout[fileId]) clearTimeout(autoSaveTimeout[fileId])
      autoSaveTimeout[fileId] = setTimeout(() => {
        state.saveFile(fileId)
      }, 1000)
    }
  },

  saveFile: async (fileId) => {
    const api = getApi()
    if (!api) return
    const file = get().openFiles.find(f => f.id === fileId)
    if (!file) return

    try {
      await api.writeFile(file.filePath, file.content)
      contentCache.set(file.filePath, { content: file.content, timestamp: Date.now() })
      set(state => ({
        openFiles: state.openFiles.map(f =>
          f.id === fileId ? { ...f, isDirty: false } : f
        ),
      }))
    } catch (err) {
      console.error('Error saving file:', err)
    }
  },

  getActiveFile: () => {
    const { openFiles, activeFileId } = get()
    return openFiles.find(f => f.id === activeFileId) || null
  },

  openDiff: (filePath, original, modified) => {
    set({
      isDiffMode: true,
      diffFilePath: filePath,
      diffOriginalContent: original,
      diffModifiedContent: modified,
    })
  },

  closeDiff: () => {
    set({
      isDiffMode: false,
      diffFilePath: '',
      diffOriginalContent: '',
      diffModifiedContent: '',
    })
  },

  acceptDiff: async () => {
    const { diffFilePath, diffModifiedContent } = get()
    if (!diffFilePath) return
    const api = getApi()
    if (api) {
      await api.writeFile(diffFilePath, diffModifiedContent)
      contentCache.set(diffFilePath, { content: diffModifiedContent, timestamp: Date.now() })
      
      // Update any open tabs if they match
      const fileId = get().openFiles.find(f => f.filePath === diffFilePath)?.id
      if (fileId) {
        get().updateFileContent(fileId, diffModifiedContent)
        set(state => ({
          openFiles: state.openFiles.map(f => f.id === fileId ? { ...f, isDirty: false } : f)
        }))
      }
    }
    get().closeDiff()
  }
}))
