import { create } from 'zustand'

interface CommandPaletteState {
  isOpen: boolean
  searchQuery: string
  togglePalette: () => void
  openPalette: () => void
  closePalette: () => void
  setSearchQuery: (query: string) => void
}

export const useCommandPaletteStore = create<CommandPaletteState>((set) => ({
  isOpen: false,
  searchQuery: '',
  togglePalette: () => set(state => ({ isOpen: !state.isOpen })),
  openPalette: () => set({ isOpen: true }),
  closePalette: () => set({ isOpen: false, searchQuery: '' }),
  setSearchQuery: (query) => set({ searchQuery: query }),
}))
