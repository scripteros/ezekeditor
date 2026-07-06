import { create } from 'zustand'

export interface WinProcess {
  pid: number
  name: string
  windowTitle: string
  mainWindowHandle: number
  executablePath: string
  memoryMB: number
  cpuTime: string
  threadCount: number
}

export interface WinWindow {
  handle: number
  title: string
  className: string
  processId: number
  processName: string
  rect: { left: number; top: number; right: number; bottom: number }
  isVisible: boolean
}

interface WinProcState {
  processes: WinProcess[]
  windows: WinWindow[]
  selectedPid: number | null
  selectedWindowHandle: number | null
  memoryStrings: string[]
  memoryDumpLoading: boolean
  memoryHex: string
  uiTree: string[]
  isLoading: boolean
  error: string | null

  refreshProcesses: () => Promise<void>
  refreshWindows: () => Promise<void>
  dumpMemory: (pid: number) => Promise<void>
  readMemoryRegion: (pid: number, address?: string, size?: number) => Promise<void>
  getUITree: (handle: number) => Promise<void>
  setSelectedPid: (pid: number | null) => void
  setSelectedWindowHandle: (handle: number | null) => void
  clearResults: () => void
}

function getApi() {
  return (window as any).api
}

export const useWinProcStore = create<WinProcState>()((set, get) => ({
  processes: [],
  windows: [],
  selectedPid: null,
  selectedWindowHandle: null,
  memoryStrings: [],
  memoryDumpLoading: false,
  memoryHex: '',
  uiTree: [],
  isLoading: false,
  error: null,

  refreshProcesses: async () => {
    const api = getApi()
    if (!api?.winprocListProcesses) return
    set({ isLoading: true, error: null })
    try {
      const result = await api.winprocListProcesses()
      if (result.success) {
        const procs = (result.data || []).map((p: any) => ({
          pid: p.PID,
          name: p.Name,
          windowTitle: p.WindowTitle || '',
          mainWindowHandle: p.MainWindowHandle || 0,
          executablePath: p.Path || '',
          memoryMB: p.MemoryMB || 0,
          cpuTime: p.CPU || '',
          threadCount: p.Threads || 0,
        }))
        set({ processes: procs, isLoading: false })
      } else {
        set({ error: result.error || 'Failed', isLoading: false })
      }
    } catch (err: any) {
      set({ error: err.message, isLoading: false })
    }
  },

  refreshWindows: async () => {
    const api = getApi()
    if (!api?.winprocListWindows) return
    set({ isLoading: true, error: null })
    try {
      const result = await api.winprocListWindows()
      if (result.success) {
        set({ windows: result.data || [], isLoading: false })
      } else {
        set({ error: result.error || 'Failed', isLoading: false })
      }
    } catch (err: any) {
      set({ error: err.message, isLoading: false })
    }
  },

  dumpMemory: async (pid: number) => {
    const api = getApi()
    if (!api?.winprocDumpMemoryStrings) return
    set({ memoryDumpLoading: true, memoryStrings: [], selectedPid: pid })
    try {
      const result = await api.winprocDumpMemoryStrings(pid)
      if (result.success) {
        set({ memoryStrings: result.strings || [], memoryDumpLoading: false })
      } else {
        set({ error: result.error || 'Failed', memoryDumpLoading: false })
      }
    } catch (err: any) {
      set({ error: err.message, memoryDumpLoading: false })
    }
  },

  readMemoryRegion: async (pid: number, address?: string, size?: number) => {
    const api = getApi()
    if (!api?.winprocReadProcessMemory) return
    set({ memoryDumpLoading: true })
    try {
      const result = await api.winprocReadProcessMemory(pid, address, size)
      if (result.success) {
        set({ memoryHex: result.hex || '', memoryDumpLoading: false })
      } else {
        set({ error: result.error || 'Failed', memoryDumpLoading: false })
      }
    } catch (err: any) {
      set({ error: err.message, memoryDumpLoading: false })
    }
  },

  getUITree: async (handle: number) => {
    const api = getApi()
    if (!api?.winprocGetUITree) return
    set({ selectedWindowHandle: handle, isLoading: true })
    try {
      const result = await api.winprocGetUITree(handle)
      if (result.success) {
        set({ uiTree: result.uiTree || [], isLoading: false })
      } else {
        set({ error: result.error || 'Failed', isLoading: false })
      }
    } catch (err: any) {
      set({ error: err.message, isLoading: false })
    }
  },

  setSelectedPid: (pid) => set({ selectedPid: pid }),
  setSelectedWindowHandle: (handle) => set({ selectedWindowHandle: handle }),

  clearResults: () => set({ memoryStrings: [], memoryHex: '', uiTree: [], error: null }),
}))
