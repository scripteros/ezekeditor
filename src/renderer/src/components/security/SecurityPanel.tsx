import { useEffect, useState, useMemo } from 'react'
import { Shield, Play, Square, Trash2, Crosshair, Server, Activity, Globe } from 'lucide-react'
import { useSecurityStore } from '../../store/securityStore'
import { getApi } from '../../utils/platform'
import { useAIStore } from '../../store/aiStore'

export default function SecurityPanel() {
  const { isProxyRunning, proxyPort, startProxy, stopProxy, capturedRequests, clearRequests, selectedRequestId, setSelectedRequest, addCapturedRequest, updateCapturedRequest, isAutoAnalyzeEnabled, toggleAutoAnalyze } = useSecurityStore()
  const { addMessage, togglePanel } = useAIStore()
  const [portInput, setPortInput] = useState(proxyPort.toString())
  const [isOpeningBrowser, setIsOpeningBrowser] = useState(false)
  const [autoAnalyzeBatch, setAutoAnalyzeBatch] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'history' | 'sitemap'>('history')

  const sitemapData = useMemo(() => {
    const map: Record<string, Set<string>> = {}
    capturedRequests.forEach(req => {
      try {
        const urlObj = new URL(req.url)
        const host = urlObj.host
        let path = urlObj.pathname
        if (urlObj.search) path += urlObj.search
        if (!map[host]) map[host] = new Set()
        map[host].add(path)
      } catch (e) {
        // Ignore invalid URLs
      }
    })
    // Sort hosts
    const sortedMap: Record<string, string[]> = {}
    Object.keys(map).sort().forEach(host => {
      sortedMap[host] = Array.from(map[host]).sort()
    })
    return sortedMap
  }, [capturedRequests])

  useEffect(() => {
    let timeout: NodeJS.Timeout
    if (isAutoAnalyzeEnabled && autoAnalyzeBatch.length > 0) {
      timeout = setTimeout(() => {
        const batch = [...autoAnalyzeBatch]
        setAutoAnalyzeBatch([])
        handleAutoAnalyzeBatch(batch)
      }, 3000)
    }
    return () => clearTimeout(timeout)
  }, [autoAnalyzeBatch, isAutoAnalyzeEnabled])

  const handleAutoAnalyzeBatch = (batch: any[]) => {
    if (batch.length === 0) return

    const reqsText = batch.map(req => `
**URL:** ${req.method} ${req.url}
**Status:** ${req.status}
**Request Headers:** ${Object.entries(req.headers || {}).map(([k, v]) => `${k}: ${v}`).join(', ')}
**Request Body:** ${req.body ? (req.body.length > 1000 ? req.body.substring(0, 1000) + '...' : req.body) : ''}
**Response Body (Truncado):** ${req.responseBody ? (req.responseBody.length > 1000 ? req.responseBody.substring(0, 1000) + '...' : req.responseBody) : ''}
`).join('\n\n')

    const content = `Você é um assistente de Pentest autônomo monitorando meu tráfego em tempo real. Meu objetivo inicial é tentar encontrar uma forma de conseguir acessar o site sem saber a senha (login bypass, injeção SQL, vulnerabilidades de autenticação).
    
Aqui está um lote de requisições capturadas:
${reqsText}

Analise os dados capturados e seja direto e fale de forma clara.
1. O que você detectou de errado ou vulnerável nas requisições?
2. Como posso explorar essa falha para fazer bypass no login ou acessar sem a senha?
3. Se você não encontrou absolutamente NADA de vulnerável neste lote de requisições, diga EXATAMENTE e APENAS: "Análise concluída: Nenhum risco aparente encontrado." sem mais delongas.`

    useAIStore.getState().sendMessage(content)
    
    if (!useAIStore.getState().isPanelOpen) {
      togglePanel()
    }
  }

  const handleAnalyze = (reqId: string) => {
    const req = capturedRequests.find(r => r.id === reqId)
    if (!req) return

    const content = `Analise a seguinte requisição HTTP e sua respectiva resposta em busca de vulnerabilidades de segurança. Aja como um Pentester Sênior.

Quero que você me diga:
1. O que você detectou de errado ou vulnerável (ex: dados expostos, injeção, falhas de autenticação, informações que não deveriam estar ali).
2. Como eu posso explorar essa falha usando métodos de pentest (exemplo prático de como injetar, como fazer bypass no login sem saber a senha).
3. Formas e opções corretas para corrigir a vulnerabilidade na minha aplicação.

**Requisição Interceptada:**
\`\`\`http
${req.method} ${req.url} HTTP/1.1
${Object.entries(req.headers).map(([k, v]) => `${k}: ${v}`).join('\n')}

${req.body || ''}
\`\`\`

**Resposta do Servidor:**
\`\`\`http
HTTP/1.1 ${req.status || 'N/A'}
${req.responseHeaders ? Object.entries(req.responseHeaders).map(([k, v]) => `${k}: ${v}`).join('\n') : ''}

${req.responseBody ? (req.responseBody.length > 1000 ? req.responseBody.substring(0, 1000) + '\n\n... (truncado)' : req.responseBody) : ''}
\`\`\``

    addMessage({
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: Date.now(),
      type: 'text'
    })
    
    // Open chat panel
    if (!useAIStore.getState().isPanelOpen) {
      togglePanel()
    }
  }

  useEffect(() => {
    const api = getApi()
    if (!api) return

    const unsubReq = api.onSecurityRequestCaptured((req) => {
      addCapturedRequest(req)
    })

    const unsubRes = api.onSecurityResponseCaptured((res) => {
      updateCapturedRequest(res.id, res)
      
      const state = useSecurityStore.getState()
      if (state.isAutoAnalyzeEnabled) {
        const req = state.capturedRequests.find(r => r.id === res.id)
        if (req) {
          const contentType = res.responseHeaders?.['content-type']?.toLowerCase() || ''
          const url = req.url.toLowerCase()
          const isStatic = url.match(/\.(png|jpg|jpeg|gif|svg|ico|css|js|woff|woff2|ttf|eot)(\?.*)?$/)
          const isBinary = contentType.includes('image/') || contentType.includes('video/') || contentType.includes('font/') || contentType.includes('audio/') || contentType.includes('application/javascript') || contentType.includes('text/css')
          
          if (!isStatic && !isBinary) {
            setAutoAnalyzeBatch(prev => [...prev, { ...req, ...res }])
          }
        }
      }
    })

    return () => {
      unsubReq()
      unsubRes()
    }
  }, [addCapturedRequest, updateCapturedRequest])

  const toggleProxy = async () => {
    if (isProxyRunning) {
      await stopProxy()
    } else {
      await startProxy(parseInt(portInput) || 8080)
    }
  }

  const handleOpenBrowser = async () => {
    const api = getApi()
    if (!api || !isProxyRunning) return
    setIsOpeningBrowser(true)
    await (api as any).securityOpenBrowser(proxyPort)
    setIsOpeningBrowser(false)
  }



  return (
    <div className="h-full flex flex-col bg-nova-bg text-nova-text text-xs">
      <div className="p-2 bg-nova-bg-secondary border-b border-nova-border flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Shield size={14} className={isProxyRunning ? 'text-nova-success' : 'text-nova-text-muted'} />
          <span className="font-semibold text-nova-text">Security Proxy</span>
        </div>
        
        <div className="flex items-center gap-2 ml-4 border-l border-nova-border pl-4">
          <span className="text-nova-text-muted">Porta:</span>
          <input 
            type="text" 
            value={portInput}
            onChange={(e) => setPortInput(e.target.value)}
            disabled={isProxyRunning}
            className="bg-nova-input-bg border border-nova-input-border text-nova-text w-16 px-1.5 py-0.5 rounded outline-none disabled:opacity-50"
          />
          <button
            onClick={toggleProxy}
            className={`flex items-center gap-1.5 px-3 py-1 rounded transition-colors ${
              isProxyRunning 
                ? 'bg-[#401212] text-[#ff8888] hover:bg-[#5c1a1a] border border-[#ff4444]/30'
                : 'bg-nova-accent/10 hover:bg-nova-accent/20 text-nova-accent border border-nova-accent/20'
            }`}
          >
            {isProxyRunning ? (
              <><Square size={10} className="fill-current" /> Parar Proxy</>
            ) : (
              <><Play size={10} className="fill-current" /> Iniciar Proxy</>
            )}
          </button>
          
          {isProxyRunning && (
            <button
              onClick={handleOpenBrowser}
              disabled={isOpeningBrowser}
              className="flex items-center gap-1.5 px-3 py-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded transition-colors disabled:opacity-50"
              title="Abrir navegador isolado já configurado com este proxy"
            >
              <Globe size={10} />
              {isOpeningBrowser ? 'Abrindo...' : 'Navegador Proxy'}
            </button>
          )}
        </div>

        {isProxyRunning && (
          <div className="text-[10px] text-nova-text-muted ml-2 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-nova-success animate-pulse"></span>
            Escutando em localhost:{proxyPort}. Configure sua aplicação para usar este proxy HTTP.
          </div>
        )}

        <div className="ml-auto flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer text-nova-text-secondary hover:text-nova-text transition-colors">
            <span className="text-[10px] uppercase font-bold tracking-wider">Pentest Auto-Scanner</span>
            <div 
              onClick={toggleAutoAnalyze}
              className={`w-8 h-4 rounded-full relative transition-colors ${isAutoAnalyzeEnabled ? 'bg-nova-accent' : 'bg-nova-bg-secondary border border-nova-border'}`}
            >
              <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${isAutoAnalyzeEnabled ? 'left-4' : 'left-0.5 bg-nova-text-muted'}`} />
            </div>
          </label>
          <button 
            onClick={clearRequests}
            className="flex items-center gap-1 px-2 py-1 text-nova-text-secondary hover:text-nova-text hover:bg-nova-hover rounded transition-colors"
          >
            <Trash2 size={12} /> Limpar
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left pane: Request list */}
        <div className="w-1/2 border-r border-nova-border flex flex-col">
          {/* Tabs */}
          <div className="flex border-b border-nova-border bg-nova-bg-secondary sticky top-0 z-20">
            <button 
              onClick={() => setActiveTab('history')} 
              className={`px-4 py-2 text-xs font-medium transition-colors border-b-2 flex-1 ${activeTab === 'history' ? 'border-nova-accent text-nova-accent bg-nova-accent/5' : 'border-transparent text-nova-text-secondary hover:text-nova-text hover:bg-nova-hover/50'}`}
            >
              Histórico
            </button>
            <button 
              onClick={() => setActiveTab('sitemap')} 
              className={`px-4 py-2 text-xs font-medium transition-colors border-b-2 flex-1 ${activeTab === 'sitemap' ? 'border-nova-accent text-nova-accent bg-nova-accent/5' : 'border-transparent text-nova-text-secondary hover:text-nova-text hover:bg-nova-hover/50'}`}
            >
              URLs Detectadas
            </button>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin relative">
            {activeTab === 'history' ? (
              <table className="w-full text-left border-collapse">
                <thead className="bg-nova-bg-secondary sticky top-0 z-10 shadow-sm shadow-black/20">
                  <tr>
                    <th className="font-medium text-nova-text-secondary px-3 py-1.5 border-b border-nova-border w-16">Método</th>
                    <th className="font-medium text-nova-text-secondary px-3 py-1.5 border-b border-nova-border">URL</th>
                    <th className="font-medium text-nova-text-secondary px-3 py-1.5 border-b border-nova-border w-16">Status</th>
                    <th className="font-medium text-nova-text-secondary px-3 py-1.5 border-b border-nova-border w-16 text-right">Tempo</th>
                  </tr>
                </thead>
                <tbody>
                  {capturedRequests.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-8 text-nova-text-muted">
                        Nenhuma requisição capturada ainda.
                      </td>
                    </tr>
                  ) : (
                    capturedRequests.map((req) => (
                      <tr 
                        key={req.id} 
                        onClick={() => setSelectedRequest(req.id)}
                        className={`cursor-pointer border-b border-nova-border/50 hover:bg-nova-hover/50 ${selectedRequestId === req.id ? 'bg-nova-accent/10' : ''}`}
                      >
                        <td className={`px-3 py-1.5 font-mono text-[10px] ${
                          req.method === 'GET' ? 'text-blue-400' : 
                          req.method === 'POST' ? 'text-green-400' : 
                          req.method === 'PUT' ? 'text-yellow-400' : 
                          req.method === 'DELETE' ? 'text-red-400' : 'text-gray-400'
                        }`}>
                          {req.method}
                        </td>
                        <td className="px-3 py-1.5 truncate max-w-[200px]" title={req.url}>{req.url}</td>
                        <td className={`px-3 py-1.5 font-mono text-[10px] ${
                          !req.status ? 'text-nova-text-muted' :
                          req.status < 300 ? 'text-nova-success' :
                          req.status < 400 ? 'text-yellow-400' : 'text-nova-error'
                        }`}>
                          {req.status || '...'}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono text-[10px] text-nova-text-muted">
                          {req.durationMs ? `${req.durationMs}ms` : '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : (
              <div className="p-4">
                {Object.keys(sitemapData).length === 0 ? (
                  <div className="text-center py-8 text-nova-text-muted">Nenhuma URL mapeada ainda.</div>
                ) : (
                  Object.keys(sitemapData).map(host => (
                    <div key={host} className="mb-6">
                      <div className="font-semibold text-nova-text flex items-center gap-2 mb-2 pb-1 border-b border-nova-border/50">
                        <Globe size={14} className="text-blue-400" />
                        {host}
                        <span className="text-nova-text-muted text-[10px] ml-auto">{sitemapData[host].length} endpoints</span>
                      </div>
                      <div className="pl-5 border-l border-nova-border/30 space-y-1 mt-2">
                        {sitemapData[host].map(path => (
                          <div key={path} className="font-mono text-[10px] text-nova-text-secondary hover:text-nova-text cursor-default truncate py-0.5 relative group" title={path}>
                            <span className="absolute -left-5 top-1.5 w-3 border-t border-nova-border/30"></span>
                            {path}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right pane: Request details */}
        <div className="w-1/2 flex flex-col bg-[#0a0f0d]">
          {selectedRequestId ? (() => {
            const req = capturedRequests.find(r => r.id === selectedRequestId)
            if (!req) return null
            return (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="p-2 bg-nova-bg-secondary border-b border-nova-border flex items-center justify-between">
                  <span className="font-mono text-[10px] text-nova-text-muted truncate max-w-[300px]">{req.method} {req.url}</span>
                  <button
                    onClick={() => handleAnalyze(req.id)}
                    className="flex items-center gap-1.5 px-2 py-1 bg-nova-accent/20 hover:bg-nova-accent/30 text-nova-accent border border-nova-accent/30 rounded transition-colors text-[10px] font-medium"
                  >
                    <Crosshair size={12} /> Analisar Vulnerabilidades
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-4">
                  <div>
                    <h3 className="font-semibold text-nova-text flex items-center gap-1 mb-1"><Server size={12}/> Request Headers</h3>
                    <pre className="text-[10px] font-mono text-nova-text-secondary bg-[#131d1a] p-2 rounded border border-nova-border overflow-x-auto">
                      {Object.entries(req.headers).map(([k, v]) => `${k}: ${v}`).join('\n')}
                    </pre>
                  </div>
                  
                  {req.body && (
                    <div>
                      <h3 className="font-semibold text-nova-text mb-1">Request Body</h3>
                      <pre className="text-[10px] font-mono text-nova-text-secondary bg-[#131d1a] p-2 rounded border border-nova-border overflow-x-auto whitespace-pre-wrap">
                        {req.body}
                      </pre>
                    </div>
                  )}

                  {req.responseHeaders && (
                    <div>
                      <h3 className="font-semibold text-nova-text flex items-center gap-1 mb-1"><Activity size={12}/> Response Headers ({req.status})</h3>
                      <pre className="text-[10px] font-mono text-nova-text-secondary bg-[#131d1a] p-2 rounded border border-nova-border overflow-x-auto">
                        {Object.entries(req.responseHeaders).map(([k, v]) => `${k}: ${v}`).join('\n')}
                      </pre>
                    </div>
                  )}

                  {req.responseBody && (
                    <div>
                      <h3 className="font-semibold text-nova-text mb-1">Response Body</h3>
                      <pre className="text-[10px] font-mono text-nova-text-secondary bg-[#131d1a] p-2 rounded border border-nova-border overflow-x-auto whitespace-pre-wrap">
                        {req.responseBody.length > 2000 ? req.responseBody.substring(0, 2000) + '\n\n... (conteúdo truncado para visualização)' : req.responseBody}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )
          })() : (
            <div className="flex-1 flex items-center justify-center text-nova-text-muted p-8 text-center">
              <div>
                <Shield size={32} className="mx-auto mb-2 opacity-20" />
                <p>Selecione uma requisição capturada para ver os detalhes e iniciar o scan de vulnerabilidades.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
