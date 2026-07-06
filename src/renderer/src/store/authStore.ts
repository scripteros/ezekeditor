import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { useAIStore } from './aiStore'

// Lazy access to sqlStore to avoid circular dependency (sqlStore imports authStore)
function getSqlStore(): any {
  try {
    return (window as any).__zustandStores?.sql
  } catch { return null }
}

// Lazy access to skillStore
function getSkillStore(): any {
  try {
    return (window as any).__zustandStores?.skill
  } catch { return null }
}

export interface AuthUser {
  id: number | string
  nome: string
  usuario: string
}

interface AuthState {
  user: AuthUser | null
  isAuthLoading: boolean
  initialized: boolean
  authMode: 'local' | 'cloud' | null
  onlineUsers: number
  pingInterval: any | null
  
  initAuth: () => Promise<void>
  initAuthLocal: () => Promise<void>
  login: (usuario: string, senha: string) => Promise<{ success: boolean; error?: string }>
  register: (nome: string, usuario: string, senha: string) => Promise<{ success: boolean; error?: string }>
  loginLocal: (usuario: string, senha: string) => Promise<{ success: boolean; error?: string }>
  registerLocal: (nome: string, usuario: string, senha: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  startPing: () => void
  stopPing: () => void
  updateOnlineUsers: (count: number) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthLoading: false,
      initialized: false,
      authMode: null,
      onlineUsers: 0,
      pingInterval: null,

      initAuth: async () => {
        const api = (window as any).api
        if (!api) return
        set({ isAuthLoading: true })
        try {
          await api.authInit()
          set({ initialized: true })
          const currentUser = get().user
          const currentMode = get().authMode
          if (currentUser) {
            try {
              await useAIStore.getState().loadFromServer()
            } catch (e) {
              console.error('Failed to load AI configs on init:', e)
            }
            try {
              await getSqlStore()?.getState().loadFromServer()
            } catch (e) {
              console.error('Failed to load DB configs on init:', e)
            }
            try {
              await getSkillStore()?.getState().loadFromServer()
            } catch (e) {
              console.error('Failed to load skills on init:', e)
            }
            if (currentMode === 'cloud') {
              get().startPing()
            }
          }
        } catch (err) {
          console.error('Auth init error:', err)
        } finally {
          set({ isAuthLoading: false })
        }
      },

      initAuthLocal: async () => {
        const api = (window as any).api
        if (!api) return
        try {
          await api.authInitLocal()
        } catch (err) {
          console.error('Auth init local error:', err)
        }
      },

      login: async (usuario, senha) => {
        const api = (window as any).api
        if (!api) return { success: false, error: 'API não disponível' }

        set({ isAuthLoading: true })
        try {
          const result = await api.authLogin({ usuario, senha })
          if (result.success && result.user) {
            set({ user: result.user, authMode: 'cloud' })
            // Carrega configurações do servidor MySQL
            try {
              await useAIStore.getState().loadFromServer()
            } catch (e) {
              console.error('Failed to load AI configs from server:', e)
            }
            try {
              await getSqlStore()?.getState().loadFromServer()
            } catch (e) {
              console.error('Failed to load DB configs from server:', e)
            }
            try {
              await getSkillStore()?.getState().loadFromServer()
            } catch (e) {
              console.error('Failed to load skills from server:', e)
            }
            // Inicia ping de sessão
            get().startPing()
          }
          return { success: result.success, error: result.error }
        } catch (err: any) {
          return { success: false, error: err.message || 'Erro ao conectar' }
        } finally {
          set({ isAuthLoading: false })
        }
      },

      register: async (nome, usuario, senha) => {
        const api = (window as any).api
        if (!api) return { success: false, error: 'API não disponível' }

        set({ isAuthLoading: true })
        try {
          const result = await api.authRegister({ nome, usuario, senha })
          if (result.success && result.user) {
            set({ user: { id: 0, ...result.user }, authMode: 'cloud' })
          }
          return { success: result.success, error: result.error }
        } catch (err: any) {
          return { success: false, error: err.message || 'Erro ao conectar' }
        } finally {
          set({ isAuthLoading: false })
        }
      },

      loginLocal: async (usuario, senha) => {
        const api = (window as any).api
        if (!api) return { success: false, error: 'API não disponível' }

        set({ isAuthLoading: true })
        try {
          const result = await api.authLoginLocal({ usuario, senha })
          if (result.success && result.user) {
            set({ user: result.user, authMode: 'local' })
            // Carrega configurações salvas localmente
            try {
              await useAIStore.getState().loadFromServer()
            } catch (e) {
              console.error('Failed to load AI configs locally:', e)
            }
            try {
              await getSqlStore()?.getState().loadFromServer()
            } catch (e) {
              console.error('Failed to load DB configs locally:', e)
            }
          }
          return { success: result.success, error: result.error }
        } catch (err: any) {
          return { success: false, error: err.message || 'Erro ao conectar' }
        } finally {
          set({ isAuthLoading: false })
        }
      },

      registerLocal: async (nome, usuario, senha) => {
        const api = (window as any).api
        if (!api) return { success: false, error: 'API não disponível' }

        set({ isAuthLoading: true })
        try {
          const result = await api.authRegisterLocal({ nome, usuario, senha })
          if (result.success && result.user) {
            set({ user: result.user, authMode: 'local' })
          }
          return { success: result.success, error: result.error }
        } catch (err: any) {
          return { success: false, error: err.message || 'Erro ao conectar' }
        } finally {
          set({ isAuthLoading: false })
        }
      },

      logout: async () => {
        get().stopPing()
        // Salva configurações no servidor antes de deslogar
        try {
          await useAIStore.getState().syncToServer()
        } catch (e) {
          console.error('Failed to sync AI configs to server:', e)
        }
        try {
          await getSqlStore()?.getState().syncToServer()
        } catch (e) {
          console.error('Failed to sync DB configs to server:', e)
        }
        try {
          await getSkillStore()?.getState().syncToServer()
        } catch (e) {
          console.error('Failed to sync skills to server:', e)
        }
        set({ user: null, authMode: null })
      },

      startPing: () => {
        const { user, pingInterval } = get()
        if (!user || pingInterval) return
        
        const api = (window as any).api
        
        // Ping imediato
        if (api) {
          api.getOnlineCount().then((result: any) => {
            if (result) set({ onlineUsers: result.count || 0 })
          }).catch(() => {})
        }

        // Ping periódico a cada 30 segundos
        const interval = setInterval(() => {
          const currentUser = get().user
          if (!currentUser || !api) {
            get().stopPing()
            return
          }
          api.getOnlineCount().then((result: any) => {
            if (result) set({ onlineUsers: result.count || 0 })
          }).catch(() => {})
        }, 30000)

        set({ pingInterval: interval })
      },

      stopPing: () => {
        const { pingInterval } = get()
        if (pingInterval) {
          clearInterval(pingInterval)
          set({ pingInterval: null })
        }
      },

      updateOnlineUsers: (count: number) => {
        set({ onlineUsers: count })
      },
    }),
    {
      name: 'ezek-auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ user: state.user, authMode: state.authMode }),
      onRehydrateStorage: () => {
        // Após hidratação do localStorage, carregar configs do servidor (MySQL ou local)
        return (state, error) => {
          if (error) {
            console.error('Auth rehydration error:', error)
            return
          }
          if (state?.user && state?.authMode) {
            // Carrega configs de IA, SQL e Skills do servidor/local
            const loadAllConfigs = async () => {
              try {
                await useAIStore.getState().loadFromServer()
              } catch (e) {
                console.error('Failed to load AI configs after rehydration:', e)
              }
              try {
                await getSqlStore()?.getState().loadFromServer()
              } catch (e) {
                console.error('Failed to load DB configs after rehydration:', e)
              }
              try {
                await getSkillStore()?.getState().loadFromServer()
              } catch (e) {
                console.error('Failed to load skills after rehydration:', e)
              }
            }
            loadAllConfigs()
          }
        }
      },
    }
  )
)

// Register store for lazy access (breaks circular dependency with aiStore)
if (typeof window !== 'undefined') {
  ;(window as any).__zustandStores = { ...((window as any).__zustandStores || {}), auth: useAuthStore }
}
