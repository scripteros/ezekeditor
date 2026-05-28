import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, StopCircle, Settings, Sparkles, Copy, Check, Trash2, Save, Plus, Paperclip, X, Image, File, TerminalSquare, Mic, Database, Play } from 'lucide-react'
import { FileChangesBlock } from './FileChangesBlock'
import { ThinkingBlock } from './ThinkingBlock'
import { InlineFileEdits } from './InlineFileEdits'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { motion, AnimatePresence } from 'framer-motion'
import { useAIStore } from '../../store/aiStore'
import type { AIAttachment } from '../../../shared/types/ai'
import { useTerminalStore } from '../../store/terminalStore'
import { useEditorStore } from '../../store/editorStore'
import { useSqlStore } from '../../store/sqlStore'
import { useSidebarStore } from '../../store/sidebarStore'

export default function AIChatPanel() {
  const {
    messages, addMessage, appendMessageContent, isProcessing, sendMessage, cancelRequest, config, setConfig,
    routeWayModels, isLoadingModels, fetchRouteWayModels, selectRouteWayModel,
    ollamaModels, isLoadingOllamaModels, fetchOllamaModels, selectOllamaModel,
    openRouterModels, isLoadingOpenRouterModels, fetchOpenRouterModels, selectOpenRouterModel,
    deepsproxyModels, isLoadingDeepsProxyModels, fetchDeepsProxyModels, selectDeepsProxyModel,
    isDeepsProxyInstalled, checkDeepsProxyInstalled,
    kimiproxyModels, isLoadingKimiProxyModels, fetchKimiProxyModels, selectKimiProxyModel,
    isKimiProxyInstalled, checkKimiProxyInstalled,
    geminiproxyModels, isLoadingGeminiProxyModels, fetchGeminiProxyModels, selectGeminiProxyModel,
    isGeminiProxyInstalled, checkGeminiProxyInstalled,
    deepsProxyStatus, kimiProxyStatus, geminiProxyStatus,
    savedConfigs, saveCurrentConfig, deleteConfig, loadConfig,
    chatHistories, saveChatHistory, loadChatHistory, deleteChatHistory,
    currentChatId, createNewChat, clearChat, revertMessageChanges,
    acquiredProxies, enabledAIProviders
  } = useAIStore()
  const { openDiff } = useEditorStore()
  const { setActiveView } = useSidebarStore()
  const [input, setInput] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [testStatus, setTestStatus] = useState<{status: 'idle'|'testing'|'success'|'error', msg?: string}>({status: 'idle'})
  const [isInstallingDeepsProxy, setIsInstallingDeepsProxy] = useState(false)
  const [isInstallingKimiProxy, setIsInstallingKimiProxy] = useState(false)
  const [isInstallingGeminiProxy, setIsInstallingGeminiProxy] = useState(false)
  const [streamingStatus, setStreamingStatus] = useState<string>('')
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  
  const [isListening, setIsListening] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  const toggleListening = async () => {
    if (isListening) {
      mediaRecorderRef.current?.stop()
      setIsListening(false)
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        stream.getTracks().forEach(track => track.stop())
        
        const api = (window as any).api
        if (api && api.aiStartVoiceServer) {
           await api.aiStartVoiceServer()
        }

        const formData = new FormData()
        formData.append('audio', audioBlob, 'audio.webm')
        
        try {
          setInput(prev => prev + (prev ? ' ' : '') + '🎙️ Transcrevendo...')
          
          const response = await fetch('http://127.0.0.1:8000/transcribe', {
            method: 'POST',
            body: formData
          })
          
          if (!response.ok) throw new Error('Servidor Whisper não respondeu')
          
          const data = await response.json()
          
          setInput(prev => {
            const cleanPrev = prev.replace('🎙️ Transcrevendo...', '').trim()
            const newText = cleanPrev + (cleanPrev ? ' ' : '') + data.text
            return newText
          })
        } catch (error) {
          console.error('Erro na transcrição:', error)
          setInput(prev => prev.replace('🎙️ Transcrevendo...', '').trim())
        }
      }

      mediaRecorder.start()
      setIsListening(true)
    } catch (err) {
      console.error('Erro ao acessar microfone:', err)
      alert('Permissão de microfone negada ou não disponível.')
    }
  }
  const [isDragOver, setIsDragOver] = useState(false)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Handler para colar imagens/arquivos e drag & drop
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return

      let hasHandledImage = false
      
      // Primeiro, verifica se há imagens
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        
        if (item.type.indexOf('image') !== -1) {
          e.preventDefault()
          e.stopPropagation()
          const blob = item.getAsFile()
          if (blob) {
            const fileName = `imagem_colada_${Date.now()}.${blob.type.split('/')[1] || 'png'}`
            const file = new File([blob], fileName, { type: blob.type })
            setSelectedFiles(prev => [...prev, file])
            hasHandledImage = true
            // Foca no textarea após colar imagem
            setTimeout(() => inputRef.current?.focus(), 100)
          }
        }
      }
      
      // Se não houver imagem e estiver focado fora do textarea, verifica texto longo
      if (!hasHandledImage && e.target !== inputRef.current) {
        for (let i = 0; i < items.length; i++) {
          const item = items[i]
          if (item.type === 'text/plain') {
            item.getAsString((text) => {
              // Se o texto parece ser conteúdo de código ou arquivo
              if (text.length > 100 && (text.includes('\n') || text.includes('{') || text.includes('<'))) {
                e.preventDefault()
                e.stopPropagation()
                const fileName = `arquivo_colado_${Date.now()}.txt`
                const blob = new Blob([text], { type: 'text/plain' })
                const file = new File([blob], fileName, { type: 'text/plain' })
                setSelectedFiles(prev => [...prev, file])
                setTimeout(() => inputRef.current?.focus(), 100)
              }
            })
          }
        }
      }
    }

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault()
      setIsDragOver(true)
    }

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
    }

    const handleDrop = (e: DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      
      const files = Array.from(e.dataTransfer?.files || [])
      if (files.length > 0) {
        // Filtrar apenas arquivos permitidos
        const validFiles = files.filter(file => {
          return file.type.startsWith('image/') || 
                 file.type.startsWith('text/') || 
                 file.name.endsWith('.txt') || 
                 file.name.endsWith('.md') || 
                 file.name.endsWith('.json') || 
                 file.name.endsWith('.js') || 
                 file.name.endsWith('.ts') || 
                 file.name.endsWith('.tsx') || 
                 file.name.endsWith('.jsx') || 
                 file.name.endsWith('.css') || 
                 file.name.endsWith('.html') || 
                 file.name.endsWith('.xml') || 
                 file.name.endsWith('.csv') || 
                 file.name.endsWith('.log')
        })
        
        setSelectedFiles(prev => [...prev, ...validFiles])
      }
    }

    // Adicionar evento de paste no document para capturar em qualquer lugar
    document.addEventListener('paste', handlePaste)
    
    const chatContainer = chatContainerRef.current
    if (chatContainer) {
      chatContainer.addEventListener('dragover', handleDragOver)
      chatContainer.addEventListener('dragleave', handleDragLeave)
      chatContainer.addEventListener('drop', handleDrop)
      
      return () => {
        document.removeEventListener('paste', handlePaste)
        chatContainer.removeEventListener('dragover', handleDragOver)
        chatContainer.removeEventListener('dragleave', handleDragLeave)
        chatContainer.removeEventListener('drop', handleDrop)
      }
    }
    
    return () => {
      document.removeEventListener('paste', handlePaste)
    }
  }, [])

  useEffect(() => {
    const api = (window as any).api;
    if (!api) return;

    let cleanup = api.onAiStreamEvent((data: any) => {
      if (data.source === 'codebuff' && data.data) {
        const ev = data.data;
        let msg = '';
        if (ev.type === 'step') {
          msg = `⏳ Codebuff: Executando passo...`;
        } else if (ev.type === 'tool_call') {
          msg = `🛠️ Codebuff: Usando ferramenta ${ev.tool || ''}...`;
          try {
            // Se for ferramenta de arquivo e tiver o caminho, tenta abrir no editor para o usuário ver
            let targetPath = '';
            if (ev.input && ev.input.filePath) targetPath = ev.input.filePath;
            if (ev.input && ev.input.path) targetPath = ev.input.path;
            if (ev.args && ev.args.filePath) targetPath = ev.args.filePath;
            if (targetPath && (ev.tool === 'write_file' || ev.tool === 'create_file' || ev.tool === 'modify_file' || ev.tool === 'Ezek_WriteFile')) {
              useEditorStore.getState().openFile(targetPath);
            }
          } catch(e) {}
        } else if (ev.message) {
          msg = `ℹ️ Codebuff: ${ev.message}`;
        }
        
        if (msg) {
          // You could add this to a temporary state, but for now we can just show it.
          // Wait, if we append it to messages, it will flood the chat.
          // Let's just update the status or append it.
          setStreamingStatus(msg);
        }
      }
    });
    return () => {
      setStreamingStatus('');
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (enabledAIProviders.length > 0 && !enabledAIProviders.includes(config.provider)) {
      const nextProvider = enabledAIProviders[0] as any
      const nextConfig: any = { provider: nextProvider, model: '' }
      if (nextProvider === 'ollama') nextConfig.baseUrl = 'http://localhost:11434'
      if (nextProvider === 'openai') nextConfig.baseUrl = 'https://api.openai.com/v1'
      if (nextProvider === 'routeway') nextConfig.baseUrl = 'https://api.routeway.ai/v1'
      if (nextProvider === 'openrouter') nextConfig.baseUrl = 'https://openrouter.ai/api/v1'
      if (nextProvider === 'deepsproxy' || nextProvider === 'kimiproxy' || nextProvider === 'geminiproxy') nextConfig.baseUrl = 'http://localhost:3000/v1'
      setConfig(nextConfig)
      return
    }

    if (config.provider === 'routeway' && config.apiKey && routeWayModels.length === 0) {
      fetchRouteWayModels()
    }
    if (config.provider === 'openrouter' && config.apiKey && openRouterModels.length === 0) {
      fetchOpenRouterModels()
    }
    if (config.provider === 'ollama' && ollamaModels.length === 0) {
      fetchOllamaModels()
    }
    if (config.provider === 'deepsproxy') {
      if (deepsproxyModels.length === 0) fetchDeepsProxyModels()
      checkDeepsProxyInstalled()
    }
    if (config.provider === 'kimiproxy') {
      if (kimiproxyModels.length === 0) fetchKimiProxyModels()
      checkKimiProxyInstalled()
    }
    if (config.provider === 'geminiproxy') {
      if (geminiproxyModels.length === 0) fetchGeminiProxyModels()
      checkGeminiProxyInstalled()
    }
  }, [config.provider, config.apiKey, enabledAIProviders.length])

  const handleSend = async () => {
    if ((!input.trim() && selectedFiles.length === 0) || isProcessing) return
    
    const messageText = input.trim()
    const filesToSend = [...selectedFiles]
    
    // Limpar input e arquivos imediatamente
    setInput('')
    setSelectedFiles([])
    
    // Processar arquivos anexados
    const attachments = await Promise.all(filesToSend.map(async (file) => {
      const content = await readFileContent(file)
      return {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        type: file.type.startsWith('image/') ? 'image' as const : 'file' as const,
        name: file.name,
        path: file.name,
        size: file.size,
        mimeType: file.type,
        content
      }
    }))

    await sendMessage(messageText || 'Arquivo(s) anexado(s)', attachments)
  }

  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => {
        if (file.type.startsWith('image/')) {
          // Para imagens, retornar base64
          resolve(reader.result as string)
        } else {
          // Para outros arquivos, retornar conteúdo como texto
          resolve(reader.result as string)
        }
      }
      
      if (file.type.startsWith('image/')) {
        reader.readAsDataURL(file)
      } else {
        reader.readAsText(file)
      }
    })
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    setSelectedFiles(prev => [...prev, ...files])
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleCopyMessage = async (content: string, id: string) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {}
  }

  const isModelConfigured = () => {
    if (!enabledAIProviders.includes(config.provider)) return false
    if (config.provider === 'routeway' || config.provider === 'openrouter') return config.apiKey && config.model
    if (config.provider === 'codebuff') return config.apiKey !== ''
    if (config.provider === 'openai') return config.apiKey && config.model
    if (config.provider === 'custom') return config.baseUrl && config.model
    if (config.provider === 'deepsproxy') return true
    if (config.provider === 'kimiproxy') return true
    if (config.provider === 'geminiproxy') return true
    if (config.provider === 'ollama') return config.baseUrl && config.model
    return config.apiKey && config.model
  }

  const handleTestConnection = async () => {
    const api = (window as any).api
    if (!api) return
    setTestStatus({ status: 'testing' })
    try {
      const result = await api.aiTestConnection(config)
      if (result.ok) {
        setTestStatus({ status: 'success', msg: 'Conexão bem-sucedida!' })
      } else {
        setTestStatus({ status: 'error', msg: result.error || 'Falha na conexão.' })
      }
    } catch {
      setTestStatus({ status: 'error', msg: 'Erro ao testar a conexão.' })
    }
    setTimeout(() => setTestStatus({ status: 'idle' }), 5000)
  }

  return (
    <div className="relative flex flex-col h-full overflow-hidden bg-nova-bg ai-gradient">
      <div className="h-[35px] min-h-[35px] flex items-center justify-between px-3 bg-nova-bg-secondary border-b border-nova-border glass-panel">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-nova-accent" />
          <span className="text-xs font-semibold text-nova-text-secondary uppercase tracking-wider">Chat IA</span>
          <span className="text-[10px] text-nova-accent px-1 py-0.5 rounded bg-nova-accent/10 font-medium">Ezek</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={createNewChat}
            className="p-1 rounded text-nova-text-muted hover:text-nova-text hover:bg-nova-hover transition-colors"
            title="Novo Chat"
          >
            <Plus size={14} />
          </button>
          <button
            onClick={clearChat}
            className="p-1 rounded text-nova-text-muted hover:text-nova-error hover:bg-nova-hover transition-colors"
            title="Limpar Chat"
          >
            <Trash2 size={14} />
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-1 rounded transition-colors ${showSettings ? 'bg-nova-accent text-white' : 'text-nova-text-muted hover:text-nova-text hover:bg-nova-hover'}`}
            title="Config. IA"
          >
            <Settings size={14} />
          </button>
        </div>
      </div>

      {showSettings && (
        <div className="absolute inset-0 z-30 flex items-start justify-center bg-nova-bg/70 p-4 backdrop-blur-sm">
          <div className="glass-panel flex max-h-full w-full max-w-[560px] flex-col overflow-hidden rounded-xl border border-nova-accent/25 shadow-2xl shadow-black/30">
            <div className="flex items-center justify-between border-b border-nova-border bg-nova-bg-secondary/95 px-4 py-3">
              <div className="flex items-center gap-2">
                <Settings size={15} className="text-nova-accent" />
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-nova-text">Configurações de IA</h2>
                  <p className="text-[10px] text-nova-text-muted">Provedor, modelo, chaves e controles locais.</p>
                </div>
              </div>
              <button
                onClick={() => setShowSettings(false)}
                className="rounded p-1.5 text-nova-text-muted transition-colors hover:bg-nova-hover hover:text-nova-text"
                title="Fechar configurações"
              >
                <X size={15} />
              </button>
            </div>
            <div className="space-y-3 overflow-y-auto p-4 scrollbar-thin">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-nova-text-secondary uppercase">Configurações</span>
            {enabledAIProviders.length > 0 && (
              <div className="flex items-center gap-2">
                <button onClick={handleTestConnection} disabled={testStatus.status === 'testing' || !isModelConfigured()} className="flex items-center gap-1 text-[10px] text-nova-text-muted hover:text-nova-success disabled:opacity-50" title={testStatus.msg}>
                  {testStatus.status === 'testing' ? 'Testando...' : testStatus.status === 'success' ? 'OK' : testStatus.status === 'error' ? 'Erro' : 'Testar Conexão'}
                </button>
                {testStatus.status === 'error' && (
                  <span className="text-[10px] text-nova-error truncate max-w-[150px]">{testStatus.msg}</span>
                )}
                <button onClick={saveCurrentConfig} className="flex items-center gap-1 text-[10px] text-nova-accent hover:text-nova-accent-hover ml-2">
                  <Save size={10} /> Salvar
                </button>
              </div>
            )}
          </div>

          {savedConfigs.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {savedConfigs.map((cfg: any) => (
                <button
                  key={cfg.id}
                  onClick={() => loadConfig(cfg.id)}
                  className={`flex items-center gap-1 px-2 py-0.5 text-[10px] rounded border transition-colors ${
                    cfg.id === config.id ? 'border-nova-accent bg-nova-accent/10 text-nova-accent' : 'border-nova-border text-nova-text-secondary hover:bg-nova-hover'
                  }`}
                >
                  {cfg.name}
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteConfig(cfg.id) }}
                    className="text-nova-text-muted hover:text-nova-error"
                  >
                    <Trash2 size={8} />
                  </button>
                </button>
              ))}
            </div>
          )}

          {enabledAIProviders.length === 0 ? (
            <div className="rounded-lg border border-nova-accent/20 bg-nova-accent/10 p-3">
              <div className="mb-1 flex items-center gap-2 text-xs font-bold text-nova-text">
                <Sparkles size={13} className="text-nova-accent" />
                Nenhum provedor ativo
              </div>
              <p className="text-[11px] leading-relaxed text-nova-text-secondary">
                Marque um provedor no Marketplace para liberar URL, modelo, chave e permissões da IA.
              </p>
              <button
                onClick={() => {
                  setShowSettings(false)
                  setActiveView('extensions')
                }}
                className="mt-3 rounded bg-nova-accent px-3 py-1.5 text-xs font-bold text-nova-statusbar-text hover:bg-nova-accent-hover"
              >
                Abrir Marketplace
              </button>
            </div>
          ) : (
            <>
          <select
            value={config.provider}
            onChange={e => {
              if (!e.target.value) return
              const provider = e.target.value
              const nextConfig: any = { provider, model: '' }
              if (provider === 'ollama') nextConfig.baseUrl = config.baseUrl?.startsWith('http') ? config.baseUrl : 'http://localhost:11434'
              if (provider === 'openai') nextConfig.baseUrl = config.baseUrl?.startsWith('http') ? config.baseUrl : 'https://api.openai.com/v1'
              if (provider === 'routeway') nextConfig.baseUrl = 'https://api.routeway.ai/v1'
              if (provider === 'openrouter') nextConfig.baseUrl = 'https://openrouter.ai/api/v1'
              setConfig(nextConfig)
              if (provider === 'routeway') fetchRouteWayModels()
              if (provider === 'openrouter') fetchOpenRouterModels()
              if (provider === 'ollama') fetchOllamaModels()
              if (provider === 'deepsproxy') fetchDeepsProxyModels()
              if (provider === 'kimiproxy') fetchKimiProxyModels()
              if (provider === 'geminiproxy') fetchGeminiProxyModels()
            }}
            className="w-full bg-nova-input-bg text-nova-text text-xs border border-nova-input-border rounded px-2 py-1 outline-none focus:border-nova-accent"
          >
            {enabledAIProviders.length === 0 && (
              <option value="">Marque provedores no Marketplace</option>
            )}
            {enabledAIProviders.includes('routeway') && (
              <option value="routeway">RouteWay</option>
            )}
            {enabledAIProviders.includes('ollama') && (
              <option value="ollama">Ollama (Local)</option>
            )}
            {enabledAIProviders.includes('openai') && (
              <option value="openai">OpenAI</option>
            )}
            {enabledAIProviders.includes('codebuff') && (
              <option value="codebuff">Codebuff (Agente Nativo)</option>
            )}
            {enabledAIProviders.includes('deepsproxy') && acquiredProxies.includes('deepsproxy') && isDeepsProxyInstalled && (
              <option value="deepsproxy">DeepsProxy (Navegador Local)</option>
            )}
            {enabledAIProviders.includes('kimiproxy') && acquiredProxies.includes('kimiproxy') && isKimiProxyInstalled && (
              <option value="kimiproxy">KimiProxy (Navegador Local)</option>
            )}
            {enabledAIProviders.includes('geminiproxy') && acquiredProxies.includes('geminiproxy') && isGeminiProxyInstalled && (
              <option value="geminiproxy">GeminiProxy (Navegador Local)</option>
            )}
            {enabledAIProviders.includes('openrouter') && (
              <option value="openrouter">OpenRouter</option>
            )}
            {enabledAIProviders.includes('custom') && (
              <option value="custom">API Personalizada</option>
            )}
          </select>

          {config.provider === 'routeway' && (
            <>
              <input
                type="password"
                placeholder="Chave da API RouteWay"
                value={config.apiKey}
                onChange={e => setConfig({ apiKey: e.target.value })}
                className="w-full bg-nova-input-bg text-nova-text text-xs border border-nova-input-border rounded px-2 py-1 outline-none focus:border-nova-accent"
              />
              <button
                onClick={fetchRouteWayModels}
                disabled={isLoadingModels || !config.apiKey}
                className="w-full px-2 py-1 text-xs bg-nova-accent text-white rounded hover:bg-nova-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoadingModels ? 'Carregando...' : 'Buscar Modelos Grátis'}
              </button>
              {routeWayModels.length > 0 && (
                <select
                  value={config.model}
                  onChange={e => selectRouteWayModel(e.target.value)}
                  className="w-full bg-nova-input-bg text-nova-text text-xs border border-nova-input-border rounded px-2 py-1 outline-none focus:border-nova-accent"
                >
                  {routeWayModels.map(m => (
                    <option key={m.id} value={m.id}>🆓 {m.name}</option>
                  ))}
                </select>
              )}
              {routeWayModels.length === 0 && !isLoadingModels && (
                <p className="text-[10px] text-nova-text-muted">Informe sua API Key e clique em "Buscar"</p>
              )}
            </>
          )}

          {config.provider === 'ollama' && (
            <>
              <input
                type="text"
                placeholder="URL do Ollama"
                value={config.baseUrl || 'http://localhost:11434'}
                onChange={e => setConfig({ baseUrl: e.target.value })}
                className="w-full bg-nova-input-bg text-nova-text text-xs border border-nova-input-border rounded px-2 py-1 outline-none focus:border-nova-accent"
              />
              <button
                onClick={fetchOllamaModels}
                disabled={isLoadingOllamaModels || !config.baseUrl}
                className="w-full px-2 py-1 text-xs bg-nova-accent text-white rounded hover:bg-nova-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoadingOllamaModels ? 'Carregando...' : 'Buscar Modelos Locais'}
              </button>
              {ollamaModels.length > 0 ? (
                <select
                  value={config.model}
                  onChange={e => selectOllamaModel(e.target.value)}
                  className="w-full bg-nova-input-bg text-nova-text text-xs border border-nova-input-border rounded px-2 py-1 outline-none focus:border-nova-accent"
                >
                  {ollamaModels.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="Modelo Ollama, ex: llama3.2"
                  value={config.model}
                  onChange={e => setConfig({ model: e.target.value })}
                  className="w-full bg-nova-input-bg text-nova-text text-xs border border-nova-input-border rounded px-2 py-1 outline-none focus:border-nova-accent"
                />
              )}
            </>
          )}

          {config.provider === 'openrouter' && (
            <>
              <input
                type="password"
                placeholder="Chave da API OpenRouter"
                value={config.apiKey}
                onChange={e => setConfig({ apiKey: e.target.value })}
                className="w-full bg-nova-input-bg text-nova-text text-xs border border-nova-input-border rounded px-2 py-1 outline-none focus:border-nova-accent"
              />
              <button
                onClick={fetchOpenRouterModels}
                disabled={isLoadingOpenRouterModels || !config.apiKey}
                className="w-full px-2 py-1 text-xs bg-nova-accent text-white rounded hover:bg-nova-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoadingOpenRouterModels ? 'Carregando...' : 'Buscar Modelos Grátis'}
              </button>
              {openRouterModels.length > 0 && (
                <select
                  value={config.model}
                  onChange={e => selectOpenRouterModel(e.target.value)}
                  className="w-full bg-nova-input-bg text-nova-text text-xs border border-nova-input-border rounded px-2 py-1 outline-none focus:border-nova-accent"
                >
                  {openRouterModels.map(m => (
                    <option key={m.id} value={m.id}>🆓 {m.name}</option>
                  ))}
                </select>
              )}
              {openRouterModels.length === 0 && !isLoadingOpenRouterModels && (
                <p className="text-[10px] text-nova-text-muted">Informe sua API Key e clique em "Buscar"</p>
              )}
            </>
          )}

          {config.provider === 'openai' && (
            <>
              <input
                type="text"
                placeholder="URL Base OpenAI"
                value={config.baseUrl || 'https://api.openai.com/v1'}
                onChange={e => setConfig({ baseUrl: e.target.value })}
                className="w-full bg-nova-input-bg text-nova-text text-xs border border-nova-input-border rounded px-2 py-1 outline-none focus:border-nova-accent"
              />
              <input
                type="password"
                placeholder="Chave da API OpenAI"
                value={config.apiKey}
                onChange={e => setConfig({ apiKey: e.target.value })}
                className="w-full bg-nova-input-bg text-nova-text text-xs border border-nova-input-border rounded px-2 py-1 outline-none focus:border-nova-accent"
              />
              <input
                type="text"
                placeholder="Modelo, ex: gpt-4o-mini"
                value={config.model}
                onChange={e => setConfig({ model: e.target.value })}
                className="w-full bg-nova-input-bg text-nova-text text-xs border border-nova-input-border rounded px-2 py-1 outline-none focus:border-nova-accent"
              />
            </>
          )}

          {config.provider === 'codebuff' && (
            <>
              <input
                type="password"
                placeholder="Chave da API Codebuff"
                value={config.apiKey}
                onChange={e => setConfig({ apiKey: e.target.value })}
                className="w-full bg-nova-input-bg text-nova-text text-xs border border-nova-input-border rounded px-2 py-1 outline-none focus:border-nova-accent"
              />
              <p className="text-[10px] text-nova-text-muted">Obtenha sua chave em codebuff.com/api-keys</p>
            </>
          )}

          {config.provider === 'deepsproxy' && (
            <>
              {!isDeepsProxyInstalled ? (
                <div className="space-y-2 p-2 bg-nova-bg border border-nova-border rounded">
                  <p className="text-[10px] text-nova-text-muted">
                    O DeepsProxy ainda não está instalado no seu sistema. Ele requer Git, Node.js e Playwright.
                  </p>
                  <button
                    onClick={async () => {
                      const api = (window as any).api;
                      if (!api || isInstallingDeepsProxy) return;
                      setIsInstallingDeepsProxy(true);
                      
                      const msgId = Date.now().toString();
                      addMessage({
                        id: msgId,
                        role: 'assistant',
                        content: '⏳ Iniciando instalação do DeepsProxy...\n\n```log\n',
                        timestamp: Date.now(),
                        type: 'info'
                      });

                      const unlisten = api.onAiInstallLog((log: string) => {
                        appendMessageContent(msgId, log);
                      });

                      const success = await api.aiInstallDeepsProxy();
                      unlisten();

                      appendMessageContent(msgId, '\n```\n');

                      if (success) {
                        addMessage({
                          id: (Date.now() + 1).toString(),
                          role: 'assistant',
                          content: '✅ DeepsProxy instalado com sucesso! A configuração foi atualizada.',
                          timestamp: Date.now(),
                          type: 'info'
                        });
                        await checkDeepsProxyInstalled();
                      } else {
                        addMessage({
                          id: (Date.now() + 1).toString(),
                          role: 'assistant',
                          content: '❌ Ocorreu um erro durante a instalação. Verifique os logs acima.',
                          timestamp: Date.now(),
                          type: 'error'
                        });
                      }
                      
                      setIsInstallingDeepsProxy(false);
                    }}
                    disabled={isInstallingDeepsProxy}
                    className="w-full px-2 py-1 text-xs bg-nova-accent text-white rounded hover:bg-nova-accent-hover transition-colors disabled:opacity-50"
                  >
                    {isInstallingDeepsProxy ? 'Instalando...' : 'Baixar e Instalar DeepsProxy'}
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-[10px] text-nova-success text-center">DeepsProxy está instalado localmente!</p>
                  <button
                    onClick={async () => {
                      const api = (window as any).api;
                      if (api) {
                        if (deepsProxyStatus === 'online') {
                          await api.aiStopProxy('deepsproxy');
                        } else {
                          useAIStore.getState().setProxyStatus('deepsproxy', 'starting');
                          await api.aiStartProxy('deepsproxy');
                        }
                      }
                    }}
                    disabled={deepsProxyStatus === 'starting'}
                    className={`w-full px-2 py-1 text-xs text-white rounded transition-colors ${deepsProxyStatus === 'online' ? 'bg-red-600 hover:bg-red-700' : deepsProxyStatus === 'starting' ? 'bg-yellow-600 cursor-wait' : 'bg-nova-accent hover:bg-nova-accent-hover'}`}
                  >
                    {deepsProxyStatus === 'online' ? 'Parar Servidor DeepsProxy' : deepsProxyStatus === 'starting' ? (<span className="flex items-center justify-center gap-2"><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />Iniciando...</span>) : 'Iniciar Servidor DeepsProxy'}
                  </button>
                  <button
                    onClick={async () => {
                      const api = (window as any).api;
                      if (api && config.deepsproxyPath) {
                        const termId = await api.createTerminal('cmd.exe');
                        useTerminalStore.getState().addTerminal({ id: termId, name: 'DeepsProxy Login' });
                        useTerminalStore.getState().setActiveTerminal(termId);

                        await api.writeToTerminal(termId, `cd /d "${config.deepsproxyPath}"\r`);
                        await api.writeToTerminal(termId, `npm run login\r`);
                      }
                    }}
                    className="w-full px-2 py-1 text-[10px] bg-nova-bg-tertiary text-nova-text rounded border border-nova-border hover:bg-nova-hover transition-colors"
                    title="Abre o navegador oculto para você fazer o primeiro login e salvar os dados"
                  >
                    Fazer Login no DeepSeek (1º Acesso)
                  </button>
                  <button
                    onClick={fetchDeepsProxyModels}
                    disabled={isLoadingDeepsProxyModels}
                    className="w-full px-2 py-1 text-xs bg-nova-bg-tertiary text-nova-text rounded border border-nova-border hover:bg-nova-hover disabled:opacity-50 transition-colors"
                  >
                    {isLoadingDeepsProxyModels ? 'Carregando...' : 'Atualizar Modelos (Requer servidor online)'}
                  </button>
                  {deepsproxyModels.length > 0 && (
                    <select
                      value={config.model}
                      onChange={e => selectDeepsProxyModel(e.target.value)}
                      className="w-full bg-nova-input-bg text-nova-text text-xs border border-nova-input-border rounded px-2 py-1 outline-none focus:border-nova-accent mt-2"
                    >
                      {deepsproxyModels.map(m => (
                        <option key={m.id} value={m.id}>🤖 {m.name}</option>
                      ))}
                    </select>
                  )}
                </>
              )}
            </>
          )}

          {config.provider === 'kimiproxy' && (
            <>
              {!isKimiProxyInstalled ? (
                <div className="space-y-2 p-2 bg-nova-bg border border-nova-border rounded">
                  <p className="text-[10px] text-nova-text-muted">
                    O KimiProxy ainda não está instalado no seu sistema. Ele requer Git, Node.js e Playwright.
                  </p>
                  <button
                    onClick={async () => {
                      const api = (window as any).api;
                      if (!api || isInstallingKimiProxy) return;
                      setIsInstallingKimiProxy(true);
                      
                      const msgId = Date.now().toString();
                      addMessage({
                        id: msgId,
                        role: 'assistant',
                        content: '⏳ Iniciando instalação do KimiProxy...\n\n```log\n',
                        timestamp: Date.now(),
                        type: 'info'
                      });

                      const unlisten = api.onAiInstallLog((log: string) => {
                        appendMessageContent(msgId, log);
                      });

                      const success = await api.aiInstallKimiProxy();
                      unlisten();

                      appendMessageContent(msgId, '\n```\n');

                      if (success) {
                        addMessage({
                          id: (Date.now() + 1).toString(),
                          role: 'assistant',
                          content: '✅ KimiProxy instalado com sucesso! A configuração foi atualizada.',
                          timestamp: Date.now(),
                          type: 'info'
                        });
                        await checkKimiProxyInstalled();
                      } else {
                        addMessage({
                          id: (Date.now() + 1).toString(),
                          role: 'assistant',
                          content: '❌ Ocorreu um erro durante a instalação. Verifique os logs acima.',
                          timestamp: Date.now(),
                          type: 'error'
                        });
                      }
                      
                      setIsInstallingKimiProxy(false);
                    }}
                    disabled={isInstallingKimiProxy}
                    className="w-full px-2 py-1 text-xs bg-nova-accent text-white rounded hover:bg-nova-accent-hover transition-colors disabled:opacity-50"
                  >
                    {isInstallingKimiProxy ? 'Instalando...' : 'Baixar e Instalar KimiProxy'}
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-[10px] text-nova-success text-center">KimiProxy está instalado localmente!</p>
                  <button
                    onClick={async () => {
                      const api = (window as any).api;
                      if (api) {
                        if (kimiProxyStatus === 'online') {
                          await api.aiStopProxy('kimiproxy');
                        } else {
                          useAIStore.getState().setProxyStatus('kimiproxy', 'starting');
                          await api.aiStartProxy('kimiproxy');
                        }
                      }
                    }}
                    disabled={kimiProxyStatus === 'starting'}
                    className={`w-full px-2 py-1 text-xs text-white rounded transition-colors ${kimiProxyStatus === 'online' ? 'bg-red-600 hover:bg-red-700' : kimiProxyStatus === 'starting' ? 'bg-yellow-600 cursor-wait' : 'bg-nova-accent hover:bg-nova-accent-hover'}`}
                  >
                    {kimiProxyStatus === 'online' ? 'Parar Servidor KimiProxy' : kimiProxyStatus === 'starting' ? (<span className="flex items-center justify-center gap-2"><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />Iniciando...</span>) : 'Iniciar Servidor KimiProxy'}
                  </button>
                  <button
                    onClick={async () => {
                      const api = (window as any).api;
                      if (api && config.kimiproxyPath) {
                        const termId = await api.createTerminal('cmd.exe');
                        useTerminalStore.getState().addTerminal({ id: termId, name: 'KimiProxy Login' });
                        useTerminalStore.getState().setActiveTerminal(termId);

                        await api.writeToTerminal(termId, `cd /d "${config.kimiproxyPath}"\r`);
                        await api.writeToTerminal(termId, `npm run login\r`);
                      }
                    }}
                    className="w-full px-2 py-1 text-[10px] bg-nova-bg-tertiary text-nova-text rounded border border-nova-border hover:bg-nova-hover transition-colors"
                    title="Abre o navegador oculto para você fazer o primeiro login e salvar os dados"
                  >
                    Fazer Login no Kimi (1º Acesso)
                  </button>
                  <button
                    onClick={fetchKimiProxyModels}
                    disabled={isLoadingKimiProxyModels}
                    className="w-full px-2 py-1 text-xs bg-nova-bg-tertiary text-nova-text rounded border border-nova-border hover:bg-nova-hover disabled:opacity-50 transition-colors"
                  >
                    {isLoadingKimiProxyModels ? 'Carregando...' : 'Atualizar Modelos (Requer servidor online)'}
                  </button>
                  {kimiproxyModels.length > 0 && (
                    <select
                      value={config.model}
                      onChange={e => selectKimiProxyModel(e.target.value)}
                      className="w-full bg-nova-input-bg text-nova-text text-xs border border-nova-input-border rounded px-2 py-1 outline-none focus:border-nova-accent mt-2"
                    >
                      {kimiproxyModels.map(m => (
                        <option key={m.id} value={m.id}>🤖 {m.name}</option>
                      ))}
                    </select>
                  )}
                </>
              )}
            </>
          )}

          {config.provider === 'geminiproxy' && (
            <>
              {!isGeminiProxyInstalled ? (
                <div className="space-y-2 p-2 bg-nova-bg border border-nova-border rounded">
                  <p className="text-[10px] text-nova-text-muted">
                    O GeminiProxy ainda não está instalado no seu sistema. Ele requer Git, Node.js e Playwright.
                  </p>
                  <button
                    onClick={async () => {
                      const api = (window as any).api;
                      if (!api || isInstallingGeminiProxy) return;
                      setIsInstallingGeminiProxy(true);
                      
                      const msgId = Date.now().toString();
                      addMessage({
                        id: msgId,
                        role: 'assistant',
                        content: '⏳ Iniciando instalação do GeminiProxy...\n\n```log\n',
                        timestamp: Date.now(),
                        type: 'info'
                      });

                      const unlisten = api.onAiInstallLog((log: string) => {
                        appendMessageContent(msgId, log);
                      });

                      const success = await api.aiInstallGeminiProxy();
                      unlisten();

                      appendMessageContent(msgId, '\n```\n');

                      if (success) {
                        addMessage({
                          id: (Date.now() + 1).toString(),
                          role: 'assistant',
                          content: '✅ GeminiProxy instalado com sucesso! A configuração foi atualizada.',
                          timestamp: Date.now(),
                          type: 'info'
                        });
                        await checkGeminiProxyInstalled();
                      } else {
                        addMessage({
                          id: (Date.now() + 1).toString(),
                          role: 'assistant',
                          content: '❌ Ocorreu um erro durante a instalação. Verifique os logs acima.',
                          timestamp: Date.now(),
                          type: 'error'
                        });
                      }
                      
                      setIsInstallingGeminiProxy(false);
                    }}
                    disabled={isInstallingGeminiProxy}
                    className="w-full px-2 py-1 text-xs bg-nova-accent text-white rounded hover:bg-nova-accent-hover transition-colors disabled:opacity-50"
                  >
                    {isInstallingGeminiProxy ? 'Instalando...' : 'Baixar e Instalar GeminiProxy'}
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-[10px] text-nova-success text-center">GeminiProxy está instalado localmente!</p>
                  <button
                    onClick={async () => {
                      const api = (window as any).api;
                      if (api) {
                        if (geminiProxyStatus === 'online') {
                          await api.aiStopProxy('geminiproxy');
                        } else {
                          useAIStore.getState().setProxyStatus('geminiproxy', 'starting');
                          await api.aiStartProxy('geminiproxy');
                        }
                      }
                    }}
                    disabled={geminiProxyStatus === 'starting'}
                    className={`w-full px-2 py-1 text-xs text-white rounded transition-colors ${geminiProxyStatus === 'online' ? 'bg-red-600 hover:bg-red-700' : geminiProxyStatus === 'starting' ? 'bg-yellow-600 cursor-wait' : 'bg-nova-accent hover:bg-nova-accent-hover'}`}
                  >
                    {geminiProxyStatus === 'online' ? 'Parar Servidor GeminiProxy' : geminiProxyStatus === 'starting' ? (<span className="flex items-center justify-center gap-2"><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />Iniciando...</span>) : 'Iniciar Servidor GeminiProxy'}
                  </button>
                  <button
                    onClick={async () => {
                      const api = (window as any).api;
                      if (api && config.geminiproxyPath) {
                        const termId = await api.createTerminal('cmd.exe');
                        useTerminalStore.getState().addTerminal({ id: termId, name: 'GeminiProxy Login' });
                        useTerminalStore.getState().setActiveTerminal(termId);

                        await api.writeToTerminal(termId, `cd /d "${config.geminiproxyPath}"\r`);
                        await api.writeToTerminal(termId, `npm run login\r`);
                      }
                    }}
                    className="w-full px-2 py-1 text-[10px] bg-nova-bg-tertiary text-nova-text rounded border border-nova-border hover:bg-nova-hover transition-colors"
                    title="Abre o navegador oculto para você fazer o primeiro login e salvar os dados"
                  >
                    Fazer Login no Gemini (1º Acesso)
                  </button>
                  <button
                    onClick={fetchGeminiProxyModels}
                    disabled={isLoadingGeminiProxyModels}
                    className="w-full px-2 py-1 text-xs bg-nova-bg-tertiary text-nova-text rounded border border-nova-border hover:bg-nova-hover disabled:opacity-50 transition-colors"
                  >
                    {isLoadingGeminiProxyModels ? 'Carregando...' : 'Atualizar Modelos (Requer servidor online)'}
                  </button>
                  {geminiproxyModels.length > 0 && (
                    <select
                      value={config.model}
                      onChange={e => selectGeminiProxyModel(e.target.value)}
                      className="w-full bg-nova-input-bg text-nova-text text-xs border border-nova-input-border rounded px-2 py-1 outline-none focus:border-nova-accent mt-2"
                    >
                      {geminiproxyModels.map(m => (
                        <option key={m.id} value={m.id}>🤖 {m.name}</option>
                      ))}
                    </select>
                  )}
                </>
              )}
            </>
          )}

          {config.provider === 'custom' && (
            <>
              <input
                type="text"
                placeholder="URL Base compatível com OpenAI"
                value={config.baseUrl}
                onChange={e => setConfig({ baseUrl: e.target.value })}
                className="w-full bg-nova-input-bg text-nova-text text-xs border border-nova-input-border rounded px-2 py-1 outline-none focus:border-nova-accent"
              />
              <input
                type="text"
                placeholder="Modelo"
                value={config.model}
                onChange={e => setConfig({ model: e.target.value })}
                className="w-full bg-nova-input-bg text-nova-text text-xs border border-nova-input-border rounded px-2 py-1 outline-none focus:border-nova-accent"
              />
              <input
                type="password"
                placeholder="Chave da API, se necessária"
                value={config.apiKey}
                onChange={e => setConfig({ apiKey: e.target.value })}
                className="w-full bg-nova-input-bg text-nova-text text-xs border border-nova-input-border rounded px-2 py-1 outline-none focus:border-nova-accent"
              />
            </>
          )}

          <div className="mt-3 pt-3 border-t border-nova-accent/10">
            <label className="flex items-center gap-2 cursor-pointer group">
              <div className="relative">
                <input 
                  type="checkbox" 
                  className="sr-only" 
                  checked={!!config.allowAutonomousSql}
                  onChange={(e) => setConfig({ allowAutonomousSql: e.target.checked })}
                />
                <div className={`block w-8 h-4.5 rounded-full transition-colors ${config.allowAutonomousSql ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <div className={`dot absolute left-0.5 top-0.5 bg-white w-3.5 h-3.5 rounded-full transition-transform ${config.allowAutonomousSql ? 'transform translate-x-3.5' : ''}`}></div>
              </div>
              <div className="flex flex-col">
                <span className={`text-[11px] font-medium transition-colors ${config.allowAutonomousSql ? 'text-green-400' : 'text-red-400'}`}>Permitir IA Executar SQL</span>
                <span className="text-[9px] text-nova-text-muted">A IA pode consultar o banco de forma autônoma.</span>
              </div>
            </label>
          </div>
            </>
          )}
            </div>
        </div>
        </div>
      )}

      <div 
        ref={chatContainerRef} 
        className={`flex-1 overflow-y-auto scrollbar-thin relative ${
          isDragOver ? 'bg-nova-accent/5 border-2 border-dashed border-nova-accent' : ''
        }`} 
        tabIndex={0}
      >
        {isDragOver && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-nova-accent/10 backdrop-blur-sm">
            <div className="text-center p-8 rounded-xl bg-nova-bg border-2 border-dashed border-nova-accent">
              <Paperclip size={48} className="text-nova-accent mx-auto mb-3" />
              <h3 className="text-lg font-medium text-nova-accent mb-2">Solte os arquivos aqui</h3>
              <p className="text-sm text-nova-text-muted">Imagens, textos e códigos são suportados</p>
            </div>
          </div>
        )}
        
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center px-6">
              <Sparkles size={32} className="text-nova-accent mx-auto mb-3" />
              <h3 className="text-sm font-medium text-nova-text mb-1">Ezek Assistente IA</h3>
              <p className="text-xs text-nova-text-muted mb-2">Criar, modificar e analisar código.</p>
            </div>
          </div>
        )}
        <div className="flex flex-col gap-5 p-4 bg-nova-bg-secondary/20">
          <AnimatePresence>
            {messages.filter(m => !m.hidden).map((msg, idx) => (
              <motion.div 
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                key={msg.id} 
                className={`group flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex gap-3 max-w-[96%] sm:max-w-[88%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg ${
                    msg.role === 'assistant'
                      ? 'bg-nova-accent/15 border border-nova-accent/30 text-nova-accent shadow-nova-accent/10'
                      : 'bg-nova-bg-tertiary border border-nova-border text-nova-text-secondary'
                  }`}>
                    {msg.role === 'assistant' ? <Sparkles size={17} /> : <User size={16} />}
                  </div>
                  <div className={`flex flex-col min-w-0 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`flex items-center gap-2 mb-1.5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                      {msg.role === 'assistant' ? (
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-nova-text">Ezek AI</span>
                          <span className="rounded-full border border-nova-accent/25 bg-nova-accent/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-nova-accent">
                            Assistente
                          </span>
                        </div>
                      ) : (
                        <span className="text-[11px] font-semibold text-nova-text-secondary">Você</span>
                      )}
                      <button
                        onClick={() => handleCopyMessage(msg.content, msg.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-nova-text-muted hover:text-nova-accent hover:bg-nova-hover transition-all"
                        title="Copiar mensagem"
                      >
                        {copiedId === msg.id ? <Check size={12} className="text-nova-success" /> : <Copy size={12} />}
                      </button>
                    </div>
                      <div className={`text-[13px] leading-relaxed px-4 py-3.5 rounded-2xl relative max-w-full overflow-x-auto ${
                        msg.role === 'assistant' 
                          ? "bg-[#153047] border border-[#2e5368] text-[#f1f8ff] rounded-tl-md shadow-xl shadow-black/15 before:absolute before:left-0 before:top-4 before:h-10 before:w-[3px] before:rounded-r-full before:bg-nova-accent before:content-['']" 
                          : 'bg-[#1c3a50] border border-[#365b70] text-[#f5fbff] rounded-tr-md shadow-lg shadow-black/10'
                        }`}>
                        {msg.role === 'assistant' && (msg.parsedSteps || msg.parsedActions) && (
                          <ThinkingBlock steps={msg.parsedSteps} actions={msg.parsedActions} />
                        )}
                        
                        {msg.role === 'assistant' && msg.fileChanges && msg.fileChanges.length > 0 && (
                          <InlineFileEdits 
                            changes={msg.fileChanges} 
                            onRevert={() => {
                              if (confirm('Tem certeza que deseja reverter as modificações feitas por esta mensagem?')) {
                                revertMessageChanges(msg.id)
                              }
                            }}
                            onOpenDiff={(path, original, modified) => {
                              if (original !== undefined && modified !== undefined) {
                                openDiff(path, original, modified)
                              } else {
                                alert('Conteúdo original/modificado não disponível para visualizar o diff.')
                              }
                            }}
                          />
                        )}
                      {msg.role === 'assistant' ? <FormattedMessage content={msg.content} /> : <div className="whitespace-pre-wrap">{msg.content}</div>}
                      
                      {msg.fileChanges && msg.fileChanges.length > 0 && (
                        <FileChangesBlock 
                          changes={msg.fileChanges} 
                          onReview={() => {
                            if (msg.fileChanges && msg.fileChanges[0]) {
                              window.api.aiExecuteCommand('').then(() => {})
                            }
                          }}
                        />
                      )}

                      {msg.parsedActions && msg.parsedActions.filter((a: any) => a.type === 'execute_sql').map((action: any, i: number) => (
                        <div key={`sql-${i}`} className="mt-3 border border-nova-accent/20 rounded-md bg-[#0f1513] overflow-hidden shadow-sm text-left">
                          <div className="bg-[#131d1a] border-b border-nova-accent/10 px-3 py-1.5 flex justify-between items-center">
                            <div className="flex items-center gap-2 text-xs font-semibold text-nova-accent">
                              <Database size={12} />
                              Proposta de Execução SQL
                            </div>
                          </div>
                          <div className="p-3 bg-[#0a0f0d] text-xs text-[#a0aab2] overflow-x-auto whitespace-pre-wrap font-mono">
                            {action.query}
                          </div>
                          <div className="bg-[#131d1a] border-t border-nova-accent/10 px-3 py-2 flex justify-end gap-2">
                            <button
                              onClick={(e) => {
                                navigator.clipboard.writeText(action.query)
                                const btn = e.currentTarget
                                const originalHtml = btn.innerHTML
                                btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-green-500"><polyline points="20 6 9 17 4 12"></polyline></svg> Copiado!'
                                setTimeout(() => {
                                  btn.innerHTML = originalHtml
                                }, 2000)
                              }}
                              className="px-3 py-1 bg-nova-bg-secondary text-nova-text-secondary hover:text-nova-text rounded transition-colors text-xs flex items-center gap-1.5"
                            >
                              <Copy size={12} /> Copiar SQL
                            </button>
                            <button
                              onClick={() => {
                                const { executeQuery } = useSqlStore.getState()
                                executeQuery(action.query)
                                window.dispatchEvent(new CustomEvent('ezek:open-sql-tab'))
                              }}
                              className="px-3 py-1 bg-nova-accent/10 text-nova-accent hover:bg-nova-accent hover:text-nova-bg rounded transition-colors text-xs flex items-center gap-1.5"
                            >
                              <Play size={12} /> Aprovar e Executar
                            </button>
                          </div>
                        </div>
                      ))}
                      
                      {msg.executedSqls && msg.executedSqls.length > 0 && (
                        <div className="mt-3">
                          <details className="group [&_summary::-webkit-details-marker]:hidden border border-nova-accent/20 rounded-md bg-[#0f1513] overflow-hidden shadow-sm">
                            <summary className="flex items-center justify-between cursor-pointer px-3 py-2 bg-[#131d1a] hover:bg-[#1a2824] transition-colors">
                              <div className="flex items-center gap-2 text-xs font-semibold text-nova-accent">
                                <Database size={12} />
                                Ver Consultas SQL Utilizadas ({msg.executedSqls.length})
                              </div>
                              <span className="text-nova-accent/70 transition group-open:rotate-180">
                                <svg fill="none" height="14" shapeRendering="geometricPrecision" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="14"><path d="M6 9l6 6 6-6"></path></svg>
                              </span>
                            </summary>
                            
                            <div className="p-0 flex flex-col gap-px bg-nova-accent/10">
                              {msg.executedSqls.map((query, i) => (
                                <div key={i} className="bg-[#0f1513]">
                                  <div className="p-3 text-xs text-[#a0aab2] overflow-x-auto whitespace-pre-wrap font-mono">
                                    {query}
                                  </div>
                                  <div className="bg-[#131d1a] border-t border-nova-accent/10 px-3 py-2 flex justify-end gap-2">
                                    <button
                                      onClick={(e) => {
                                        navigator.clipboard.writeText(query)
                                        const btn = e.currentTarget
                                        const originalHtml = btn.innerHTML
                                        btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-green-500"><polyline points="20 6 9 17 4 12"></polyline></svg> Copiado!'
                                        setTimeout(() => {
                                          btn.innerHTML = originalHtml
                                        }, 2000)
                                      }}
                                      className="px-3 py-1 bg-nova-bg-secondary text-nova-text-secondary hover:text-nova-text rounded transition-colors text-xs flex items-center gap-1.5"
                                    >
                                      <Copy size={12} /> Copiar
                                    </button>
                                    <button
                                      onClick={() => {
                                        const { executeQuery } = useSqlStore.getState()
                                        executeQuery(query)
                                        window.dispatchEvent(new CustomEvent('ezek:open-sql-tab'))
                                      }}
                                      className="px-3 py-1 bg-nova-accent/10 text-nova-accent hover:bg-nova-accent hover:text-nova-bg rounded transition-colors text-xs flex items-center gap-1.5"
                                    >
                                      <Play size={12} /> Executar Novamente
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </details>
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-1 mt-2 select-none opacity-80">
                        <span className="text-[9px] text-nova-text-muted font-medium">
                          {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                        <Check size={12} className={msg.role === 'assistant' ? "text-nova-accent" : "text-nova-text-muted"} />
                      </div>
                    </div>
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2 justify-end">
                        {msg.attachments.map(attachment => (
                          <div key={attachment.id} className="relative group">
                            {attachment.type === 'image' ? (
                              <div className="bg-[#101916] border border-[#152b21] rounded-lg overflow-hidden hover:border-nova-accent transition-colors w-20 h-20 shadow-sm">
                                <img 
                                  src={attachment.content} 
                                  alt={attachment.name}
                                  className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
                                  onClick={() => {
                                    const newWindow = window.open()
                                    if (newWindow) {
                                      newWindow.document.write(`<html><body style="margin:0;background:#000;display:flex;justify-content:center;align-items:center;min-height:100vh;"><img src="${attachment.content}" style="max-width:100%;max-height:100%;" /></body></html>`)
                                    }
                                  }}
                                />
                              </div>
                            ) : (
                              <div className="bg-[#101916] border border-[#152b21] rounded-lg p-2 hover:border-nova-accent transition-colors flex items-center gap-2 shadow-sm">
                                <File size={14} className="text-nova-text-muted flex-shrink-0" />
                                <div className="flex flex-col">
                                  <span className="text-[10px] text-[#f3f4f6] truncate max-w-[100px] font-medium">{attachment.name}</span>
                                  <span className="text-[9px] text-nova-text-muted">{(attachment.size / 1024).toFixed(1)} KB</span>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        {isProcessing && (
          <div className="px-3 py-3 bg-nova-bg-secondary/50">
            <div className="flex flex-col gap-2">
              <div className="flex gap-2 items-center">
                <div className="w-6 h-6 rounded-full bg-nova-accent/20 flex items-center justify-center">
                  <Bot size={12} className="text-nova-accent" />
                </div>
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-nova-accent rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-nova-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-nova-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
              {streamingStatus && (
                <div className="text-[10px] text-nova-accent ml-8">
                  {streamingStatus}
                </div>
              )}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-gradient-to-t from-nova-bg via-nova-bg/95 to-transparent shrink-0">
        <div className="relative overflow-hidden rounded-2xl border border-nova-border bg-[#10283a]/95 shadow-2xl shadow-black/30 transition-all focus-within:border-nova-accent/70 focus-within:shadow-nova-accent/10 flex flex-col">
          {config.provider !== 'codebuff' && (
            <div className="flex items-center gap-2 border-b border-white/5 bg-white/5 px-4 py-2">
              <select
                value={config.model || ''}
                onChange={e => {
                  if (config.provider === 'routeway' && routeWayModels.length > 0) {
                    selectRouteWayModel(e.target.value)
                  } else if (config.provider === 'ollama' && ollamaModels.length > 0) {
                    selectOllamaModel(e.target.value)
                  } else if (config.provider === 'openrouter' && openRouterModels.length > 0) {
                    selectOpenRouterModel(e.target.value)
                  } else if (config.provider === 'deepsproxy' && deepsproxyModels.length > 0) {
                    selectDeepsProxyModel(e.target.value)
                  } else if (config.provider === 'kimiproxy' && kimiproxyModels.length > 0) {
                    selectKimiProxyModel(e.target.value)
                  } else if (config.provider === 'geminiproxy' && geminiproxyModels.length > 0) {
                    selectGeminiProxyModel(e.target.value)
                  } else {
                    setConfig({ model: e.target.value })
                  }
                }}
                className="flex-1 bg-transparent text-nova-text-secondary text-[11px] outline-none cursor-pointer hover:text-nova-text transition-colors appearance-none"
              >
                {config.provider === 'routeway' && routeWayModels.length > 0
                  ? routeWayModels.map(m => (
                      <option key={m.id} value={m.id} className="bg-[#101916] text-[#f3f4f6]">🆓 {m.name.length > 25 ? m.name.substring(0, 25) + '...' : m.name}</option>
                    ))
                  : config.provider === 'ollama' && ollamaModels.length > 0
                  ? ollamaModels.map(m => (
                      <option key={m.id} value={m.id} className="bg-[#101916] text-[#f3f4f6]">🏠 {m.name.length > 25 ? m.name.substring(0, 25) + '...' : m.name}</option>
                    ))
                  : config.provider === 'openrouter' && openRouterModels.length > 0
                  ? openRouterModels.map(m => (
                      <option key={m.id} value={m.id} className="bg-[#101916] text-[#f3f4f6]">🆓 {m.name.length > 25 ? m.name.substring(0, 25) + '...' : m.name}</option>
                    ))
                  : config.provider === 'deepsproxy' && deepsproxyModels.length > 0
                  ? deepsproxyModels.map(m => (
                      <option key={m.id} value={m.id} className="bg-[#101916] text-[#f3f4f6]">🔌 {m.name.length > 25 ? m.name.substring(0, 25) + '...' : m.name}</option>
                    ))
                  : config.provider === 'kimiproxy' && kimiproxyModels.length > 0
                  ? kimiproxyModels.map(m => (
                      <option key={m.id} value={m.id} className="bg-[#101916] text-[#f3f4f6]">🔌 {m.name.length > 25 ? m.name.substring(0, 25) + '...' : m.name}</option>
                    ))
                  : config.provider === 'geminiproxy' && geminiproxyModels.length > 0
                  ? geminiproxyModels.map(m => (
                      <option key={m.id} value={m.id} className="bg-[#101916] text-[#f3f4f6]">🔌 {m.name.length > 25 ? m.name.substring(0, 25) + '...' : m.name}</option>
                    ))
                  : <option value={config.model} className="bg-[#101916] text-[#f3f4f6]">{config.model || 'Nenhum modelo'}</option>
                }
              </select>
              <span className="text-[9px] text-nova-accent whitespace-nowrap bg-nova-accent/10 border border-nova-accent/20 px-2 py-1 rounded-full font-bold">
                {config.provider === 'routeway' ? 'RouteWay' : config.provider === 'ollama' ? 'Ollama' : config.provider === 'openai' ? 'OpenAI' : config.provider === 'openrouter' ? 'OpenRouter' : config.provider === 'deepsproxy' ? 'DeepsProxy' : config.provider === 'kimiproxy' ? 'KimiProxy' : config.provider === 'geminiproxy' ? 'GeminiProxy' : config.provider === 'custom' ? 'Custom' : config.provider}
              </span>
            </div>
          )}

          {selectedFiles.length > 0 && (
            <div className="px-4 py-3 border-b border-white/5 bg-[#0b1d2b]/70">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] font-medium text-[#94a3b8]">Anexos</div>
                <button
                  onClick={() => setSelectedFiles([])}
                  className="text-[9px] text-nova-error/80 hover:text-nova-error transition-colors"
                >
                  Limpar todos
                </button>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
                {selectedFiles.map((file, index) => (
                  <div key={index} className="relative group shrink-0">
                    <div className="bg-[#13211c] border border-[#152b21] rounded-xl p-1.5 hover:border-nova-accent/30 transition-colors w-16 h-16 flex flex-col justify-center items-center">
                      {file.type.startsWith('image/') ? (
                        <div className="w-full h-full rounded overflow-hidden relative">
                          <img 
                            src={URL.createObjectURL(file)} 
                            alt={file.name}
                            className="w-full h-full object-cover"
                            onLoad={(e) => setTimeout(() => URL.revokeObjectURL((e.target as HTMLImageElement).src), 1000)}
                          />
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center gap-1 w-full h-full">
                          <File size={16} className="text-[#94a3b8]" />
                          <span className="text-[8px] text-[#64748b] truncate w-full text-center">{file.name}</span>
                        </div>
                      )}
                      <button
                        onClick={() => removeFile(index)}
                        className="absolute -top-1 -right-1 w-4 h-4 bg-nova-error text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3 p-3">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={(e) => {
                // Tenta primeiro via files (mais confiável no Chromium/Electron)
                const files = e.clipboardData?.files;
                if (files && files.length > 0) {
                  const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
                  if (imageFiles.length > 0) {
                    e.preventDefault();
                    const processedFiles = imageFiles.map(f => {
                      if (!f.name || f.name === 'image.png') {
                        return new File([f], `imagem_colada_${Date.now()}.${f.type.split('/')[1] || 'png'}`, { type: f.type });
                      }
                      return f;
                    });
                    setSelectedFiles(prev => [...prev, ...processedFiles]);
                    return;
                  }
                }

                // Fallback para items
                const items = e.clipboardData?.items;
                if (!items) return;
                for (let i = 0; i < items.length; i++) {
                  if (items[i].type.indexOf('image') !== -1) {
                    e.preventDefault();
                    const blob = items[i].getAsFile();
                    if (blob) {
                      const fileName = `imagem_colada_${Date.now()}.${blob.type.split('/')[1] || 'png'}`;
                      const file = new File([blob], fileName, { type: blob.type });
                      setSelectedFiles(prev => [...prev, file]);
                    }
                  }
                }
              }}
              placeholder={isModelConfigured() ? 'Digite sua mensagem para o Ezek...' : 'Ative um provedor no Marketplace para conversar...'}
              rows={4}
              className="w-full resize-y rounded-xl border border-white/10 bg-[#071a29]/80 px-4 py-3 text-[13px] leading-relaxed text-nova-text outline-none placeholder:text-nova-text-muted transition-all min-h-[104px] max-h-[280px] overflow-y-auto scrollbar-thin focus:border-nova-accent/50 focus:bg-[#082033]"
            />
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 text-[10px] text-nova-text-muted">
                Enter envia, Shift+Enter quebra linha
              </div>
              <div className="flex gap-1.5 shrink-0">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.txt,.md,.json,.js,.ts,.tsx,.jsx,.css,.html,.xml,.csv,.log"
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="h-8 w-8 flex items-center justify-center text-nova-text-secondary rounded-lg border border-white/10 bg-white/5 hover:bg-nova-accent/10 hover:text-nova-accent transition-colors"
                title="Anexar arquivo"
                disabled={isProcessing}
              >
                <Paperclip size={18} />
              </button>
              <button
                onClick={toggleListening}
                className={`h-8 w-8 flex items-center justify-center rounded-lg border border-white/10 transition-colors ${
                  isListening ? 'bg-nova-error/20 text-nova-error' : 'bg-white/5 text-nova-text-secondary hover:bg-nova-accent/10 hover:text-nova-accent'
                }`}
                title={isListening ? 'Parar gravação' : 'Falar com Ezek (Whisper)'}
                disabled={isProcessing}
              >
                <Mic size={18} className={isListening ? 'animate-pulse' : ''} />
              </button>
              {isProcessing ? (
                <button onClick={cancelRequest} className="h-8 w-8 flex items-center justify-center bg-nova-error/10 text-nova-error rounded-lg border border-nova-error/20 hover:bg-nova-error/20 transition-colors" title="Parar">
                  <StopCircle size={18} />
                </button>
              ) : (
                <button 
                  onClick={handleSend} 
                  className={`h-8 min-w-8 px-2 flex items-center justify-center rounded-lg transition-colors ${
                    !isModelConfigured() || (!input.trim() && selectedFiles.length === 0)
                      ? 'text-[#64748b] bg-white/5 border border-white/10'
                      : 'bg-nova-accent text-nova-statusbar-text hover:bg-nova-accent-hover shadow-sm shadow-nova-accent/20'
                  }`}
                  title="Enviar" 
                  disabled={!isModelConfigured() || (!input.trim() && selectedFiles.length === 0)}
                >
                  <Send size={18} className={input.trim() || selectedFiles.length > 0 ? "ml-0.5" : ""} />
                </button>
              )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function FormattedMessage({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({node, inline, className, children, ...props}: any) {
          const match = /language-(\w+)/.exec(className || '')
          return !inline && match ? (
            <div className="relative group my-3 border border-nova-border rounded-lg overflow-hidden bg-nova-bg shadow-sm">
              <div className="flex items-center justify-between px-3 py-1.5 bg-nova-bg-secondary border-b border-nova-border">
                <span className="text-[10px] text-nova-text-muted font-mono uppercase">{match[1]}</span>
                {match[1].toLowerCase() === 'sql' && (
                  <button
                    onClick={() => {
                      const { executeQuery } = useSqlStore.getState()
                      executeQuery(String(children).replace(/\n$/, ''))
                      window.dispatchEvent(new CustomEvent('ezek:open-sql-tab'))
                    }}
                    className="flex items-center gap-1 px-2 py-0.5 bg-nova-accent/10 hover:bg-nova-accent hover:text-nova-statusbar-text text-nova-accent text-[10px] rounded transition-colors"
                  >
                    <Play size={10} /> Executar
                  </button>
                )}
              </div>
              <SyntaxHighlighter
                {...props}
                children={String(children).replace(/\n$/, '')}
                style={vscDarkPlus}
                language={match[1]}
                PreTag="div"
                wrapLines={false}
                wrapLongLines={false}
                customStyle={{ background: 'transparent', margin: 0, padding: '0.5rem', fontSize: '12px', overflowX: 'auto', maxWidth: '100%' }}
              />
            </div>
          ) : (
            <code {...props} className="bg-nova-accent/10 px-1.5 py-0.5 rounded text-[12px] font-mono text-nova-accent border border-nova-accent/20 break-words whitespace-pre-wrap">
              {children}
            </code>
          )
        },
        p: ({children}) => <p className="mb-3 leading-relaxed text-nova-text break-words last:mb-0">{children}</p>,
        ul: ({children}) => <ul className="list-disc pl-5 mb-3 space-y-1 text-nova-text marker:text-nova-accent">{children}</ul>,
        ol: ({children}) => <ol className="list-decimal pl-5 mb-3 space-y-1 text-nova-text marker:text-nova-accent">{children}</ol>,
        li: ({children}) => <li>{children}</li>,
        h1: ({children}) => <h1 className="text-xl font-bold mb-3 text-nova-text mt-4">{children}</h1>,
        h2: ({children}) => <h2 className="text-lg font-bold mb-3 text-nova-text mt-3">{children}</h2>,
        h3: ({children}) => <h3 className="text-base font-bold mb-2 text-nova-text mt-2">{children}</h3>,
        a: ({children, href}) => <a href={href} className="text-nova-accent hover:underline" target="_blank" rel="noreferrer">{children}</a>,
        table: ({children}) => <div className="overflow-x-auto mb-3"><table className="min-w-full divide-y divide-nova-border border border-nova-border rounded-lg">{children}</table></div>,
        thead: ({children}) => <thead className="bg-nova-bg-secondary">{children}</thead>,
        th: ({children}) => <th className="px-3 py-2 text-left text-xs font-medium text-nova-text-secondary uppercase tracking-wider">{children}</th>,
        td: ({children}) => <td className="px-3 py-2 whitespace-nowrap text-sm text-nova-text border-t border-nova-border">{children}</td>,
      }}
    >
      {content}
    </ReactMarkdown>
  )
}
