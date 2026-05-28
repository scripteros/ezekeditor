import { create } from 'zustand'
import type { AIMessage, AIConfig, AIActionStep, AIFileChange, AIAttachment } from '../../../shared/types/ai'
import { getApi } from '../utils/platform'
import { useExplorerStore } from './explorerStore'
import { useEditorStore } from './editorStore'
import { useSqlStore } from './sqlStore'

interface RouteWayModel {
  id: string
  name: string
  free: boolean
  description?: string
}

interface SavedConfig {
  id: string
  name: string
  config: AIConfig
}

interface AIState {
  messages: AIMessage[]
  config: AIConfig
  isProcessing: boolean
  isPanelOpen: boolean
  activePlanSteps: AIActionStep[]
  showDiff: boolean
  pendingChanges: AIFileChange[]
  routeWayModels: RouteWayModel[]
  isLoadingModels: boolean
  ollamaModels: RouteWayModel[]
  isLoadingOllamaModels: boolean
  openRouterModels: RouteWayModel[]
  isLoadingOpenRouterModels: boolean
  deepsproxyModels: RouteWayModel[]
  isLoadingDeepsProxyModels: boolean
  isDeepsProxyInstalled: boolean
  kimiproxyModels: RouteWayModel[]
  isLoadingKimiProxyModels: boolean
  isKimiProxyInstalled: boolean
  geminiproxyModels: RouteWayModel[]
  isLoadingGeminiProxyModels: boolean
  isGeminiProxyInstalled: boolean
  deepsProxyStatus: 'online' | 'offline' | 'starting' | 'error'
  kimiProxyStatus: 'online' | 'offline' | 'starting' | 'error'
  geminiProxyStatus: 'online' | 'offline' | 'starting' | 'error'
  savedConfigs: SavedConfig[]
  chatHistories: Record<string, AIMessage[]>
  panelWidth: number
  acquiredProxies: string[]
  enabledAIProviders: string[]
  acquireProxy: (id: string) => void
  releaseProxy: (id: string) => void
  enableAIProvider: (id: string) => void
  disableAIProvider: (id: string) => void
  stopProxy: (id: 'deepsproxy' | 'kimiproxy' | 'geminiproxy') => Promise<boolean>
  uninstallProxy: (id: 'deepsproxy' | 'kimiproxy' | 'geminiproxy') => Promise<boolean>

  addMessage: (msg: AIMessage) => void
  appendMessageContent: (id: string, text: string) => void
  setConfig: (config: Partial<AIConfig>) => void
  sendMessage: (content: string, attachments?: AIAttachment[]) => Promise<void>
  cancelRequest: () => void
  togglePanel: () => void
  setPanelWidth: (width: number) => void
  setShowDiff: (show: boolean) => void
  addPlanStep: (step: AIActionStep) => void
  updatePlanStep: (id: string, updates: Partial<AIActionStep>) => void
  clearPlan: () => void
  addPendingChange: (change: AIFileChange) => void
  clearPendingChanges: () => void
  fetchRouteWayModels: () => Promise<void>
  selectRouteWayModel: (modelId: string) => void
  fetchOllamaModels: () => Promise<void>
  selectOllamaModel: (modelId: string) => void
  fetchOpenRouterModels: () => Promise<void>
  selectOpenRouterModel: (modelId: string) => void
  fetchDeepsProxyModels: () => Promise<void>
  selectDeepsProxyModel: (modelId: string) => void
  checkDeepsProxyInstalled: () => Promise<void>
  fetchKimiProxyModels: () => Promise<void>
  selectKimiProxyModel: (modelId: string) => void
  checkKimiProxyInstalled: () => Promise<void>
  fetchGeminiProxyModels: () => Promise<void>
  selectGeminiProxyModel: (modelId: string) => void
  checkGeminiProxyInstalled: () => Promise<void>
  setProxyStatus: (proxyType: 'deepsproxy' | 'kimiproxy' | 'geminiproxy', status: 'online' | 'offline' | 'starting' | 'error') => void
  saveConfig: (name: string) => void
  loadConfig: (configId: string) => void
  deleteConfig: (configId: string) => void
  saveChatHistory: () => void
  loadChatHistory: (chatId: string) => void
  deleteChatHistory: (chatId: string) => void
  createNewChat: () => void
  clearChat: () => void
  revertMessageChanges: (messageId: string) => Promise<void>
  checkGeminiProxyInstalled: () => Promise<void>
  checkKimiProxyInstalled: () => Promise<void>
  checkDeepsProxyInstalled: () => Promise<void>
}

const DEFAULT_CONFIG: AIConfig = {
  provider: 'routeway',
  model: '',
  apiKey: '',
  baseUrl: 'https://api.routeway.ai/v1',
  temperature: 0.3,
  maxTokens: 4096,
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 11)
}

const STORAGE_KEY_CONFIGS = 'ezek_ai_configs'
const STORAGE_KEY_CHATS = 'ezek_ai_chats'
const STORAGE_KEY_ACTIVE_CONFIG = 'ezek_ai_active_config'

type AIProviderId = AIConfig['provider']

function loadSavedConfigs(): SavedConfig[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_CONFIGS)
    return stored ? JSON.parse(stored) : []
  } catch { return [] }
}

function loadChatHistories(): Record<string, AIMessage[]> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_CHATS)
    return stored ? JSON.parse(stored) : {}
  } catch { return {} }
}

function loadActiveConfig(): AIConfig | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_ACTIVE_CONFIG)
    return stored ? JSON.parse(stored) : null
  } catch { return null }
}

function providerDefaults(provider: AIProviderId): Partial<AIConfig> {
  if (provider === 'ollama') return { provider, baseUrl: 'http://localhost:11434', model: '' }
  if (provider === 'openai') return { provider, baseUrl: 'https://api.openai.com/v1', model: '' }
  if (provider === 'routeway') return { provider, baseUrl: 'https://api.routeway.ai/v1', model: '' }
  if (provider === 'openrouter') return { provider, baseUrl: 'https://openrouter.ai/api/v1', model: '' }
  if (provider === 'custom') return { provider, model: '' }
  if (provider === 'codebuff') return { provider, model: '' }
  if (provider === 'deepsproxy' || provider === 'kimiproxy' || provider === 'geminiproxy') {
    return { provider, baseUrl: 'http://localhost:3000/v1', model: '' }
  }
  return { provider, model: '' }
}

async function buildRedisMemoryContext(): Promise<string> {
  const api = getApi()
  if (!api || !(api as any).sqlGetCache) return ''

  const { connections, redisServers, activeRedisServerId } = useSqlStore.getState()
  const activeRedis = redisServers.find(server => server.id === activeRedisServerId)
  const redisConnections = activeRedis
    ? connections.map(conn => ({
      ...conn,
      redisEnabled: true,
      redisMode: activeRedis.redisMode,
      redisUrl: activeRedis.redisUrl,
      redisHost: activeRedis.redisHost,
      redisPort: activeRedis.redisPort,
      redisUsername: activeRedis.redisUsername,
      redisPassword: activeRedis.redisPassword,
      redisDatabase: activeRedis.redisDatabase,
      redisTls: activeRedis.redisTls,
    }))
    : connections.filter(conn => conn.redisEnabled || conn.redisUrl || conn.redisHost)
  if (redisConnections.length === 0) return ''

  const memoryBlocks: string[] = []

  for (const conn of redisConnections) {
    try {
      const entries = await (api as any).sqlGetCache(conn)
      if (!entries || entries.length === 0) continue

      const lines = entries.slice(0, 40).map((entry: any, index: number) => {
        const columns = Array.isArray(entry.columns) ? entry.columns.join(', ') : 'sem colunas'
        const types = entry.columnTypes && typeof entry.columnTypes === 'object'
          ? Object.entries(entry.columnTypes).map(([name, type]) => `${name}:${type}`).join(', ')
          : ''
        const date = entry.timestamp ? new Date(entry.timestamp).toLocaleString() : 'sem data'
        return [
          `Memória ${index + 1} (${date})`,
          `Banco: ${entry.provider || conn.provider} / ${entry.database || conn.database || 'sem database'}`,
          `Linhas: ${entry.rowCount ?? 'N/A'}`,
          `Colunas: ${columns}`,
          types ? `Tipos: ${types}` : '',
          `Query:\n\`\`\`sql\n${entry.query || ''}\n\`\`\``
        ].filter(Boolean).join('\n')
      })

      memoryBlocks.push(`Conexão "${conn.name}" (${conn.provider.toUpperCase()}):\n${lines.join('\n\n')}`)
    } catch (err) {
      console.error('Failed to inject Redis memory', err)
    }
  }

  if (memoryBlocks.length === 0) return ''

  return `\n\n[MEMÓRIA REDIS DA IA - expiração automática em 7 dias]:\nUse esta memória em qualquer conversa para lembrar consultas, colunas, tipos de campos e estrutura observada nos bancos configurados. Servidor Redis ativo: ${activeRedis?.name || 'legado da conexão SQL'}.\n\n${memoryBlocks.join('\n\n---\n\n')}\n`
}

// Function to clean and process Codebuff responses
function processCodebuffResponse(response: string): string {
  try {
    // Check if response looks like JSON
    if (!response.trim().startsWith('{')) {
      return response
    }
    
    const parsed = JSON.parse(response)
    
    // Extract text from lastMessage structure
    if (parsed.type === 'lastMessage' && Array.isArray(parsed.value)) {
      let extractedText = ''
      
      for (const msg of parsed.value) {
        // Only extract from assistant messages, skip tool-calls and tool messages
        if (msg.role === 'assistant' && Array.isArray(msg.content)) {
          for (const content of msg.content) {
            // Skip tool-call type content, only get text
            if (content.type === 'text' && content.text && !content.toolName && !content.toolCallId) {
              extractedText += content.text + '\n'
            }
          }
        }
      }
      
      return extractedText.trim() || 'Tarefa concluída com sucesso! ✅'
    }
    
    return response
  } catch {
    return response
  }
}

const initialHistories = loadChatHistories()
const chatIds = Object.keys(initialHistories)
let initialChatId = generateId()
let initialMessages: AIMessage[] = []

if (chatIds.length > 0) {
  // Pegar o último chat criado/editado (baseado na ordem das chaves ou timestamps)
  initialChatId = chatIds[chatIds.length - 1]
  initialMessages = initialHistories[initialChatId] || []
}

export const useAIStore = create<AIState>((set, get) => ({
  messages: initialMessages,
  config: loadActiveConfig() || DEFAULT_CONFIG,
  isProcessing: false,
  isPanelOpen: false,
  activePlanSteps: [],
  showDiff: false,
  pendingChanges: [],
  routeWayModels: [],
  isLoadingModels: false,
  ollamaModels: [],
  isLoadingOllamaModels: false,
  openRouterModels: [],
  isLoadingOpenRouterModels: false,
  deepsproxyModels: [],
  isLoadingDeepsProxyModels: false,
  isDeepsProxyInstalled: false,
  kimiproxyModels: [],
  isLoadingKimiProxyModels: false,
  isKimiProxyInstalled: false,
  geminiproxyModels: [],
  isLoadingGeminiProxyModels: false,
  isGeminiProxyInstalled: false,
  deepsProxyStatus: 'offline',
  kimiProxyStatus: 'offline',
  geminiProxyStatus: 'offline',
  savedConfigs: loadSavedConfigs() || [],
  chatHistories: initialHistories,
  currentChatId: initialChatId,
  panelWidth: 320,
  acquiredProxies: (() => {
    try {
      const stored = localStorage.getItem('ezek_acquired_proxies')
      return stored ? JSON.parse(stored) : []
    } catch { return [] }
  })(),
  enabledAIProviders: (() => {
    try {
      const stored = localStorage.getItem('ezek_enabled_ai_providers')
      return stored ? JSON.parse(stored) : []
    } catch { return [] }
  })(),

  acquireProxy: (id) => {
    set(state => {
      const updated = [...new Set([...state.acquiredProxies, id])]
      try {
        localStorage.setItem('ezek_acquired_proxies', JSON.stringify(updated))
      } catch {}
      return { acquiredProxies: updated }
    })
  },

  releaseProxy: (id) => {
    set(state => {
      const updated = state.acquiredProxies.filter(proxyId => proxyId !== id)
      try {
        localStorage.setItem('ezek_acquired_proxies', JSON.stringify(updated))
      } catch {}
      return { acquiredProxies: updated }
    })
  },

  enableAIProvider: (id) => {
    set(state => {
      const updated = [...new Set([...state.enabledAIProviders, id])]
      try {
        localStorage.setItem('ezek_enabled_ai_providers', JSON.stringify(updated))
      } catch {}
      return { enabledAIProviders: updated }
    })

    get().setConfig(providerDefaults(id as AIProviderId))
  },

  disableAIProvider: (id) => {
    set(state => {
      const updated = state.enabledAIProviders.filter(providerId => providerId !== id)
      try {
        localStorage.setItem('ezek_enabled_ai_providers', JSON.stringify(updated))
      } catch {}
      return { enabledAIProviders: updated }
    })

    if (get().config.provider === id) {
      get().setConfig({ provider: 'custom' as any, model: '' })
    }
  },

  stopProxy: async (id) => {
    const api = getApi()
    if (!api) return false

    try {
      const success = await api.aiStopProxy(id)
      get().setProxyStatus(id, success ? 'offline' : 'error')
      return success
    } catch {
      get().setProxyStatus(id, 'error')
      return false
    }
  },

  uninstallProxy: async (id) => {
    const api = getApi()
    if (!api || !(api as any).aiUninstallProxy) return false

    try {
      await api.aiStopProxy(id)
    } catch {}

    const success = await (api as any).aiUninstallProxy(id)
    if (!success) return false

    get().releaseProxy(id)
    get().disableAIProvider(id)
    get().setProxyStatus(id, 'offline')

    if (id === 'deepsproxy') set({ isDeepsProxyInstalled: false })
    if (id === 'kimiproxy') set({ isKimiProxyInstalled: false })
    if (id === 'geminiproxy') set({ isGeminiProxyInstalled: false })

    const currentProvider = get().config.provider
    if (currentProvider === id) {
      get().setConfig({ provider: 'routeway', model: '' })
    }

    return true
  },

  addMessage: (msg) => {
    set(state => ({ messages: [...state.messages, msg] }))
    get().saveChatHistory()
  },

  appendMessageContent: (id, text) => {
    set(state => ({
      messages: state.messages.map(m => m.id === id ? { ...m, content: m.content + text } : m)
    }))
  },

  setConfig: (partial) => {
    set(state => ({ config: { ...state.config, ...partial } }))
    try {
      localStorage.setItem(STORAGE_KEY_ACTIVE_CONFIG, JSON.stringify({ ...get().config, ...partial }))
    } catch {}

    const selectedProvider = partial.provider
    if (selectedProvider === 'deepsproxy' || selectedProvider === 'kimiproxy' || selectedProvider === 'geminiproxy') {
      const api = getApi()
      if (api) {
        get().setProxyStatus(selectedProvider, 'starting' as any)
        api.aiStartProxy(selectedProvider)
          .then(success => get().setProxyStatus(selectedProvider, success ? 'online' : 'error'))
          .catch(() => get().setProxyStatus(selectedProvider, 'error'))
      }
    }
  },

  sendMessage: async (content: string, attachments?: AIAttachment[], isHiddenSystemMessage = false) => {
    const { isProcessing } = get()
    if (isProcessing && !isHiddenSystemMessage) return

    set({ isProcessing: true })

    const api = getApi()
    if (!api) return

    if (!isHiddenSystemMessage) {
      const userMsg: AIMessage = {
        id: generateId(),
        role: 'user',
        content,
        timestamp: Date.now(),
        type: 'plan',
        attachments,
      }

      set(state => ({ messages: [...state.messages, userMsg] }))
      get().saveChatHistory()
    } else {
      const sysMsg: AIMessage = {
        id: generateId(),
        role: 'system',
        content,
        timestamp: Date.now(),
        type: 'plan',
        hidden: true
      }
      set(state => ({ messages: [...state.messages, sysMsg] }))
    }

    try {
      const { config, messages, currentChatId } = get()
      const rootPath = useExplorerStore.getState().rootPath
      // Preparar conteúdo com anexos para enviar à API
      let messageContent = content
      if (attachments && attachments.length > 0) {
        messageContent += '\n\nArquivos anexados:\n'
        for (const attachment of attachments) {
          messageContent += `\n**${attachment.name}** (${attachment.mimeType}):\n`
          if (attachment.type === 'image') {
            messageContent += `[Imagem: ${attachment.name}]\n`
          } else {
            messageContent += `\`\`\`\n${attachment.content}\n\`\`\`\n`
          }
        }
      }

      const redisMemoryContext = await buildRedisMemoryContext()
      if (redisMemoryContext) {
        messageContent += redisMemoryContext
      }

      // Adicionar contexto SQL se for relevante
      const { activeFileId, openFiles } = useEditorStore.getState()
      const activeFile = openFiles.find(f => f.id === activeFileId)
      if (activeFile && activeFile.language === 'sql') {
        const { activeConnectionId, queryResults, connections } = useSqlStore.getState()
        if (activeConnectionId) {
          const activeConn = connections.find(c => c.id === activeConnectionId)
          if (activeConn) {
            messageContent += `\n\n[INFORMAÇÃO IMPORTANTE]: O banco de dados alvo desta operação é: **${activeConn.provider.toUpperCase()}**.\n`
            
          }

          if (queryResults[activeConnectionId]) {
            const sqlResult = queryResults[activeConnectionId]
            messageContent += `\n\n[Contexto SQL da Sessão Atual]:\nÚltima query executada na tela:\n\`\`\`sql\n${sqlResult.query || 'N/A'}\n\`\`\`\n`
            if (sqlResult.success) {
              messageContent += `Resultado (Linhas: ${sqlResult.rowCount}):\n\`\`\`json\n${JSON.stringify(sqlResult.rows?.slice(0, 50), null, 2)}\n\`\`\``
            } else {
              messageContent += `Erro na execução:\n\`\`\`\n${sqlResult.error}\n\`\`\``
            }
          }
          
          if (config.allowAutonomousSql) {
            messageContent += `\n\n[AGENTE SQL ATIVADO]: Você tem permissão para consultar o banco de dados de forma autônoma para resolver o problema do usuário.
Se você precisar buscar dados ou investigar a estrutura, use a action: {"type": "execute_sql", "query": "SEU SQL AQUI"}.
Eu vou executar o SQL silenciosamente e te devolver o resultado. Você pode fazer isso quantas vezes quiser até obter todos os dados necessários.
Quando tiver os dados, dê a sua resposta final para o usuário. IMPORTANTE: Não mostre os códigos SQL executados na sua resposta final, apenas os dados e a explicação. O sistema irá anexar o SQL no final automaticamente.
Não encerre dizendo que "vai fazer" ou que "o usuário deve executar" se você tem permissão para consultar. Execute as consultas necessárias, analise o resultado e só então conclua.`;
          }
        }
      }
      
      const response = await api.aiSendMessage(messageContent, messages, config, rootPath, currentChatId)

      // Process and clean Codebuff response
      let cleanedResponse = response
      if (config.provider === 'codebuff') {
        cleanedResponse = processCodebuffResponse(response)
      }

      let parsedSteps: any = null
      let parsedChanges: any = null
      let parsedActions: any = null

      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          if (parsed.message) {
            cleanedResponse = parsed.message
          }
          if (parsed.steps) parsedSteps = parsed.steps
          if (parsed.changes) parsedChanges = parsed.changes
          if (parsed.actions) parsedActions = parsed.actions
        }
      } catch (e) {
        console.error("Failed to parse actions", e);
      }

      const assistantMsg: AIMessage = {
        id: generateId(),
        role: 'assistant',
        content: cleanedResponse,
        timestamp: Date.now(),
        type: 'result',
        parsedSteps: parsedSteps || undefined,
        parsedActions: parsedActions || undefined,
      }

      set(state => ({
        messages: [...state.messages, assistantMsg]
      }))
      get().saveChatHistory()

      try {
        if (parsedSteps) {
          set({ activePlanSteps: parsedSteps.map((s: any) => ({ ...s, status: 'pending' })) })
        }
        if (parsedChanges) {
          set({ pendingChanges: parsedChanges })
        }
        
        const resolvePath = (filePath: string, rootPath?: string) => {
          if (!filePath) return filePath;
          if (/^[a-zA-Z]:\\/.test(filePath) || filePath.startsWith('/')) return filePath;
          if (!rootPath) return filePath;
          const cleanRoot = rootPath.replace(/[\\/]$/, '');
          const cleanPath = filePath.replace(/^[\\/]/, '');
          return `${cleanRoot}/${cleanPath}`;
        };

        if (parsedActions && Array.isArray(parsedActions)) {
          let executedAny = false;
          let fileChanges: { path: string, add: number, del: number, originalContent?: string }[] = [];
          let actionFeedback = '';
          
          for (const action of parsedActions) {
              if (action.filePath) action.filePath = resolvePath(action.filePath, rootPath);

              if (action.type === 'read_file' && action.filePath) {
                 try {
                   const content = await api.readFile(action.filePath);
                   actionFeedback += `\n[Result of read_file ${action.filePath}]:\n\`\`\`\n${content}\n\`\`\`\n`;
                 } catch (err: any) {
                   actionFeedback += `\n[Error reading ${action.filePath}]: ${err.message || 'File not found'}\n`;
                 }
                 executedAny = true;
              }
              else if (action.type === 'write_file' && action.filePath && action.content) {
                let add = 0;
                let del = 0;
                let originalContentToSave = '';
                try {
                  const oldContent = await api.readFile(action.filePath);
                  originalContentToSave = oldContent;
                  const oldLines = oldContent.split('\n');
                  const newLines = action.content.split('\n');
                  
                  if (oldContent !== action.content) {
                     // Naive diff for UI
                     add = Math.max(0, newLines.length - oldLines.length);
                     del = Math.max(0, oldLines.length - newLines.length);
                     // If length is the same but content differs, show minimal change
                     if (add === 0 && del === 0) {
                        add = Math.floor(newLines.length * 0.1) || 1;
                        del = add;
                     } else {
                        // Add some randomness/proportionality for modified lines
                        const minChange = Math.floor(Math.min(oldLines.length, newLines.length) * 0.1);
                        add += minChange;
                        del += minChange;
                     }
                  }
                } catch {
                  // File probably didn't exist
                  add = action.content.split('\n').length;
                }

                if (add > 0 || del > 0 || originalContentToSave) {
                  fileChanges.push({ path: action.filePath, add, del, originalContent: originalContentToSave });
                }

                try {
                  await api.aiWriteFile(action.filePath, action.content);
                  useEditorStore.getState().openFile(action.filePath);
                  actionFeedback += `\n[Success: wrote file ${action.filePath}]\n`;
                } catch (err: any) {
                  actionFeedback += `\n[Error writing ${action.filePath}]: ${err.message || 'Permission denied'}\n`;
                }
                executedAny = true;
              }
              else if (action.type === 'command' && action.cmd) {
                try {
                  await api.aiExecuteCommand(action.cmd);
                  actionFeedback += `\n[Command executed: ${action.cmd}]\n`;
                } catch (err: any) {
                  actionFeedback += `\n[Error executing command ${action.cmd}]: ${err.message}\n`;
                }
                executedAny = true;
              }
              else if (action.type === 'execute_sql' && action.query) {
                try {
                  const upperQuery = action.query.trim().toUpperCase();
                  const isSelectOnly = upperQuery.startsWith('SELECT') || upperQuery.startsWith('SHOW') || upperQuery.startsWith('DESCRIBE') || upperQuery.startsWith('EXPLAIN');
                  
                  if (!isSelectOnly) {
                    actionFeedback += `\n[SQL Execution Blocked]: Ação bloqueada pelas políticas de segurança. A IA só possui permissão para executar comandos SELECT de forma autônoma. Para comandos que alteram dados (UPDATE, INSERT, DELETE, ALTER), você deve apenas mostrar a query no chat e pedir para o usuário executar e aprovar manualmente.\n`
                  } else {
                    const { activeConnectionId, connections, executeQuery } = useSqlStore.getState()
                    const activeConn = connections.find(c => c.id === activeConnectionId)
                    if (activeConn) {
                      const result = await executeQuery(action.query)
                      window.dispatchEvent(new CustomEvent('ezek:open-sql-tab'))
                      if (result.success) {
                        actionFeedback += `\n[SQL Execution Success]:\nRows affected/returned: ${result.rowCount}\nData (first 50 rows max):\n\`\`\`json\n${JSON.stringify(result.rows?.slice(0, 50), null, 2)}\n\`\`\`\n`
                      } else {
                        actionFeedback += `\n[SQL Execution Error]: ${result.error}\n`
                      }
                    } else {
                      actionFeedback += `\n[SQL Execution Error]: No active SQL connection found.\n`
                    }
                  }
                } catch (err: any) {
                  actionFeedback += `\n[SQL Execution Exception]: ${err.message}\n`
                }
                
                // Track executed SQLs
                const currentMsg = get().messages.find(m => m.id === assistantMsg.id)
                const sqlList = currentMsg?.executedSqls || []
                set(state => ({
                  messages: state.messages.map(m => m.id === assistantMsg.id ? { ...m, executedSqls: [...sqlList, action.query] } : m)
                }))
                
                executedAny = true;
              }
            }
            if (executedAny) {
              const successMsg: AIMessage = {
                id: generateId(),
                role: 'assistant',
                content: `✅ Ações processadas pelo sistema (veja feedback na próxima mensagem).`,
                timestamp: Date.now(),
                type: 'result',
                hidden: true // Esconder a mensagem de success do loop do usuário
              }
              
              set(state => {
                const updatedMessages = [...state.messages, successMsg];
                if (fileChanges.length > 0) {
                  const msgIndex = updatedMessages.findIndex(m => m.id === assistantMsg.id);
                  if (msgIndex !== -1) {
                    updatedMessages[msgIndex] = { ...updatedMessages[msgIndex], fileChanges };
                  }
                }
                return { messages: updatedMessages };
              });
              
              get().saveChatHistory();

              // Agentic Loop: Enviar o feedback de volta para a IA silenciosamente
              if (actionFeedback.trim().length > 0) {
                setTimeout(() => {
                  const prompt = `[SYSTEM AUTO-FEEDBACK] Resultado das suas ações:\n${actionFeedback}\n\nContinue a tarefa até concluir. Se houve erros, corrija-os e tente novamente. Se você leu um arquivo ou executou SQL com sucesso, use as informações para continuar seu trabalho. Se tudo deu certo, finalize com uma conclusão clara do que foi feito e do resultado obtido. Responda no formato JSON válido somente se ainda precisar executar novas ações; se a tarefa estiver concluída, responda em texto normal.`;
                  get().sendMessage(prompt, undefined, true);
                }, 800);
              }
            }
          }
      } catch (e) {
        console.error("Failed to parse/execute actions", e);
      }
    } catch (err) {
      const errorMsg: AIMessage = {
        id: generateId(),
        role: 'assistant',
        content: `Erro: ${err instanceof Error ? err.message : 'Falha ao processar requisição'}`,
        timestamp: Date.now(),
        type: 'error',
      }
      set(state => ({
        messages: [...state.messages, errorMsg]
      }))
      get().saveChatHistory()
    } finally {
      set({ isProcessing: false })
    }
  },

  cancelRequest: () => {
    const api = getApi()
    if (api) api.aiCancelRequest()
    set({ isProcessing: false })
  },

  togglePanel: () => {
    set(state => ({ isPanelOpen: !state.isPanelOpen }))
  },

  setPanelWidth: (width) => {
    set({ panelWidth: Math.max(200, Math.min(800, width)) })
  },

  setShowDiff: (show) => {
    set({ showDiff: show })
  },


  addPlanStep: (step) => { set(state => ({ activePlanSteps: [...state.activePlanSteps, step] })) },
  updatePlanStep: (id, updates) => { set(state => ({ activePlanSteps: state.activePlanSteps.map(s => s.id === id ? { ...s, ...updates } : s) })) },
  clearPlan: () => { set({ activePlanSteps: [] }) },
  addPendingChange: (change) => { set(state => ({ pendingChanges: [...state.pendingChanges, change] })) },
  clearPendingChanges: () => { set({ pendingChanges: [] }) },

  fetchRouteWayModels: async () => {
    const api = getApi()
    if (!api) return
    set({ isLoadingModels: true })
    try {
      const models: RouteWayModel[] = await api.aiListRouteWayModels()
      set({ routeWayModels: models, isLoadingModels: false })
      const freeModels = models.filter(m => m.free)
      if (freeModels.length > 0 && !get().config.model) {
        set(state => ({ config: { ...state.config, model: freeModels[0].id } }))
      }
    } catch {
      set({ isLoadingModels: false })
    }
  },

  selectRouteWayModel: (modelId) => {
    get().setConfig({ model: modelId })
  },

  fetchOllamaModels: async () => {
    const api = getApi()
    if (!api || !(api as any).aiListModels) return
    set({ isLoadingOllamaModels: true })
    try {
      const models: string[] = await (api as any).aiListModels(get().config.baseUrl || 'http://localhost:11434')
      const formatted = models.map(model => ({
        id: model,
        name: model,
        free: true,
        description: 'Modelo local do Ollama',
      }))
      set({ ollamaModels: formatted, isLoadingOllamaModels: false })
      if (formatted.length > 0 && !get().config.model) {
        get().setConfig({ model: formatted[0].id })
      }
    } catch {
      set({ isLoadingOllamaModels: false })
    }
  },

  selectOllamaModel: (modelId) => {
    get().setConfig({ model: modelId })
  },

  fetchOpenRouterModels: async () => {
    const api = getApi()
    if (!api) return
    set({ isLoadingOpenRouterModels: true })
    try {
      const models: RouteWayModel[] = await (api as any).aiListOpenRouterModels()
      set({ openRouterModels: models, isLoadingOpenRouterModels: false })
      const freeModels = models.filter(m => m.free)
      if (freeModels.length > 0 && !get().config.model) {
        set(state => ({ config: { ...state.config, model: freeModels[0].id } }))
      }
    } catch {
      set({ isLoadingOpenRouterModels: false })
    }
  },

  selectOpenRouterModel: (modelId) => {
    get().setConfig({ model: modelId })
  },

  fetchDeepsProxyModels: async () => {
    const api = getApi()
    if (!api) return
    set({ isLoadingDeepsProxyModels: true })
    try {
      const models: RouteWayModel[] = await (api as any).aiListDeepsProxyModels()
      set({ deepsproxyModels: models, isLoadingDeepsProxyModels: false })
      const freeModels = models.filter(m => m.free)
      if (freeModels.length > 0 && !get().config.model) {
        set(state => ({ config: { ...state.config, model: freeModels[0].id } }))
      }
    } catch {
      set({ isLoadingDeepsProxyModels: false })
    }
  },

  selectDeepsProxyModel: (modelId) => {
    get().setConfig({ model: modelId })
  },

  checkDeepsProxyInstalled: async () => {
    const api = getApi()
    if (!api) return
    try {
      const { installed, path } = await (api as any).aiCheckDeepsProxy()
      set({ isDeepsProxyInstalled: installed })
      if (installed) get().acquireProxy('deepsproxy')
      if (installed && !get().config.deepsproxyPath) {
        get().setConfig({ deepsproxyPath: path })
      }
    } catch {}
  },

  fetchKimiProxyModels: async () => {
    const api = getApi()
    if (!api) return
    set({ isLoadingKimiProxyModels: true })
    try {
      const models: RouteWayModel[] = await (api as any).aiListKimiProxyModels()
      set({ kimiproxyModels: models, isLoadingKimiProxyModels: false })
      const freeModels = models.filter(m => m.free)
      if (freeModels.length > 0 && !get().config.model) {
        set(state => ({ config: { ...state.config, model: freeModels[0].id } }))
      }
    } catch {
      set({ isLoadingKimiProxyModels: false })
    }
  },

  selectKimiProxyModel: (modelId) => {
    get().setConfig({ model: modelId })
  },

  checkKimiProxyInstalled: async () => {
    const api = getApi()
    if (!api) return
    try {
      const { installed, path } = await (api as any).aiCheckKimiProxyInstalled()
      set({ isKimiProxyInstalled: installed })
      if (installed) get().acquireProxy('kimiproxy')
      if (installed && !get().config.kimiproxyPath) {
        get().setConfig({ kimiproxyPath: path })
      }
    } catch {}
  },

  fetchGeminiProxyModels: async () => {
    const api = getApi()
    if (!api) return
    set({ isLoadingGeminiProxyModels: true })
    try {
      const models: RouteWayModel[] = await (api as any).aiListGeminiProxyModels()
      set({ geminiproxyModels: models, isLoadingGeminiProxyModels: false })
      const freeModels = models.filter(m => m.free)
      if (freeModels.length > 0 && !get().config.model) {
        set(state => ({ config: { ...state.config, model: freeModels[0].id } }))
      }
    } catch {
      set({ isLoadingGeminiProxyModels: false })
    }
  },

  selectGeminiProxyModel: (modelId) => {
    get().setConfig({ model: modelId })
  },

  checkGeminiProxyInstalled: async () => {
    const api = getApi()
    if (!api) return
    try {
      const { installed, path } = await (api as any).aiCheckGeminiProxyInstalled()
      set({ isGeminiProxyInstalled: installed })
      if (installed) get().acquireProxy('geminiproxy')
      if (installed && !get().config.geminiproxyPath) {
        get().setConfig({ geminiproxyPath: path })
      }
    } catch {}
  },

  setProxyStatus: (proxyType, status) => {
    if (proxyType === 'deepsproxy') set({ deepsProxyStatus: status })
    else if (proxyType === 'kimiproxy') set({ kimiProxyStatus: status })
    else if (proxyType === 'geminiproxy') set({ geminiProxyStatus: status })
  },

  saveCurrentConfig: () => {
    const { config, savedConfigs } = get()
    const name = prompt('Nome para esta configuração:', `${config.provider} - ${config.model || 'sem modelo'}`)
    if (!name) return
    const newConfig: SavedConfig = {
      id: generateId(),
      name,
      config: { ...config },
    }
    const updated = [...savedConfigs, newConfig]
    set({ savedConfigs: updated })
    try { localStorage.setItem(STORAGE_KEY_CONFIGS, JSON.stringify(updated)) } catch {}
  },

  loadConfig: (configId) => {
    const { savedConfigs } = get()
    const found = savedConfigs.find(c => c.id === configId)
    if (found) {
      set({ config: { ...found.config } })
      try { localStorage.setItem(STORAGE_KEY_ACTIVE_CONFIG, JSON.stringify(found.config)) } catch {}
      if (found.config.provider === 'routeway') {
        get().fetchRouteWayModels()
      }
    }
  },

  deleteConfig: (configId) => {
    const updated = get().savedConfigs.filter(c => c.id !== configId)
    set({ savedConfigs: updated })
    try { localStorage.setItem(STORAGE_KEY_CONFIGS, JSON.stringify(updated)) } catch {}
  },

  saveChatHistory: () => {
    const { messages, currentChatId, chatHistories } = get()
    const updated = { ...chatHistories, [currentChatId]: messages }
    set({ chatHistories: updated })
    try { localStorage.setItem(STORAGE_KEY_CHATS, JSON.stringify(updated)) } catch {}
  },

  loadChatHistory: (chatId) => {
    const { chatHistories } = get()
    const history = chatHistories[chatId]
    if (history) {
      set({ messages: history, currentChatId: chatId })
    }
  },

  deleteChatHistory: (chatId) => {
    const { chatHistories } = get()
    const updated = { ...chatHistories }
    delete updated[chatId]
    set({ chatHistories: updated })
    try { localStorage.setItem(STORAGE_KEY_CHATS, JSON.stringify(updated)) } catch {}
  },

  createNewChat: () => {
    const newId = generateId()
    set({ messages: [], currentChatId: newId })
    get().saveChatHistory()
  },

  clearChat: () => {
    set({ messages: [] })
    get().saveChatHistory()
  },

  revertMessageChanges: async (messageId: string) => {
    const msg = get().messages.find(m => m.id === messageId)
    if (!msg || !msg.fileChanges) return
    
    const api = getApi()
    if (!api) return

    for (const change of msg.fileChanges) {
      if (change.originalContent !== undefined) {
        try {
          await api.aiWriteFile(change.path, change.originalContent)
        } catch (e) {
          console.error(`Failed to revert file ${change.path}`, e)
        }
      }
    }
    
    // Optionally remove the fileChanges from the message or mark them as reverted
    // But keeping it is fine, just maybe add a notification.
  }
}))
