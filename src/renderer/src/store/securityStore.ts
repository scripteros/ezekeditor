import { create } from 'zustand'
import { getApi } from '../utils/platform'

export interface CapturedRequest {
  id: string
  method: string
  url: string
  headers: Record<string, string>
  body?: string
  timestamp: number
  status?: number
  responseHeaders?: Record<string, string>
  responseBody?: string
  durationMs?: number
}

interface SecurityState {
  isProxyRunning: boolean
  proxyPort: number
  capturedRequests: CapturedRequest[]
  selectedRequestId: string | null
  isAutoAnalyzeEnabled: boolean
  
  startProxy: (port?: number) => Promise<boolean>
  stopProxy: () => Promise<boolean>
  clearRequests: () => void
  addCapturedRequest: (req: CapturedRequest) => void
  updateCapturedRequest: (id: string, updates: Partial<CapturedRequest>) => void
  setSelectedRequest: (id: string | null) => void
  toggleAutoAnalyze: () => void
}

export const useSecurityStore = create<SecurityState>((set, get) => ({
  isProxyRunning: false,
  proxyPort: 8080,
  capturedRequests: [],
  selectedRequestId: null,
  isAutoAnalyzeEnabled: false,

  startProxy: async (port = 8080) => {
    const api = getApi()
    if (!api) return false
    try {
      const success = await api.securityStartProxy(port)
      if (success) {
        set({ isProxyRunning: true, proxyPort: port })
        return true
      }
      return false
    } catch (err) {
      console.error(err)
      return false
    }
  },

  stopProxy: async () => {
    const api = getApi()
    if (!api) return false
    try {
      await api.securityStopProxy()
      set({ isProxyRunning: false })
      return true
    } catch (err) {
      console.error(err)
      return false
    }
  },

  clearRequests: () => set({ capturedRequests: [], selectedRequestId: null }),
  
  addCapturedRequest: (req) => set((state) => ({ 
    capturedRequests: [req, ...state.capturedRequests].slice(0, 1000) // Keep last 1000
  })),

  updateCapturedRequest: (id, updates) => set((state) => ({
    capturedRequests: state.capturedRequests.map(r => r.id === id ? { ...r, ...updates } : r)
  })),

  setSelectedRequest: (id) => set({ selectedRequestId: id }),
  
  toggleAutoAnalyze: () => set(state => ({ isAutoAnalyzeEnabled: !state.isAutoAnalyzeEnabled }))
}))
