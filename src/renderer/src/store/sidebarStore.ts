import { create } from 'zustand'

type SidebarView = 'explorer' | 'search' | 'git' | 'extensions' | 'ldap' | null

interface SidebarState {
  isOpen: boolean
  activeView: SidebarView
  width: number
  toggleSidebar: () => void
  openSidebar: () => void
  closeSidebar: () => void
  setActiveView: (view: SidebarView) => void
  setWidth: (width: number) => void
}

export const useSidebarStore = create<SidebarState>((set) => ({
  isOpen: true,
  activeView: 'explorer',
  width: 260,
  toggleSidebar: () => set(state => ({ isOpen: !state.isOpen })),
  openSidebar: () => set({ isOpen: true }),
  closeSidebar: () => set({ isOpen: false }),
  setActiveView: (view) => set({ activeView: view, isOpen: true }),
  setWidth: (width) => set({ width: Math.max(150, Math.min(800, width)) }),
}))
