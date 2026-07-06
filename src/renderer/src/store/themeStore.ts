import { create } from 'zustand'
import type { ThemeConfig } from '../../../shared/types'

const darkTheme: ThemeConfig = {
  id: 'ezek-dark',
  name: 'Ezek Escuro',
  type: 'dark',
  colors: {
    'bg': '#06111f',
    'bg-secondary': '#0b1b2b',
    'bg-tertiary': '#13283a',
    'sidebar': '#091827',
    'activitybar': '#03101d',
    'titlebar': '#06111f',
    'tab-active': '#06111f',
    'tab-inactive': '#0b1b2b',
    'border': '#1d3444',
    'text': '#e8f3ff',
    'text-secondary': '#aec5cf',
    'text-muted': '#78909d',
    'accent': '#43e6a1',
    'accent-hover': '#67f4b8',
    'hover': '#123146',
    'scrollbar': '#163548',
    'scrollbar-hover': '#43e6a1',
    'terminal-bg': '#071524',
    'input-bg': '#0f2232',
    'input-border': '#244254',
    'badge': '#102b3b',
    'error': '#ffb4ab',
    'warning': '#f59e0b',
    'info': '#7dd3fc',
    'success': '#43e6a1',
    'highlight': '#102f3f',
    'selection': '#173b4d',
    'statusbar': '#43e6a1',
    'statusbar-text': '#032016',
    'shadow': 'rgba(0, 0, 0, 0.36)',
    'focus-ring': '#6757ff',
  },
}

const lightTheme: ThemeConfig = {
  id: 'ezek-light',
  name: 'Ezek Claro',
  type: 'light',
  colors: {
    'bg': '#f7f9fb',
    'bg-secondary': '#edf2f6',
    'bg-tertiary': '#e4edf2',
    'sidebar': '#eef4f7',
    'activitybar': '#fbfdff',
    'titlebar': '#ffffff',
    'tab-active': '#ffffff',
    'tab-inactive': '#eef3f7',
    'border': '#cddbe4',
    'text': '#132635',
    'text-secondary': '#49606d',
    'text-muted': '#748895',
    'accent': '#00bf7d',
    'accent-hover': '#00a96d',
    'hover': '#dfeaf0',
    'scrollbar': '#c9d8e1',
    'scrollbar-hover': '#00bf7d',
    'terminal-bg': '#f4f7f9',
    'input-bg': '#ffffff',
    'input-border': '#c9d9e2',
    'badge': '#e2edf2',
    'error': '#cf222e',
    'warning': '#9a6700',
    'info': '#0969da',
    'success': '#008f61',
    'highlight': '#d7f7eb',
    'selection': '#c4f1e2',
    'statusbar': '#00bf7d',
    'statusbar-text': '#ffffff',
    'shadow': 'rgba(24, 44, 56, 0.14)',
    'focus-ring': '#6757ff',
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
