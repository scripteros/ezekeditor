import { useState, useRef, useEffect, useCallback } from 'react'
import { Play, Square, Send, Edit3, Pause, Globe, Trash2, Copy, Check, XCircle, Shield, Ban, ArrowUp, RefreshCw, Code, Wifi, Plus, Minus } from 'lucide-react'
import { getApi } from '../../utils/platform'

interface InterceptedItem {
  interceptId: string
  requestId: string
  method: string
  url: string
  headers: Record<string, string>
  body: string
  capturedAt: number
  type: 'request' | 'response'
  status?: number
  responseBody?: string
  responseHeaders?: Record<string, string>
  action?: 'forwarded' | 'dropped'
}

interface WSMessage {
  id: string
  direction: 'client->server' | 'server->client'
  data: string
  timestamp: number
  binary: boolean
}

export default function InterceptorPanel() {
  const [isInterceptEnabled, setIsInterceptEnabled] = useState(false)
  const [intercepted, setIntercepted] = useState<InterceptedItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editMethod, setEditMethod] = useState('GET')
  const [editUrl, setEditUrl] = useState('')
  const [editHeaders, setEditHeaders] = useState('')
  const [editBody, setEditBody] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [activeSubTab, setActiveSubTab] = useState<'intercept' | 'repeater' | 'ws'>('intercept')

  // Repeater state
  const [repeaterMethod, setRepeaterMethod] = useState('GET')
  const [repeaterUrl, setRepeaterUrl] = useState('')
  const [repeaterHeaders, setRepeaterHeaders] = useState('')
  const [repeaterBody, setRepeaterBody] = useState('')
  const [repeaterResponse, setRepeaterResponse] = useState<{
    status: number
    statusText: string
    headers: string
    body: string
    time: number
  } | null>(null)
  const [repeaterLoading, setRepeaterLoading] = useState(false)

  // WS state
  const [wsMessages, setWsMessages] = useState<WSMessage[]>([])
  const [wsConnected, setWsConnected] = useState(false)
  const [wsUrl, setWsUrl] = useState('')
  const [wsSendMessage, setWsSendMessage] = useState('')

  const selected = intercepted.find(i => i.interceptId === selectedId)

  useEffect(() => {
    const api = getApi()
    if (!api) return

    const cleanup = (api as any).onSecurityInterceptPending((data: any) => {
      setIntercepted(prev => {
        const exists = prev.find(i => i.interceptId === data.interceptId)
        if (exists) return prev
        return [...prev, {
          interceptId: data.interceptId,
          requestId: data.requestId,
          method: data.method,
          url: data.url,
          headers: data.headers || {},
          body: data.body || '',
          capturedAt: data.capturedAt || Date.now(),
          type: data.type || 'request',
          status: data.status,
        }]
      })
    })

    return () => { cleanup?.() }
  }, [])

  const handleForward = async (interceptId: string) => {
    const api = getApi()
    if (!api) return

    const item = intercepted.find(i => i.interceptId === interceptId)
    const method = selectedId === interceptId ? editMethod : (item?.method || 'GET')
    const url = selectedId === interceptId ? editUrl : (item?.url || '')
    const headers = selectedId === interceptId ? parseHeaders(editHeaders) : (item?.headers || {})
    const body = selectedId === interceptId ? editBody : (item?.body || '')

    await (api as any).securityInterceptAction({ interceptId, type: 'forward', method, url, headers, body })

    setIntercepted(prev => prev.map(i =>
      i.interceptId === interceptId ? { ...i, action: 'forwarded' } : i
    ))
    if (selectedId === interceptId) setSelectedId(null)
  }

  const handleDrop = async (interceptId: string) => {
    const api = getApi()
    if (!api) return

    await (api as any).securityInterceptAction({ interceptId, type: 'drop' })

    setIntercepted(prev => prev.map(i =>
      i.interceptId === interceptId ? { ...i, action: 'dropped' } : i
    ))
    if (selectedId === interceptId) setSelectedId(null)
  }

  const handleForwardAll = async () => {
    const pending = intercepted.filter(i => !i.action)
    for (const item of pending) {
      await handleForward(item.interceptId)
    }
  }

  const handleDropAll = async () => {
    const pending = intercepted.filter(i => !i.action)
    for (const item of pending) {
      await handleDrop(item.interceptId)
    }
  }

  const toggleIntercept = async () => {
    const api = getApi()
    if (!api) return

    if (isInterceptEnabled) {
      // Libera todas as pendentes ao desativar
      const pending = intercepted.filter(i => !i.action)
      for (const item of pending) {
        await (api as any).securityInterceptAction({ interceptId: item.interceptId, type: 'forward' })
      }
      setIntercepted([])
      await (api as any).securityInterceptDisable()
    } else {
      await (api as any).securityInterceptEnable()
    }
    setIsInterceptEnabled(!isInterceptEnabled)
  }

  // Cleanup old completed items after 5s
  useEffect(() => {
    if (!isInterceptEnabled) return
    const timer = setInterval(() => {
      const now = Date.now()
      setIntercepted(prev => prev.filter(i => {
        if (i.action && now - i.capturedAt > 5000) return false
        return true
      }))
    }, 3000)
    return () => clearInterval(timer)
  }, [isInterceptEnabled])

  const handleSelect = (item: InterceptedItem) => {
    if (item.action) return
    setSelectedId(item.interceptId)
    setEditMethod(item.method)
    setEditUrl(item.url)
    setEditHeaders(Object.entries(item.headers).map(([k, v]) => `${k}: ${v}`).join('\n'))
    setEditBody(item.body)
  }

  // Send selected item to Repeater
  const sendToRepeater = (item: InterceptedItem) => {
    setRepeaterMethod(item.method)
    setRepeaterUrl(item.url)
    setRepeaterHeaders(Object.entries(item.headers).map(([k, v]) => `${k}: ${v}`).join('\n'))
    setRepeaterBody(item.body)
    setRepeaterResponse(null)
    setActiveSubTab('repeater')
  }

  // Repeater: send modified request
  const handleRepeaterSend = async () => {
    const api = getApi()
    if (!api || !repeaterUrl.trim()) return
    setRepeaterLoading(true)
    setRepeaterResponse(null)
    const startTime = Date.now()
    try {
      const headers = parseHeaders(repeaterHeaders)
      const result = await (api as any).securityReplayRequest({
        method: repeaterMethod,
        url: repeaterUrl,
        headers,
        body: repeaterBody,
      })
      const elapsed = Date.now() - startTime
      if (result) {
        setRepeaterResponse({
          status: result.status || 0,
          statusText: result.statusText || '',
          headers: result.headers ? (typeof result.headers === 'string' ? result.headers : Object.entries(result.headers).map(([k, v]) => `${k}: ${v}`).join('\n')) : '',
          body: result.body || '',
          time: elapsed,
        })
      }
    } catch (err: any) {
      setRepeaterResponse({
        status: 0,
        statusText: 'Error',
        headers: '',
        body: `Erro: ${err.message || 'Falha na requisição'}`,
        time: Date.now() - startTime,
      })
    } finally {
      setRepeaterLoading(false)
    }
  }

  // WS connect
  const handleWSConnect = () => {
    const api = getApi()
    if (!api || !wsUrl.trim()) return
    setWsConnected(true)
    setWsMessages([])
    // Listen for WS messages via event
    const cleanup = (api as any).onSecurityWSMessage?.((msg: any) => {
      setWsMessages(prev => [...prev, {
        id: `ws-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        direction: msg.direction || 'server->client',
        data: msg.data || '',
        timestamp: Date.now(),
        binary: msg.binary || false,
      }])
    })
    // Save cleanup for disconnect
    ;(window as any).__wsCleanup = cleanup
  }

  const handleWSDisconnect = () => {
    setWsConnected(false)
    ;(window as any).__wsCleanup?.()
    ;(window as any).__wsCleanup = null
  }

  const handleWSSend = () => {
    if (!wsSendMessage.trim() || !wsConnected) return
    const api = getApi()
    ;(api as any)?.securityWSSend?.(wsUrl, wsSendMessage)
    setWsMessages(prev => [...prev, {
      id: `ws-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      direction: 'client->server',
      data: wsSendMessage,
      timestamp: Date.now(),
      binary: false,
    }])
    setWsSendMessage('')
  }

  const parseHeaders = (raw: string) => {
    return raw.split('\n').reduce<Record<string, string>>((acc, line) => {
      const i = line.indexOf(':')
      if (i > 0) acc[line.slice(0, i).trim()] = line.slice(i + 1).trim()
      return acc
    }, {})
  }

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  const pendingCount = intercepted.filter(i => !i.action).length

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="h-10 px-3 border-b border-nova-border bg-nova-bg-secondary flex items-center gap-2 shrink-0">
        <button
          onClick={toggleIntercept}
          className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
            isInterceptEnabled
              ? 'bg-nova-error/20 text-nova-error border border-nova-error/40'
              : 'bg-nova-bg text-nova-text-secondary border border-nova-border hover:bg-nova-hover'
          }`}
        >
          {isInterceptEnabled ? <Pause size={12} /> : <Play size={12} />}
          {isInterceptEnabled ? 'Interceptando' : 'Interceptar'}
        </button>

        {isInterceptEnabled && (
          <>
            <button
              onClick={handleForwardAll}
              disabled={pendingCount === 0}
              className="flex items-center gap-1.5 px-3 py-1 rounded bg-nova-success/20 text-nova-success border border-nova-success/40 text-xs font-medium disabled:opacity-40"
            >
              <Send size={12} /> Encaminhar tudo ({pendingCount})
            </button>
            <button
              onClick={handleDropAll}
              disabled={pendingCount === 0}
              className="flex items-center gap-1.5 px-3 py-1 rounded bg-nova-error/10 text-nova-error border border-nova-error/30 text-xs font-medium disabled:opacity-40"
            >
              <Ban size={12} /> Descartar tudo
            </button>
          </>
        )}

        {isInterceptEnabled && (
          <span className={`ml-auto font-medium text-xs ${pendingCount > 0 ? 'text-nova-accent' : 'text-nova-text-muted'}`}>
            {pendingCount > 0 ? `${pendingCount} pendente${pendingCount > 1 ? 's' : ''}` : 'Aguardando...'}
          </span>
        )}
      </div>

      {/* Sub-tabs: Intercept | Repeater | WebSocket */}
      <div className="h-8 shrink-0 flex items-center bg-nova-bg-secondary border-b border-nova-border px-2">
        {([
          ['intercept', 'Interceptar'],
          ['repeater', 'Repeater'],
          ['ws', 'WebSocket'],
        ] as const).map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => setActiveSubTab(tab)}
            className={`h-7 px-3 border-b-2 text-[10px] font-medium transition-colors ${
              activeSubTab === tab
                ? 'border-nova-accent text-nova-accent'
                : 'border-transparent text-nova-text-muted hover:text-nova-text'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Intercept Tab */}
      {activeSubTab === 'intercept' && isInterceptEnabled && (
        <div className="flex-1 flex min-h-0">
          {/* Lista de itens interceptados */}
          <div className="w-[40%] border-r border-nova-border overflow-auto scrollbar-thin bg-nova-bg">
            {intercepted.length === 0 ? (
              <div className="h-full flex items-center justify-center text-nova-text-muted text-xs p-4 text-center">
                As requisições serão interceptadas em tempo real. Navegue no site para começar.
                <br /><span className="text-[9px] mt-2 block">Requsições e respostas HTTP serão pausadas para sua análise.</span>
              </div>
            ) : (
              intercepted.map(item => (
                <div
                  key={item.interceptId}
                  onClick={() => handleSelect(item)}
                  className={`p-3 border-b border-nova-border/50 transition-colors ${
                    item.action
                      ? 'opacity-40 cursor-default'
                      : 'cursor-pointer hover:bg-nova-hover/40'
                  } ${
                    selectedId === item.interceptId ? 'bg-nova-accent/10 border-l-2 border-l-nova-accent' : ''
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                      item.method === 'GET' ? 'bg-green-500/20 text-green-400' :
                      item.method === 'POST' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-yellow-500/20 text-yellow-400'
                    }`}>{item.method}</span>
                    <span className={`text-[9px] px-1 py-0.5 rounded ${
                      item.type === 'request'
                        ? 'bg-purple-500/20 text-purple-400'
                        : 'bg-orange-500/20 text-orange-400'
                    }`}>{item.type === 'request' ? 'REQ' : 'RES'}</span>
                    {item.action && (
                      <span className={`text-[9px] px-1 py-0.5 rounded ${
                        item.action === 'forwarded' ? 'bg-nova-success/20 text-nova-success' : 'bg-nova-error/20 text-nova-error'
                      }`}>{item.action.toUpperCase()}</span>
                    )}
                    {item.status && !item.action && (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-nova-hover text-nova-text-secondary">{item.status}</span>
                    )}
                  </div>
                  <div className="text-[11px] truncate text-nova-text font-mono">{item.url}</div>
                  {!item.action && (
                    <div className="flex gap-1 mt-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleForward(item.interceptId) }}
                        className="flex items-center gap-1 px-2 py-0.5 bg-nova-success/15 text-nova-success rounded text-[9px] hover:bg-nova-success/25"
                      >
                        <Send size={10} /> Forward
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDrop(item.interceptId) }}
                        className="flex items-center gap-1 px-2 py-0.5 bg-nova-error/15 text-nova-error rounded text-[9px] hover:bg-nova-error/25"
                      >
                        <Ban size={10} /> Drop
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); sendToRepeater(item) }}
                        className="flex items-center gap-1 px-2 py-0.5 bg-orange-500/15 text-orange-400 rounded text-[9px] hover:bg-orange-500/25 ml-auto"
                      >
                        <RefreshCw size={10} /> Repeater
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Editor */}
          <div className="flex-1 overflow-auto scrollbar-thin bg-[#0a0f0d]">
            {selected && !selected.action ? (
              <div className="p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield size={13} className={selected.type === 'request' ? 'text-purple-400' : 'text-orange-400'} />
                    <span className="text-xs font-semibold">{selected.type === 'request' ? 'Requisição Interceptada' : 'Resposta Interceptada'}</span>
                    {selected.status && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-nova-hover">HTTP {selected.status}</span>}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleForward(selected.interceptId)}
                      className="flex items-center gap-1 px-3 py-1 bg-nova-success/20 text-nova-success border border-nova-success/40 rounded text-[10px] hover:bg-nova-success/30"
                    >
                      <Send size={11} /> Encaminhar
                    </button>
                    <button
                      onClick={() => handleDrop(selected.interceptId)}
                      className="flex items-center gap-1 px-3 py-1 bg-nova-error/20 text-nova-error border border-nova-error/40 rounded text-[10px] hover:bg-nova-error/30"
                    >
                      <Ban size={11} /> Descartar
                    </button>
                  </div>
                </div>

                <div className="flex gap-2">
                  <div className="w-20">
                    <label className="text-[10px] text-nova-text-muted block mb-1">Método</label>
                    <input
                      value={editMethod}
                      onChange={e => setEditMethod(e.target.value.toUpperCase())}
                      className="w-full bg-nova-input-bg border border-nova-input-border rounded px-2 py-1 font-mono text-[11px]"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] text-nova-text-muted block mb-1">URL</label>
                    <input
                      value={editUrl}
                      onChange={e => setEditUrl(e.target.value)}
                      className="w-full bg-nova-input-bg border border-nova-input-border rounded px-2 py-1 font-mono text-[11px]"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] text-nova-text-muted">Headers</label>
                    <button
                      onClick={() => copyToClipboard(editHeaders, 'headers')}
                      className="flex items-center gap-1 text-[9px] text-nova-text-muted hover:text-nova-accent"
                    >
                      {copiedId === 'headers' ? <Check size={10} /> : <Copy size={10} />}
                    </button>
                  </div>
                  <textarea
                    value={editHeaders}
                    onChange={e => setEditHeaders(e.target.value)}
                    className="w-full min-h-[80px] bg-nova-input-bg border border-nova-input-border rounded p-2 font-mono text-[10px] outline-none resize-y"
                    spellCheck={false}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] text-nova-text-muted">Body</label>
                    <button
                      onClick={() => copyToClipboard(editBody, 'body')}
                      className="flex items-center gap-1 text-[9px] text-nova-text-muted hover:text-nova-accent"
                    >
                      {copiedId === 'body' ? <Check size={10} /> : <Copy size={10} />}
                    </button>
                  </div>
                  <textarea
                    value={editBody}
                    onChange={e => setEditBody(e.target.value)}
                    className="w-full min-h-[120px] bg-nova-input-bg border border-nova-input-border rounded p-2 font-mono text-[10px] outline-none resize-y"
                    spellCheck={false}
                    placeholder="Body da requisição (vazio = sem body)"
                  />
                </div>

                <div className="flex gap-2 pt-2 border-t border-nova-border">
                  <button
                    onClick={() => handleForward(selected.interceptId)}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-nova-success/20 text-nova-success border border-nova-success/40 rounded text-xs hover:bg-nova-success/30"
                  >
                    <Send size={12} /> Encaminhar Modificado
                  </button>
                  <button
                    onClick={() => handleDrop(selected.interceptId)}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-nova-error/15 text-nova-error border border-nova-error/30 rounded text-xs hover:bg-nova-error/25"
                  >
                    <Ban size={12} /> Descartar
                  </button>
                </div>
              </div>
            ) : selected?.action ? (
              <div className="h-full flex items-center justify-center text-nova-text-muted text-xs p-4 text-center">
                <div>
                  <Check size={24} className="mx-auto mb-2 text-nova-success" />
                  <p>Esta requisição foi {selected.action === 'forwarded' ? 'encaminhada' : 'descartada'}.</p>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-nova-text-muted text-xs p-4 text-center">
                <div className="space-y-2">
                  <Shield size={24} className="mx-auto text-nova-text-muted/50" />
                  <p className="text-sm font-medium">Interceptação de Tráfego</p>
                  <p className="text-xs">Selecione uma requisição ou resposta para editar antes de encaminhar.</p>
                  <ul className="text-xs text-left max-w-xs mx-auto mt-3 space-y-1.5 list-disc pl-4">
                    <li>Requisições e respostas são pausadas em tempo real</li>
                    <li>Modifique método, URL, headers e body</li>
                    <li>Encaminhe ou descarte itens individualmente</li>
                    <li>Respostas também podem ser interceptadas</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Intercept disabled placeholder */}
      {activeSubTab === 'intercept' && !isInterceptEnabled && (
        <div className="flex-1 flex items-center justify-center text-nova-text-muted p-4 bg-nova-bg">
          <div className="text-center space-y-2">
            <Shield size={32} className="mx-auto text-nova-text-muted/30" />
            <p className="text-sm font-medium">Interceptação em Tempo Real</p>
            <p className="text-xs">Ative a interceptação para pausar, modificar e liberar requisições HTTP.
            <br /><span className="text-[9px] block mt-1">Requer MITM ativo para funcionar corretamente.</span></p>
          </div>
        </div>
      )}

      {/* Repeater Tab — Burp Suite style resend */}
      {activeSubTab === 'repeater' && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Request section */}
          <div className="border-b border-nova-border bg-nova-bg-secondary p-3 space-y-2 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Repeater</span>
              <span className="text-[9px] text-nova-text-muted">Modifique e reenvie requisições manualmente</span>
            </div>
            <div className="flex gap-2">
              <div className="w-20">
                <label className="text-[9px] text-nova-text-muted block mb-0.5">Método</label>
                <select
                  value={repeaterMethod}
                  onChange={e => setRepeaterMethod(e.target.value)}
                  className="w-full bg-nova-input-bg border border-nova-input-border rounded px-2 py-1.5 text-[10px] font-mono"
                >
                  {['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'].map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="text-[9px] text-nova-text-muted block mb-0.5">URL</label>
                <input
                  value={repeaterUrl}
                  onChange={e => setRepeaterUrl(e.target.value)}
                  placeholder="https://exemplo.com/api/endpoint"
                  className="w-full bg-nova-input-bg border border-nova-input-border rounded px-2 py-1.5 text-[10px] font-mono"
                />
              </div>
              <button
                onClick={handleRepeaterSend}
                disabled={repeaterLoading || !repeaterUrl.trim()}
                className="flex items-center gap-1 px-4 py-1.5 rounded-lg bg-orange-500/20 text-orange-400 border border-orange-500/30 text-xs font-medium hover:bg-orange-500/30 disabled:opacity-40 self-end"
              >
                {repeaterLoading ? <RefreshCw size={11} className="animate-spin" /> : <Send size={11} />}
                Enviar
              </button>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[9px] text-nova-text-muted block mb-0.5">Headers (um por linha: Key: Value)</label>
                <textarea
                  value={repeaterHeaders}
                  onChange={e => setRepeaterHeaders(e.target.value)}
                  className="w-full bg-nova-input-bg border border-nova-input-border rounded p-2 font-mono text-[10px] h-16 resize-none"
                  placeholder="Content-Type: application/json"
                  spellCheck={false}
                />
              </div>
            </div>
            {['POST', 'PUT', 'PATCH'].includes(repeaterMethod) && (
              <div>
                <label className="text-[9px] text-nova-text-muted block mb-0.5">Body</label>
                <textarea
                  value={repeaterBody}
                  onChange={e => setRepeaterBody(e.target.value)}
                  className="w-full bg-nova-input-bg border border-nova-input-border rounded p-2 font-mono text-[10px] h-20 resize-y"
                  placeholder='{"key": "value"}'
                  spellCheck={false}
                />
              </div>
            )}
          </div>

          {/* Response section */}
          <div className="flex-1 overflow-auto scrollbar-thin bg-[#0a0f0d]">
            {repeaterLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <RefreshCw size={24} className="text-orange-400 animate-spin mx-auto mb-2" />
                  <p className="text-xs text-nova-text-muted">Enviando requisição...</p>
                </div>
              </div>
            ) : repeaterResponse ? (
              <div className="p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] font-mono px-2 py-0.5 rounded font-bold ${
                    repeaterResponse.status >= 500 ? 'bg-red-500/20 text-red-400' :
                    repeaterResponse.status >= 400 ? 'bg-orange-500/20 text-orange-400' :
                    repeaterResponse.status >= 300 ? 'bg-yellow-500/20 text-yellow-400' :
                    repeaterResponse.status >= 200 ? 'bg-green-500/20 text-green-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {repeaterResponse.status || '???'} {repeaterResponse.statusText}
                  </span>
                  <span className="text-[10px] text-nova-text-muted">{repeaterResponse.time}ms</span>
                </div>
                {repeaterResponse.headers && (
                  <div>
                    <label className="text-[9px] text-nova-text-muted block mb-1">Headers de Resposta</label>
                    <pre className="bg-nova-bg border border-nova-border rounded p-2 text-[10px] font-mono text-nova-text overflow-auto max-h-[120px] whitespace-pre-wrap">{repeaterResponse.headers}</pre>
                  </div>
                )}
                <div>
                  <label className="text-[9px] text-nova-text-muted block mb-1">Body da Resposta</label>
                  <pre className="bg-nova-bg border border-nova-border rounded p-2 text-[10px] font-mono text-nova-text overflow-auto max-h-[400px] whitespace-pre-wrap">{repeaterResponse.body}</pre>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-nova-text-muted">
                <div className="text-center">
                  <Send size={24} className="mx-auto mb-2 opacity-30" />
                  <p className="text-xs">Preencha a URL e clique em Enviar</p>
                  <p className="text-[9px] mt-1">Selecione um item da aba "Interceptar" e use "Enviar p/ Repeater"</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* WebSocket Tab */}
      {activeSubTab === 'ws' && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="border-b border-nova-border bg-nova-bg-secondary p-3 flex items-center gap-2 shrink-0">
            <Wifi size={13} className={wsConnected ? 'text-green-400' : 'text-nova-text-muted'} />
            <span className="text-[10px] font-bold uppercase tracking-wider">WebSocket Monitor</span>
            <input
              value={wsUrl}
              onChange={e => setWsUrl(e.target.value)}
              placeholder="ws://localhost:8080/ws"
              className="flex-1 max-w-md bg-nova-input-bg border border-nova-input-border rounded px-2 py-1 text-[10px] font-mono"
            />
            {wsConnected ? (
              <button onClick={handleWSDisconnect} className="px-3 py-1 rounded bg-red-500/20 text-red-400 text-[10px] font-medium hover:bg-red-500/30">
                Desconectar
              </button>
            ) : (
              <button onClick={handleWSConnect} disabled={!wsUrl.trim()} className="px-3 py-1 rounded bg-green-500/20 text-green-400 text-[10px] font-medium hover:bg-green-500/30 disabled:opacity-40">
                Conectar
              </button>
            )}
            {wsConnected && (
              <span className="text-[10px] text-green-400 font-medium ml-auto">
                {wsMessages.length} mensagens
              </span>
            )}
          </div>

          {/* WS Messages */}
          <div className="flex-1 overflow-auto scrollbar-thin bg-[#0a0f0d] p-2 space-y-1">
            {wsMessages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-nova-text-muted">
                <div className="text-center">
                  <Wifi size={24} className="mx-auto mb-2 opacity-30" />
                  <p className="text-xs">Conecte a um WebSocket para monitorar mensagens</p>
                </div>
              </div>
            ) : (
              wsMessages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex items-start gap-2 px-2 py-1.5 rounded text-[10px] font-mono ${
                    msg.direction === 'client->server'
                      ? 'bg-blue-500/10 border border-blue-500/20'
                      : 'bg-green-500/10 border border-green-500/20'
                  }`}
                >
                  <span className={`text-[9px] px-1 py-0.5 rounded flex-shrink-0 ${
                    msg.direction === 'client->server'
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'bg-green-500/20 text-green-400'
                  }`}>
                    {msg.direction === 'client->server' ? '→' : '←'}
                  </span>
                  <span className="text-nova-text break-all flex-1">{msg.data}</span>
                  <span className="text-[8px] text-nova-text-muted flex-shrink-0">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                </div>
              ))
            )}
          </div>

          {/* WS Send */}
          {wsConnected && (
            <div className="border-t border-nova-border bg-nova-bg-secondary p-2 flex items-center gap-2 shrink-0">
              <input
                value={wsSendMessage}
                onChange={e => setWsSendMessage(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleWSSend() }}
                placeholder="Mensagem para enviar..."
                className="flex-1 bg-nova-input-bg border border-nova-input-border rounded px-2 py-1 text-[10px] font-mono"
              />
              <button
                onClick={handleWSSend}
                disabled={!wsSendMessage.trim()}
                className="px-3 py-1 rounded bg-blue-500/20 text-blue-400 text-[10px] font-medium hover:bg-blue-500/30 disabled:opacity-40"
              >
                Enviar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
