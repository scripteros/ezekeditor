import { create } from 'zustand'
import { getApi } from '../utils/platform'
import type { LdapConfig } from '../../../main/services/ldapService'

interface LdapState {
  isConnected: boolean
  config: LdapConfig
  users: any[]
  groups: any[]
  isLoading: boolean
  error: string | null

  setConfig: (config: Partial<LdapConfig>) => void
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  searchUsers: (filter?: string) => Promise<void>
  searchGroups: (filter?: string) => Promise<void>
}

export const useLdapStore = create<LdapState>((set, get) => ({
  isConnected: false,
  config: {
    url: 'ldap://srv01.hsepaco.local:389',
    baseDN: 'dc=hsepaco,dc=local',
    bindDN: 'administrador@hsepaco.local',
    password: ''
  },
  users: [],
  groups: [],
  isLoading: false,
  error: null,

  setConfig: (newConfig) => set((state) => ({ config: { ...state.config, ...newConfig } })),

  connect: async () => {
    const api = getApi()
    if (!api) return
    set({ isLoading: true, error: null })
    try {
      const res = await (api as any).ldapConnect(get().config)
      if (res.success) {
        set({ isConnected: true, isLoading: false })
      } else {
        set({ isConnected: false, isLoading: false, error: res.error })
      }
    } catch (err: any) {
      set({ isConnected: false, isLoading: false, error: err.message })
    }
  },

  disconnect: async () => {
    const api = getApi()
    if (!api) return
    set({ isLoading: true })
    try {
      await (api as any).ldapDisconnect()
      set({ isConnected: false, users: [], groups: [], isLoading: false })
    } catch (err: any) {
      set({ isLoading: false, error: err.message })
    }
  },

  searchUsers: async (filter?: string) => {
    const api = getApi()
    if (!api || !get().isConnected) return
    set({ isLoading: true, error: null })
    try {
      const res = await (api as any).ldapSearchUsers(filter)
      if (res.success) {
        set({ users: res.data || [], isLoading: false })
      } else {
        set({ isLoading: false, error: res.error })
      }
    } catch (err: any) {
      set({ isLoading: false, error: err.message })
    }
  },

  searchGroups: async (filter?: string) => {
    const api = getApi()
    if (!api || !get().isConnected) return
    set({ isLoading: true, error: null })
    try {
      const res = await (api as any).ldapSearchGroups(filter)
      if (res.success) {
        set({ groups: res.data || [], isLoading: false })
      } else {
        set({ isLoading: false, error: res.error })
      }
    } catch (err: any) {
      set({ isLoading: false, error: err.message })
    }
  }
}))
