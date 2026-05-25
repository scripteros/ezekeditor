import { create } from 'zustand'
import type { ThemeConfig } from '../../../shared/types'

const darkTheme: ThemeConfig = {
  id: 'ezek-dark',
  name: 'Ezek Escuro',
  type: 'dark',
  colors: {
    'bg': '#08110d',
    'bg-secondary': '#101916',
    'bg-tertiary': '#13211c',
    'sidebar': '#0a1511',
    'activitybar': '#08110d',
    'titlebar': '#08110d',
    'tab-active': '#101916',
    'tab-inactive': '#0a1511',
    'border': '#152b21',
    'text': '#f3f4f6',
    'text-secondary': '#94a3b8',
    'text-muted': '#64748b',
    'accent': '#22c55e',
    'accent-hover': '#16a34a',
    'hover': '#13211c',
    'scrollbar': '#152b21',
    'scrollbar-hover': '#22c55e',
    'terminal-bg': '#08110d',
    'input-bg': '#101916',
    'input-border': '#152b21',
    'badge': '#13211c',
    'error': '#ef4444',
    'warning': '#f59e0b',
    'info': '#3b82f6',
    'success': '#22c55e',
    'highlight': '#13211c',
    'selection': '#152b21',
  },
}

const lightTheme: ThemeConfig = {
  id: 'ezek-light',
  name: 'Ezek Claro',
  type: 'light',
  colors: {
    'bg': '#ffffff',
    'bg-secondary': '#f0f7f0',
    'bg-tertiary': '#e8f0e8',
    'sidebar': '#f0f7f0',
    'activitybar': '#e8f0e8',
    'titlebar': '#dce8dc',
    'tab-active': '#ffffff',
    'tab-inactive': '#f0f7f0',
    'border': '#d0e0d0',
    'text': '#1a2d1f',
    'text-secondary': '#4a6a4a',
    'text-muted': '#8aaa8a',
    'accent': '#2ea043',
    'accent-hover': '#238636',
    'hover': '#e8f0e8',
    'scrollbar': '#c0d0c0',
    'scrollbar-hover': '#a0b0a0',
    'terminal-bg': '#f0f7f0',
    'input-bg': '#ffffff',
    'input-border': '#d0e0d0',
    'badge': '#e8f0e8',
    'error': '#cf222e',
    'warning': '#9a6700',
    'info': '#0969da',
    'success': '#1a7f37',
    'highlight': '#d0f0d0',
    'selection': '#d0f0d0',
  },
}

interface ThemeState {
  theme: ThemeConfig
  themes: ThemeConfig[]
  setTheme: (themeId: string) => void
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: darkTheme,
  themes: [darkTheme, lightTheme],
  setTheme: (themeId) => {
    const found = darkTheme.id === themeId ? darkTheme : lightTheme
    if (found) set({ theme: found })
  },
}))
