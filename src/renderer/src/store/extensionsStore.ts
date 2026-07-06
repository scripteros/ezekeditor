import { create } from 'zustand'

export interface AIExtension {
  id: string
  name: string
  url: string
  icon: string // lucide icon name or emoji
}

const defaultExtensions: AIExtension[] = [
  { id: 'kilo', name: 'Kilo AI', url: 'https://kilo.ai', icon: '⚖️' },
  { id: 'opencode', name: 'OpenCode', url: 'https://opencode.com', icon: '🔓' },
  { id: 'chatgpt', name: 'ChatGPT', url: 'https://chat.openai.com', icon: '🤖' },
  { id: 'claude', name: 'Claude', url: 'https://claude.ai', icon: '🧠' },
  { id: 'v0', name: 'v0 (Vercel)', url: 'https://v0.dev', icon: '⚡' }
]

interface ExtensionsState {
  installed: AIExtension[]
  activeExtensionId: string | null
  installExtension: (ext: AIExtension) => void
  uninstallExtension: (id: string) => void
  setActiveExtension: (id: string | null) => void
}

export const useExtensionsStore = create<ExtensionsState>((set) => ({
  installed: defaultExtensions,
  activeExtensionId: null,
  installExtension: (ext) => set((state) => ({ 
    installed: state.installed.find(e => e.id === ext.id) ? state.installed : [...state.installed, ext] 
  })),
  uninstallExtension: (id) => set((state) => ({ 
    installed: state.installed.filter(e => e.id !== id),
    activeExtensionId: state.activeExtensionId === id ? null : state.activeExtensionId
  })),
  setActiveExtension: (id) => set({ activeExtensionId: id }),
}))
