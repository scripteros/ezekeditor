import { create } from 'zustand'

export interface LogEntry {
  id: string
  type: 'info' | 'warn' | 'error' | 'debug'
  message: string
  timestamp: number
  source?: string
}

interface LogState {
  logs: LogEntry[]
  isVisible: boolean
  maxLogs: number
  addLog: (entry: Omit<LogEntry, 'id' | 'timestamp'>) => void
  clearLogs: () => void
  toggleVisibility: () => void
  setVisible: (visible: boolean) => void
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 11)
}

export const useLogStore = create<LogState>((set, get) => ({
  logs: [],
  isVisible: true,
  maxLogs: 500,

  addLog: (entry) => {
    const newEntry: LogEntry = {
      ...entry,
      id: generateId(),
      timestamp: Date.now(),
    }
    set(state => {
      const updated = [...state.logs, newEntry]
      if (updated.length > state.maxLogs) {
        return { logs: updated.slice(updated.length - state.maxLogs) }
      }
      return { logs: updated }
    })
  },

  clearLogs: () => set({ logs: [] }),
  toggleVisibility: () => set(state => ({ isVisible: !state.isVisible })),
  setVisible: (visible) => set({ isVisible: visible }),
}))
