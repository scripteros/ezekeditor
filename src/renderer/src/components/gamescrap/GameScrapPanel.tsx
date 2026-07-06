import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Gamepad2, Globe, Crosshair, MousePointer, Eye, EyeOff,
  Play, Square, Plus, Trash2, Edit3, Terminal, Send, Bot,
  Skull, Loader2, Cpu, Zap, Copy, Check, RefreshCw,
  ExternalLink, ChevronDown, ChevronRight, Code, Scissors,
  ArrowRight, Layers, Wifi, Download, Bug
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useGameScrapStore } from '../../store/gameScrapStore'
import { useAIStore } from '../../store/aiStore'
import { getApi } from '../../utils/platform'

export default function GameScrapPanel() {
  const {
    browserUrl, isBrowserActive,
    trackedElements, selectedElementId, editingElementId, isWatching,
    scrapedItems, scrapCodeOutput,
    activeActions,
    setBrowserUrl, setBrowserActive,
    addTrackedElement, updateTrackedElement, removeTrackedElement,
    updateElementValue, setSelectedElement, setEditingElement, setWatching,
    recordClick,
    addScrapedItem, clearScrapedItems, setScrapCodeOutput, appendScrapCodeOutput,
    logClick, logExtraction, logNavigation, logInput, clearActions,
    getGameContextPrompt, getScrapContextPrompt,
  } = useGameScrapStore()

  const { messages: allMessages, isStreaming, isProcessing, sendMessage } = useAIStore()

  const [activeTab, setActiveTab] = useState<'game' | 'scrap'>('game')
  const [chatInput, setChatInput] = useState('')
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null)
  const [urlInput, setUrlInput] = useState('')
  const [newSelector, setNewSelector] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [newClickable, setNewClickable] = useState(false)
  const [newClickInterval, setNewClickInterval] = useState(1000)
  const [newAttrName, setNewAttrName] = useState('')
  const [editSelector, setEditSelector] = useState('')
  const [editLabel, setEditLabel] = useState('')
  const [editClickable, setEditClickable] = useState(false)
  const [editClickInterval, setEditClickInterval] = useState(1000)
  const [editAttrName, setEditAttrName] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [watchingInterval, setWatchingInterval] = useState(2000)

  const webviewRef = useRef<HTMLWebViewElement | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const watchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const clickTimerRefs = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map())

  // Filtra mensagens do chat
  const [chatStartIndex] = useState(() => allMessages.length)
  const visibleMessages = allMessages.slice(chatStartIndex)

  // URL input sync
  useEffect(() => {
    if (browserUrl && !urlInput) setUrlInput(browserUrl)
  }, [browserUrl])

  // Auto-scroll chat
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [visibleMessages.length, isStreaming, isProcessing])

  // Navegação
  const navigate = () => {
    const url = urlInput.startsWith('http') ? urlInput : `https://${urlInput}`
    setBrowserUrl(url)
    setUrlInput(url)
    setBrowserActive(true)
    logNavigation(url)
  }

  // DOM Watching loop
  useEffect(() => {
    if (isWatching && webviewRef.current) {
      watchTimerRef.current = setInterval(() => {
        try {
          const wv = webviewRef.current
          if (!wv) return

          for (const el of trackedElements.filter(e => e.enabled)) {
            const js = `
              (function() {
                try {
                  const el = document.querySelector('${el.selector.replace(/'/g, "\\'")}');
                  if (!el) return null;
                  const text = el.textContent?.trim().slice(0, 500) || '';
                  const value = (el as any).value || '';
                  const attr = '${(el.attributeName || '').replace(/'/g, "\\'")}' ? el.getAttribute('${(el.attributeName || '').replace(/'/g, "\\'")}') || '' : '';
                  return { text, value, attr };
                } catch(e) { return null; }
              })()
            `
            wv.executeJavaScript(js).then((result: any) => {
              if (result) {
                updateElementValue(el.id, result.text, result.value, result.attr || el.currentAttribute)
              }
            }).catch(() => {})
          }
        } catch {}
      }, watchingInterval)

      return () => {
        if (watchTimerRef.current) clearInterval(watchTimerRef.current)
      }
    }
  }, [isWatching, trackedElements, watchingInterval])

  // Auto-click elements
  useEffect(() => {
    const timers = clickTimerRefs.current
    timers.forEach((timer) => clearInterval(timer))
    timers.clear()

    if (isBrowserActive && webviewRef.current) {
      for (const el of trackedElements.filter(e => e.enabled && e.clickable)) {
        const timer = setInterval(() => {
          try {
            const wv = webviewRef.current
            if (!wv) return
            const js = `
              (function() {
                const el = document.querySelector('${el.selector.replace(/'/g, "\\'")}');
                if (el) { el.click(); return true; }
                return false;
              })()
            `
            wv.executeJavaScript(js).then((clicked: boolean) => {
              if (clicked) recordClick(el.id)
            }).catch(() => {})
          } catch {}
        }, el.clickInterval || 1000)

        timers.set(el.id, timer)
      }
    }

    return () => {
      timers.forEach((timer) => clearInterval(timer))
      timers.clear()
    }
  }, [isBrowserActive, trackedElements])

  // Extrair elemento
  const extractElement = (selector: string, label: string) => {
    if (!webviewRef.current) return
    const js = `
      (function() {
        try {
          const el = document.querySelector('${selector.replace(/'/g, "\\'")}');
          if (!el) return { text: '(não encontrado)', html: '' };
          return { text: el.textContent?.trim().slice(0, 2000) || '', html: el.outerHTML?.slice(0, 2000) || '' };
        } catch(e) { return { text: '(erro)', html: '' }; }
      })()
    `
    webviewRef.current.executeJavaScript(js).then((result: any) => {
      if (result) {
        addScrapedItem({
          selector,
          label: label || selector,
          value: result.text || result.html || '',
          format: 'text',
        })
        appendScrapCodeOutput(`// Extraído de: ${selector}\n// ${label}\nconst data_${scrapedItems.length} = ${JSON.stringify(result.text?.slice(0, 500))};\n`)
        logExtraction(selector)
      }
    }).catch(() => {})
  }

  // Executar clique manual
  const manualClick = (selector: string) => {
    if (!webviewRef.current) return
    const js = `
      (function() {
        const el = document.querySelector('${selector.replace(/'/g, "\\'")}');
        if (el) { el.click(); return true; }
        return false;
      })()
    `
    webviewRef.current.executeJavaScript(js).then((clicked: boolean) => {
      if (clicked) logClick(selector)
    }).catch(() => {})
  }

  // Enviar chat para IA com contexto
  const handleChatSend = () => {
    const text = chatInput.trim()
    if (!text) return
    setChatInput('')

    let fullMessage = '[MODO: ' + (activeTab === 'game' ? 'GAME AUTOMATION' : 'WEB SCRAPING') + ']'

    if (browserUrl) {
      fullMessage += `\n🌐 URL atual: ${browserUrl}`
    }

    // Injeta contexto do modo ativo
    if (activeTab === 'game') {
      const ctx = getGameContextPrompt()
      if (ctx) fullMessage = ctx + '\n\n' + fullMessage
    } else {
      const ctx = getScrapContextPrompt()
      if (ctx) fullMessage = ctx + '\n\n' + fullMessage
    }

    fullMessage += `\n\n${text}\n\nAja imediatamente usando as ações JSON disponíveis.`

    sendMessage(fullMessage)
  }

  // Preparar formulário de edição
  const startEdit = (id: string) => {
    const el = trackedElements.find(e => e.id === id)
    if (!el) return
    setEditingElement(id)
    setEditSelector(el.selector)
    setEditLabel(el.label)
    setEditClickable(el.clickable)
    setEditClickInterval(el.clickInterval)
    setEditAttrName(el.attributeName || '')
  }

  // Salvar edição
  const saveEdit = () => {
    if (!editingElementId) return
    updateTrackedElement(editingElementId, {
      selector: editSelector,
      label: editLabel,
      clickable: editClickable,
      clickInterval: editClickInterval,
      attributeName: editAttrName,
    })
  }

  // Adicionar novo elemento
  const handleAddElement = () => {
    if (!newSelector.trim() || !newLabel.trim()) return
    addTrackedElement({
      selector: newSelector.trim(),
      label: newLabel.trim(),
      clickable: newClickable,
      clickInterval: newClickInterval,
      attributeName: newAttrName.trim(),
      enabled: true,
    })
    setNewSelector('')
    setNewLabel('')
    setNewClickable(false)
    setNewClickInterval(1000)
    setNewAttrName('')
    setShowAddForm(false)
  }

  const watchingElements = trackedElements.filter(e => e.enabled)
  const clickableElements = trackedElements.filter(e => e.enabled && e.clickable)

  return (
    <div className="h-full flex flex-col bg-nova-bg overflow-hidden">
      {/* Header */}
      <div className="h-10 px-3 border-b border-nova-border bg-nova-bg-secondary flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('game')}
            className={`h-7 px-3 text-[10px] font-medium rounded-t border-b-2 transition-colors flex items-center gap-1 ${
              activeTab === 'game'
                ? 'border-purple-400 text-purple-400'
                : 'border-transparent text-nova-text-muted hover:text-nova-text'
            }`}
          >
            <Gamepad2 size={11} />
            Game
          </button>
          <button
            onClick={() => setActiveTab('scrap')}
            className={`h-7 px-3 text-[10px] font-medium rounded-t border-b-2 transition-colors flex items-center gap-1 ${
              activeTab === 'scrap'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-nova-text-muted hover:text-nova-text'
            }`}
          >
            <Scissors size={11} />
            Web Scrap
          </button>
        </div>

        {/* URL bar */}
        <div className="flex-1 flex items-center gap-1">
          <div className="flex-1 flex items-center gap-1 bg-nova-input-bg border border-nova-input-border rounded px-2 py-1">
            <Globe size={11} className="text-nova-text-muted flex-shrink-0" />
            <input
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') navigate() }}
              placeholder="https://..."
              className="flex-1 bg-transparent text-[10px] text-nova-text outline-none font-mono"
            />
            {urlInput && (
              <button onClick={() => { setUrlInput(''); setBrowserUrl(''); setBrowserActive(false) }} className="text-nova-text-muted hover:text-nova-text">
                <Trash2 size={11} />
              </button>
            )}
          </div>
          <button
            onClick={navigate}
            disabled={!urlInput.trim()}
            className="p-1.5 rounded bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 disabled:opacity-30 border border-purple-500/30"
          >
            <ExternalLink size={12} />
          </button>
        </div>

        {/* Toggle watch */}
        <button
          onClick={() => setWatching(!isWatching)}
          className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-medium transition-colors ${
            isWatching
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : 'bg-nova-bg-secondary text-nova-text-muted border border-nova-border'
          }`}
        >
          {isWatching ? <Eye size={10} /> : <EyeOff size={10} />}
          {isWatching ? 'Monitorando' : 'Monitorar'}
        </button>
      </div>

      {/* Split: Browser + Chat (esq) | Inspector (dir) */}
      <div className={`flex-1 flex min-h-0 ${isBrowserActive ? '' : 'hidden'}`}>
        {/* Coluna Esquerda: Browser + Chat */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Browser view */}
          <div className="flex-1 min-h-0 border-b border-nova-border">
            <webview
              ref={webviewRef as any}
              src={browserUrl}
              style={{ width: '100%', height: '100%' }}
              allowpopups="true"
            />
          </div>

          {/* Chat integrado */}
          <div className="h-[200px] flex flex-col bg-nova-bg-secondary border-t border-nova-border">
            <div className="h-7 px-3 border-b border-nova-border flex items-center gap-2 shrink-0">
              <span className="text-[9px] font-bold uppercase tracking-wider text-purple-400">Chat IA</span>
              {isProcessing && (
                <span className="text-[8px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded-full animate-pulse">PROCESSANDO</span>
              )}
            </div>
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-thin">
              {/* IA pensando */}
              {isProcessing && visibleMessages.length === 0 && (
                <div className="flex items-center gap-2 px-2 py-3 bg-purple-500/5 rounded-lg border border-purple-500/20">
                  <Cpu size={12} className="text-purple-400 animate-spin" />
                  <span className="text-[10px] text-purple-400/80">IA analisando o jogo...</span>
                  <div className="flex gap-1 ml-auto">
                    <span className="w-1 h-1 rounded-full bg-purple-400 animate-bounce" />
                    <span className="w-1 h-1 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1 h-1 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
              {visibleMessages.map(msg => {
                const isUser = msg.role === 'user'
                return (
                  <div key={msg.id} className={`flex gap-1.5 ${isUser ? 'justify-end' : ''}`}>
                    {!isUser && <div className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0 mt-0.5"><Bot size={10} className="text-purple-400" /></div>}
                    <div className={`max-w-[85%] rounded-lg px-2 py-1.5 text-[10px] leading-relaxed relative group ${
                      isUser ? 'bg-nova-accent/15 border border-nova-accent/30' : 'bg-nova-bg border border-nova-border'
                    }`}>
                      {!isUser && (
                        <button
                          onClick={() => { navigator.clipboard.writeText(msg.content); setCopiedMsgId(msg.id); setTimeout(() => setCopiedMsgId(null), 2000) }}
                          className="absolute top-0.5 right-0.5 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-nova-hover text-nova-text-muted transition-all"
                        >
                          {copiedMsgId === msg.id ? <Check size={9} className="text-green-400" /> : <Copy size={9} />}
                        </button>
                      )}
                      <div className="select-text prose prose-xs prose-invert max-w-none break-words [&_pre]:text-[9px] [&_code]:text-[9px]">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {isUser ? msg.content.slice(0, 200) + (msg.content.length > 200 ? '...' : '') : msg.content}
                        </ReactMarkdown>
                      </div>
                    </div>
                    {isUser && <div className="w-5 h-5 rounded-full bg-nova-accent/20 flex items-center justify-center flex-shrink-0 mt-0.5"><ArrowRight size={10} className="text-nova-accent" /></div>}
                  </div>
                )
              })}
            </div>
            {/* Input */}
            <div className="p-1.5 border-t border-nova-border flex items-center gap-1 shrink-0">
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSend() } }}
                placeholder={activeTab === 'game' ? 'Peça para a IA jogar...' : 'Descreva o que extrair...'}
                className="flex-1 bg-nova-input-bg border border-nova-input-border rounded px-2 py-1 text-[10px] outline-none focus:border-purple-500/50"
                disabled={isProcessing}
              />
              <button
                onClick={handleChatSend}
                disabled={!chatInput.trim() || isProcessing}
                className="p-1 rounded bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 disabled:opacity-30"
              >
                <Send size={12} />
              </button>
            </div>
          </div>
        </div>

        {/* Coluna Direita: Inspector */}
        <div className="w-[320px] border-l border-nova-border flex flex-col min-h-0 bg-nova-bg-secondary flex-shrink-0">
          {/* Sub-tabs do inspector */}
          <div className="h-8 px-2 border-b border-nova-border flex items-center gap-0.5 shrink-0">
            <span className="text-[9px] font-bold uppercase tracking-wider text-nova-text-muted mr-2">
              {activeTab === 'game' ? 'Inspector' : 'Scrap'}
            </span>
            {activeTab === 'game' && (
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="flex items-center gap-1 px-2 py-1 rounded text-[9px] bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 ml-auto"
              >
                <Plus size={9} /> Elemento
              </button>
            )}
          </div>

          {/* Game Mode: Element Inspector */}
          {activeTab === 'game' && (
            <div className="flex-1 overflow-auto scrollbar-thin">
              {/* Add form */}
              {showAddForm && (
                <div className="p-3 border-b border-nova-border bg-nova-bg space-y-2">
                  <input value={newSelector} onChange={e => setNewSelector(e.target.value)} placeholder="Selector CSS (ex: #score, .health-bar)" className="w-full bg-nova-input-bg border border-nova-input-border rounded px-2 py-1 text-[10px] font-mono outline-none focus:border-purple-500/50" />
                  <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Nome (ex: Vida, Score, Moedas)" className="w-full bg-nova-input-bg border border-nova-input-border rounded px-2 py-1 text-[10px] outline-none focus:border-purple-500/50" />
                  <input value={newAttrName} onChange={e => setNewAttrName(e.target.value)} placeholder="Atributo HTML (ex: data-value, href)" className="w-full bg-nova-input-bg border border-nova-input-border rounded px-2 py-1 text-[10px] font-mono outline-none focus:border-purple-500/50" />
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-1 text-[10px] text-nova-text-muted">
                      <input type="checkbox" checked={newClickable} onChange={e => setNewClickable(e.target.checked)} className="rounded" />
                      Clicável
                    </label>
                    {newClickable && (
                      <input
                        type="number"
                        value={newClickInterval}
                        onChange={e => setNewClickInterval(Number(e.target.value))}
                        placeholder="Intervalo (ms)"
                        className="w-20 bg-nova-input-bg border border-nova-input-border rounded px-2 py-0.5 text-[10px]"
                      />
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={handleAddElement} className="flex-1 py-1 rounded bg-purple-500/20 text-purple-400 text-[10px] hover:bg-purple-500/30">Adicionar</button>
                    <button onClick={() => setShowAddForm(false)} className="px-3 py-1 rounded text-nova-text-muted text-[10px] hover:text-nova-text">Cancelar</button>
                  </div>
                </div>
              )}

              {/* Element list */}
              {trackedElements.length === 0 ? (
                <div className="flex items-center justify-center h-full text-nova-text-muted p-4">
                  <div className="text-center">
                    <Crosshair size={28} className="mx-auto mb-2 opacity-30" />
                    <p className="text-[10px]">Adicione elementos para monitorar</p>
                    <p className="text-[9px] mt-1 opacity-60">Use seletores CSS para rastrear scores, botões, etc</p>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-nova-border">
                  {trackedElements.map(el => (
                    <div key={el.id} className={`p-2 ${el.id === selectedElementId ? 'bg-purple-500/10' : ''}`}>
                      {/* Edição */}
                      {editingElementId === el.id ? (
                        <div className="space-y-1.5">
                          <input value={editLabel} onChange={e => setEditLabel(e.target.value)} placeholder="Nome" className="w-full bg-nova-input-bg border border-nova-input-border rounded px-2 py-1 text-[10px] outline-none" />
                          <input value={editSelector} onChange={e => setEditSelector(e.target.value)} placeholder="Selector" className="w-full bg-nova-input-bg border border-nova-input-border rounded px-2 py-1 text-[10px] font-mono outline-none" />
                          <input value={editAttrName} onChange={e => setEditAttrName(e.target.value)} placeholder="Atributo" className="w-full bg-nova-input-bg border border-nova-input-border rounded px-2 py-1 text-[10px] font-mono outline-none" />
                          <div className="flex items-center gap-4">
                            <label className="flex items-center gap-1 text-[10px]"><input type="checkbox" checked={editClickable} onChange={e => setEditClickable(e.target.checked)} className="rounded" /> Clicável</label>
                            {editClickable && <input type="number" value={editClickInterval} onChange={e => setEditClickInterval(Number(e.target.value))} className="w-20 bg-nova-input-bg border rounded px-2 py-0.5 text-[10px]" />}
                          </div>
                          <div className="flex gap-1">
                            <button onClick={saveEdit} className="flex-1 py-1 rounded bg-purple-500/20 text-purple-400 text-[10px]">Salvar</button>
                            <button onClick={() => setEditingElement(null)} className="px-3 py-1 rounded text-[10px] text-nova-text-muted">Cancelar</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setSelectedElement(el.id === selectedElementId ? null : el.id)}>
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => {
                                    const updated = !el.enabled
                                    updateTrackedElement(el.id, { enabled: updated })
                                  }}
                                  className="flex-shrink-0"
                                >
                                  {el.enabled ? <Eye size={11} className="text-green-400" /> : <EyeOff size={11} className="text-nova-text-muted" />}
                                </button>
                                <span className="text-[10px] font-bold text-nova-text truncate">{el.label}</span>
                                {el.clickable && <MousePointer size={9} className="text-purple-400 flex-shrink-0" />}
                              </div>
                              <p className="text-[9px] font-mono text-nova-text-muted mt-0.5 truncate">{el.selector}</p>
                              {el.currentText && (
                                <p className="text-[9px] text-purple-400/80 mt-0.5 truncate">"{el.currentText.slice(0, 80)}"</p>
                              )}
                              {el.currentAttribute && (
                                <p className="text-[9px] text-cyan-400/80 mt-0.5 truncate">attr: "{el.currentAttribute.slice(0, 80)}"</p>
                              )}
                            </div>
                            <div className="flex items-center gap-0.5 flex-shrink-0 ml-1">
                              <button onClick={() => startEdit(el.id)} className="p-0.5 text-nova-text-muted hover:text-nova-accent"><Edit3 size={10} /></button>
                              <button onClick={() => removeTrackedElement(el.id)} className="p-0.5 text-nova-text-muted hover:text-red-400"><Trash2 size={10} /></button>
                              <button onClick={() => manualClick(el.selector)} className="p-0.5 text-purple-400/70 hover:text-purple-400" title="Clicar agora"><MousePointer size={10} /></button>
                              <button onClick={() => extractElement(el.selector, el.label)} className="p-0.5 text-amber-400/70 hover:text-amber-400" title="Extrair valor"><Scissors size={10} /></button>
                            </div>
                          </div>

                          {/* Histórico expandido */}
                          {el.id === selectedElementId && el.history.length > 0 && (
                            <div className="mt-2 pl-3 border-l border-nova-border">
                              <p className="text-[8px] text-nova-text-muted mb-1">Histórico de mudanças:</p>
                              <div className="space-y-0.5 max-h-[100px] overflow-auto">
                                {el.history.slice(-10).reverse().map((h, i) => (
                                  <div key={i} className="text-[8px] text-nova-text-muted flex items-center gap-2">
                                    <span className="w-1 h-1 rounded-full bg-purple-400/40 flex-shrink-0" />
                                    <span className="text-purple-400/70">"{h.text || h.value}"</span>
                                    <span className="text-[7px] text-nova-text-muted/50">{new Date(h.time).toLocaleTimeString()}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Watcher settings */}
              <div className="border-t border-nova-border p-2 space-y-1 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-nova-text-muted">Intervalo:</span>
                  <input
                    type="number"
                    value={watchingInterval}
                    onChange={e => setWatchingInterval(Math.max(200, Number(e.target.value)))}
                    className="w-24 bg-nova-input-bg border border-nova-input-border rounded px-2 py-0.5 text-[9px]"
                    min="200"
                  />
                  <span className="text-[9px] text-nova-text-muted">ms</span>
                </div>
                <div className="flex items-center gap-2 text-[9px] text-nova-text-muted">
                  <span>{watchingElements.length} ativos</span>
                  <span>|</span>
                  <span>{clickableElements.length} auto-click</span>
                  {clickableElements.length > 0 && (
                    <span className="text-purple-400 animate-pulse ml-auto">● clicando</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Scrap Mode */}
          {activeTab === 'scrap' && (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Quick extract */}
              <div className="p-2 border-b border-nova-border flex gap-1 shrink-0">
                <input
                  id="scrap-selector"
                  placeholder="Selector CSS..."
                  className="flex-1 bg-nova-input-bg border border-nova-input-border rounded px-2 py-1 text-[10px] font-mono outline-none focus:border-amber-500/50"
                />
                <button
                  onClick={() => {
                    const input = document.getElementById('scrap-selector') as HTMLInputElement
                    if (input?.value.trim()) {
                      extractElement(input.value.trim(), input.value.trim())
                      manualClick(input.value.trim())
                      input.value = ''
                    }
                  }}
                  className="px-2 py-1 rounded bg-amber-500/20 text-amber-400 text-[10px] hover:bg-amber-500/30"
                >
                  Extrair
                </button>
              </div>

              {/* Scraped items */}
              <div className="flex-1 overflow-auto scrollbar-thin">
                {scrapedItems.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-nova-text-muted p-4">
                    <div className="text-center">
                      <Layers size={28} className="mx-auto mb-2 opacity-30" />
                      <p className="text-[10px]">Nada capturado ainda</p>
                      <p className="text-[9px] mt-1 opacity-60">Use o seletor acima ou o botão Extrair nos elementos</p>
                    </div>
                  </div>
                ) : (
                  <div className="divide-y divide-nova-border">
                    {scrapedItems.map(item => (
                      <div key={item.id} className="p-2">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-bold text-nova-text">{item.label}</p>
                            <p className="text-[9px] font-mono text-nova-text-muted truncate">{item.selector}</p>
                            <pre className="text-[9px] text-amber-400/80 mt-1 bg-nova-bg rounded p-1.5 max-h-[80px] overflow-auto whitespace-pre-wrap break-all">{item.value.slice(0, 300)}</pre>
                          </div>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(item.value)
                            }}
                            className="p-0.5 text-nova-text-muted hover:text-nova-accent flex-shrink-0"
                          >
                            <Copy size={10} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Code output area */}
              <div className="border-t border-nova-border p-2 shrink-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] font-bold text-amber-400 uppercase tracking-wider">Código Acumulado</span>
                  <div className="flex gap-1">
                    <button onClick={() => navigator.clipboard.writeText(scrapCodeOutput)} className="p-0.5 text-nova-text-muted hover:text-nova-accent"><Copy size={10} /></button>
                    <button onClick={() => setScrapCodeOutput('')} className="p-0.5 text-nova-text-muted hover:text-red-400"><Trash2 size={10} /></button>
                  </div>
                </div>
                <pre className="bg-[#0a0f0d] border border-nova-border rounded p-2 text-[9px] font-mono text-green-400 max-h-[150px] overflow-auto whitespace-pre-wrap select-text">
                  {scrapCodeOutput || '// O código extraído aparecerá aqui...'}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Placeholder quando sem navegador */}
      {!isBrowserActive && (
        <div className="flex-1 flex items-center justify-center text-nova-text-muted">
          <div className="text-center max-w-xs">
            <div className="w-16 h-16 rounded-2xl bg-purple-500/10 flex items-center justify-center mx-auto mb-4">
              <Gamepad2 size={28} className="text-purple-400" />
            </div>
            <p className="text-sm font-semibold text-nova-text mb-1">
              {activeTab === 'game' ? 'Modo Game Automation' : 'Modo Web Scraping'}
            </p>
            <p className="text-[10px] leading-relaxed">
              {activeTab === 'game'
                ? 'Abra um jogo ou página web e monitore elementos em tempo real. A IA verá tudo que acontece e poderá interagir automaticamente.'
                : 'Capture dados de qualquer site. Extraia textos, atributos e HTML de elementos específicos. O código é acumulado para exportação.'}
            </p>
            <div className="mt-4 p-3 bg-nova-bg-secondary rounded-lg border border-nova-border text-left space-y-1">
              <p className="text-[10px] font-bold text-nova-text">Como usar:</p>
              {activeTab === 'game' ? (
                <>
                  <p className="text-[9px] text-nova-text-muted">1. Cole a URL do jogo e clique em navegar</p>
                  <p className="text-[9px] text-nova-text-muted">2. Use DevTools (F12) para encontrar seletores</p>
                  <p className="text-[9px] text-nova-text-muted">3. Adicione elementos com "+ Elemento"</p>
                  <p className="text-[9px] text-nova-text-muted">4. Ative "Monitorar" para rastrear em tempo real</p>
                  <p className="text-[9px] text-nova-text-muted">5. Converse com a IA que vê tudo</p>
                </>
              ) : (
                <>
                  <p className="text-[9px] text-nova-text-muted">1. Navegue até o site alvo</p>
                  <p className="text-[9px] text-nova-text-muted">2. Cole seletores CSS no campo de extração</p>
                  <p className="text-[9px] text-nova-text-muted">3. Extraia texto, HTML ou atributos</p>
                  <p className="text-[9px] text-nova-text-muted">4. O código acumulado pode ser exportado</p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
