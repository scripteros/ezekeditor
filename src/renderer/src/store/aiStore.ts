import { create } from 'zustand'
import type { AIMessage, AIConfig, AIActionStep, AIFileChange, AIAttachment } from '../../../shared/types/ai'
import { getApi } from '../utils/platform'
import { useExplorerStore } from './explorerStore'
import { useEditorStore } from './editorStore'
import { useSqlStore } from './sqlStore'

// Lazy getter for useAuthStore to break circular dependency
// authStore imports useAIStore, so we cannot import useAuthStore here directly
function getAuthUser(): { id: number | string; nome: string; usuario: string } | null {
  try {
    // Dynamically check if authStore is available
    const stores = (window as any).__zustandStores
    if (stores?.auth) {
      return stores.auth.getState().user
    }
    // Fallback: try localStorage
    const raw = localStorage.getItem('ezek-auth-storage')
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed?.state?.user) return parsed.state.user
    }
  } catch {}
  return null
}

function getAuthMode(): 'local' | 'cloud' | null {
  try {
    const stores = (window as any).__zustandStores
    if (stores?.auth) {
      return stores.auth.getState().authMode
    }
    // Fallback: try localStorage
    const raw = localStorage.getItem('ezek-auth-storage')
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed?.state?.authMode) return parsed.state.authMode
    }
  } catch {}
  return null
}

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

// Lazy getter for skillStore
function getSkillStore(): any {
  try {
    const stores = (window as any).__zustandStores
    if (stores?.skill) return stores.skill
  } catch {}
  return null
}

interface AIState {
  messages: AIMessage[]
  config: AIConfig
  activeConfigId: string | null
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
  savedConfigs: SavedConfig[]
  chatHistories: Record<string, AIMessage[]>
  currentChatId: string
  panelWidth: number
  acquiredAPIs: string[]
  enabledAIProviders: string[]
  sessionFileWriteCount: number  // SAFETY: quantidade de arquivos criados na sessão atual
  enableAPIProvider: (id: string) => void
  disableAPIProvider: (id: string) => void
  acquireAPI: (id: string) => void
  releaseAPI: (id: string) => void

  addMessage: (msg: AIMessage) => void
  appendMessageContent: (id: string, text: string) => void
  setConfig: (config: Partial<AIConfig>) => void
  setActiveConfigId: (id: string | null) => void
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
  saveConfig: (name: string) => void
  updateConfig: (id: string, updates: Partial<AIConfig>) => void
  loadConfig: (configId: string) => void
  deleteConfig: (configId: string) => void
  activateConfig: (configId: string) => void
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

function getCurrentUserId(): string | null {
  const user = getAuthUser()
  return user ? String(user.id) : null
}

function getChatsStorageKey(): string {
  const userId = getCurrentUserId()
  return userId ? `ezek_ai_chats_${userId}` : 'ezek_ai_chats'
}

type AIProviderId = AIConfig['provider']

function providerDefaults(provider: AIProviderId): Partial<AIConfig> {
  if (provider === 'ollama') return { provider, baseUrl: 'http://localhost:11434', model: '' }
  if (provider === 'openai') return { provider, baseUrl: 'https://api.openai.com/v1', model: '' }
  if (provider === 'routeway') return { provider, baseUrl: 'https://api.routeway.ai/v1', model: '' }
  if (provider === 'openrouter') return { provider, baseUrl: 'https://openrouter.ai/api/v1', model: '' }
  if (provider === 'lmstudio') return { provider, baseUrl: 'http://localhost:1234/v1', model: '' }
  if (provider === 'deepseek') return { provider, baseUrl: 'https://api.deepseek.com/v1', model: '' }
  if (provider === 'opencode') return { provider, baseUrl: 'https://api.opencode.ai/v1', model: '' }
  if (provider === 'groq') return { provider, baseUrl: 'https://api.groq.com/openai/v1', model: '' }
  if (provider === 'custom') return { provider, model: '' }
  if (provider === 'hermes') return { provider, baseUrl: 'http://localhost:1337/v1', model: 'hermes-3' }
  if (provider === 'codebuff') return { provider, model: '' }
  return { provider, model: '' }
}

async function buildRedisMemoryContext(): Promise<string> {
  const api = getApi()
  if (!api || !(api as any).sqlGetCache) return ''

  const userId = getCurrentUserId()
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
      const entries = await (api as any).sqlGetCache(conn, userId)
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

// Debounced sync to MySQL after mutations
let syncTimer: any = null
function scheduleSyncToServer() {
  if (syncTimer) clearTimeout(syncTimer)
  syncTimer = setTimeout(() => {
    try {
      useAIStore.getState().syncToServer()
    } catch {}
  }, 2000)
}

// Estado inicial limpo — dados são carregados do MySQL via loadFromServer() no login
export const useAIStore = create<AIState>((set, get) => ({
  messages: [],
  config: DEFAULT_CONFIG,
  activeConfigId: null,
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
  savedConfigs: [],
  chatHistories: {},
  currentChatId: generateId(),
  panelWidth: 320,
  acquiredAPIs: [],
  enabledAIProviders: [],
  sessionFileWriteCount: 0,

  acquireAPI: (id) => {
    set(state => {
      const updated = [...new Set([...state.acquiredAPIs, id])]
      return { acquiredAPIs: updated }
    })
    scheduleSyncToServer()
  },

  releaseAPI: (id) => {
    set(state => {
      const updatedAcquired = state.acquiredAPIs.filter(apiId => apiId !== id)
      const updatedEnabled = state.enabledAIProviders.filter(providerId => providerId !== id)
      const next: Partial<AIState> = { acquiredAPIs: updatedAcquired, enabledAIProviders: updatedEnabled }
      if (state.config.provider === id) {
        const fallbackProvider = (updatedEnabled[0] as AIProviderId | undefined) || 'custom'
        next.config = { ...state.config, ...providerDefaults(fallbackProvider) }
      }
      return next as any
    })
    scheduleSyncToServer()
  },

  enableAPIProvider: (id) => {
    set(state => {
      const updatedAcquired = [...new Set([...state.acquiredAPIs, id])]
      const updatedEnabled = [...new Set([...state.enabledAIProviders, id])]
      return { acquiredAPIs: updatedAcquired, enabledAIProviders: updatedEnabled }
    })
    scheduleSyncToServer()
  },

  disableAPIProvider: (id) => {
    set(state => {
      const updatedEnabled = state.enabledAIProviders.filter(providerId => providerId !== id)
      const next: Partial<AIState> = { enabledAIProviders: updatedEnabled }
      if (state.config.provider === id) {
        const fallbackProvider = (updatedEnabled[0] as AIProviderId | undefined) || 'custom'
        next.config = { ...state.config, ...providerDefaults(fallbackProvider) }
      }
      return next as any
    })
    scheduleSyncToServer()
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
  },

  setActiveConfigId: (id) => {
    set({ activeConfigId: id })
  },

  sendMessage: async (content: string, attachments?: AIAttachment[], isHiddenSystemMessage = false, depth = 0) => {
    // Profundidade máxima para evitar loop infinito no agentic loop
    if (depth > 3) {
      if (depth === 0) set({ isProcessing: false })
      return
    }
    
    const { isProcessing } = get()
    if (isProcessing && !isHiddenSystemMessage) return

    set({ isProcessing: true })

    const api = getApi()
    if (!api) {
      if (depth === 0) set({ isProcessing: false })
      return
    }

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

      // Adicionar skills ativas como instruções obrigatórias
      const skillStore = getSkillStore()
      if (skillStore) {
        const skillsPrompt = skillStore.getState().getActiveSkillsPrompt()
        if (skillsPrompt) {
          messageContent = skillsPrompt + '\n' + messageContent
        }
      }

      // Adicionar contexto do navegador hacker
      if (skillStore) {
        const state = skillStore.getState()
        if (state.hackerMode) {
          // O navegador pode ser controlado via ação navigate_browser
          messageContent = '[MODO HACKER ATIVO] ' + messageContent

          // Injeta contexto ao vivo do painel de segurança em TODAS as mensagens
          const liveContext = state.getHackerLiveContextPrompt()
          if (liveContext) {
            messageContent = liveContext + '\n\n' + messageContent
          }
          
          // Informar ações disponíveis
          messageContent += `\n\n🔴 [FERRAMENTAS DISPONÍVEIS NO MODO HACKER]
Você pode usar as seguintes ações em blocos JSON nas suas respostas:
- \`{"type":"navigate_browser","url":"https://..."}\` — Navegar no navegador interno para um site
- \`{"type":"get_browser_content"}\` — Solicitar o conteúdo HTML da página atual
- \`{"type":"create_skill","name":"...","description":"...","content":"..."}\` — Criar uma nova skill

Use essas ações para explorar ativamente os alvos!`
        }
      }

      // Adicionar contexto de Game/Web Scrap se estiver ativo
      const gameStore = (window as any).__zustandStores?.gameScrap
      if (gameStore && gameStore.getState().isBrowserActive) {
        const state = gameStore.getState()
        const gameCtx = state.getGameContextPrompt()
        const scrapCtx = state.getScrapContextPrompt()
        if (gameCtx || scrapCtx) {
          messageContent = (gameCtx || scrapCtx) + '\n\n' + messageContent
          messageContent += `\n\n[🎮 AÇÕES DISPONÍVEIS]\n- \`{"type":"click_element","selector":"..."}\` — Clicar em um elemento\n- \`{"type":"extract_element","selector":"...","label":"..."}\` — Extrair dados de um elemento\n- \`{"type":"input_text","selector":"...","value":"..."}\` — Digitar em um campo\n`
        }
      }

      // Adicionar identidade do usuário para contexto da IA
      const authUser = getAuthUser()
      if (authUser) {
        messageContent = `[USUÁRIO ATUAL]: ${authUser.nome} (usuário: ${authUser.usuario})\n\n${messageContent}`
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
            // Só inclui regras Oracle Tasy se o workspace SQL estiver aberto
            const showSqlWs = useSqlStore.getState().showSqlWorkspace
            
            if (showSqlWs) {
              messageContent += `\n\n[AGENTE SQL ATIVADO]: O usuário está com o workspace SQL aberto.
Se você precisar buscar dados ou investigar a estrutura, use a action: {"type": "execute_sql", "query": "SEU SQL AQUI"}.
Eu vou executar o SQL silenciosamente e te devolver o resultado. Você pode fazer isso quantas vezes quiser até obter todos os dados necessários.
IMPORTANTE - REGRA DE ENTREGA: Você DEVE SEMPRE entregar a conclusão final da solicitação. Siga este fluxo:
1. Se precisar de dados, execute o SQL primeiro
2. Quando receber os dados, ANALISE e APRESENTE o resultado ao usuário
3. NUNCA responda apenas com "vou buscar" ou "vou fazer" - você já tem permissão, então FAÇA e entregue
4. Após obter os dados com sucesso, responda em texto normal (NUNCA use JSON) com o resultado completo
5. Se o SQL falhar, corrija o erro e tente novamente quantas vezes precisar
6. Somente se faltar alguma informação essencial que você não tem como obter, PEÇA ao usuário

IMPORTANTE: Não mostre os códigos SQL executados na sua resposta final, apenas os dados e a explicação. O sistema irá anexar o SQL no final automaticamente.

REGRAS OBRIGATÓRIAS PARA ORACLE TASY (DBLINK @tasyprod):

DECISÃO — QUANDO USAR DBLINK:
- Tabelas do sistema Tasy (pacientes, atendimentos, guias, contas, faturamento, etc): use \`tasy.NOME@tasyprod\`
- Tabelas locais (próprias do banco conectado, relatórios customizados): NÃO use @tasyprod
- Se não tem certeza: tente sem @tasyprod \u2192 se der ORA-00942, tente com \`tasy.NOME@tasyprod\`

SINTAXE CORRETA (OBRIGATÓRIO):
- \`tasy.nome_tabela@tasyprod\` — SEMPRE com \`tasy.\` ANTES e \`@tasyprod\` DEPOIS
- \`tasy.pacote.funcao@tasyprod(param)\` — para functions
- Exemplo: \`SELECT * FROM tasy.pacientes@tasyprod WHERE cod_paciente = 1234\`
- Exemplo CORRETO: \`SELECT p.nome, a.cod_atendimento FROM tasy.pacientes@tasyprod p, tasy.atendimentos@tasyprod a WHERE p.cod_paciente = a.cod_paciente\`
- Exemplo ERRADO: \`SELECT * FROM pacientes@tasyprod\` (falta \`tasy.\`)
- Exemplo ERRADO: \`SELECT * FROM tasy.pacientes\` (falta \`@tasyprod\`)

AUTO-CORREÇÃO OBRIGATÓRIA (SEMPRE SIGA):
Quando seu SQL der erro, você DEVE automaticamente:
1. Analisar o erro ORA-XXXXX
2. ORA-00942 (table/view not found): 
   - Sem @tasyprod \u2192 adicione \`tasy.NOME@tasyprod\`
   - Com @tasyprod e ainda erro \u2192 busque nome correto da tabela
3. ORA-00904 (invalid identifier / coluna não existe):
   - Investigue colunas reais: \`SELECT column_name FROM all_tab_columns@tasyprod WHERE table_name = 'TABELA'\`
   - Ajuste a query com o nome correto da coluna
4. ORA-00933 (SQL not properly ended): troque ANSI JOIN por sintaxe Oracle antiga
5. Corrija e tente novamente. REPITA até funcionar.
6. Depois de obter os dados, SEMPRE entregue a resposta final ao usuário
7. NUNCA pare no meio — finalize o raciocínio e entregue a conclusão`;
            } else {
              messageContent += `\n\n[ASSISTENTE DE CÓDIGO]: Você é um assistente de programação.
O usuário está no workspace de código do editor.
Você pode:
1. Criar, editar e ler arquivos no projeto
2. Executar comandos no terminal
3. Responder perguntas técnicas sobre código, arquitetura, etc
4. APENAS se o usuário pedir EXPLICITAMENTE, você pode usar execute_sql
5. NÃO use SQL a menos que o usuário peça
6. Regras Oracle Tasy dblink NÃO se aplicam aqui`;
            }
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

        // SAFETY: verifica se o arquivo está dentro do diretório do projeto
        // (comparação simples de string, path não está disponível no renderer)
        const isPathSafe = (filePath: string): boolean => {
          if (!rootPath) return true;
          const normalizedPath = filePath.replace(/\\/g, '/');
          const normalizedRoot = rootPath.replace(/\\/g, '/');
          return normalizedPath.startsWith(normalizedRoot);
        };

        // SAFETY: lista de diretórios bloqueados para escrita da IA
        const blockedDirectories = [
          '\\Desktop\\', '/Desktop/',
          '\\Documentos\\', '/Documentos/',
          '\\Documents\\', '/Documents/',
          '\\Downloads\\', '/Downloads/',
          '\\AppData\\', '/AppData/',
          '\\Program Files\\', '/Program Files/',
          '\\Windows\\', '/Windows/',
          '\\System32\\', '/System32/',
        ];

        const isPathBlocked = (filePath: string): boolean => {
          return blockedDirectories.some(dir => filePath.includes(dir));
        };

        const MAX_FILE_WRITES_PER_SESSION = 10;
        const MAX_FILE_WRITES_PER_MESSAGE = 3;  // limite por resposta da IA

        // Só executa ações nas primeiras chamadas (depth limitado) para evitar loop infinito
        if (depth < 3 && parsedActions && Array.isArray(parsedActions)) {
          let executedAny = false;
          let fileChanges: { path: string, add: number, del: number, originalContent?: string }[] = [];
          let actionFeedback = '';
          let fileWritesInThisMessage = 0;  // contador de arquivos criados NESTA resposta
          
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
                // SAFETY: bloquear escrita em diretórios do sistema (Desktop, Documentos, etc)
                const resolvedPath = action.filePath; // já resolvido pelo resolvePath acima
                
                if (isPathBlocked(resolvedPath)) {
                  actionFeedback += `\n[BLOCKED] Escrita em ${resolvedPath} bloqueada por segurança. A IA só pode criar arquivos dentro do diretório do projeto.\n`;
                  continue;
                }

                if (!isPathSafe(resolvedPath)) {
                  actionFeedback += `\n[BLOCKED] Escrita em ${resolvedPath} bloqueada — fora do diretório do projeto. Use caminhos relativos ao projeto.\n`;
                  continue;
                }

                // SAFETY: limite de arquivos por sessão
                const currentCount = get().sessionFileWriteCount;
                if (currentCount >= MAX_FILE_WRITES_PER_SESSION) {
                  actionFeedback += `\n[BLOCKED] Limite de ${MAX_FILE_WRITES_PER_SESSION} arquivos por sessão atingido.\n`;
                  continue;
                }

                // SAFETY: limite de arquivos por resposta — evita criação massiva de uma vez
                if (fileWritesInThisMessage >= MAX_FILE_WRITES_PER_MESSAGE) {
                  actionFeedback += `\n[BLOCKED] Limite de ${MAX_FILE_WRITES_PER_MESSAGE} arquivos por resposta atingido. Se precisar criar mais, envie uma nova mensagem.\n`;
                  continue;
                }

                // REGRA RÍGIDA: arquivos .html (dashboard/relatório) = no máximo 1 por resposta
                const isDashboardFile = resolvedPath.endsWith('.html') || resolvedPath.includes('dashboard') || resolvedPath.includes('report');
                if (isDashboardFile && fileWritesInThisMessage >= 1) {
                  actionFeedback += `\n[BLOCKED] Dashboard e relatório só podem ser criados em 1 arquivo único. Use um único arquivo HTML auto-contido.\n`;
                  continue;
                }

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
                  // File probably didn't exist — nova criação
                  add = action.content.split('\n').length;
                }

                if (add > 0 || del > 0 || originalContentToSave) {
                  fileChanges.push({ path: action.filePath, add, del, originalContent: originalContentToSave });
                }

                try {
                  await api.aiWriteFile(action.filePath, action.content);
                  useEditorStore.getState().openFile(action.filePath);
                  // Incrementa os contadores
                  set(state => ({ sessionFileWriteCount: state.sessionFileWriteCount + 1 }));
                  fileWritesInThisMessage++;  // contador por resposta
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
              else if (action.type === 'create_skill' && action.name && action.content) {
                try {
                  const skillDesc = action.description || `Skill criada pela IA via chat`;
                  const skillStore = getSkillStore()
                  if (skillStore) {
                    const stateBefore = skillStore.getState()
                    stateBefore.addSkill(action.name, skillDesc, action.content)
                    actionFeedback += `\n[SKILL CRIADA]: "${action.name}" foi criada e ativada com sucesso.\n`
                  } else {
                    actionFeedback += `\n[ERRO]: SkillStore não disponível.\n`
                  }
                } catch (err: any) {
                  actionFeedback += `\n[ERRO ao criar skill]: ${err.message}\n`
                }
                executedAny = true;
              }
              else if (action.type === 'navigate_browser' && action.url) {
                try {
                  const skillStore = getSkillStore()
                  if (skillStore) {
                    // Comunica ao SecurityPanel para navegar
                    skillStore.getState().setHackerBrowserCommandUrl(action.url)
                    actionFeedback += `\n[NAVEGADOR]: Navegando para ${action.url}...\n`
                  } else {
                    actionFeedback += `\n[ERRO]: Navegador interno não disponível.\n`
                  }
                } catch (err: any) {
                  actionFeedback += `\n[ERRO ao navegar]: ${err.message}\n`
                }
                executedAny = true;
              }
              else if (action.type === 'get_browser_content') {
                try {
                  const skillStore = getSkillStore()
                  if (skillStore) {
                    // O conteúdo da página será fornecido pelo SecurityPanel via IPC
                    // Por enquanto, indica que a IA está requisitando o conteúdo
                    actionFeedback += `\n[NAVEGADOR]: Solicitando conteúdo da página atual. O conteúdo será injetado na próxima iteração.\n`
                  }
                } catch (err: any) {
                  actionFeedback += `\n[ERRO ao obter conteúdo]: ${err.message}\n`
                }
                executedAny = true;
              }
              // Game/Scrap actions
              else if (action.type === 'click_element' && action.selector) {
                try {
                  const gameStore = (window as any).__zustandStores?.gameScrap
                  if (gameStore) {
                    gameStore.getState().logClick(action.selector)
                    // O clique real é feito pelo componente GameScrapPanel via polling
                    actionFeedback += `\n[🎮 CLIQUE]: Elemento "${action.selector}" será clicado.\n`
                  } else {
                    actionFeedback += `\n[ERRO]: GameScrapStore não disponível.\n`
                  }
                } catch (err: any) {
                  actionFeedback += `\n[ERRO ao clicar]: ${err.message}\n`
                }
                executedAny = true;
              }
              else if (action.type === 'extract_element' && action.selector) {
                try {
                  const gameStore = (window as any).__zustandStores?.gameScrap
                  if (gameStore) {
                    gameStore.getState().logExtraction(action.selector)
                    gameStore.getState().addScrapedItem({
                      selector: action.selector,
                      label: action.label || action.selector,
                      value: `(extraído pela IA em ${new Date().toLocaleTimeString()})`,
                      format: 'text',
                    })
                    actionFeedback += `\n[🕷️ EXTRAÇÃO]: Elemento "${action.selector}" registrado.\n`
                  } else {
                    actionFeedback += `\n[ERRO]: GameScrapStore não disponível.\n`
                  }
                } catch (err: any) {
                  actionFeedback += `\n[ERRO ao extrair]: ${err.message}\n`
                }
                executedAny = true;
              }
              else if (action.type === 'input_text' && action.selector) {
                try {
                  const gameStore = (window as any).__zustandStores?.gameScrap
                  if (gameStore) {
                    gameStore.getState().logInput(action.selector, action.value || '')
                    actionFeedback += `\n[⌨️ INPUT]: Digitando "${action.value || ''}" em "${action.selector}".\n`
                  }
                } catch (err: any) {
                  actionFeedback += `\n[ERRO ao digitar]: ${err.message}\n`
                }
                executedAny = true;
              }
          }

            if (executedAny) {
              // Atualiza o assistantMsg original com os fileChanges, SEM adicionar mensagem intermediária
              set(state => {
                const updatedMessages = [...state.messages];
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
              // Aguarda a resposta para manter isProcessing ativo durante todo o ciclo
              if (actionFeedback.trim().length > 0) {
                const hasErrors = actionFeedback.includes('[SQL Execution Error]') || actionFeedback.includes('[Error');
                
                // Se já executamos ações nesse ciclo, o próximo nível DEVE concluir
                let feedbackType = 'success';
                if (hasErrors) feedbackType = 'error';
                
                const prompt = `[SYSTEM FEEDBACK - ${feedbackType === 'error' ? 'ERROR' : 'DADOS OBTIDOS'}]

${actionFeedback}

⚠️ INSTRUÇÃO FINAL (OBRIGATÓRIA):
${feedbackType === 'error' 
  ? 'O SQL ACUSOU ERRO. Analise o erro acima, corrija o SQL e execute novamente. NÃO responda com texto, NÃO peça desculpas — apenas corrija e tente de novo.'
  : 'VOCÊ ACABOU DE RECEBER OS DADOS. AGORA RESPONDA EM TEXTO NORMAL com a conclusão final para o usuário. Não gere JSON. Não gere actions. Não execute mais SQL. Apenas responda com a análise completa dos dados. Se houver dados em formato de tabela, apresente-os de forma legível.'
}`;
                await new Promise(resolve => setTimeout(resolve, 500)); // pequena pausa para UI atualizar
                await get().sendMessage(prompt, undefined, true, depth + 1);
                
                // Após o feedback, se ainda estamos em depth 0 e houve ações executadas,
                // registrar que o ciclo foi concluído — a resposta final já foi adicionada
                // nos messages pelo sendMessage interno
              }
            }
          }

        // SAFETY NET: detecta "promessa vazia" — IA disse que vai fazer algo mas não executou ação
        if (depth === 0 && cleanedResponse && !parsedActions?.length) {
          const promisePattern = /vou\s+(buscar|consultar|fazer|procurar|verificar|analisar|executar|criar|gerar|montar|preparar|tentar|prosseguir|iniciar|começar|investigar)|deixe-me|deixa\s+eu|vamos\s+(buscar|consultar|fazer)/i;
          if (promisePattern.test(cleanedResponse)) {
            const prompt = `[SISTEMA] Você respondeu apenas com texto dizendo que vai fazer algo, mas NÃO executou a ação necessária. Quando precisa consultar dados no banco, você DEVE usar o formato JSON com "actions": [{"type": "execute_sql", "query": "..."}]. Responda AGORA com o JSON contendo a ação necessária. Coloque no campo "message" apenas "Processando...". NÃO escreva texto explicativo, NÃO diga "vou buscar" — apenas o JSON com a ação.`;
            await get().sendMessage(prompt, undefined, true, 1);
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
      if (depth === 0) set({ isProcessing: false })
      // Em depths > 0, isProcessing será limpo pelo depth 0 quando retornar
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

  saveConfig: (customName?: string) => {
    const { config, savedConfigs } = get()
    const name = customName || prompt('Nome para esta configuração:', `${config.provider} - ${config.model || 'sem modelo'}`)
    if (!name) return
    const newConfig: SavedConfig = {
      id: generateId(),
      name,
      config: { ...config, id: generateId(), name },
    }
    const updated = [...savedConfigs, newConfig]
    set({ savedConfigs: updated, activeConfigId: newConfig.id })
    scheduleSyncToServer()
  },

  updateConfig: (configId, updates) => {
    const { savedConfigs } = get()
    const updated = savedConfigs.map(c => {
      if (c.id === configId) {
        const updatedConfig = { ...c.config, ...updates }
        return { ...c, config: updatedConfig }
      }
      return c
    })
    set({ savedConfigs: updated })
  },

  loadConfig: (configId) => {
    const { savedConfigs } = get()
    const found = savedConfigs.find(c => c.id === configId)
    if (found) {
      set({ config: { ...found.config }, activeConfigId: configId })
      if (found.config.provider === 'routeway') {
        get().fetchRouteWayModels()
      }
    }
    scheduleSyncToServer()
  },

  deleteConfig: (configId) => {
    const { savedConfigs, activeConfigId } = get()
    const updated = savedConfigs.filter(c => c.id !== configId)
    set({ savedConfigs: updated })
    if (activeConfigId === configId) {
      set({ activeConfigId: null })
    }
    scheduleSyncToServer()
  },

  activateConfig: (configId) => {
    const { savedConfigs } = get()
    const found = savedConfigs.find(c => c.id === configId)
    if (found) {
      set({ config: { ...found.config }, activeConfigId: configId })
    }
    scheduleSyncToServer()
  },

  saveChatHistory: () => {
    const { messages, currentChatId, chatHistories } = get()
    const updated = { ...chatHistories, [currentChatId]: messages }
    set({ chatHistories: updated })
    scheduleSyncToServer()
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
    scheduleSyncToServer()
  },

  createNewChat: () => {
    const newId = generateId()
    set({
      messages: [],
      currentChatId: newId,
      activePlanSteps: [],
      pendingChanges: []
    })
    const { chatHistories } = get()
    const updated = { ...chatHistories, [newId]: [] }
    set({ chatHistories: updated })
    scheduleSyncToServer()
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
  },

  // ─── MySQL/Local Sync ─────────────────────────────
  syncToServer: async () => {
    const api = getApi()
    if (!api) return
    const user = getAuthUser()
    const authMode = getAuthMode()
    if (!user) return
    
    const { acquiredAPIs, enabledAIProviders, savedConfigs, config, activeConfigId, chatHistories } = get()
    const data = {
      acquiredAPIs,
      enabledAIProviders,
      savedConfigs,
      activeConfig: config,
      activeConfigId,
      chatHistories
    }
    
    if (authMode === 'local') {
      // Save locally using JSON file
      if ((api as any).localConfigSaveAI) {
        await (api as any).localConfigSaveAI(String(user.id), data)
      }
    } else {
      // Save to MySQL server (cloud)
      if ((api as any).userSaveAiConfigs) {
        await (api as any).userSaveAiConfigs(user.id as number, data)
      }
    }
  },

  loadFromServer: async () => {
    const api = getApi()
    if (!api) return
    const user = getAuthUser()
    const authMode = getAuthMode()
    if (!user) return
    
    if (authMode === 'local') {
      // Load from local JSON file
      if ((api as any).localConfigLoadAI) {
        const result = await (api as any).localConfigLoadAI(String(user.id))
        if (result.success && result.configs) {
          const c = result.configs
          if (c.acquiredAPIs) set({ acquiredAPIs: c.acquiredAPIs })
          if (c.enabledAIProviders) set({ enabledAIProviders: c.enabledAIProviders })
          if (c.savedConfigs) set({ savedConfigs: c.savedConfigs })
          if (c.activeConfig) set({ config: c.activeConfig })
          if (c.activeConfigId !== undefined) set({ activeConfigId: c.activeConfigId })
          if (c.chatHistories) set({ chatHistories: c.chatHistories })
        }
      }
    } else {
      // Load from MySQL server (cloud)
      if ((api as any).userLoadAiConfigs) {
        const result = await (api as any).userLoadAiConfigs(user.id as number)
        if (result.success && result.configs) {
          const c = result.configs
          if (c.acquired_apis) set({ acquiredAPIs: c.acquired_apis })
          if (c.enabled_providers) set({ enabledAIProviders: c.enabled_providers })
          if (c.saved_configs) set({ savedConfigs: c.saved_configs })
          if (c.active_config) set({ config: c.active_config })
          if (c.active_config_id) set({ activeConfigId: c.active_config_id })
          if (c.chat_histories) set({ chatHistories: c.chat_histories })
        }
      }
    }
  }
}))
