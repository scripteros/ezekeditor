import { useState, useRef, useEffect, useCallback } from 'react'
import { Play, Square, Send, Edit3, Pause, Globe, Trash2, Copy, Check, XCircle, Shield, Ban, ArrowUp } from 'lucide-react'
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
  action?: 'forwarded' | 'dropped'
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

      {isInterceptEnabled ? (
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
      ) : (
        <div className="flex-1 flex items-center justify-center text-nova-text-muted p-4 bg-nova-bg">
          <div className="text-center space-y-2">
            <Shield size={32} className="mx-auto text-nova-text-muted/30" />
            <p className="text-sm font-medium">Interceptação em Tempo Real</p>
            <p className="text-xs">Ative a interceptação para pausar, modificar e liberar requisições HTTP.
            <br /><span className="text-[9px] block mt-1">Requer MITM ativo para funcionar corretamente.</span></p>
          </div>
        </div>
      )}
    </div>
  )
}
