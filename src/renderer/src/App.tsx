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
import LoginScreen from './components/auth/LoginScreen'
import UpdateNotification from './components/UpdateNotification'
import { useThemeStore } from './store/themeStore'
import { useCommandPaletteStore } from './store/commandPaletteStore'
import { useSidebarStore } from './store/sidebarStore'
import { useAIStore } from './store/aiStore'
import { useAuthStore } from './store/authStore'

export default function App() {
  const { theme } = useThemeStore()
  const { togglePalette } = useCommandPaletteStore()
  const { isOpen: isSidebarOpen, activeView, setWidth: setSidebarWidth, showBacklogWorkspace } = useSidebarStore()
  const { isPanelOpen, panelWidth, setPanelWidth } = useAIStore()
  const user = useAuthStore(s => s.user)
  const updateOnlineUsers = useAuthStore(s => s.updateOnlineUsers)
  const shouldShowSidebar = isSidebarOpen && activeView !== 'extensions' && activeView !== 'backlog'

  useEffect(() => {
    document.documentElement.className = theme.type
    const root = document.documentElement
    Object.entries(theme.colors).forEach(([key, value]) => {
      root.style.setProperty(`--nova-${key}`, value)
    })
  }, [theme])

  // Listener de usuários online
  useEffect(() => {
    const api = (window as any).api
    if (!api) return
    const cleanup = api.onUsersOnlineChanged((data: { count: number }) => {
      updateOnlineUsers(data.count)
    })
    return () => cleanup?.()
  }, [updateOnlineUsers])

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

  if (!user) {
    return <LoginScreen />
  }

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
          {activeView !== 'backlog' && <BottomPanel />}
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
      <UpdateNotification />
    </div>
  )
}
