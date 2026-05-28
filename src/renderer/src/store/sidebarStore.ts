import { create } from 'zustand'

type SidebarView = 'explorer' | 'search' | 'git' | 'extensions' | 'ldap' | 'settings' | null

interface SidebarState {
  isOpen: boolean
  activeView: SidebarView
  width: number
  activeSettingsSection: string
  toggleSidebar: () => void
  openSidebar: () => void
  closeSidebar: () => void
  setActiveView: (view: SidebarView) => void
  setActiveSettingsSection: (section: string) => void
  setWidth: (width: number) => void
}

export const useSidebarStore = create<SidebarState>((set) => ({
  isOpen: true,
  activeView: 'explorer',
  width: 260,
  activeSettingsSection: 'appearance',
  toggleSidebar: () => set(state => ({ isOpen: !state.isOpen })),
  openSidebar: () => set({ isOpen: true }),
  closeSidebar: () => set({ isOpen: false }),
  setActiveView: (view) => set({ activeView: view, isOpen: true }),
  setActiveSettingsSection: (section) => set({ activeSettingsSection: section }),
  setWidth: (width) => set({ width: Math.max(80, width) }),
}))
