import React, { useEffect, useState } from 'react'
import { useExtensionsStore } from '../../store/extensionsStore'
import { Puzzle, ArrowLeft, RefreshCw, X, Home } from 'lucide-react'

export default function AIExtensionsPanel() {
  const { installed, activeExtensionId, setActiveExtension } = useExtensionsStore()
  const [loading, setLoading] = useState(false)

  const activeExt = installed.find(e => e.id === activeExtensionId)

  // Handle webview loading state
  useEffect(() => {
    if (!activeExt) return;
    
    const webview = document.querySelector('webview') as any;
    if (!webview) return;

    const startLoading = () => setLoading(true);
    const stopLoading = () => setLoading(false);

    webview.addEventListener('did-start-loading', startLoading);
    webview.addEventListener('did-stop-loading', stopLoading);
    
    return () => {
      webview.removeEventListener('did-start-loading', startLoading);
      webview.removeEventListener('did-stop-loading', stopLoading);
    };
  }, [activeExt]);

  const handleRefresh = () => {
    const webview = document.querySelector('webview') as any;
    if (webview) webview.reload();
  }

  if (!activeExt) {
    return (
      <div className="flex flex-col h-full bg-nova-bg text-nova-text">
        <div className="h-[35px] min-h-[35px] flex items-center justify-between px-3 bg-nova-bg-secondary border-b border-nova-border">
          <div className="flex items-center gap-2">
            <Puzzle size={14} className="text-nova-accent" />
            <span className="text-xs font-semibold text-nova-text-secondary uppercase tracking-wider">Web IAs</span>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-white mb-1">Marketplace de IAs</h2>
            <p className="text-xs text-nova-text-muted">Acesse a interface web oficial de diversas inteligências artificiais diretamente na sua IDE.</p>
          </div>
          
          <div className="grid grid-cols-1 gap-2">
            {installed.map(ext => (
              <button
                key={ext.id}
                onClick={() => setActiveExtension(ext.id)}
                className="flex items-center justify-between p-3 bg-nova-bg-secondary border border-nova-border rounded-lg hover:border-nova-accent hover:bg-[#13211c] transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="text-xl bg-[#08110d] w-10 h-10 flex items-center justify-center rounded border border-nova-border group-hover:border-nova-accent/50 transition-colors">
                    {ext.icon}
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="text-sm font-medium text-white">{ext.name}</span>
                    <span className="text-[10px] text-nova-text-muted">{ext.url}</span>
                  </div>
                </div>
                <div className="text-[10px] font-medium text-nova-accent opacity-0 group-hover:opacity-100 transition-opacity bg-nova-accent/10 px-2 py-1 rounded">
                  Abrir
                </div>
              </button>
            ))}
          </div>
          
          <div className="mt-8 p-4 bg-nova-bg-secondary/50 rounded-lg border border-nova-border border-dashed text-center">
            <p className="text-[10px] text-nova-text-muted">As extensões abrem um navegador interno (Webview) da URL oficial. É necessário fazer login na sua conta para usá-las.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-nova-bg">
      {/* WebView Toolbar */}
      <div className="h-[35px] min-h-[35px] flex items-center justify-between px-2 bg-nova-bg-secondary border-b border-nova-border">
        <div className="flex items-center gap-1">
          <button 
            onClick={() => setActiveExtension(null)}
            className="p-1.5 rounded hover:bg-nova-hover text-nova-text-secondary hover:text-white transition-colors"
            title="Voltar"
          >
            <Home size={14} />
          </button>
          <button 
            onClick={handleRefresh}
            className={`p-1.5 rounded hover:bg-nova-hover text-nova-text-secondary hover:text-white transition-colors ${loading ? 'animate-spin opacity-50' : ''}`}
            title="Recarregar página"
          >
            <RefreshCw size={14} />
          </button>
        </div>
        
        <div className="flex items-center gap-2 max-w-[200px] overflow-hidden">
          <span className="text-xs font-semibold text-nova-accent truncate">{activeExt.name}</span>
        </div>
        
        <div className="flex items-center gap-1">
          <button 
            onClick={() => setActiveExtension(null)}
            className="p-1.5 rounded hover:bg-nova-error/20 text-nova-text-secondary hover:text-nova-error transition-colors"
            title="Fechar"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Electron Webview Tag */}
      <div className="flex-1 bg-white relative">
        {loading && (
          <div className="absolute top-0 left-0 w-full h-1 bg-nova-bg-secondary z-10 overflow-hidden">
            <div className="h-full bg-nova-accent animate-[pulse_1.5s_ease-in-out_infinite] w-1/3 rounded-r-full"></div>
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
