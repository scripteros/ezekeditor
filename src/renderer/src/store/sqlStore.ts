import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DbConfig, RedisServerConfig, SqlQueryResult } from '../../../shared/types/sql'
import { useAuthStore } from './authStore'

export interface SqlEditorTab {
  id: string
  title: string
  query: string
  isDirty?: boolean
  createdAt: number
  updatedAt: number
}

export type SqlEditorLayout = 'split' | 'editor' | 'results'
export type SqlResultView = 'table' | 'json' | 'text'
export type SqlSurfaceTheme = 'dark' | 'light'

interface SqlState {
  connections: DbConfig[]
  redisServers: RedisServerConfig[]
  activeConnectionId: string | null
  activeRedisServerId: string | null
  queryResults: { [connId: string]: SqlQueryResult }
  tabResults: { [tabId: string]: SqlQueryResult }
  sqlTabs: SqlEditorTab[]
  activeSqlTabId: string | null
  editorLayout: SqlEditorLayout
  resultView: SqlResultView
  sqlEditorTheme: SqlSurfaceTheme
  sqlResultTheme: SqlSurfaceTheme
  isExecuting: boolean
  showSqlWorkspace: boolean
  
  addConnection: (config: DbConfig) => void
  updateConnection: (id: string, config: Partial<DbConfig>) => void
  removeConnection: (id: string) => void
  setActiveConnection: (id: string | null) => void
  testConnection: (config: DbConfig) => Promise<{ success: boolean; error?: string }>
  addRedisServer: (config: RedisServerConfig) => void
  updateRedisServer: (id: string, config: Partial<RedisServerConfig>) => void
  removeRedisServer: (id: string) => void
  setActiveRedisServer: (id: string | null) => void
  testRedisConnection: (config: RedisServerConfig | DbConfig) => Promise<{ success: boolean; error?: string }>
  executeQuery: (query: string, tabId?: string) => Promise<SqlQueryResult | void>
  cancelQuery: () => Promise<void>
  clearResults: (connId: string) => void
  clearTabResult: (tabId: string) => void
  createSqlTab: (query?: string) => string
  updateSqlTab: (id: string, changes: Partial<Pick<SqlEditorTab, 'title' | 'query' | 'isDirty'>>) => void
  closeSqlTab: (id: string) => void
  setActiveSqlTab: (id: string) => void
  setEditorLayout: (layout: SqlEditorLayout) => void
  setResultView: (view: SqlResultView) => void
  setSqlEditorTheme: (theme: SqlSurfaceTheme) => void
  setSqlResultTheme: (theme: SqlSurfaceTheme) => void
  setShowSqlWorkspace: (show: boolean) => void
  
  // MySQL sync
  syncToServer: () => Promise<void>
  loadFromServer: () => Promise<void>
}

const createTab = (index: number, query = ''): SqlEditorTab => {
  const now = Date.now()
  return {
    id: `sql-tab-${now}-${Math.random().toString(36).slice(2, 7)}`,
    title: `Consulta ${index}`,
    query,
    isDirty: Boolean(query),
    createdAt: now,
    updatedAt: now,
  }
}

const withActiveRedis = (connection: DbConfig, redis?: RedisServerConfig | null): DbConfig => {
  if (!redis) return connection
  return {
    ...connection,
    redisEnabled: true,
    redisMode: redis.redisMode,
    redisUrl: redis.redisUrl,
    redisHost: redis.redisHost,
    redisPort: redis.redisPort,
    redisUsername: redis.redisUsername,
    redisPassword: redis.redisPassword,
    redisDatabase: redis.redisDatabase,
    redisTls: redis.redisTls,
  }
}

// Lazy auth getter — avoids circular dependency if authStore imports sqlStore
function getAuthUser(): { id: number } | null {
  try {
    const stores = (window as any).__zustandStores
    if (stores?.auth) {
      return stores.auth.getState().user
    }
  } catch {}
  return null
}

// Debounced sync to MySQL after connection/redis mutations
let dbSyncTimer: any = null
function scheduleSyncDbConfigs() {
  if (dbSyncTimer) clearTimeout(dbSyncTimer)
  dbSyncTimer = setTimeout(() => {
    try {
      useSqlStore.getState().syncToServer()
    } catch {}
  }, 2000)
}

export const useSqlStore = create(
  persist<SqlState>(
    (set, get) => ({
      connections: [],
      redisServers: [],
      activeConnectionId: null,
      activeRedisServerId: null,
      queryResults: {},
      tabResults: {},
      sqlTabs: [createTab(1)],
      activeSqlTabId: null,
      editorLayout: 'split',
      resultView: 'table',
      sqlEditorTheme: 'dark',
      sqlResultTheme: 'dark',
      isExecuting: false,
      showSqlWorkspace: false,

      addConnection: (config) => {
        set((state) => ({
          connections: [...state.connections, config],
          activeConnectionId: state.activeConnectionId || config.id
        }))
        scheduleSyncDbConfigs()
      },

      updateConnection: (id, config) => {
        set((state) => ({
          connections: state.connections.map(c => c.id === id ? { ...c, ...config } : c)
        }))
        scheduleSyncDbConfigs()
      },

      removeConnection: (id) => {
        set((state) => {
          const newConnections = state.connections.filter(c => c.id !== id)
          return {
            connections: newConnections,
            activeConnectionId: state.activeConnectionId === id 
              ? (newConnections[0]?.id || null) 
              : state.activeConnectionId
          }
        })
        scheduleSyncDbConfigs()
      },

      setActiveConnection: (id) => set({ activeConnectionId: id }),

      addRedisServer: (config) => {
        set((state) => ({
          redisServers: [...state.redisServers, config],
          activeRedisServerId: state.activeRedisServerId || config.id
        }))
        scheduleSyncDbConfigs()
      },

      updateRedisServer: (id, config) => {
        set((state) => ({
          redisServers: state.redisServers.map(server => server.id === id ? { ...server, ...config } : server)
        }))
        scheduleSyncDbConfigs()
      },

      removeRedisServer: (id) => {
        set((state) => {
          const redisServers = state.redisServers.filter(server => server.id !== id)
          return {
            redisServers,
            activeRedisServerId: state.activeRedisServerId === id ? (redisServers[0]?.id || null) : state.activeRedisServerId
          }
        })
        scheduleSyncDbConfigs()
      },

      setActiveRedisServer: (id) => set({ activeRedisServerId: id }),

      testConnection: async (config) => {
        const api = (window as any).api
        if (!api) return { success: false, error: 'API not available' }
        return await api.sqlTestConnection(config)
      },

      testRedisConnection: async (config) => {
        const api = (window as any).api
        if (!api) return { success: false, error: 'API not available' }
        return await api.sqlTestRedisConnection(config)
      },

      executeQuery: async (query, tabId) => {
        const { activeConnectionId, activeRedisServerId, connections, redisServers } = get()
        if (!activeConnectionId) return

        const activeConn = connections.find(c => c.id === activeConnectionId)
        if (!activeConn) return
        const activeRedis = redisServers.find(server => server.id === activeRedisServerId)
        const connectionWithRedis = withActiveRedis(activeConn, activeRedis)

        const api = (window as any).api
        if (!api) return

        set({ isExecuting: true })
        try {
          const authUser = useAuthStore.getState().user
          const userId = authUser ? String(authUser.id) : undefined
          const result = await api.sqlExecuteQuery(connectionWithRedis, query, userId)
          set((state) => ({
            queryResults: {
              ...state.queryResults,
              [activeConnectionId]: { ...result, query }
            },
            tabResults: tabId ? {
              ...state.tabResults,
              [tabId]: { ...result, query }
            } : state.tabResults
          }))
          return { ...result, query }
        } catch (error: any) {
          const result = { success: false, error: error.message || String(error), query }
          set((state) => ({
            queryResults: {
              ...state.queryResults,
              [activeConnectionId]: result
            },
            tabResults: tabId ? {
              ...state.tabResults,
              [tabId]: result
            } : state.tabResults
          }))
          return result
        } finally {
          set({ isExecuting: false })
        }
      },
      
      cancelQuery: async () => {
        const { activeConnectionId, activeRedisServerId, connections, redisServers } = get()
        if (!activeConnectionId) return

        const activeConn = connections.find(c => c.id === activeConnectionId)
        if (!activeConn) return
        const activeRedis = redisServers.find(server => server.id === activeRedisServerId)
        const connectionWithRedis = withActiveRedis(activeConn, activeRedis)

        const api = (window as any).api
        if (!api) return

        try {
          await api.sqlCancelQuery(connectionWithRedis)
        } catch (err) {
          console.error('Failed to cancel query', err)
        }
      },
      
      clearResults: (connId) => set((state) => {
        const newResults = { ...state.queryResults }
        delete newResults[connId]
        return { queryResults: newResults }
      }),

      clearTabResult: (tabId) => set((state) => {
        const nextResults = { ...state.tabResults }
        delete nextResults[tabId]
        return { tabResults: nextResults }
      }),

      createSqlTab: (query = '') => {
        const id = createTab(get().sqlTabs.length + 1, query).id
        set((state) => {
          const tab = createTab(state.sqlTabs.length + 1, query)
          tab.id = id
          return {
            sqlTabs: [...state.sqlTabs, tab],
            activeSqlTabId: id
          }
        })
        return id
      },

      updateSqlTab: (id, changes) => set((state) => ({
        sqlTabs: state.sqlTabs.map(tab => tab.id === id ? {
          ...tab,
          ...changes,
          updatedAt: Date.now(),
          isDirty: changes.isDirty ?? (changes.query !== undefined ? true : tab.isDirty)
        } : tab)
      })),

      closeSqlTab: (id) => set((state) => {
        const remaining = state.sqlTabs.filter(tab => tab.id !== id)
        const nextTabs = remaining.length > 0 ? remaining : [createTab(1)]
        const currentIndex = state.sqlTabs.findIndex(tab => tab.id === id)
        const fallbackTab = nextTabs[Math.max(0, Math.min(currentIndex, nextTabs.length - 1))]
        const nextResults = { ...state.tabResults }
        delete nextResults[id]

        return {
          sqlTabs: nextTabs,
          activeSqlTabId: state.activeSqlTabId === id ? fallbackTab.id : state.activeSqlTabId,
          tabResults: nextResults
        }
      }),

      setActiveSqlTab: (id) => set({ activeSqlTabId: id }),
      setEditorLayout: (layout) => set({ editorLayout: layout }),
      setResultView: (view) => set({ resultView: view }),
      setSqlEditorTheme: (theme) => set({ sqlEditorTheme: theme }),
      setSqlResultTheme: (theme) => set({ sqlResultTheme: theme }),
      setShowSqlWorkspace: (show) => set({ showSqlWorkspace: show }),

      // ─── MySQL Sync ─────────────────────────────
      syncToServer: async () => {
        const user = getAuthUser()
        if (!user) return
        const { connections, redisServers, activeConnectionId, activeRedisServerId } = get()
        const api = (window as any).api
        if (!api || !api.userSaveConfig) return
        await api.userSaveConfig(user.id, 'db_connections', connections)
        await api.userSaveConfig(user.id, 'db_redis_servers', redisServers)
        await api.userSaveConfig(user.id, 'db_active_connection', activeConnectionId)
        await api.userSaveConfig(user.id, 'db_active_redis', activeRedisServerId)
      },

      loadFromServer: async () => {
        const user = getAuthUser()
        if (!user) return
        const api = (window as any).api
        if (!api || !api.userLoadConfigs) return
        const result = await api.userLoadConfigs(user.id)
        if (result.success && result.configs) {
          const c = result.configs
          if (c.db_connections) set({ connections: c.db_connections })
          if (c.db_redis_servers) set({ redisServers: c.db_redis_servers })
          if (c.db_active_connection) set({ activeConnectionId: c.db_active_connection })
          if (c.db_active_redis) set({ activeRedisServerId: c.db_active_redis })
        }
      },
    }),
    {
      name: 'sql-storage',
      partialize: (state) => ({
        sqlTabs: state.sqlTabs,
        activeSqlTabId: state.activeSqlTabId,
        editorLayout: state.editorLayout,
        resultView: state.resultView,
        sqlEditorTheme: state.sqlEditorTheme,
        sqlResultTheme: state.sqlResultTheme,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return
        // Conexões/Redis vêm do MySQL via loadFromServer(), não do localStorage
        state.connections = []
        state.redisServers = []
        state.activeConnectionId = null
        state.activeRedisServerId = null
        if (state.sqlTabs.length === 0) {
          const tab = createTab(1)
          state.sqlTabs = [tab]
          state.activeSqlTabId = tab.id
        } else if (!state.activeSqlTabId || !state.sqlTabs.some(tab => tab.id === state.activeSqlTabId)) {
          state.activeSqlTabId = state.sqlTabs[0].id
        }
      }
    }
  )
)

// Register store for lazy access (avoids circular dependency)
if (typeof window !== 'undefined') {
  ;(window as any).__zustandStores = { ...((window as any).__zustandStores || {}), sql: useSqlStore }
}
