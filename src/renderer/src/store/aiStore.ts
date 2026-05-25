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
  openRouterModels: RouteWayModel[]
  isLoadingOpenRouterModels: boolean
  deepsproxyModels: RouteWayModel[]
  isLoadingDeepsProxyModels: boolean
  isDeepsProxyInstalled: boolean
  kimiproxyModels: RouteWayModel[]
  isLoadingKimiProxyModels: boolean
  isKimiProxyInstalled: boolean
  deepsProxyStatus: 'online' | 'offline' | 'error'
  kimiProxyStatus: 'online' | 'offline' | 'error'
  savedConfigs: SavedConfig[]
  chatHistories: Record<string, AIMessage[]>
  currentChatId: string
  panelWidth: number

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
  fetchOpenRouterModels: () => Promise<void>
  selectOpenRouterModel: (modelId: string) => void
  fetchDeepsProxyModels: () => Promise<void>
  selectDeepsProxyModel: (modelId: string) => void
  checkDeepsProxyInstalled: () => Promise<void>
  fetchKimiProxyModels: () => Promise<void>
  selectKimiProxyModel: (modelId: string) => void
  checkKimiProxyInstalled: () => Promise<void>
  setProxyStatus: (proxyType: 'deepsproxy' | 'kimiproxy', status: 'online' | 'offline' | 'error') => void
  saveConfig: (name: string) => void
  loadConfig: (configId: string) => void
  deleteConfig: (configId: string) => void
  saveChatHistory: () => void
  loadChatHistory: (chatId: string) => void
  deleteChatHistory: (chatId: string) => void
  createNewChat: () => void
  clearChat: () => void
  revertMessageChanges: (messageId: string) => Promise<void>
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
  openRouterModels: [],
  isLoadingOpenRouterModels: false,
  deepsproxyModels: [],
  isLoadingDeepsProxyModels: false,
  isDeepsProxyInstalled: false,
  kimiproxyModels: [],
  isLoadingKimiProxyModels: false,
  isKimiProxyInstalled: false,
  deepsProxyStatus: 'offline',
  kimiProxyStatus: 'offline',
  savedConfigs: loadSavedConfigs() || [],
  chatHistories: initialHistories,
  currentChatId: initialChatId,
  panelWidth: 320,

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

      // Adicionar contexto SQL se for relevante
      const { activeFileId, openFiles } = useEditorStore.getState()
      const activeFile = openFiles.find(f => f.id === activeFileId)
      if (activeFile && activeFile.language === 'sql') {
        const { activeConnectionId, queryResults, connections } = useSqlStore.getState()
        if (activeConnectionId) {
          const activeConn = connections.find(c => c.id === activeConnectionId)
          if (activeConn) {
            messageContent += `\n\n[INFORMAÇÃO IMPORTANTE]: O banco de dados alvo desta operação é: **${activeConn.provider.toUpperCase()}**.\n`
            
            // Try fetching from Redis cache
            try {
              const cacheHistory = await (window as any).api.sqlGetCache(activeConn)
              if (cacheHistory && cacheHistory.length > 0) {
                messageContent += `\n[Contexto Estrutural - Histórico do Redis]:\nAbaixo estão as últimas queries executadas e as colunas retornadas, use isso para entender a estrutura, os nomes de tabelas, campos e funções:\n`
                cacheHistory.forEach((entry: any, i: number) => {
                  messageContent += `\nQuery ${i + 1}:\n\`\`\`sql\n${entry.query}\n\`\`\`\nColunas mapeadas: ${entry.columns.join(', ')}\n`
                })
              }
            } catch (err) {
              console.error('Failed to inject Redis cache', err)
            }
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
Quando tiver os dados, dê a sua resposta final para o usuário. IMPORTANTE: Não mostre os códigos SQL executados na sua resposta final, apenas os dados e a explicação. O sistema irá anexar o SQL no final automaticamente.`;
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
                    const { activeConnectionId, connections } = useSqlStore.getState()
                    const activeConn = connections.find(c => c.id === activeConnectionId)
                    if (activeConn) {
                      const result = await (window as any).api.sqlExecuteQuery(activeConn, action.query)
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
                  const prompt = `[SYSTEM AUTO-FEEDBACK] Resultado das suas ações:\n${actionFeedback}\n\nSe houve erros, corrija-os e tente novamente. Se você leu um arquivo com sucesso, use as informações para continuar seu trabalho. Se tudo deu certo, você pode finalizar a tarefa. Lembre-se de sempre responder no formato JSON válido.`;
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

  setProxyStatus: (proxyType, status) => {
    if (proxyType === 'deepsproxy') set({ deepsProxyStatus: status })
    if (proxyType === 'kimiproxy') set({ kimiProxyStatus: status })
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
      if (installed && !get().config.kimiproxyPath) {
        get().setConfig({ kimiproxyPath: path })
      }
    } catch {}
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
