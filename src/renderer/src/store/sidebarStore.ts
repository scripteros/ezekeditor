import { create } from 'zustand'

type SidebarView = 'explorer' | 'search' | 'git' | 'extensions' | 'ldap' | 'backlog' | 'settings' | null

export type BottomTab = 'terminal' | 'logs' | 'sql' | 'security'

function loadHiddenTabs(): BottomTab[] {
  try {
    const saved = localStorage.getItem('ezek-hidden-bottom-tabs')
    return saved ? JSON.parse(saved) : []
  } catch {
    return []
  }
}

function saveHiddenTabs(tabs: BottomTab[]) {
  localStorage.setItem('ezek-hidden-bottom-tabs', JSON.stringify(tabs))
}

interface SidebarState {
  isOpen: boolean
  activeView: SidebarView
  width: number
  activeSettingsSection: string
  hiddenBottomTabs: BottomTab[]
  toggleSidebar: () => void
  openSidebar: () => void
  closeSidebar: () => void
  setActiveView: (view: SidebarView) => void
  setActiveSettingsSection: (section: string) => void
  setWidth: (width: number) => void
  toggleBottomTab: (tab: BottomTab) => void
  isBottomTabVisible: (tab: BottomTab) => boolean
}

export const useSidebarStore = create<SidebarState>((set, get) => ({
  isOpen: true,
  activeView: 'explorer',
  width: 260,
  activeSettingsSection: 'appearance',
  hiddenBottomTabs: loadHiddenTabs(),
  toggleSidebar: () => set(state => ({ isOpen: !state.isOpen })),
  openSidebar: () => set({ isOpen: true }),
  closeSidebar: () => set({ isOpen: false }),
  setActiveView: (view) => set({ activeView: view, isOpen: true }),
  setActiveSettingsSection: (section) => set({ activeSettingsSection: section }),
  setWidth: (width) => set({ width: Math.max(80, width) }),
  toggleBottomTab: (tab) => set(state => {
    const isHidden = state.hiddenBottomTabs.includes(tab)
    const newHidden = isHidden
      ? state.hiddenBottomTabs.filter(t => t !== tab)
      : [...state.hiddenBottomTabs, tab]
    saveHiddenTabs(newHidden)
    return { hiddenBottomTabs: newHidden }
  }),
  isBottomTabVisible: (tab) => !get().hiddenBottomTabs.includes(tab),
}))
