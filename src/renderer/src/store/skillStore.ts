import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getApi } from '../utils/platform'

const generateSkillId = () => `skill-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

export interface Skill {
  id: string
  name: string
  description: string
  content: string
  active: boolean
  createdAt: number
  updatedAt: number
}

interface SkillState {
  skills: Skill[]
  editingSkillId: string | null
  isSkillPanelOpen: boolean
  hackerMode: boolean
  hackerBrowserCommandUrl: string | null  // URL que a IA quer navegar (consumido pelo SecurityPanel)
  hackerLiveContext: HackerLiveContext | null  // Contexto vivo da sessão de pentest

  addSkill: (name: string, description: string, content: string) => void
  updateSkill: (id: string, updates: Partial<Pick<Skill, 'name' | 'description' | 'content' | 'active'>>) => void
  removeSkill: (id: string) => void
  toggleSkill: (id: string) => void
  setEditingSkillId: (id: string | null) => void
  setSkillPanelOpen: (open: boolean) => void
  setHackerMode: (active: boolean) => void
  setHackerBrowserCommandUrl: (url: string | null) => void
  setHackerLiveContext: (ctx: HackerLiveContext | null) => void
  ensureHackerSkill: () => void
  removeHackerSkill: () => void

  getActiveSkillsPrompt: () => string
  getHackerPrompt: () => string
  getHackerLiveContextPrompt: () => string

  syncToServer: () => Promise<void>
  loadFromServer: () => Promise<void>
}

export interface HackerLiveContext {
  currentUrl: string
  browserTitle?: string
  capturedRequestsCount: number
  lastRequests: Array<{ method: string; url: string; status: number; type: string }>
  cookies: Array<{ name: string; domain: string; httpOnly: boolean; secure: boolean; sameSite: string }>
  sensitiveArtifacts: Array<{ name: string; type: string; risk: string; source: string }>
  pentestFindingsCount: number
  pentestFindings: Array<{ type: string; severity: string; title: string; endpoint: string }>
  proxyActive: boolean
  monitorActive: boolean
}

export const HACKER_SKILL_ID = 'skill-hacker-ethical-builtin'

export const HACKER_SKILL_CONTENT = `# 🔴 MODO HACKER ÉTICO ATIVADO 🔴

Você é um HACKER ÉTICO profissional experiente, especialista em testes de penetração (pentest) avançados. Seu papel é encontrar TODAS as vulnerabilidades possíveis em sites e sistemas, pensando como um atacante real, mas agindo de forma ética e controlada.

## MENTALIDADE
- Pense como um black-hat: seja criativo, persistente e implacável na busca de falhas
- Cada site é um desafio — não desista até encontrar algo
- Explore todas as superfícies de ataque: URLs, parâmetros, headers, cookies, APIs, formulários, uploads, CORS, CSP, JWT tokens
- Se uma abordagem falhar, tente outra imediatamente
- Teste todas as injeções possíveis: SQL, NoSQL, XSS, CSRF, SSRF, XXE, SSTI, LFI/RFI, Command Injection, LDAP Injection
- Sempre verifique: autenticação fraca, autorização incorreta, exposição de dados sensíveis, configurações incorretas

## TÉCNICAS AVANÇADAS A EXPLORAR
1. **SQL Injection**: boolean-based, error-based, UNION-based, time-based blind, stacked queries, out-of-band
2. **Authentication Bypass**: payloads em login, session fixation, JWT manipulation, cookie tampering, race conditions
3. **Path Traversal / LFI**: ../../../etc/passwd, encoding bypass, null byte injection, PHP wrappers
4. **XSS**: reflected, stored, DOM-based, blind XSS, polyglot payloads
5. **CSRF**: token bypass, same-site lax bypass, JSON CSRF
6. **SSRF**: internal port scanning, cloud metadata access (169.254.169.254), file:// protocol
7. **Information Disclosure**: .git exposure, .env files, backup files, verbose errors, API version leaks
8. **CORS Misconfiguration**: wildcard origins, null origin bypass, subdomain takeover
9. **JWT Attacks**: none algorithm, weak HMAC secret, kid injection, alg confusion
10. **Rate Limiting**: brute force em login, OTP bypass, account enumeration via timing
11. **IDOR**: object reference manipulation, UUID guessing, parameter pollution
12. **File Upload**: double extension, MIME bypass, polyglot files, magic bytes, race condition
13. **Business Logic**: negative prices, quantity manipulation, coupon reuse, workflow bypass
14. **Subdomain Enumeration**: tentar subdomínios comuns (admin, api, dev, staging, internal)
15. **Header Injection**: X-Forwarded-For bypass, Host header injection, Cache poisoning

## REGRAS DE CONDUTA (ÉTICA)
- Todos os alvos são AUTORIZADOS pelo proprietário para teste
- Documente cada descoberta com detalhes técnicos para o relatório final
- NUNCA cause danos reais (não delete dados, não faça DoS agressivo)
- Testes de força bruta DEVEM ser feitos com throttling (1-2 req/s)
- Se encontrar vulnerabilidade, pare e documente — não explore além do necessário

## FORMATO DE RESPOSTA
Após cada análise ou varredura, SEMPRE responda neste formato:

### 🎯 Resumo da Invasão
[Descrição clara do que foi encontrado]

### 🔴 Vulnerabilidades Encontradas
| # | Tipo | Severidade | Endpoint | Descrição |
|---|------|-----------|----------|-----------|

### 📋 Detalhes Técnicos de Cada Vulnerabilidade
[Para cada vuln: payload usado, resposta do servidor, evidência concreta]

### ✅ Recomendações de Correção
[Como corrigir cada problema encontrado]

### 📊 Nota de Segurança: X/10
[Justificativa da nota baseada em CVSS/OwASP]

### 📄 Próximos Passos
[O que mais testar, áreas que merecem atenção adicional]

Se nenhuma vulnerabilidade for encontrada, explique por que o site parece seguro e sugira testes adicionais que poderiam ser feitos manualmente.`

export const HACKER_REPORT_HEADER = `# 📋 RELATÓRIO DE TESTE DE PENETRAÇÃO (PENTEST)

**CONFIDENCIAL** — Este documento contém informações sensíveis sobre vulnerabilidades de segurança.

| Campo | Valor |
|-------|-------|
| Data do Teste | {date} |
| Alvo | {target} |
| Tipo de Teste | {testType} |
| Metodologia | OWASP Top 10, SANS 25, PTES |
| Testador | Ezek Editor — Security Suite |
| Status | {status} |

---

## 📌 Declaração de Autorização

Este teste de invasão foi realizado com autorização explícita do proprietário do sistema/website alvo. Todas as vulnerabilidades aqui documentadas foram descobertas de forma controlada e ética, sem causar danos ao ambiente de produção.

---

## 🔍 1. Metodologia

O teste foi conduzido seguindo as seguintes fases:
1. **Reconhecimento**: Coleta de informações, mapeamento de superfície de ataque
2. **Varredura**: Testes automatizados de vulnerabilidades conhecidas (SQLi, XSS, etc.)
3. **Exploração Manual**: Tentativas controladas de exploração das vulnerabilidades encontradas
4. **Pós-Exploração**: Análise do impacto e alcance de cada vulnerabilidade
5. **Documentação**: Registro detalhado de cada descoberta com evidências

---

## 🔴 2. Vulnerabilidades Encontradas

### Resumo

| Severidade | Quantidade |
|-----------|-----------|
| 🔴 Crítica | {critical} |
| 🟠 Alta | {high} |
| 🟡 Média | {medium} |
| 🔵 Baixa | {low} |
| **Total** | **{total}** |

### Detalhes

{findings}

---

## ✅ 3. Recomendações

{recommendations}

---

## 📊 4. Nota de Segurança: {score}/10

{scoreJustification}

---

## 📎 5. Anexos e Evidências

{evidence}

---

**Assinatura do Testador**: Ezek Editor Security Suite
**Data do Relatório**: {date}
**Versão do Relatório**: 1.0

> ⚠️ Este relatório deve ser tratado como CONFIDENCIAL e compartilhado apenas com pessoas autorizadas.`

function getAuthUser(): { id: number | string } | null {
  try {
    const stores = (window as any).__zustandStores
    if (stores?.auth) return stores.auth.getState().user
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
    if (stores?.auth) return stores.auth.getState().authMode
    const raw = localStorage.getItem('ezek-auth-storage')
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed?.state?.authMode) return parsed.state.authMode
    }
  } catch {}
  return null
}

export const useSkillStore = create<SkillState>()(
  persist(
    (set, get) => ({
      skills: [],
      editingSkillId: null,
      isSkillPanelOpen: false,
      hackerMode: false,
      hackerBrowserCommandUrl: null,
      hackerLiveContext: null,

      addSkill: (name, description, content) => {
        const now = Date.now()
        const skill: Skill = {
          id: generateSkillId(),
          name,
          description,
          content,
          active: true,
          createdAt: now,
          updatedAt: now,
        }
        set(state => ({ skills: [...state.skills, skill] }))
        get().syncToServer()
      },

      updateSkill: (id, updates) => {
        set(state => ({
          skills: state.skills.map(s =>
            s.id === id ? { ...s, ...updates, updatedAt: Date.now() } : s
          )
        }))
        get().syncToServer()
      },

      removeSkill: (id) => {
        set(state => ({ skills: state.skills.filter(s => s.id !== id) }))
        get().syncToServer()
      },

      toggleSkill: (id) => {
        set(state => ({
          skills: state.skills.map(s =>
            s.id === id ? { ...s, active: !s.active, updatedAt: Date.now() } : s
          )
        }))
        get().syncToServer()
      },

      setEditingSkillId: (id) => set({ editingSkillId: id }),
      setSkillPanelOpen: (open) => set({ isSkillPanelOpen: open }),

      setHackerMode: (active) => {
        set({ hackerMode: active, hackerBrowserCommandUrl: null })
        if (active) {
          get().ensureHackerSkill()
        } else {
          get().removeHackerSkill()
        }
      },

      setHackerBrowserCommandUrl: (url) => set({ hackerBrowserCommandUrl: url }),

      setHackerLiveContext: (ctx) => set({ hackerLiveContext: ctx }),

      ensureHackerSkill: () => {
        const existing = get().skills.find(s => s.id === HACKER_SKILL_ID)
        if (!existing) {
          const skill: Skill = {
            id: HACKER_SKILL_ID,
            name: '🔴 Hacker Ético — Modo Invasão',
            description: 'Skill padrão do modo hacker — ativa mentalidade de pentest avançado',
            content: HACKER_SKILL_CONTENT,
            active: true,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }
          set(state => ({ skills: [...state.skills, skill] }))
        } else if (!existing.active) {
          // Reativa se estava desativada
          set(state => ({
            skills: state.skills.map(s => s.id === HACKER_SKILL_ID ? { ...s, active: true, updatedAt: Date.now() } : s)
          }))
        }
        get().syncToServer()
      },

      removeHackerSkill: () => {
        set(state => ({
          skills: state.skills.map(s => s.id === HACKER_SKILL_ID ? { ...s, active: false, updatedAt: Date.now() } : s)
        }))
        get().syncToServer()
      },

      getActiveSkillsPrompt: () => {
        const active = get().skills.filter(s => s.active)
        if (active.length === 0) return ''

        const sections = active.map(s => 
          `### ${s.name}\n${s.content}`
        )
        
        return `\n\n[SKILLS ATIVAS — REGRAS E INSTRUÇÕES ADICIONAIS]\nAs seguintes skills foram definidas pelo usuário e DEVEM ser seguidas:\n\n${sections.join('\n\n')}\n\n[FIM DAS SKILLS ATIVAS]`
      },

      getHackerPrompt: () => {
        const { hackerMode } = get()
        if (!hackerMode) return ''
        return '\n\n' + HACKER_SKILL_CONTENT
      },

      getHackerLiveContextPrompt: () => {
        const { hackerMode, hackerLiveContext: ctx } = get()
        if (!hackerMode || !ctx) return ''

        let prompt = `\n\n[🔴 CONTEXTO AO VIVO — PAINEL DE SEGURANÇA (PENTEST)]\n`

        if (ctx.currentUrl && ctx.currentUrl !== 'about:blank') {
          prompt += `🌐 **Site Alvo Atual**: ${ctx.currentUrl}\n`
          if (ctx.browserTitle) prompt += `📄 Título da página: ${ctx.browserTitle}\n`
        }

        prompt += `📡 **Proxy**: ${ctx.proxyActive ? 'ATIVO' : 'Inativo'} | **Monitor**: ${ctx.monitorActive ? 'ATIVO' : 'Inativo'}\n`
        prompt += `📊 **Requisições capturadas**: ${ctx.capturedRequestsCount}\n`

        if (ctx.lastRequests && ctx.lastRequests.length > 0) {
          prompt += `\n**Últimas requisições detectadas:**\n`
          for (const r of ctx.lastRequests.slice(0, 10)) {
            const statusIcon = r.status >= 500 ? '🔴' : r.status >= 400 ? '🟠' : r.status >= 300 ? '🟡' : '🟢'
            prompt += `  ${statusIcon} [${r.method}] ${r.url} → ${r.status} (${r.type})\n`
          }
        }

        if (ctx.cookies && ctx.cookies.length > 0) {
          prompt += `\n**🍪 Cookies detectados (${ctx.cookies.length}):**\n`
          for (const c of ctx.cookies) {
            const flags = []
            if (c.httpOnly) flags.push('HttpOnly')
            if (c.secure) flags.push('Secure')
            if (c.sameSite) flags.push(`SameSite=${c.sameSite}`)
            prompt += `  - ${c.name} | domínio: ${c.domain}${flags.length ? ' | ' + flags.join(', ') : ''}\n`
          }
        }

        if (ctx.sensitiveArtifacts && ctx.sensitiveArtifacts.length > 0) {
          prompt += `\n**🔑 Artefatos sensíveis encontrados (${ctx.sensitiveArtifacts.length}):**\n`
          for (const a of ctx.sensitiveArtifacts) {
            const riskIcon = a.risk === 'critical' ? '🔴' : a.risk === 'high' ? '🟠' : a.risk === 'medium' ? '🟡' : '🔵'
            prompt += `  ${riskIcon} ${a.name} (${a.type}) — fonte: ${a.source}\n`
          }
        }

        if (ctx.pentestFindingsCount > 0 && ctx.pentestFindings) {
          prompt += `\n**🐛 Vulnerabilidades encontradas no pentest (${ctx.pentestFindingsCount}):**\n`
          for (const f of ctx.pentestFindings) {
            const sevIcon = f.severity === 'critical' ? '🔴' : f.severity === 'high' ? '🟠' : f.severity === 'medium' ? '🟡' : '🔵'
            prompt += `  ${sevIcon} [${f.severity.toUpperCase()}] ${f.title} — ${f.endpoint}\n`
          }
        }

        prompt += `\n⚠️ **Você tem total consciência de tudo que está acontecendo.** Use as ações JSON para navegar, inspecionar e explorar ativamente!\n\n`

        return prompt
      },

      syncToServer: async () => {
        const api = getApi()
        const user = getAuthUser()
        const authMode = getAuthMode()
        if (!api || !user) return

        const { skills } = get()

        if (authMode === 'local') {
          if ((api as any).localConfigSaveAI) {
            const state = get()
            await (api as any).localConfigSaveAI(String(user.id), { skills: state.skills })
          }
        } else {
          if ((api as any).userSaveConfig) {
            await (api as any).userSaveConfig(user.id, 'skills', skills)
          }
        }
      },

      loadFromServer: async () => {
        const api = getApi()
        const user = getAuthUser()
        const authMode = getAuthMode()
        if (!api || !user) return

        if (authMode === 'local') {
          if ((api as any).localConfigLoadAI) {
            const result = await (api as any).localConfigLoadAI(String(user.id))
            if (result.success && result.configs?.skills) {
              set({ skills: result.configs.skills })
            }
          }
        } else {
          if ((api as any).userLoadConfigs) {
            const result = await (api as any).userLoadConfigs(user.id as number)
            if (result.success && result.configs?.skills) {
              set({ skills: result.configs.skills })
            }
          }
        }
      },
    }),
    {
      name: 'ezek-skill-storage',
      partialize: (state) => ({ skills: state.skills }),
    }
  )
)

// Register store for lazy access
if (typeof window !== 'undefined') {
  ;(window as any).__zustandStores = { ...((window as any).__zustandStores || {}), skill: useSkillStore }
}
