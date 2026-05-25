import { create } from 'zustand'
import type { TerminalInstance } from '../../../shared/types'
import { getApi } from '../utils/platform'

interface TerminalState {
  terminals: TerminalInstance[]
  activeTerminalId: string | null
  terminalError: string | null
  
  addTerminal: (terminal: TerminalInstance) => void
  setActiveTerminal: (id: string) => void
  removeTerminal: (id: string) => void
  killTerminal: (id: string) => Promise<void>
  createNewTerminal: () => Promise<void>
  clearError: () => void
}

export const useTerminalStore = create<TerminalState>((set, get) => ({
  terminals: [],
  activeTerminalId: null,
  terminalError: null,

  addTerminal: (terminal) => {
    set(state => ({
      terminals: [...state.terminals, terminal],
      activeTerminalId: terminal.id,
      terminalError: null,
    }))
  },

  setActiveTerminal: (id) => {
    set({ activeTerminalId: id })
  },

  removeTerminal: (id) => {
    set(state => {
      const remaining = state.terminals.filter(t => t.id !== id)
      let newActive = state.activeTerminalId
      if (state.activeTerminalId === id) {
        newActive = remaining[remaining.length - 1]?.id || null
      }
      return { terminals: remaining, activeTerminalId: newActive }
    })
  },

  killTerminal: async (id) => {
    const api = getApi()
    if (api) {
      await api.killTerminal(id)
    }
    get().removeTerminal(id)
  },

  createNewTerminal: async () => {
    const api = getApi()
    if (!api) {
      set({ terminalError: 'Terminal requer ambiente Electron' })
      return
    }
    try {
      const id = await api.createTerminal()
      if (!id) {
        set({ terminalError: 'Falha ao criar processo do terminal' })
        return
      }
      const terminal: TerminalInstance = {
        id,
        name: `Terminal ${get().terminals.length + 1}`,
        shell: 'default',
        cwd: '.',
      }
      get().addTerminal(terminal)
    } catch (err) {
      set({ terminalError: `Erro no terminal: ${err instanceof Error ? err.message : 'Erro desconhecido'}` })
      console.error('Error creating terminal:', err)
    }
  },

  clearError: () => set({ terminalError: null }),
}))
