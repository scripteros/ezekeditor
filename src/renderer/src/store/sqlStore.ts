import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DbConfig, SqlQueryResult } from '../../../shared/types/sql'

interface SqlState {
  connections: DbConfig[]
  activeConnectionId: string | null
  queryResults: { [connId: string]: SqlQueryResult }
  isExecuting: boolean
  
  addConnection: (config: DbConfig) => void
  updateConnection: (id: string, config: Partial<DbConfig>) => void
  removeConnection: (id: string) => void
  setActiveConnection: (id: string | null) => void
  testConnection: (config: DbConfig) => Promise<{ success: boolean; error?: string }>
  executeQuery: (query: string) => Promise<void>
  cancelQuery: () => Promise<void>
  clearResults: (connId: string) => void
}

export const useSqlStore = create<SqlState>()(
  persist(
    (set, get) => ({
      connections: [],
      activeConnectionId: null,
      queryResults: {},
      isExecuting: false,

      addConnection: (config) => set((state) => ({
        connections: [...state.connections, config],
        activeConnectionId: state.activeConnectionId || config.id
      })),

      updateConnection: (id, config) => set((state) => ({
        connections: state.connections.map(c => c.id === id ? { ...c, ...config } : c)
      })),

      removeConnection: (id) => set((state) => {
        const newConnections = state.connections.filter(c => c.id !== id)
        return {
          connections: newConnections,
          activeConnectionId: state.activeConnectionId === id 
            ? (newConnections[0]?.id || null) 
            : state.activeConnectionId
        }
      }),

      setActiveConnection: (id) => set({ activeConnectionId: id }),

      testConnection: async (config) => {
        const api = (window as any).api
        if (!api) return { success: false, error: 'API not available' }
        return await api.sqlTestConnection(config)
      },

      executeQuery: async (query) => {
        const { activeConnectionId, connections } = get()
        if (!activeConnectionId) return

        const activeConn = connections.find(c => c.id === activeConnectionId)
        if (!activeConn) return

        const api = (window as any).api
        if (!api) return

        set({ isExecuting: true })
        try {
          const result = await api.sqlExecuteQuery(activeConn, query)
          set((state) => ({
            queryResults: {
              ...state.queryResults,
              [activeConnectionId]: { ...result, query }
            }
          }))
        } catch (error: any) {
          set((state) => ({
            queryResults: {
              ...state.queryResults,
              [activeConnectionId]: { success: false, error: error.message || String(error), query }
            }
          }))
        } finally {
          set({ isExecuting: false })
        }
      },
      
      cancelQuery: async () => {
        const { activeConnectionId, connections } = get()
        if (!activeConnectionId) return

        const activeConn = connections.find(c => c.id === activeConnectionId)
        if (!activeConn) return

        const api = (window as any).api
        if (!api) return

        try {
          await api.sqlCancelQuery(activeConn)
        } catch (err) {
          console.error('Failed to cancel query', err)
        }
      },
      
      clearResults: (connId) => set((state) => {
        const newResults = { ...state.queryResults }
        delete newResults[connId]
        return { queryResults: newResults }
      })
    }),
    {
      name: 'sql-storage',
      partialize: (state) => ({
        connections: state.connections,
        activeConnectionId: state.activeConnectionId
      })
    }
  )
)
