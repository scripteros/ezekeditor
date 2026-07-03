import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { useAIStore } from './aiStore'

// Lazy access to sqlStore to avoid circular dependency (sqlStore imports authStore)
function getSqlStore(): any {
  try {
    return (window as any).__zustandStores?.sql
  } catch { return null }
}

export interface AuthUser {
  id: number
  nome: string
  usuario: string
}

interface AuthState {
  user: AuthUser | null
  isAuthLoading: boolean
  initialized: boolean
  onlineUsers: number
  pingInterval: any | null
  
  initAuth: () => Promise<void>
  login: (usuario: string, senha: string) => Promise<{ success: boolean; error?: string }>
  register: (nome: string, usuario: string, senha: string) => Promise<{ success: boolean; error?: string }>
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
      onlineUsers: 0,
      pingInterval: null,

      initAuth: async () => {
        const api = (window as any).api
        if (!api) return
        set({ isAuthLoading: true })
        try {
          await api.authInit()
          set({ initialized: true })
          // Se o usuário já estava logado (restaurado do localStorage pelo persist),
          // carrega as configurações do servidor MySQL
          const currentUser = get().user
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
            get().startPing()
          }
        } catch (err) {
          console.error('Auth init error:', err)
        } finally {
          set({ isAuthLoading: false })
        }
      },

      login: async (usuario, senha) => {
        const api = (window as any).api
        if (!api) return { success: false, error: 'API não disponível' }

        set({ isAuthLoading: true })
        try {
          const result = await api.authLogin({ usuario, senha })
          if (result.success && result.user) {
            set({ user: result.user })
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
            set({ user: { id: 0, ...result.user } })
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
        set({ user: null })
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
      partialize: (state) => ({ user: state.user }),
    }
  )
)

// Register store for lazy access (breaks circular dependency with aiStore)
if (typeof window !== 'undefined') {
  ;(window as any).__zustandStores = { ...((window as any).__zustandStores || {}), auth: useAuthStore }
}
