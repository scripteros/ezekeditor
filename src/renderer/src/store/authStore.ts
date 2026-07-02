import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface AuthUser {
  id: number
  nome: string
  usuario: string
}

interface AuthState {
  user: AuthUser | null
  isAuthLoading: boolean
  initialized: boolean
  
  initAuth: () => Promise<void>
  login: (usuario: string, senha: string) => Promise<{ success: boolean; error?: string }>
  register: (nome: string, usuario: string, senha: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthLoading: false,
      initialized: false,

      initAuth: async () => {
        const api = (window as any).api
        if (!api) return
        set({ isAuthLoading: true })
        try {
          await api.authInit()
          set({ initialized: true })
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

      logout: () => {
        set({ user: null })
      },
    }),
    {
      name: 'ezek-auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ user: state.user }),
    }
  )
)
