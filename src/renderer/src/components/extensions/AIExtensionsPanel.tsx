import React, { useEffect, useState } from 'react'
import { useExtensionsStore } from '../../store/extensionsStore'
import { useAIStore } from '../../store/aiStore'
import { Home, RefreshCw, X } from 'lucide-react'

export default function AIExtensionsPanel() {
  const { installed: webExtensions, activeExtensionId, setActiveExtension } = useExtensionsStore()
  const [loading, setLoading] = useState(false)

  const activeExt = webExtensions.find(e => e.id === activeExtensionId)

  // Handle webview loading state
  useEffect(() => {
    if (!activeExt) return

    const webview = document.querySelector('webview') as any
    if (!webview) return

    const startLoading = () => setLoading(true)
    const stopLoading = () => setLoading(false)

    webview.addEventListener('did-start-loading', startLoading)
    webview.addEventListener('did-stop-loading', stopLoading)

    return () => {
      webview.removeEventListener('did-start-loading', startLoading)
      webview.removeEventListener('did-stop-loading', stopLoading)
    }
  }, [activeExt])

  const handleRefresh = () => {
    const webview = document.querySelector('webview') as any
    if (webview) webview.reload()
  }

  if (!activeExt) {
    return (
      <div className="flex flex-col h-full bg-[#0d1c2d] text-[#d4e4fa] font-sans">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-outline-variant flex justify-between items-center bg-[#0d1c2d] select-none">
          <h2 className="font-label-xs text-label-xs uppercase tracking-widest text-on-surface-variant">Extensions</h2>
          <span className="material-symbols-outlined text-sm opacity-60 cursor-pointer hover:text-[#4edea3]">more_horiz</span>
        </div>

        <div className="p-4 flex-1 overflow-y-auto scrollbar-thin space-y-6">
          {/* Search Marketplace */}
          <div className="relative">
            <input 
              className="w-full bg-surface-container-low border border-outline-variant rounded px-3 py-2 text-label-xs font-label-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all placeholder:opacity-50 text-on-surface" 
              placeholder="Search Marketplace" 
              type="text"
            />
            <span className="material-symbols-outlined absolute right-2 top-2 text-sm opacity-40">search</span>
          </div>

          {/* Navigation Categories */}
          <nav className="flex flex-col gap-1">
            <div className="flex items-center gap-2 p-2 rounded hover:bg-surface-variant/30 cursor-pointer text-primary bg-primary/5">
              <span className="material-symbols-outlined text-base">trending_up</span>
              <span className="text-label-xs font-label-xs">Trending</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded hover:bg-surface-variant/30 cursor-pointer text-on-surface-variant">
              <span className="material-symbols-outlined text-base">bug_report</span>
              <span className="text-label-xs font-label-xs">Debuggers</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded hover:bg-surface-variant/30 cursor-pointer text-on-surface-variant">
              <span className="material-symbols-outlined text-base">palette</span>
              <span className="text-label-xs font-label-xs">Themes</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded hover:bg-surface-variant/30 cursor-pointer text-on-surface-variant">
              <span className="material-symbols-outlined text-base">language</span>
              <span className="text-label-xs font-label-xs">Programming Languages</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded hover:bg-surface-variant/30 cursor-pointer text-on-surface-variant">
              <span className="material-symbols-outlined text-base">cloud_done</span>
              <span className="text-label-xs font-label-xs">Cloud Development</span>
            </div>
          </nav>

          {/* Recommended list */}
          <div>
            <h3 className="font-label-xs text-label-xs opacity-40 uppercase px-2 mb-2">Recommended</h3>
            <div className="flex items-center gap-3 p-2 group cursor-pointer hover:bg-surface-variant/20 rounded-lg">
              <div className="w-8 h-8 rounded bg-primary/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-lg">bolt</span>
              </div>
              <div>
                <div className="text-label-xs font-bold text-white">FastLint Pro</div>
                <div className="text-[10px] text-on-surface-variant">v2.4.0</div>
              </div>
            </div>
          </div>

          {/* Web Shortcuts (Atalhos Web) */}
          <div className="pt-4 border-t border-outline-variant/30">
            <h3 className="font-label-xs text-label-xs opacity-40 uppercase px-2 mb-3 tracking-widest flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">language</span> Atalhos Web (Navegador)
            </h3>
            <div className="space-y-1">
              {webExtensions.map(ext => (
                <button
                  key={ext.id}
                  onClick={() => setActiveExtension(ext.id)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs text-on-surface-variant hover:text-primary hover:bg-[#122131]/40 text-left transition-all border border-transparent hover:border-outline-variant/20"
                >
                  <span className="text-sm shrink-0">{ext.icon}</span>
                  <span className="font-semibold truncate">{ext.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-[#051424]">
      {/* WebView Toolbar */}
      <div className="h-9 min-h-[36px] flex items-center justify-between px-2 bg-[#0d1c2d] border-b border-[#3c4a42]/20">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveExtension(null)}
            className="p-1.5 rounded hover:bg-[#122131] text-[#bbcabf] hover:text-[#d4e4fa] transition-colors"
            title="Voltar"
          >
            <Home size={14} />
          </button>
          <button
            onClick={handleRefresh}
            className={`p-1.5 rounded hover:bg-[#122131] text-[#bbcabf] hover:text-[#d4e4fa] transition-colors ${loading ? 'animate-spin opacity-50' : ''}`}
            title="Recarregar página"
          >
            <RefreshCw size={14} />
          </button>
        </div>

        <div className="flex items-center gap-2 max-w-[200px] overflow-hidden">
          <span className="text-xs font-bold text-[#4edea3] truncate">{activeExt.name}</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveExtension(null)}
            className="p-1.5 rounded hover:bg-red-500/10 text-[#bbcabf] hover:text-red-400 transition-colors"
            title="Fechar"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Electron Webview Tag */}
      <div className="flex-1 bg-white relative">
        {loading && (
          <div className="absolute top-0 left-0 w-full h-1 bg-[#0d1c2d] z-10 overflow-hidden">
            <div className="h-full bg-[#4edea3] animate-[pulse_1.5s_ease-in-out_infinite] w-1/3 rounded-r-full"></div>
          </div>
        )}
        {React.createElement('webview', {
          src: activeExt.url,
          className: 'w-full h-full border-none',
          allowpopups: 'true',
          webpreferences: 'contextIsolation=yes, sandbox=yes'
        })}
      </div>
    </div>
  )
}
