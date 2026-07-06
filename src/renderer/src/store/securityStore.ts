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
  resourceType?: string
  protocol?: string
  fromCache?: boolean
  ip?: string
  error?: string
  replayResult?: ReplayResult
}

export interface BrowserEvent {
  id: string
  type: string
  timestamp: number
  [key: string]: any
}

export interface SecurityCookie {
  name: string
  value: string
  domain: string
  path: string
  secure: boolean
  httpOnly: boolean
  sameSite?: string
  session?: boolean
  expirationDate?: number
}

export interface ReplayResult {
  status: number
  headers: Record<string, string>
  body: string
  durationMs: number
}

interface SecurityState {
  isProxyRunning: boolean
  isMonitoring: boolean
  isMitmRunning: boolean
  proxyPort: number
  mitmPort: number
  mitmCaPath: string | null
  browserPartition: string
  capturedRequests: CapturedRequest[]
  browserEvents: BrowserEvent[]
  selectedRequestId: string | null
  isAutoAnalyzeEnabled: boolean
  
  startProxy: (port?: number) => Promise<boolean>
  stopProxy: () => Promise<boolean>
  startMonitoring: () => Promise<string | null>
  stopMonitoring: () => Promise<boolean>
  addBrowserEvent: (event: BrowserEvent) => void
  getCookies: (url?: string) => Promise<SecurityCookie[]>
  clearBrowserData: () => Promise<boolean>
  replayRequest: (request: { method: string; url: string; headers?: Record<string, string>; body?: string }) => Promise<ReplayResult | null>
  startMitm: (port?: number) => Promise<boolean>
  stopMitm: () => Promise<boolean>
  openCaCert: () => Promise<string | null>
  clearRequests: () => void
  addCapturedRequest: (req: CapturedRequest) => void
  updateCapturedRequest: (id: string, updates: Partial<CapturedRequest>) => void
  setSelectedRequest: (id: string | null) => void
  toggleAutoAnalyze: () => void
}

export const useSecurityStore = create<SecurityState>((set, get) => ({
  isProxyRunning: false,
  isMonitoring: false,
  isMitmRunning: false,
  proxyPort: 8080,
  mitmPort: 8899,
  mitmCaPath: null,
  browserPartition: 'persist:ezek-security-browser',
  capturedRequests: [],
  browserEvents: [],
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

  startMonitoring: async () => {
    const api = getApi()
    if (!api) return null
    try {
      const result = await api.securityStartMonitoring()
      if (result.ok) {
        set({ isMonitoring: true, browserPartition: result.partition })
        return result.partition
      }
      return null
    } catch (err) {
      console.error(err)
      return null
    }
  },

  stopMonitoring: async () => {
    const api = getApi()
    if (!api) return false
    try {
      await api.securityStopMonitoring()
      set({ isMonitoring: false })
      return true
    } catch (err) {
      console.error(err)
      return false
    }
  },

  addBrowserEvent: (event) => set((state) => ({
    browserEvents: [event, ...state.browserEvents].slice(0, 500)
  })),

  getCookies: async (url?: string) => {
    const api = getApi()
    if (!api) return []
    return api.securityGetCookies(url)
  },

  clearBrowserData: async () => {
    const api = getApi()
    if (!api) return false
    const success = await api.securityClearBrowserData()
    if (success) {
      set({ browserEvents: [] })
    }
    return success
  },

  replayRequest: async (request) => {
    const api = getApi()
    if (!api) return null
    try {
      return await api.securityReplayRequest(request)
    } catch (err) {
      console.error(err)
      return null
    }
  },

  startMitm: async (port = 8899) => {
    const api = getApi()
    if (!api) return false
    try {
      const result = await api.securityStartMitm(port)
      if (result.ok) {
        set({
          isMitmRunning: true,
          mitmPort: result.port,
          mitmCaPath: result.caPath,
          isMonitoring: true,
        })
        return true
      }
      return false
    } catch (err) {
      console.error(err)
      return false
    }
  },

  stopMitm: async () => {
    const api = getApi()
    if (!api) return false
    try {
      await api.securityStopMitm()
      set({ isMitmRunning: false })
      return true
    } catch (err) {
      console.error(err)
      return false
    }
  },

  openCaCert: async () => {
    const api = getApi()
    if (!api) return null
    return api.securityOpenCaCert()
  },

  clearRequests: () => set({ capturedRequests: [], browserEvents: [], selectedRequestId: null }),
  
  addCapturedRequest: (req) => set((state) => ({ 
    capturedRequests: [
      { ...state.capturedRequests.find(r => r.id === req.id), ...req },
      ...state.capturedRequests.filter(r => r.id !== req.id)
    ].slice(0, 1000)
  })),

  updateCapturedRequest: (id, updates) => set((state) => ({
    capturedRequests: state.capturedRequests.map(r => r.id === id ? { ...r, ...updates } : r)
  })),

  setSelectedRequest: (id) => set({ selectedRequestId: id }),
  
  toggleAutoAnalyze: () => set(state => ({ isAutoAnalyzeEnabled: !state.isAutoAnalyzeEnabled }))
}))
