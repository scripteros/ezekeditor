import { useEffect } from 'react'
import TitleBar from './components/layout/TitleBar'
import ActivityBar from './components/layout/ActivityBar'
import Sidebar from './components/layout/Sidebar'
import EditorPanel from './components/layout/EditorPanel'
import BottomPanel from './components/layout/BottomPanel'
import StatusBar from './components/layout/StatusBar'
import CommandPalette from './components/commandPalette/CommandPalette'
import RightPanel from './components/layout/RightPanel'
import HorizontalResizer from './components/layout/HorizontalResizer'
import { useThemeStore } from './store/themeStore'
import { useCommandPaletteStore } from './store/commandPaletteStore'
import { useSidebarStore } from './store/sidebarStore'
import { useAIStore } from './store/aiStore'

export default function App() {
  const { theme } = useThemeStore()
  const { togglePalette } = useCommandPaletteStore()
  const { isOpen: isSidebarOpen, activeView, setWidth: setSidebarWidth } = useSidebarStore()
  const { isPanelOpen, panelWidth, setPanelWidth } = useAIStore()
  const shouldShowSidebar = isSidebarOpen && activeView !== 'extensions'

  useEffect(() => {
    document.documentElement.className = theme.type
    const root = document.documentElement
    Object.entries(theme.colors).forEach(([key, value]) => {
      root.style.setProperty(`--nova-${key}`, value)
    })
  }, [theme])

  useEffect(() => {
    const api = (window as any).api
    if (api && api.onProxyStatusChange) {
      return api.onProxyStatusChange((proxyType: 'deepsproxy' | 'kimiproxy' | 'geminiproxy', status: 'online' | 'offline' | 'error') => {
        useAIStore.getState().setProxyStatus(proxyType, status)
      })
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'p') {
        e.preventDefault()
        togglePalette()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [togglePalette])

  return (
    <div className="h-screen flex flex-col bg-nova-bg text-nova-text select-none app-shell">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <ActivityBar />
        {shouldShowSidebar && <Sidebar />}
        {shouldShowSidebar && (
          <HorizontalResizer onResize={(delta) => {
            const currentWidth = useSidebarStore.getState().width;
            setSidebarWidth(currentWidth + delta);
          }} />
        )}
        <div className="flex flex-col flex-1 overflow-hidden min-w-[200px]">
          <EditorPanel />
          <BottomPanel />
        </div>
        {isPanelOpen && (
          <HorizontalResizer onResize={(delta) => {
            const currentWidth = useAIStore.getState().panelWidth;
            setPanelWidth(currentWidth - delta);
          }} />
        )}
        <RightPanel />
      </div>
      <StatusBar />
      <CommandPalette />
    </div>
  )
}
