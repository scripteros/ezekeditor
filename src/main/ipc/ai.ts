import { ipcMain, dialog, BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '../../shared/constants'
import { spawn, ChildProcess } from 'child_process'
import { readFile, writeFile, readDirectory } from '../services/fileService'
import { getGitStatus, gitAdd, gitCommit, gitPush, gitPull, gitBranch, gitCheckout, gitLog, gitExecuteCommand, isGitRepo } from '../services/gitService'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import os from 'os'
import fs from 'fs'
import { CodebuffClient } from '@codebuff/sdk'

const execAsync = promisify(exec)

let abortController: AbortController | null = null
const codebuffSessions: Record<string, any> = {}

let deepsProxyProcess: ChildProcess | null = null
let kimiProxyProcess: ChildProcess | null = null
let geminiProxyProcess: ChildProcess | null = null

function killProxyProcess(child: ChildProcess | null) {
  if (!child) return
  if (process.platform === 'win32' && child.pid) {
    spawn('taskkill', ['/pid', child.pid.toString(), '/t'])
  } else {
    child.kill()
  }
}

function emitProxyStatus(proxyType: 'deepsproxy' | 'kimiproxy' | 'geminiproxy', status: 'online' | 'offline' | 'error') {
  const wins = BrowserWindow.getAllWindows()
  if (wins.length > 0) {
    wins[0].webContents.send('ai:proxyStatusChange', proxyType, status)
  }
}

function getProxyProcess(proxyType: 'deepsproxy' | 'kimiproxy' | 'geminiproxy') {
  if (proxyType === 'deepsproxy') return deepsProxyProcess
  if (proxyType === 'kimiproxy') return kimiProxyProcess
  return geminiProxyProcess
}

function clearProxyProcess(proxyType: 'deepsproxy' | 'kimiproxy' | 'geminiproxy') {
  if (proxyType === 'deepsproxy') deepsProxyProcess = null
  else if (proxyType === 'kimiproxy') kimiProxyProcess = null
  else geminiProxyProcess = null
}

async function queryOllama(baseUrl: string, model: string, prompt: string, signal: AbortSignal): Promise<string> {
  const cleanBaseUrl = (baseUrl || 'http://localhost:11434').replace(/\/+$/, '')
  const response = await fetch(`${cleanBaseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: false }),
    signal,
  })
  
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Ollama Error (${response.status}): ${text}`)
  }

  const data = await response.json()
  return data.response || 'No response from model'
}

async function queryOpenAI(config: { baseUrl: string; apiKey: string; model: string }, prompt: string, signal: AbortSignal): Promise<string> {
  const baseUrl = config.baseUrl.replace(/\/+$/, '').replace(/\/v1$/, '')
  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'OpenAI/NodeJS/4.0.0',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    }),
    signal,
  })

  if (!response.ok) {
    const text = await response.text()
    try {
      const errorJson = JSON.parse(text)
      const errorMsg = errorJson.error?.message || errorJson.error?.metadata?.raw || text
      throw new Error(`API Error (${response.status}): ${errorMsg}`)
    } catch {
      throw new Error(`API Error (${response.status}): ${text}`)
    }
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content || 'No response'
}

async function queryOpenAIChat(config: { baseUrl: string; apiKey: string; model: string }, messages: { role: string; content: string }[], signal: AbortSignal): Promise<string> {
  const baseUrl = config.baseUrl.replace(/\/+$/, '').replace(/\/v1$/, '')
  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'OpenAI/NodeJS/4.0.0',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: 0.3,
    }),
    signal,
  })

  if (!response.ok) {
    const text = await response.text()
    try {
      const errorJson = JSON.parse(text)
      const errorMsg = errorJson.error?.message || errorJson.error?.metadata?.raw || text
      throw new Error(`API Error (${response.status}): ${errorMsg}`)
    } catch {
      throw new Error(`API Error (${response.status}): ${text}`)
    }
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content || 'No response'
}


export function registerAiHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.AI_LIST_MODELS, async (_event, baseUrl?: string) => {
    try {
      const cleanBaseUrl = (baseUrl || 'http://localhost:11434').replace(/\/+$/, '')
      const response = await fetch(`${cleanBaseUrl}/api/tags`)
      const data = await response.json()
      return data.models?.map((m: any) => m.name) || []
    } catch {
      return []
    }
  })

  ipcMain.handle('ai:startVoiceServer', async () => {
    return new Promise((resolve) => {
      const command = 'start cmd /k "title Ezek Voice Server && cd voice-server && echo Inicializando Servidor de Voz (Whisper)... && pip install -r requirements.txt && echo Dependencias verificadas! Iniciando... && python server.py"';
      exec(command, (error) => {
        if (error) {
          console.error('Failed to start voice server:', error);
          resolve({ success: false, error: error.message });
          return;
        }
        resolve({ success: true });
      });
    });
  })

  ipcMain.handle(IPC_CHANNELS.AI_SEND_MESSAGE, async (_event, message: string, history: any[], config: any, workspacePath?: string, chatId?: string) => {
    abortController = new AbortController()
    const signal = abortController.signal

    if (config.provider === 'codebuff') {
      try {
        if (config.apiKey) {
          process.env.CODEBUFF_API_KEY = config.apiKey
        }
        
        const client = new CodebuffClient({
          apiKey: config.apiKey,
          cwd: workspacePath || os.homedir(),
        })

        const previousRun = chatId ? codebuffSessions[chatId] : undefined

        const finalPrompt = message + '\n\n[INSTRUÇÃO DO SISTEMA: Responda e se comunique sempre em Português do Brasil.]'

        const result = await client.run({
          agent: 'codebuff/base@0.0.16',
          prompt: finalPrompt,
          previousRun,
          handleEvent: (event) => {
            const wins = BrowserWindow.getAllWindows()
            if (wins.length > 0) {
              wins[0].webContents.send('ai:streamEvent', { source: 'codebuff', data: event })
            }
          }
        })

        if (result.output?.type === 'error') {
          throw new Error(`Codebuff Error: ${result.output.message || JSON.stringify(result.output)}`)
        }

        if (chatId) {
          codebuffSessions[chatId] = result
        }

        let responseText = ''
        if (result.output?.type === 'lastMessage' && Array.isArray(result.output.value)) {
          for (const val of result.output.value) {
            if (val.role === 'assistant' && Array.isArray(val.content)) {
              for (const content of val.content) {
                if (content.type === 'text' && content.text) {
                  responseText += content.text + '\n'
                }
              }
            }
          }
        }
        
        if (responseText) return responseText.trim()

        if (result.output?.text) return result.output.text
        if (result.output?.message) return result.output.message
        if (typeof result.output === 'string') return result.output
        
        return JSON.stringify(result.output) || "Tarefa concluída pelo Codebuff."
      } catch (err: any) {
        if (err.name === 'AbortError') return 'Request cancelled'
        throw new Error(`Codebuff: ${err.message || 'Falha na execução do agente.'}`)
      }
    }

    const systemPrompt = `# MASTER PROMPT — FULL STACK AI ENGINEER ELITE

Você é um engenheiro de software full stack sênior extremamente experiente, especializado em desenvolvimento moderno, arquitetura escalável, segurança, performance e experiência do usuário.

Seu comportamento deve ser semelhante ao de um arquiteto de software profissional de alto nível que trabalha em produtos modernos comparáveis a:
- VSCode, Notion, Discord, Figma, Linear, Vercel, GitHub, Cursor AI, ChatGPT, Supabase

# PROMPT — FRONTEND SPECIALIST ELITE
Você é um engenheiro frontend sênior especialista em interfaces modernas, UX/UI profissional, performance e aplicações web escaláveis.
Especialista em: React, Next.js, TypeScript, TailwindCSS, Vite, Zustand, Redux, Electron, Framer Motion, Responsive Design, Design Systems.
Você sempre: cria interfaces modernas, cria layouts profissionais, utiliza componentização, usa boas práticas de UX, cria dark mode elegante, cria interfaces fluidas, utiliza animações suaves, usa grids modernos, cria componentes reutilizáveis.
Sempre gerar código limpo, responsivo, acessível, performático, bonito e intuitivo.
Sempre utilizar TailwindCSS, Lucide Icons, Heroicons, assets gratuitos. Priorizar Vercel, Linear, Stripe, Notion e GitHub style.
Evitar: layouts amadores, CSS bagunçado, código repetido, arquivos gigantes, interfaces antigas.

# PROMPT — BACKEND SPECIALIST ELITE
Você é um engenheiro backend sênior especialista em: Python, FastAPI, Flask, Node.js, NestJS, APIs REST, WebSockets, Microservices, Event Driven Architecture.
Você sempre: cria APIs seguras, utiliza arquitetura limpa, separa responsabilidades, cria middlewares, cria logs, implementa autenticação segura, implementa validações, implementa tratamento de erros, documenta endpoints.
Sempre usar JWT seguro, rate limit, validar entradas, evitar SQL Injection, proteger APIs, criar estrutura escalável.
Ao criar APIs: utilizar DTOs, services, repositories, controllers, schemas, tipagem forte.
Nunca: criar APIs inseguras, misturar responsabilidades, usar código monolítico, deixar secrets expostos.

# PROMPT — FLUTTER MOBILE SPECIALIST
Você é um desenvolvedor mobile especialista em Flutter. Cria aplicativos modernos, rápidos, profissionais, responsivos, intuitivos.
Especialista em: Flutter, Dart, Material 3, Clean Architecture, Riverpod, Bloc, animações, responsividade, offline-first.
Toda interface deve parecer um app premium, moderno, minimalista, elegante.
Nunca criar layouts amadores, código desorganizado, misturar lógica com UI.

# PROMPT — SQL DATABASE SPECIALIST
Você é um especialista em banco de dados e SQL avançado (PostgreSQL, MySQL, Oracle, SQLite, Redis, MongoDB).
Sempre: cria queries otimizadas, evita SQL lento, utiliza índices corretamente, evita N+1 queries, cria relacionamentos corretos, pensa em escalabilidade.
Domina: tuning, procedures, triggers, views, joins complexos, CTEs, paginação.
Nunca usar SELECT *, criar queries inseguras, ignorar índices.
REGRAS CRÍTICAS PARA ORACLE: Ao criar/sugerir comandos SQL para bancos ORACLE, NUNCA utilize ANSI Joins (INNER JOIN, LEFT JOIN). Utilize SEMPRE a sintaxe antiga de Joins do Oracle com múltiplas tabelas no FROM e restrições de relação na cláusula WHERE (ex: \`FROM tabela_a a, tabela_b b WHERE a.id = b.id\`).
O contexto frequentemente proverá um histórico de queries e metadados estruturais (schema). Preste atenção nas tabelas, campos e FUNÇÕES usadas no histórico para fazer melhores recomendações.
SEMPRE que o usuário pedir para você aprender a estrutura de uma tabela via dblink (ou obter campos/colunas de uma tabela via dblink), VOCÊ DEVE usar a seguinte query como base para buscar os dados:
\`SELECT column_name, data_type, data_length, nullable FROM all_tab_columns@tasyprod WHERE owner = 'TASY' AND table_name = 'NOME_DA_TABELA' ORDER BY column_id;\`

# PROMPT — SECURITY ENGINEER ELITE
Você é um engenheiro de segurança especialista em desenvolvimento seguro.
Sempre revisa vulnerabilidades, aplica OWASP, protege autenticação, APIs, frontend e backend.
Especialista em XSS, CSRF, SQL Injection, SSRF, JWT, OAuth, Criptografia, Hardening.
Você age como um auditor de segurança profissional. Nunca permitir código inseguro ou secrets expostos.

# PROMPT — DEVOPS ENGINEER ELITE
Engenheiro DevOps especialista em Docker, Docker Compose, Linux, Nginx, CI/CD, GitHub Actions, PM2, VPS, Kubernetes.
Cria ambientes organizados, otimiza containers, reduz consumo, melhora deploy, automatiza processos, monitora aplicações.
Especialista em deploy automatizado, monitoramento, segurança, escalabilidade, proxy reverso.

# PROMPT — UI/UX DESIGNER ELITE
Designer UI/UX especialista em interfaces modernas inspiradas em Stripe, Vercel, Linear, Notion, Discord, GitHub, Figma.
Usa hierarquia visual correta, espaçamentos profissionais, interfaces fluidas, dark mode elegante, micro animações, ícones modernos.

# PROMPT — BI & DASHBOARD SPECIALIST ELITE
Especialista em Business Intelligence, Analytics e Dashboards empresariais.
Você cria dashboards lindos, profissionais e responsivos usando bibliotecas modernas e gratuitas (como Recharts, Chart.js, Tremor, Nivo ou Apache ECharts).
Sempre prioriza visualizações de dados interativas, limpas, minimalistas e que gerem valor, com foco em métricas claras (KPIs).

# PROMPT — AI SOFTWARE ARCHITECT
Arquiteto de software especialista em sistemas modernos escaláveis. Pensa como CTO, arquiteto enterprise.
Especialista em microsserviços, monorepo, modularização, clean architecture, event driven, filas, websocket.
Sempre separa responsabilidades, evita acoplamento, prepara para crescimento futuro.

# PROMPT — CODE REVIEWER ELITE
Revisor de código extremamente rigoroso. Revisa segurança, performance, arquitetura, organização, legibilidade, boas práticas.
Detecta gargalos e vulnerabilidades. Age como tech lead experiente.

# PROMPT — OPEN SOURCE SPECIALIST
Especialista em ferramentas open source, self-hosted, Docker, IA local.
Prioriza Ollama, OpenWebUI, Flowise, n8n, Supabase, PostgreSQL, Traefik. Sempre recomenda alternativas gratuitas, self-hosted e escaláveis.

=== RECURSOS DO SISTEMA ===
You have the ability to:
1. Read files from the project
2. Create new files
3. Modify existing files
4. Delete files
5. Execute shell commands
6. List directory contents

You must act by returning standard JSON objects matching the schema below.

When the user asks you to make changes, you MUST:
1. First read the relevant files to understand the code
2. Plan the changes
3. Execute the changes using the JSON actions array

IMPORTANT: You MUST respond EXCLUSIVELY in valid JSON format when you want to execute actions. DO NOT use markdown codeblocks for your commands or write "**Call:**". If you want to perform actions, your ENTIRE response must be a single JSON object matching this schema:
{
  "message": "Your explanation or chat to the user in markdown formatting.",
  "steps": [{ "id": "1", "description": "what you're doing", "type": "read_file|write_file|command|git|execute_sql", "status": "pending" }],
  "actions": [
    { "type": "read_file", "filePath": "/absolute/path/to/file" },
    { "type": "write_file", "filePath": "/absolute/path/to/file", "content": "file content" },
    { "type": "command", "cmd": "shell command to run" },
    { "type": "execute_sql", "query": "SELECT * FROM users;" },
    { "type": "git", "action": "status|add|commit|push|pull|branch|checkout|log", "params": {"message": "commit msg", "branch": "main", etc...} }
  ]
}
If you DO NOT need to execute any actions, you can just return normal text/markdown without JSON. But if you need to read files, run commands, or edit code, you MUST wrap everything (including your message) inside the JSON object shown above.

IMPORTANTE: Responda em português do Brasil. Não fique repetindo seu nome ou se apresentando em toda mensagem; só mencione o nome Ezek se o usuário perguntar quem você é ou se isso for realmente necessário.
REGRA DE OURO: NUNCA inicie a conversa listando todas as suas habilidades. Seja extremamente direto, conciso e minimalista nas suas respostas. Se o usuário disser apenas 'oi', responda apenas com um cumprimento amigável e breve, sem textões.
PERSISTÊNCIA: Quando assumir uma tarefa, continue trabalhando até concluir de ponta a ponta ou até encontrar um bloqueio real que precise de ação do usuário. Não pare após análise parcial. Depois de executar ações, use o feedback para corrigir erros, continuar os próximos passos e retornar uma conclusão clara do que foi feito.`

    let workspaceContext = '';
    if (workspacePath) {
      try {
        const nodes = await readDirectory(workspacePath);
        const files = nodes.map(n => n.isDirectory ? `[DIR]  ${n.name}` : `[FILE] ${n.name}`).join('\n');
        workspaceContext = `\n\nCurrent Workspace Path: ${workspacePath}\nWorkspace Root Files:\n${files}\n`;
      } catch (err) {
        workspaceContext = `\n\nCurrent Workspace Path: ${workspacePath}\n(Unable to read workspace directory)\n`;
      }
    }

    const fullPrompt = `${systemPrompt}${workspaceContext}\n\nProject context: ${JSON.stringify(history.slice(-10))}\n\nUser: ${message}\n\nAssistant:`

    if (config.provider === 'routeway' || config.provider === 'openrouter' || config.provider === 'deepsproxy' || config.provider === 'kimiproxy' || config.provider === 'geminiproxy' || config.provider === 'custom' || config.provider === 'openai') {
      try {
        let baseUrl = 'https://api.routeway.ai/v1'
        if (config.provider === 'openrouter') baseUrl = 'https://openrouter.ai/api/v1'
        if (config.provider === 'openai') baseUrl = config.baseUrl || 'https://api.openai.com/v1'
        if (config.provider === 'deepsproxy') baseUrl = 'http://localhost:3000/v1'
        if (config.provider === 'kimiproxy') baseUrl = 'http://localhost:3000/v1'
        if (config.provider === 'geminiproxy') baseUrl = 'http://localhost:3000/v1'
        if (config.provider === 'custom') baseUrl = config.baseUrl || baseUrl

        const chatMessages = [
          { role: 'system', content: systemPrompt },
        ];
        if (workspaceContext) {
          chatMessages.push({ role: 'system', content: workspaceContext });
        }
        for (const h of history.slice(-10)) {
          chatMessages.push({
            role: h.role === 'assistant' ? 'assistant' : 'user',
            content: typeof h.content === 'string' ? h.content : JSON.stringify(h.content)
          });
        }
        chatMessages.push({ role: 'user', content: message });

        const response = await queryOpenAIChat({
          baseUrl,
          apiKey: config.apiKey || 'sk-no-key-required',
          model: config.model,
        }, chatMessages, signal)
        return response
      } catch (err: any) {
        if (err.name === 'AbortError') return 'Request cancelled'
        const providerName = config.provider === 'routeway' ? 'RouteWay' : config.provider === 'openrouter' ? 'OpenRouter' : config.provider === 'openai' ? 'OpenAI' : config.provider === 'kimiproxy' ? 'KimiProxy' : config.provider === 'geminiproxy' ? 'GeminiProxy' : config.provider === 'custom' ? 'Custom API' : 'DeepsProxy'
        throw new Error(`${providerName}: ${err.message || 'Connection failed.'}`)
      }
    }

    try {
      const response = await queryOllama(config.baseUrl, config.model, fullPrompt, signal)
      return response
    } catch (err: any) {
      if (err.name === 'AbortError') return 'Request cancelled'
      
      try {
        const response = await queryOpenAI(config, fullPrompt, signal)
        return response
      } catch {
        throw new Error(`Falha ao conectar em ${config.provider}. Verifique sua configuração.`)
      }
    }
  })

  ipcMain.handle(IPC_CHANNELS.AI_CANCEL, () => {
    if (abortController) {
      abortController.abort()
      abortController = null
    }
  })

  ipcMain.handle(IPC_CHANNELS.AI_TEST_CONNECTION, async (_event, config: any) => {
    try {
      if (config.provider === 'codebuff') {
        return { ok: Boolean(config.apiKey), error: config.apiKey ? undefined : 'Informe a chave da API Codebuff.' }
      }

      if (config.provider === 'ollama') {
        const cleanBaseUrl = (config.baseUrl || 'http://localhost:11434').replace(/\/+$/, '')
        const response = await fetch(`${cleanBaseUrl}/api/tags`)
        return { ok: response.ok, error: response.ok ? undefined : 'Ollama não respondeu corretamente.' }
      }
      
      let baseUrl = config.baseUrl || 'https://api.openai.com/v1'
      if (config.provider === 'openrouter') baseUrl = 'https://openrouter.ai/api/v1'
      if (config.provider === 'routeway') baseUrl = 'https://api.routeway.ai/v1'
      if (config.provider === 'deepsproxy') baseUrl = 'http://localhost:3000/v1'
      if (config.provider === 'kimiproxy') baseUrl = 'http://localhost:3000/v1'
      if (config.provider === 'geminiproxy') baseUrl = 'http://localhost:3000/v1'
      
      const formattedBaseUrl = baseUrl.replace(/\/+$/, '').replace(/\/v1$/, '')
      
      if (config.model) {
        const response = await fetch(`${formattedBaseUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'Ezek-Editor/1.0.0',
            'Authorization': `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({
            model: config.model,
            messages: [{ role: 'user', content: 'hello' }],
            max_tokens: 1
          }),
          signal: AbortSignal.timeout(10000),
        })
        
        if (response.ok) return { ok: true }
        
        const data = await response.json().catch(() => ({}))
        const errorMsg = data.error?.message || data.error || `HTTP ${response.status}`
        return { ok: false, error: String(errorMsg) }
      } else {
        const response = await fetch(`${formattedBaseUrl}/v1/models`, {
          headers: { Authorization: `Bearer ${config.apiKey}` },
          signal: AbortSignal.timeout(10000),
        })
        return { ok: response.ok, error: response.ok ? undefined : `HTTP ${response.status}` }
      }
    } catch (err: any) {
      return { ok: false, error: err.message || 'Erro de rede' }
    }
  })

  ipcMain.handle(IPC_CHANNELS.AI_EXECUTE_COMMAND, async (_event, command: string) => {
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: os.homedir(),
        timeout: 30000,
      })
      return { stdout: stdout || '', stderr: stderr || '' }
    } catch (err: any) {
      return { stdout: '', stderr: err.message || 'Command failed' }
    }
  })

  ipcMain.handle(IPC_CHANNELS.AI_GET_FILE, async (_event, filePath: string) => {
    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      return { content, exists: true }
    } catch {
      return { content: '', exists: false }
    }
  })

  ipcMain.handle(IPC_CHANNELS.AI_WRITE_FILE, async (_event, filePath: string, content: string) => {
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(filePath, content, 'utf-8')
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.AI_LIST_FILES, async (_event, dirPath: string) => {
    try {
      const files = await readDirectory(dirPath)
      return files
    } catch {
      return []
    }
  })

  ipcMain.handle(IPC_CHANNELS.AI_LIST_ROUTEWAY_MODELS, async () => {
    try {
      const response = await fetch('https://routeway.ai/api/models', {
        headers: { 
          'Accept': 'application/json',
          'User-Agent': 'Ezek-Editor/1.0.0'
        },
        signal: AbortSignal.timeout(10000),
      })
      const data = await response.json()

      const allModels = data.data || data.models || []
      if (!Array.isArray(allModels)) {
        return []
      }

      const freeModels = allModels.filter((m: any) => {
        const id = (m.id || m.name || '').toLowerCase()
        if (id.includes(':free')) return true
        const inputPrice = m.pricing?.input?.price_per_million_t
        const outputPrice = m.pricing?.output?.price_per_million_t
        return inputPrice === 0 && outputPrice === 0
      })

      return freeModels.map((m: any) => ({
        id: m.id || m.name || '',
        name: (m.name || m.id || '').replace(/\s*\(Free\)/i, '').trim(),
        free: true,
        description: (m.description || '').substring(0, 120),
      }))
    } catch (err) {
      console.error('Failed to fetch RouteWay models:', err)
      return [
        { id: 'deepseek-v4-flash:free', name: 'DeepSeek V4 Flash', free: true, description: 'Fast MoE model with 1M context, optimized for coding and reasoning' },
        { id: 'gpt-4o-mini:free', name: 'GPT-4o Mini', free: true, description: 'OpenAI small efficient model' },
        { id: 'gemini-2.0-flash:free', name: 'Gemini 2.0 Flash', free: true, description: 'Google fast multimodal model' },
        { id: 'claude-3.5-sonnet:free', name: 'Claude 3.5 Sonnet', free: true, description: 'Anthropic balanced model' },
        { id: 'llama-3.2-3b:free', name: 'Llama 3.2 3B', free: true, description: 'Meta small efficient model' },
        { id: 'mistral-7b:free', name: 'Mistral 7B', free: true, description: 'Mistral AI open model' },
      ]
    }
  })
  ipcMain.handle(IPC_CHANNELS.AI_LIST_OPENROUTER_MODELS, async () => {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000),
      })
      const data = await response.json()
      const allModels = data.data || []
      
      const freeModels = allModels.filter((m: any) => {
        return m.pricing?.prompt === '0' && m.pricing?.completion === '0'
      })

      return freeModels.map((m: any) => ({
        id: m.id || m.name || '',
        name: (m.name || m.id || '').replace(/\s*\(Free\)/i, '').trim(),
        free: true,
        description: (m.description || '').substring(0, 120),
      }))
    } catch (err) {
      console.error('Failed to fetch OpenRouter models:', err)
      return []
    }
  })

  ipcMain.handle(IPC_CHANNELS.AI_LIST_DEEPSPROXY_MODELS, async () => {
    try {
      const response = await fetch('http://localhost:3000/v1/models', {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000),
      })
      const data = await response.json()
      const allModels = data.data || []
      
      return allModels.map((m: any) => ({
        id: m.id || m.name || '',
        name: (m.id || '').toUpperCase().replace(/-/g, ' '),
        free: true,
        description: `Local DeepsProxy Model: ${m.id}`,
      }))
    } catch (err: any) {
      if (err?.cause?.code !== 'ECONNREFUSED') console.error('Failed to fetch DeepsProxy models:', err?.message || err)
      return [
        { id: 'deepseek-v4-flash', name: 'Deepseek V4 Flash', free: true, description: 'Local proxy' },
        { id: 'deepseek-v4-flash-thinking', name: 'Deepseek V4 Flash Thinking', free: true, description: 'Local proxy with reasoning' },
        { id: 'deepseek-v4-pro', name: 'Deepseek V4 Pro', free: true, description: 'Local proxy pro' },
        { id: 'deepseek-v4-pro-thinking', name: 'Deepseek V4 Pro Thinking', free: true, description: 'Local proxy pro with reasoning' },
      ]
    }
  })

  ipcMain.handle(IPC_CHANNELS.AI_CHECK_DEEPSPROXY, async () => {
    try {
      const home = os.homedir()
      const targetDir = path.join(home, '.ezek-editor', 'deepsproxy')
      const packageJsonPath = path.join(targetDir, 'package.json')
      
      const installed = fs.existsSync(packageJsonPath)
      return { installed, path: targetDir }
    } catch {
      return { installed: false, path: '' }
    }
  })

  ipcMain.handle(IPC_CHANNELS.AI_INSTALL_DEEPSPROXY, async (event) => {
    return new Promise((resolve) => {
      const home = os.homedir()
      const sendLog = (text: string) => {
        event.sender.send('ai:installLog', text)
      }

      const targetDir = path.join(home, '.ezek-editor')
      if (!fs.existsSync(targetDir)) {
        try { fs.mkdirSync(targetDir, { recursive: true }) } catch (e) {}
      }

      const commands = [
        `cd /d "${targetDir}"`,
        `if exist deepsproxy (rmdir /s /q deepsproxy)`,
        `git clone https://github.com/pedrofariasx/deepsproxy.git`,
        `cd deepsproxy`,
        `npm install`,
        `npx playwright install`
      ]

      const env = { ...process.env }
      const pathKey = Object.keys(env).find(k => k.toLowerCase() === 'path') || 'PATH'
      const currentPath = env[pathKey] || ''
      if (process.platform === 'win32' && !currentPath.toLowerCase().includes('git\\cmd')) {
        env[pathKey] = `${currentPath};C:\\Program Files\\Git\\cmd`
      }

      const child = spawn(commands.join(' && '), { cwd: targetDir, shell: true, env })
      child.stdout.on('data', d => sendLog(d.toString()))
      child.stderr.on('data', d => sendLog(d.toString()))
      child.on('close', code => resolve(code === 0))
      child.on('error', err => {
        sendLog(`Error: ${err.message}`)
        resolve(false)
      })
    })
  })

  ipcMain.handle(IPC_CHANNELS.AI_LIST_KIMIPROXY_MODELS, async () => {
    try {
      const response = await fetch('http://localhost:3000/v1/models', {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000),
      })
      const data = await response.json()
      const allModels = data.data || []
      
      return allModels.map((m: any) => ({
        id: m.id || m.name || '',
        name: (m.id || '').toUpperCase().replace(/-/g, ' '),
        free: true,
        description: `Local KimiProxy Model: ${m.id}`,
      }))
    } catch (err: any) {
      if (err?.cause?.code !== 'ECONNREFUSED') console.error('Failed to fetch KimiProxy models:', err?.message || err)
      return [
        { id: 'moonshot-v1-8k', name: 'Moonshot V1 8K', free: true, description: 'Local proxy' },
        { id: 'moonshot-v1-32k', name: 'Moonshot V1 32K', free: true, description: 'Local proxy' },
        { id: 'moonshot-v1-128k', name: 'Moonshot V1 128K', free: true, description: 'Local proxy' },
      ]
    }
  })

  ipcMain.handle(IPC_CHANNELS.AI_CHECK_KIMIPROXY, async () => {
    try {
      const home = os.homedir()
      const targetDir = path.join(home, '.ezek-editor', 'kimiproxy')
      const packageJsonPath = path.join(targetDir, 'package.json')
      
      const installed = fs.existsSync(packageJsonPath)
      return { installed, path: targetDir }
    } catch {
      return { installed: false, path: '' }
    }
  })

  ipcMain.handle(IPC_CHANNELS.AI_INSTALL_KIMIPROXY, async (event) => {
    return new Promise((resolve) => {
      const home = os.homedir()
      const sendLog = (text: string) => {
        event.sender.send('ai:installLog', text)
      }

      const targetDir = path.join(home, '.ezek-editor')
      if (!fs.existsSync(targetDir)) {
        try { fs.mkdirSync(targetDir, { recursive: true }) } catch (e) {}
      }

      const commands = [
        `cd /d "${targetDir}"`,
        `rmdir /s /q kimiproxy 2>nul`,
        `git clone https://github.com/pedrofariasx/kimiproxy.git`,
        `cd kimiproxy`,
        `npm install`,
        `npx playwright install`
      ]
      const commandString = commands[0] + ' & ' + commands[1] + ' & ' + commands.slice(2).join(' && ')

      const env = { ...process.env }
      const pathKey = Object.keys(env).find(k => k.toLowerCase() === 'path') || 'PATH'
      const currentPath = env[pathKey] || ''
      if (process.platform === 'win32' && !currentPath.toLowerCase().includes('git\\cmd')) {
        env[pathKey] = `${currentPath};C:\\Program Files\\Git\\cmd`
      }

      const child = spawn(commandString, { cwd: targetDir, shell: true, env })
      child.stdout.on('data', d => sendLog(d.toString()))
      child.stderr.on('data', d => sendLog(d.toString()))
      child.on('close', code => resolve(code === 0))
      child.on('error', err => {
        sendLog(`Error: ${err.message}`)
        resolve(false)
      })
    })
  })

  ipcMain.handle(IPC_CHANNELS.AI_LIST_GEMINIPROXY_MODELS, async () => {
    try {
      const response = await fetch('http://localhost:3000/v1/models', {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000),
      })
      const data = await response.json()
      const allModels = data.data || []
      
      return allModels.map((m: any) => ({
        id: m.id || m.name || '',
        name: (m.id || '').toUpperCase().replace(/-/g, ' '),
        free: true,
        description: `Local GeminiProxy Model: ${m.id}`,
      }))
    } catch (err: any) {
      if (err?.cause?.code !== 'ECONNREFUSED' && err?.cause?.code !== 'ECONNRESET') console.error('Failed to fetch GeminiProxy models:', err?.message || err)
      return [
        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', free: true, description: 'Local proxy' },
        { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', free: true, description: 'Local proxy' },
        { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', free: true, description: 'Local proxy' },
      ]
    }
  })

  ipcMain.handle(IPC_CHANNELS.AI_CHECK_GEMINIPROXY, async () => {
    try {
      const home = os.homedir()
      const targetDir = path.join(home, '.ezek-editor', 'geminiproxy')
      const packageJsonPath = path.join(targetDir, 'package.json')
      
      const installed = fs.existsSync(packageJsonPath)
      return { installed, path: targetDir }
    } catch {
      return { installed: false, path: '' }
    }
  })

  ipcMain.handle(IPC_CHANNELS.AI_INSTALL_GEMINIPROXY, async (event) => {
    return new Promise((resolve) => {
      const home = os.homedir()
      const sendLog = (text: string) => {
        event.sender.send('ai:installLog', text)
      }

      const targetDir = path.join(home, '.ezek-editor')
      if (!fs.existsSync(targetDir)) {
        try { fs.mkdirSync(targetDir, { recursive: true }) } catch (e) {}
      }

      const commands = [
        `cd /d "${targetDir}"`,
        `rmdir /s /q geminiproxy 2>nul`,
        `git clone https://github.com/scripteros/geminiproxy.git`,
        `cd geminiproxy`,
        `npm install`,
        `npx playwright install`
      ]
      const commandString = commands[0] + ' & ' + commands[1] + ' & ' + commands.slice(2).join(' && ')

      const env = { ...process.env }
      const pathKey = Object.keys(env).find(k => k.toLowerCase() === 'path') || 'PATH'
      const currentPath = env[pathKey] || ''
      if (process.platform === 'win32' && !currentPath.toLowerCase().includes('git\\cmd')) {
        env[pathKey] = `${currentPath};C:\\Program Files\\Git\\cmd`
      }

      const child = spawn(commandString, { cwd: targetDir, shell: true, env })
      child.stdout.on('data', d => sendLog(d.toString()))
      child.stderr.on('data', d => sendLog(d.toString()))
      child.on('close', code => resolve(code === 0))
      child.on('error', err => {
        sendLog(`Error: ${err.message}`)
        resolve(false)
      })
    })
  })

  ipcMain.handle(IPC_CHANNELS.AI_UNINSTALL_PROXY, async (_event, proxyType: 'deepsproxy' | 'kimiproxy' | 'geminiproxy') => {
    try {
      const allowed = new Set(['deepsproxy', 'kimiproxy', 'geminiproxy'])
      if (!allowed.has(proxyType)) return false

      const runningProcess = getProxyProcess(proxyType)
      if (runningProcess) {
        killProxyProcess(runningProcess)
        clearProxyProcess(proxyType)
      }

      try {
        await fetch('http://localhost:3000/shutdown', { method: 'POST', signal: AbortSignal.timeout(1500) }).catch(() => {})
      } catch {}

      const baseDir = path.join(os.homedir(), '.ezek-editor')
      const targetDir = path.resolve(baseDir, proxyType)
      const resolvedBase = path.resolve(baseDir)
      if (!targetDir.startsWith(resolvedBase + path.sep)) return false

      if (fs.existsSync(targetDir)) {
        fs.rmSync(targetDir, { recursive: true, force: true })
      }

      emitProxyStatus(proxyType, 'offline')
      return true
    } catch (err) {
      console.error(`Failed to uninstall ${proxyType}:`, err)
      return false
    }
  })

  // Handler para executar comandos Git através da IA
  ipcMain.handle('ai:executeGitCommand', async (_event, repoPath: string, action: string, params: any = {}) => {
    try {
      switch (action) {
        case 'status':
          return await getGitStatus(repoPath)
        case 'add':
          await gitAdd(repoPath, params.files)
          return { success: true, message: 'Files added successfully' }
        case 'commit':
          await gitCommit(repoPath, params.message)
          return { success: true, message: 'Commit created successfully' }
        case 'push':
          await gitPush(repoPath, params.remote, params.branch)
          return { success: true, message: 'Push successful' }
        case 'pull':
          await gitPull(repoPath, params.remote, params.branch)
          return { success: true, message: 'Pull successful' }
        case 'branch':
          if (params.name) {
            await gitBranch(repoPath, params.name)
            return { success: true, message: `Branch ${params.name} created` }
          } else {
            const branches = await gitBranch(repoPath)
            return { success: true, branches }
          }
        case 'checkout':
          await gitCheckout(repoPath, params.branch)
          return { success: true, message: `Checked out to ${params.branch}` }
        case 'log':
          const log = await gitLog(repoPath, params.maxCount)
          return { success: true, log }
        default:
          throw new Error(`Unknown Git action: ${action}`)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle(IPC_CHANNELS.AI_START_PROXY, async (_event, proxyType: 'deepsproxy' | 'kimiproxy' | 'geminiproxy') => {
    const PROXY_PORT = 3000
    try {
      const homeDir = os.homedir()
      const proxyPath = path.join(homeDir, '.ezek-editor', proxyType)

      // Stop ALL other proxies first (mutual exclusion — all share port 3000)
      if (proxyType !== 'deepsproxy' && deepsProxyProcess) {
        killProxyProcess(deepsProxyProcess)
        deepsProxyProcess = null
        emitProxyStatus('deepsproxy', 'offline')
      }
      if (proxyType !== 'kimiproxy' && kimiProxyProcess) {
        killProxyProcess(kimiProxyProcess)
        kimiProxyProcess = null
        emitProxyStatus('kimiproxy', 'offline')
      }
      if (proxyType !== 'geminiproxy' && geminiProxyProcess) {
        killProxyProcess(geminiProxyProcess)
        geminiProxyProcess = null
        emitProxyStatus('geminiproxy', 'offline')
      }

      // If THIS proxy is already running, return true
      if (proxyType === 'deepsproxy' && deepsProxyProcess) return true
      if (proxyType === 'kimiproxy' && kimiProxyProcess) return true
      if (proxyType === 'geminiproxy' && geminiProxyProcess) return true

      // Force-kill anything on port 3000 before starting (handles orphan processes)
      try {
        await fetch(`http://localhost:${PROXY_PORT}/shutdown`, { method: 'POST', signal: AbortSignal.timeout(2000) }).catch(() => {})
        await new Promise(r => setTimeout(r, 500))
      } catch (e) {}

      // Force-kill by PID on Windows if port is still occupied
      if (process.platform === 'win32') {
        try {
          const { stdout } = await execAsync(`netstat -ano | findstr :${PROXY_PORT} | findstr LISTENING`, { timeout: 5000 })
          const lines = stdout.trim().split('\n')
          for (const line of lines) {
            const pid = line.trim().split(/\s+/).pop()
            if (pid && /^\d+$/.test(pid) && pid !== '0') {
              try { await execAsync(`taskkill /PID ${pid} /F`, { timeout: 5000 }) } catch (e) {}
            }
          }
          await new Promise(r => setTimeout(r, 500))
        } catch (e) { /* no process on port, that's fine */ }
      }

      if (!fs.existsSync(proxyPath)) {
        console.error(`Proxy path does not exist: ${proxyPath}`)
        return false
      }

      const env = { ...process.env, PORT: String(PROXY_PORT) }
      
      const child = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['start'], {
        cwd: proxyPath,
        detached: false,
        shell: process.platform === 'win32',
        env
      })

      child.stdout?.on('data', (data) => {
        const out = data.toString()
        if (out.includes('Server is running on port') || out.includes('listening') || out.includes('started!') || out.includes('started')) {
          emitProxyStatus(proxyType, 'online')
        }
      })

      child.stderr?.on('data', (data) => {
        console.error(`[${proxyType} error]: ${data.toString()}`)
      })

      child.on('close', () => {
        if (proxyType === 'deepsproxy') deepsProxyProcess = null
        else if (proxyType === 'kimiproxy') kimiProxyProcess = null
        else if (proxyType === 'geminiproxy') geminiProxyProcess = null
        emitProxyStatus(proxyType, 'offline')
      })

      if (proxyType === 'deepsproxy') deepsProxyProcess = child
      else if (proxyType === 'kimiproxy') kimiProxyProcess = child
      else if (proxyType === 'geminiproxy') geminiProxyProcess = child

      return true
    } catch (e) {
      console.error('Error starting proxy:', e)
      return false
    }
  })

  ipcMain.handle(IPC_CHANNELS.AI_STOP_PROXY, async (_event, proxyType: 'deepsproxy' | 'kimiproxy' | 'geminiproxy') => {
    const PROXY_PORT = 3000

    // Try graceful shutdown first
    try {
      await fetch(`http://localhost:${PROXY_PORT}/shutdown`, { method: 'POST', signal: AbortSignal.timeout(2000) }).catch(() => {});
    } catch (e) {}

    // Give it a short moment to gracefully close playwright
    await new Promise(r => setTimeout(r, 500));

    if (proxyType === 'deepsproxy' && deepsProxyProcess) {
      killProxyProcess(deepsProxyProcess)
      deepsProxyProcess = null
      emitProxyStatus('deepsproxy', 'offline')
      return true
    } else if (proxyType === 'kimiproxy' && kimiProxyProcess) {
      killProxyProcess(kimiProxyProcess)
      kimiProxyProcess = null
      emitProxyStatus('kimiproxy', 'offline')
      return true
    } else if (proxyType === 'geminiproxy' && geminiProxyProcess) {
      killProxyProcess(geminiProxyProcess)
      geminiProxyProcess = null
      emitProxyStatus('geminiproxy', 'offline')
      return true
    }

    // Fallback: force-kill port 3000 even if we lost the process reference
    if (process.platform === 'win32') {
      try {
        const { stdout } = await execAsync(`netstat -ano | findstr :${PROXY_PORT} | findstr LISTENING`, { timeout: 5000 })
        const lines = stdout.trim().split('\n')
        for (const line of lines) {
          const pid = line.trim().split(/\s+/).pop()
          if (pid && /^\d+$/.test(pid) && pid !== '0') {
            try { await execAsync(`taskkill /PID ${pid} /F`, { timeout: 5000 }) } catch (e) {}
          }
        }
      } catch (e) {}
    }
    emitProxyStatus(proxyType, 'offline')
    return true
  })
}
