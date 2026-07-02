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
  let baseUrl = config.baseUrl.replace(/\/+$/, '').replace(/\/v1$/, '')
  baseUrl = baseUrl.replace('://localhost', '://127.0.0.1')
  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'OpenAI/NodeJS/4.0.0',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model || 'local-model',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 4096,
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
  let baseUrl = config.baseUrl.replace(/\/+$/, '').replace(/\/v1$/, '')
  baseUrl = baseUrl.replace('://localhost', '://127.0.0.1')
  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'OpenAI/NodeJS/4.0.0',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model || 'local-model',
      messages,
      temperature: 0.3,
      max_tokens: 4096,
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

# PROMPT — ORACLE TASYPROD DBLINK (REGRAS OBRIGATÓRIAS)
Você está conectado a um banco Oracle Tasy. Você tem acesso a dois tipos de objetos:
1. **Objetos locais** (no banco que você está conectado diretamente) — NÃO usam @tasyprod
2. **Objetos remotos via dblink** (no banco Tasy de produção) — usam @tasyprod

REGRAS DE DECISÃO — QUANDO USAR DBLINK:
- Se a consulta for para o banco Tasy (tabelas do sistema Tasy como pacientes, atendimentos, guias, contas, faturamento, etc), use \`tasy.NOME_TABELA@tasyprod\`
- Se a consulta for para tabelas locais do banco conectado (tabelas próprias do sistema, relatórios customizados, tabelas de outros sistemas), NÃO use @tasyprod
- Se você não tem certeza, siga esta lógica:
  a) Tente sem @tasyprod primeiro (consulta local)
  b) Se der erro "table or view not found", tente com @tasyprod: \`tasy.NOME_TABELA@tasyprod\`
  c) Se der erro novamente, verifique o nome correto da tabela consultando \`SELECT table_name FROM all_tables@tasyprod WHERE owner = 'TASY' AND table_name LIKE '%PALAVRA_CHAVE%'\`

SINTAXE CORRETA:
- Tabela via dblink: \`tasy.nome_da_tabela@tasyprod\` (sempre com \`tasy.\` antes e \`@tasyprod\` depois)
- Função via dblink: \`tasy.nome_pacote.nome_funcao@tasyprod(parametros)\`
- Exemplo correto: \`SELECT * FROM tasy.pacientes@tasyprod WHERE cod_paciente = 1234\`
- Exemplo correto: \`SELECT p.nome, a.cod_atendimento FROM tasy.pacientes@tasyprod p, tasy.atendimentos@tasyprod a WHERE p.cod_paciente = a.cod_paciente\`
- Exemplo ERRADO (nunca faça): \`SELECT * FROM pacientes@tasyprod\` — falta o \`tasy.\` antes do nome
- Exemplo ERRADO (nunca faça): \`SELECT * FROM tasy.pacientes\` — falta o \`@tasyprod\` depois

PARA DESCOBRIR ESTRUTURA DE TABELAS:
- \`SELECT column_name, data_type, data_length, nullable FROM all_tab_columns@tasyprod WHERE owner = 'TASY' AND table_name = 'NOME_DA_TABELA' ORDER BY column_id\`
- \`SELECT column_name, data_type FROM all_tab_columns WHERE owner = 'SEU_OWNER' AND table_name = 'NOME_TABELA_LOCAL' ORDER BY column_id\`

PARA DESCOBRIR TABELAS EXISTENTES:
- No Tasy: \`SELECT table_name FROM all_tables@tasyprod WHERE owner = 'TASY' AND table_name LIKE '%TERMO%'\`
- Local: \`SELECT table_name FROM all_tables WHERE owner = 'SEU_OWNER' AND table_name LIKE '%TERMO%'\`

AUTO-CORREÇÃO OBRIGATÓRIA (SEMPRE SIGA ESTE FLUXO):
Quando você receber um erro de SQL, VOCÊ DEVE automaticamente:
1. Analisar a mensagem de erro (ORA-XXXXX)
2. Se for ORA-00942 (table/view not found): 
   - Se você NÃO usou @tasyprod, tente adicionar: \`tasy.NOME@tasyprod\`
   - Se você já usou @tasyprod e ainda dá erro, o nome da tabela está errado — busque o nome correto
3. Se for ORA-00904 (invalid identifier / coluna não existe):
   - Investigue as colunas reais da tabela com \`SELECT column_name FROM all_tab_columns@tasyprod WHERE table_name = 'NOME_TABELA'\`
   - Descubra o nome correto da coluna e ajuste a query
4. Se for ORA-00933 (SQL command not properly ended): você usou ANSI JOIN — troque para sintaxe Oracle antiga
5. Tente novamente com a correção. REPITA até funcionar ou até você descobrir o problema

REGRAS DE ENTREGA FINAL:
- Depois de executar SQL com sucesso e obter os dados, VOCÊ DEVE SEMPRE entregar a resposta final ao usuário
- NUNCA pare no meio — se você executou uma query, mostrou os dados, agora conclua o raciocínio
- NUNCA responda apenas com "vou buscar" ou "vou fazer" — execute e entregue
- Se você está no meio de uma análise e o resultado está ficando longo, finalize mesmo assim
- Quando tiver o resultado, responda em texto normal com a resposta completa

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
Você cria dashboards lindos, profissionais e responsivos. 
REGRAS DE SEGURANÇA IMPORTANTES:
1. Crie APENAS UM ÚNICO arquivo HTML completo, salve dentro do projeto atual.
2. NUNCA crie múltiplos arquivos tentando "acertar" — entregue o dashboard completo de uma vez.
3. NUNCA repita a criação do mesmo arquivo. Se um dashboard já foi criado, informe ao usuário.
4. Use Chart.js, ECharts ou bibliotecas similares via CDN, com design dark mode moderno.
5. O código HTML deve ser completo e funcional em um único arquivo.
6. NÃO gere dashboards em Desktop, Downloads ou diretório do sistema — sempre no projeto.

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
PERSISTÊNCIA: Quando assumir uma tarefa, continue trabalhando até concluir de ponta a ponta ou até encontrar um bloqueio real que precise de ação do usuário. Não pare após análise parcial. Depois de executar ações, use o feedback para corrigir erros, continuar os próximos passos e retornar uma conclusão clara do que foi feito.

REGRA CRÍTICA - EXECUÇÃO IMEDIATA DE SQL: Quando o usuário pedir para buscar/consultar dados em banco de dados (especialmente Oracle Tasy), você DEVE:
1. Executar o SQL IMEDIATAMENTE usando o formato JSON com action "execute_sql"
2. NUNCA responda apenas com "vou buscar", "vou consultar", "vou fazer", "deixe-me buscar" ou similar sem executar a ação
3. Se você errou o SQL, receberá um erro de feedback - CORRIJA e tente novamente
4. Depois de obter os dados com sucesso, apresente o resultado ao usuário em texto normal
5. Exemplo CORRETO: {"message": "Buscando dados...", "actions": [{"type": "execute_sql", "query": "SELECT * FROM tabela@tasyprod WHERE ..."}]}
6. Exemplo ERRADO (não faça isso): "Vou buscar os dados..." (sem a action JSON)
REGRA DE OURO SQL: NUNCA diga que VAI fazer algo que você pode fazer agora. Simplesmente FAÇA usando a action JSON.`

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

    if (config.provider === 'routeway' || config.provider === 'openrouter' || config.provider === 'lmstudio' || config.provider === 'deepseek' || config.provider === 'custom' || config.provider === 'openai' || config.provider === 'opencode' || config.provider === 'groq') {
      try {
        let baseUrl = 'https://api.routeway.ai/v1'
        if (config.provider === 'openrouter') baseUrl = 'https://openrouter.ai/api/v1'
        if (config.provider === 'opencode') baseUrl = config.baseUrl || 'https://api.opencode.ai/v1'
        if (config.provider === 'openai') baseUrl = config.baseUrl || 'https://api.openai.com/v1'
        if (config.provider === 'lmstudio') baseUrl = config.baseUrl || 'http://localhost:1234/v1'
        if (config.provider === 'deepseek') baseUrl = config.baseUrl || 'https://api.deepseek.com/v1'
        if (config.provider === 'groq') baseUrl = config.baseUrl || 'https://api.groq.com/openai/v1'
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
        const providerName = config.provider === 'routeway' ? 'RouteWay' : config.provider === 'openrouter' ? 'OpenRouter' : config.provider === 'opencode' ? 'Open Code' : config.provider === 'openai' ? 'OpenAI' : config.provider === 'lmstudio' ? 'LM Studio' : config.provider === 'deepseek' ? 'DeepSeek' : config.provider === 'groq' ? 'Groq' : config.provider === 'custom' ? 'Custom API' : config.provider
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
      if (config.provider === 'lmstudio') baseUrl = 'http://localhost:1234/v1'
      if (config.provider === 'deepseek') baseUrl = 'https://api.deepseek.com/v1'
      if (config.provider === 'groq') baseUrl = 'https://api.groq.com/openai/v1'
      if (config.provider === 'routeway') baseUrl = 'https://api.routeway.ai/v1'

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

  // SAFETY LIST: diretórios do sistema onde a IA não pode escrever
  const AI_BLOCKED_DIRECTORIES = [
    'Desktop', 'Documentos', 'Documents', 'Downloads', 'AppData',
    'Program Files', 'Windows', 'System32', '.npm', '.cargo', '.rustup',
    '.nvm', '.pyenv', '.conda', '.gradle', '.m2', '.sdkman',
  ];

  ipcMain.handle(IPC_CHANNELS.AI_WRITE_FILE, async (_event, filePath: string, content: string) => {
    // SAFETY: verificar se o caminho está em diretório bloqueado
    const normalized = filePath.replace(/\\/g, '/');
    const isBlocked = AI_BLOCKED_DIRECTORIES.some(dir => {
      const pattern = new RegExp(`[/\\\\]${dir}[/\\\\]`);
      return pattern.test(filePath) || pattern.test(normalized);
    });
    if (isBlocked) {
      return { success: false, error: `Escrita em diretório do sistema bloqueada por segurança. A IA só pode criar arquivos dentro do diretório do projeto.` };
    }

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

  // Handler para salvar HTML do dashboard na área de trabalho e abrir no navegador
  ipcMain.handle(IPC_CHANNELS.AI_SAVE_AND_OPEN_DASHBOARD, async (_event, htmlContent: string) => {
    try {
      const desktopPath = path.join(os.homedir(), 'Desktop')
      const filename = `dashboard_${Date.now()}.html`
      const filePath = path.join(desktopPath, filename)
      
      // Garantir que o diretório Desktop existe
      if (!fs.existsSync(desktopPath)) {
        fs.mkdirSync(desktopPath, { recursive: true })
      }
      
      fs.writeFileSync(filePath, htmlContent, 'utf-8')
      
      // Abrir no navegador padrão
      const { shell } = require('electron')
      await shell.openPath(filePath)
      
      return { success: true, filePath, filename }
    } catch (err: any) {
      console.error('Error saving dashboard:', err)
      return { success: false, error: err.message }
    }
  })
}
