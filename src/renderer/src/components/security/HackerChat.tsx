import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Skull, Loader2, Terminal, Bug, Cpu, Zap, Copy, Check } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useAIStore } from '../../store/aiStore'
import { useSkillStore } from '../../store/skillStore'

export default function HackerChat({ targetUrl }: { targetUrl: string }) {
  const [input, setInput] = useState('')
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const { messages: allMessages, isStreaming, sendMessage, isProcessing } = useAIStore()
  const { hackerMode } = useSkillStore()

  // Filtra apenas mensagens a partir da primeira enviada pelo sistema de segurança
  const [startIndex] = useState(() => allMessages.length)

  const visibleMessages = allMessages.slice(startIndex)

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [visibleMessages.length, isStreaming])

  const handleSend = () => {
    const text = input.trim()
    if (!text) return
    setInput('')

    // Contexto hacker sempre presente
    const fullMessage = hackerMode
      ? `[COMANDO DO OPERADOR — MODO HACKER ATIVO]\nAlvo atual: ${targetUrl || 'não definido'}\n\n${text}\n\nExecute imediatamente e mostre os resultados.`
      : `[COMANDO DO OPERADOR]\nAlvo atual: ${targetUrl || 'não definido'}\n\n${text}`

    sendMessage(fullMessage)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-red-950/10 to-nova-bg">
      {/* Header */}
      <div className="h-9 px-3 border-b border-red-500/20 bg-red-950/10 flex items-center gap-2 shrink-0">
        <Skull size={13} className="text-red-400" />
        <span className="text-[11px] font-bold text-red-400 uppercase tracking-wider">
          Hacker Chat
        </span>
        {hackerMode && (
          <span className="text-[8px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full animate-pulse ml-auto">
            LIVE
          </span>
        )}
        {isProcessing && (
          <span className="text-[8px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full ml-auto animate-pulse">
            RESPONDENDO
          </span>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin">
        {/* IA Pensando — animação enquanto processa (antes da primeira resposta) */}
        {isProcessing && visibleMessages.length > 0 && visibleMessages[visibleMessages.length - 1]?.role === 'user' && (
          <div className="flex gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5 animate-pulse">
              <Skull size={12} className="text-red-400" />
            </div>
            <div className="rounded-xl rounded-bl-sm px-4 py-3 bg-nova-bg-secondary border border-red-500/20 max-w-[85%]">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Cpu size={11} className="animate-pulse" />
                  IA Hacker processando
                </span>
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Barra de progresso animada estilo matrix */}
                <div className="flex-1 h-1 bg-nova-bg rounded-full overflow-hidden">
                  <div className="h-full w-full rounded-full animate-pulse" style={{
                    background: 'linear-gradient(90deg, #dc2626 0%, #f87171 30%, #dc2626 60%, #f87171 100%)',
                    backgroundSize: '200% 100%',
                  }} />
                </div>
                <Zap size={10} className="text-red-400 animate-pulse flex-shrink-0" />
              </div>
              <p className="text-[9px] text-red-400/60 mt-2 italic">
                Analisando vulnerabilidades e preparando ataque...
              </p>
              {/* Linhas de código falsas piscando */}
              <div className="mt-2 space-y-1.5 opacity-50">
                <div className="flex gap-1.5 items-center">
                  <div className="h-1 bg-red-500/30 rounded animate-pulse" style={{ width: '40%', animationDelay: '0ms' }} />
                  <div className="h-1 bg-red-500/20 rounded animate-pulse" style={{ width: '25%', animationDelay: '200ms' }} />
                </div>
                <div className="flex gap-1.5 items-center">
                  <div className="h-1 bg-red-500/25 rounded animate-pulse" style={{ width: '60%', animationDelay: '100ms' }} />
                  <div className="h-1 bg-red-500/15 rounded animate-pulse" style={{ width: '15%', animationDelay: '300ms' }} />
                </div>
                <div className="flex gap-1.5 items-center">
                  <div className="h-1 bg-red-500/20 rounded animate-pulse" style={{ width: '30%', animationDelay: '250ms' }} />
                  <div className="h-1 bg-red-500/30 rounded animate-pulse" style={{ width: '45%', animationDelay: '50ms' }} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Indicador sutil de processamento entre tool calls (já começou a responder) */}
        {isProcessing && !isStreaming && visibleMessages.length > 0 && visibleMessages[visibleMessages.length - 1]?.role === 'assistant' && (
          <div className="flex items-center gap-2 px-2 py-1 opacity-60">
            <Cpu size={10} className="text-red-400 animate-spin" />
            <span className="text-[9px] text-red-400/60 italic">Executando ações...</span>
            <div className="flex gap-1">
              <span className="w-1 h-1 rounded-full bg-red-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1 h-1 rounded-full bg-red-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1 h-1 rounded-full bg-red-400 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}

        {visibleMessages.length === 0 && !isProcessing && (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-3">
              <Skull size={22} className="text-red-400" />
            </div>
            <p className="text-[11px] font-semibold text-nova-text mb-1">Modo Hacker Ético</p>
            <p className="text-[10px] text-nova-text-muted leading-relaxed">
              Envie comandos para a IA executar testes de invasão.<br/>
              Exemplo: <code className="text-red-400/80 bg-red-500/10 px-1 rounded">faça um pentest completo neste site</code>
            </p>
            <div className="mt-4 grid grid-cols-1 gap-1.5">
              {[
                { icon: <Bug size={11} />, cmd: 'Faça um pentest completo de SQL Injection neste site', label: 'SQL Injection' },
                { icon: <Terminal size={11} />, cmd: 'Tente burlar a autenticação do login', label: 'Auth Bypass' },
                { icon: <Bug size={11} />, cmd: 'Enumere todos os endpoints e teste XSS em cada um', label: 'XSS Scan' },
              ].map((item, i) => (
                <button
                  key={i}
                  onClick={() => { setInput(item.cmd); inputRef.current?.focus() }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-nova-border bg-nova-bg-secondary hover:bg-nova-hover text-left transition-colors group"
                >
                  <span className="text-red-400/60 group-hover:text-red-400 transition-colors">{item.icon}</span>
                  <div>
                    <span className="text-[10px] text-red-400 font-medium">{item.label}</span>
                    <p className="text-[9px] text-nova-text-muted truncate max-w-[200px]">{item.cmd}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {visibleMessages.map(msg => {
          const isUser = msg.role === 'user'
          return (
            <div key={msg.id} className={`flex gap-2 ${isUser ? 'justify-end' : ''}`}>
              {!isUser && (
                <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Skull size={12} className="text-red-400" />
                </div>
              )}
              <div className={`max-w-[85%] rounded-xl px-3 py-2 text-[11px] leading-relaxed relative group ${
                isUser
                  ? 'bg-nova-accent/15 border border-nova-accent/30 text-nova-text rounded-br-sm'
                  : 'bg-nova-bg-secondary border border-nova-border text-nova-text rounded-bl-sm'
              }`}>
                {/* Botão de copiar no canto superior direito (só na resposta da IA) */}
                {!isUser && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(msg.content)
                      setCopiedMsgId(msg.id)
                      setTimeout(() => setCopiedMsgId(null), 2000)
                    }}
                    className="absolute top-1.5 right-1.5 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-nova-hover text-nova-text-muted hover:text-nova-text transition-all select-none"
                    title="Copiar resposta"
                  >
                    {copiedMsgId === msg.id ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
                  </button>
                )}
                {isUser ? (
                  <p className="whitespace-pre-wrap break-words select-text">{msg.content.slice(0, 300)}{msg.content.length > 300 ? '...' : ''}</p>
                ) : (
                  <div className="select-text prose prose-xs prose-invert max-w-none [&_pre]:bg-nova-bg [&_pre]:border [&_pre]:border-nova-border [&_pre]:rounded-lg [&_pre]:p-2 [&_pre]:text-[10px] [&_pre]:overflow-auto [&_code]:text-red-300 [&_code]:bg-red-500/10 [&_code]:px-1 [&_code]:rounded [&_table]:text-[10px] [&_table]:w-full [&_th]:bg-nova-bg [&_th]:px-2 [&_th]:py-1 [&_td]:px-2 [&_td]:py-1 [&_td]:border [&_td]:border-nova-border [&_h3]:text-red-400 [&_h3]:text-[12px] [&_h3]:font-bold [&_strong]:text-red-400">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                )}
                {(isStreaming || (isProcessing && !isStreaming && msg.id === visibleMessages[visibleMessages.length - 1]?.id)) && !isUser && (
                  <span className="inline-flex items-center gap-1 ml-1">
                    <span className="inline-block w-1.5 h-3.5 bg-gradient-to-b from-red-400 to-red-600 rounded-sm animate-pulse align-middle shadow-[0_0_6px_rgba(220,38,38,0.6)]" />
                    {!isStreaming && <span className="text-[8px] text-red-400/60 animate-pulse italic">pensando...</span>}
                  </span>
                )}
              </div>
              {isUser && (
                <div className="w-6 h-6 rounded-full bg-nova-accent/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <User size={12} className="text-nova-accent" />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Input */}
      <div className="p-2 border-t border-nova-border bg-nova-bg-secondary shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 bg-nova-bg border border-nova-input-border rounded-lg px-3 py-1.5 focus-within:border-red-500/50 transition-colors">
            <Terminal size={12} className="text-red-400 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Comando de invasão para a IA..."
              className="flex-1 bg-transparent text-[11px] text-nova-text outline-none placeholder:text-nova-text-muted"
              disabled={isProcessing}
            />
          </div>
          {isProcessing ? (
            <button
              className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors flex-shrink-0 cursor-not-allowed"
            >
              <Loader2 size={14} className="animate-spin" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            >
              <Send size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
