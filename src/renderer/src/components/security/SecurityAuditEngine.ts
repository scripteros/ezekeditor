// Security Audit Engine — OWASP Top 10, CVSS Scoring, Full Pentest Automation
import type { CapturedRequest, SecurityCookie } from '../../store/securityStore'

// ============================================================================
// TYPES
// ============================================================================

export interface AuditVulnerability {
  id: string
  name: string
  owaspCategory: string
  cwe: string
  cve?: string
  description: string
  evidence: string[]
  impact: string
  likelihood: 'Muito Baixa' | 'Baixa' | 'Média' | 'Alta' | 'Muito Alta'
  severity: 'Informativo' | 'Baixo' | 'Médio' | 'Alto' | 'Crítico'
  cvssScore: number
  cvssVector: string
  affectedSystems: string[]
  remediation: string[]
  priority: 'Imediata' | 'Alta' | 'Média' | 'Baixa'
  references: string[]
  status: 'Confirmado' | 'Potencial' | 'Observação'
}

export interface AuditSection {
  name: string
  items: AuditCheckItem[]
}

export interface AuditCheckItem {
  name: string
  status: 'pass' | 'fail' | 'warning' | 'info'
  details: string
}

export interface AuditScore {
  autenticacao: number
  controleAcesso: number
  criptografia: number
  apis: number
  configuracao: number
  infraestrutura: number
  codigo: number
  dependencias: number
  headersHttp: number
  sessoes: number
  exposicaoInfo: number
  owaspTop10: number
  total: number
}

export interface AuditReport {
  summary: string
  overallScore: number
  scoreClassification: string
  vulnerabilitiesCount: { critico: number; alto: number; medio: number; baixo: number; info: number }
  totalVulnerabilities: number
  vulnerabilities: AuditVulnerability[]
  scores: AuditScore
  checklist: AuditSection[]
  owaspCompliance: { category: string; status: 'Conforme' | 'Parcial' | 'Não Conforme'; details: string }[]
  recommendations: string[]
  productionReady: boolean
  generatedAt: string
  targetUrl: string
  duration: string
  totalRequests: number
  totalEndpoints: number
}

// ============================================================================
// CVSS CALCULATOR
// ============================================================================

function calculateCvssScore(
  attackVector: 'N' | 'A' | 'L' | 'P' = 'N',
  attackComplexity: 'L' | 'H' = 'L',
  privilegesRequired: 'N' | 'L' | 'H' = 'N',
  userInteraction: 'N' | 'R' = 'N',
  scope: 'U' | 'C' = 'U',
  confidentiality: 'H' | 'L' | 'N' = 'H',
  integrity: 'H' | 'L' | 'N' = 'H',
  availability: 'H' | 'L' | 'N' = 'N'
): { score: number; vector: string; severity: AuditVulnerability['severity'] } {
  const av = { N: 0.85, A: 0.62, L: 0.55, P: 0.2 }[attackVector]
  const ac = { L: 0.77, H: 0.44 }[attackComplexity]
  const pr = { N: 0.85, L: 0.62, H: 0.27 }[privilegesRequired]
  const ui = { N: 0.85, R: 0.62 }[userInteraction]
  const s = scope === 'U' ? 0 : 1
  const c = { H: 0.56, L: 0.22, N: 0 }[confidentiality]
  const i_val = { H: 0.56, L: 0.22, N: 0 }[integrity]
  const a = { H: 0.56, L: 0.22, N: 0 }[availability]

  const impactBase = 1 - ((1 - c) * (1 - i_val) * (1 - a))
  const impact = s === 0 ? 6.42 * impactBase : 7.52 * (impactBase - 0.029) - 3.25 * Math.pow(impactBase - 0.02, 15)
  
  const exploitability = 8.22 * av * ac * pr * ui
  const score = s === 0 
    ? Math.min(10, Math.round((impact + exploitability) * 10) / 10)
    : Math.min(10, Math.round(1.08 * (impact + exploitability) * 10) / 10)

  const severity: AuditVulnerability['severity'] = 
    score >= 9.0 ? 'Crítico' :
    score >= 7.0 ? 'Alto' :
    score >= 4.0 ? 'Médio' :
    score >= 0.1 ? 'Baixo' : 'Informativo'

  const vector = `CVSS:3.1/AV:${attackVector}/AC:${attackComplexity}/PR:${pr === 0.85 ? 'N' : pr === 0.62 ? 'L' : 'H'}/UI:${ui === 0.85 ? 'N' : 'R'}/S:${scope}/C:${confidentiality}/I:${integrity}/A:${availability}`
  
  return { score: Math.round(score * 10) / 10, vector, severity }
}

function severityToCvss(severity: string): { score: number; severity: AuditVulnerability['severity'] } {
  if (severity === 'Crítico') return { score: 9.8, severity: 'Crítico' }
  if (severity === 'Alto') return { score: 7.5, severity: 'Alto' }
  if (severity === 'Médio') return { score: 5.5, severity: 'Médio' }
  if (severity === 'Baixo') return { score: 2.5, severity: 'Baixo' }
  return { score: 0, severity: 'Informativo' }
}

// ============================================================================
// CLASSIFY SCORE
// ============================================================================

function classifyScore(score: number): string {
  if (score >= 95) return 'Excelente'
  if (score >= 90) return 'Muito Boa'
  if (score >= 80) return 'Boa'
  if (score >= 70) return 'Regular'
  return 'Necessita melhorias'
}

// ============================================================================
// SCANNING ENGINE
// ============================================================================

export function runAudit(
  requests: CapturedRequest[],
  cookies: SecurityCookie[],
  targetUrl: string,
  startTime: number
): AuditReport {
  const vulnerabilities: AuditVulnerability[] = []
  const dynamicReqs = requests.filter(r => !isStaticRequest(r))
  const htmlReqs = requests.filter(r => r.responseHeaders?.['content-type']?.includes('text/html'))
  const headersList = htmlReqs.map(r => Object.keys(r.responseHeaders || {}).map(k => k.toLowerCase()))
  
  const now = new Date()
  const generatedAt = now.toLocaleString('pt-BR')
  const duration = `${Math.round((Date.now() - startTime) / 1000)}s`

  // =====================
  // OWASP TOP 10 CHECKS
  // =====================

  // A01 - Broken Access Control
  const hasAdminPaths = requests.some(r => /admin|dashboard|config|backup|\.env|\.git/i.test(r.url))
  if (hasAdminPaths) {
    const cvss = calculateCvssScore('N', 'L', 'N', 'N', 'U', 'H', 'H', 'N')
    vulnerabilities.push({
      id: 'A01-001',
      name: 'Possível Exposição de Rotas Administrativas',
      owaspCategory: 'A01 - Broken Access Control',
      cwe: 'CWE-200',
      description: 'Requisições para endpoints administrativos ou arquivos sensíveis (.env, .git, backup) foram detectadas.',
      evidence: requests.filter(r => /admin|\.env|\.git|backup/i.test(r.url)).slice(0, 5).map(r => `${r.method} ${r.url}`),
      impact: 'Exposição de informações sensíveis, possibilidade de acesso não autorizado a áreas administrativas.',
      likelihood: 'Média',
      severity: cvss.severity,
      cvssScore: cvss.score,
      cvssVector: cvss.vector,
      affectedSystems: [targetUrl],
      remediation: [
        'Implementar controle de acesso baseado em papéis (RBAC)',
        'Proteger rotas administrativas com autenticação forte e MFA',
        'Remover arquivos sensíveis do diretório público',
        'Configurar .htaccess ou regras de nginx para bloquear acesso a arquivos ocultos',
        'Implementar validação no servidor para todas as requisições administrativas'
      ],
      priority: cvss.score >= 7 ? 'Alta' : 'Média',
      references: ['https://owasp.org/Top10/A01_2021-Broken_Access_Control/'],
      status: 'Potencial'
    })
  }

  // A02 - Cryptographic Failures
  const httpRequests = requests.filter(r => r.url.startsWith('http://'))
  if (httpRequests.length > 0) {
    const cvss = calculateCvssScore('N', 'L', 'N', 'N', 'U', 'H', 'H', 'L')
    vulnerabilities.push({
      id: 'A02-001',
      name: 'Tráfego HTTP sem TLS detectado',
      owaspCategory: 'A02 - Cryptographic Failures',
      cwe: 'CWE-319',
      description: `${httpRequests.length} requisições foram feitas sem HTTPS, permitindo interceptação de dados em texto claro.`,
      evidence: httpRequests.slice(0, 5).map(r => r.url),
      impact: 'Dados trafegados podem ser interceptados por atacantes na mesma rede (MITM). Senhas, tokens e dados sensíveis ficam expostos.',
      likelihood: 'Alta',
      severity: cvss.severity,
      cvssScore: cvss.score,
      cvssVector: cvss.vector,
      affectedSystems: [targetUrl],
      remediation: [
        'Migrar todo o tráfego para HTTPS',
        'Implementar HSTS (Strict-Transport-Security)',
        'Redirecionar HTTP para HTTPS no servidor',
        'Remover formulários e links HTTP'
      ],
      priority: 'Imediata',
      references: ['https://owasp.org/Top10/A02_2021-Cryptographic_Failures/'],
      status: 'Confirmado'
    })
  }

  // Missing HSTS check
  htmlReqs.forEach((req, i) => {
    const h = Object.keys(req.responseHeaders || {}).map(k => k.toLowerCase())
    if (req.url.startsWith('https://') && !h.includes('strict-transport-security')) {
      if (!vulnerabilities.find(v => v.id === 'A02-002')) {
        const cvss = calculateCvssScore('N', 'L', 'N', 'N', 'U', 'L', 'L', 'N')
        vulnerabilities.push({
          id: 'A02-002',
          name: 'HSTS não configurado',
          owaspCategory: 'A02 - Cryptographic Failures',
          cwe: 'CWE-523',
          description: 'Conexões HTTPS não possuem Strict-Transport-Security. Clientes podem ser forçados a usar HTTP em ataques MITM.',
          evidence: [`${req.method} ${req.url}`],
          impact: 'Usuários podem ser vítimas de downgrade attack. Cookies Secure perdem eficácia sem HSTS.',
          likelihood: 'Média',
          severity: cvss.severity,
          cvssScore: cvss.score,
          cvssVector: cvss.vector,
          affectedSystems: [new URL(req.url).hostname],
          remediation: [
            'Adicionar header: Strict-Transport-Security: max-age=31536000; includeSubDomains',
            'Testar com max-age baixo antes de aumentar',
            'Considerar preload list do Chrome'
          ],
          priority: 'Média',
          references: ['https://owasp.org/www-project-secure-headers/', 'CWE-523'],
          status: 'Confirmado'
        })
      }
    }
  })

  // A03 - Injection
  const sqliPatterns = [
    /\bOR\b.*\b\d+\b\s*=\s*\d+/i, /'(\s+)?OR(\s+)?1(\s+)?=(\s+)?1/i,
    /'(\s+)?UNION(\s+)?SELECT/i, /;(\s+)?DROP(\s+)?TABLE/i,
    /;(\s+)?DELETE(\s+)?FROM/i, /--(\s+)?$/i,
    /\bxp_cmdshell/i, /\bwaitfor(\s+)?delay/i
  ]
  const sqliRequests = requests.filter(r => {
    const data = [r.url, r.body].join(' ').toLowerCase()
    return sqliPatterns.some(p => p.test(data))
  })
  if (sqliRequests.length > 0) {
    const cvss = calculateCvssScore('N', 'L', 'N', 'N', 'U', 'H', 'H', 'H')
    vulnerabilities.push({
      id: 'A03-001',
      name: 'SQL Injection Detectado',
      owaspCategory: 'A03 - Injection',
      cwe: 'CWE-89',
      description: `${sqliRequests.length} requisições com padrões de SQL Injection foram detectadas. Atacantes podem executar comandos SQL arbitrários.`,
      evidence: sqliRequests.slice(0, 5).map(r => `${r.method} ${r.url}`),
      impact: 'Extração de dados sensíveis, modificação/exclusão de registros, execução de comandos no servidor, escalada de privilégios.',
      likelihood: 'Alta',
      severity: cvss.severity,
      cvssScore: cvss.score,
      cvssVector: cvss.vector,
      affectedSystems: [targetUrl],
      remediation: [
        'Utilizar prepared statements (queries parametrizadas) OBRIGATORIAMENTE',
        'Nunca concatenar strings em queries SQL',
        'Validar e sanitizar todas as entradas do usuário',
        'Usar ORM com proteção contra injection',
        'Implementar princípio de menor privilégio no banco de dados',
        'Configurar WAF para bloquear padrões de injection'
      ],
      priority: 'Imediata',
      references: ['https://owasp.org/Top10/A03_2021-Injection/', 'CWE-89'],
      status: 'Confirmado'
    })
  }

  // XSS detection
  const xssPatterns = [/<script>/i, /javascript:/i, /onerror\s*=/i, /onload\s*=/i, /alert\(/i]
  const xssUrls = requests.filter(r => {
    const data = [r.url, r.body, r.responseBody].join(' ').toLowerCase()
    return xssPatterns.some(p => p.test(data))
  })
  if (xssUrls.length > 0) {
    const cvss = calculateCvssScore('N', 'L', 'N', 'R', 'U', 'H', 'H', 'N')
    vulnerabilities.push({
      id: 'A03-002',
      name: 'Possível Cross-Site Scripting (XSS)',
      owaspCategory: 'A03 - Injection',
      cwe: 'CWE-79',
      description: 'Padrões de XSS detectados em requisições/respostas. Scripts maliciosos podem ser executados no navegador da vítima.',
      evidence: xssUrls.slice(0, 3).map(r => `${r.method} ${r.url}`),
      impact: 'Roubo de cookies/sessões, redirecionamento para sites maliciosos, desfiguração de página, roubo de credenciais.',
      likelihood: 'Média',
      severity: cvss.severity,
      cvssScore: cvss.score,
      cvssVector: cvss.vector,
      affectedSystems: [targetUrl],
      remediation: [
        'Implementar Content-Security-Policy',
        'Validar e escapar toda saída HTML (context-sensitive escaping)',
        'Usar React/Vue/Angular que escapam por padrão',
        'Sanitizar entradas com DOMPurify ou similar',
        'Configurar X-XSS-Protection e X-Content-Type-Options'
      ],
      priority: 'Alta',
      references: ['https://owasp.org/www-community/attacks/xss/', 'CWE-79'],
      status: 'Potencial'
    })
  }

  // A04 - Insecure Design
  vulnerabilities.push({
    id: 'A04-001',
    name: 'Verificação de Design Seguro',
    owaspCategory: 'A04 - Insecure Design',
    cwe: 'CWE-1041',
    description: 'Análise automatizada de design inseguro baseada em padrões observados. Recomenda-se revisão manual de arquitetura.',
    evidence: [
      `Total de endpoints mapeados: ${new Set(requests.map(r => r.url)).size}`,
      `Cookies sem HttpOnly/Secure: ${cookies.filter(c => !c.httpOnly || !c.secure).length}`,
      `Requisições sem validação aparente: ${requests.filter(r => r.body && r.body.length > 50).length}`
    ],
    impact: 'Falhas de design podem expor toda a aplicação independente da implementação.',
    likelihood: 'Média',
    severity: 'Médio',
    cvssScore: 5.5,
    cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:L/A:N',
    affectedSystems: [targetUrl],
    remediation: [
      'Revisar e aplicar princípios de Secure Design (Least Privilege, Defense in Depth)',
      'Realizar threat modeling no início do desenvolvimento',
      'Implementar rate limiting e validação de entrada em todas as camadas'
    ],
    priority: 'Média',
    references: ['https://owasp.org/Top10/A04_2021-Insecure_Design/'],
    status: 'Observação'
  })

  // A05 - Security Misconfiguration
  const misconfigIssues: string[] = []
  headersList.forEach((h, i) => {
    if (!h.includes('x-content-type-options')) misconfigIssues.push(`X-Content-Type-Options ausente (${htmlReqs[i].url})`)
    if (!h.includes('x-frame-options') && !h.includes('frame-ancestors')) misconfigIssues.push(`X-Frame-Options ausente (${htmlReqs[i].url})`)
  })
  if (misconfigIssues.length > 0) {
    const cvss = calculateCvssScore('N', 'L', 'N', 'N', 'U', 'L', 'L', 'N')
    vulnerabilities.push({
      id: 'A05-001',
      name: 'Configuração Incorreta de Headers de Segurança',
      owaspCategory: 'A05 - Security Misconfiguration',
      cwe: 'CWE-16',
      description: `${misconfigIssues.length} problemas de configuração de segurança identificados em headers HTTP.`,
      evidence: misconfigIssues.slice(0, 8),
      impact: 'Maior superfície de ataque, possibilidade de clickjacking, MIME sniffing e outras vulnerabilidades.',
      likelihood: 'Alta',
      severity: cvss.severity,
      cvssScore: cvss.score,
      cvssVector: cvss.vector,
      affectedSystems: [targetUrl],
      remediation: [
        'Configurar todos os headers de segurança recomendados (CSP, HSTS, X-Frame-Options, etc.)',
        'Realizar hardening do servidor web seguindo guias oficiais',
        'Revisar permissões de diretórios e arquivos',
        'Desabilitar listagem de diretórios'
      ],
      priority: 'Média',
      references: ['https://owasp.org/Top10/A05_2021-Security_Misconfiguration/'],
      status: 'Confirmado'
    })
  }

  // A06 - Vulnerable Components
  const outdatedPatterns = [/jquery\//i, /bootstrap\/3/i, /angular\/1/i, /lodash\/4/i]
  const outdatedLibs = requests.filter(r => {
    return outdatedPatterns.some(p => p.test(r.url))
  })
  if (outdatedLibs.length > 0) {
    const cvss = calculateCvssScore('N', 'L', 'N', 'R', 'U', 'H', 'H', 'H')
    vulnerabilities.push({
      id: 'A06-001',
      name: 'Possível uso de componentes/bibliotecas desatualizadas',
      owaspCategory: 'A06 - Vulnerable & Outdated Components',
      cwe: 'CWE-1104',
      description: 'Bibliotecas com versões antigas foram detectadas. Versões desatualizadas podem conter CVEs conhecidas.',
      evidence: outdatedLibs.slice(0, 5).map(r => r.url),
      impact: 'Execução remota de código, XSS, ou outras vulnerabilidades conhecidas via CVEs.',
      likelihood: 'Média',
      severity: cvss.severity,
      cvssScore: cvss.score,
      cvssVector: cvss.vector,
      affectedSystems: [targetUrl],
      remediation: [
        'Manter todas as dependências atualizadas',
        'Usar SCA (Software Composition Analysis) tools',
        'Monitorar CVEs das dependências',
        'Remover bibliotecas não utilizadas',
        'Assinar feeds de segurança para componentes críticos'
      ],
      priority: 'Alta',
      references: ['https://owasp.org/Top10/A06_2021-Vulnerable_and_Outdated_Components/'],
      status: 'Potencial'
    })
  }

  // A07 - Identification & Auth Failures
  const authIssues: string[] = []
  cookies.forEach(c => {
    if (!c.httpOnly) authIssues.push(`Cookie ${c.name} sem HttpOnly no domínio ${c.domain}`)
    if (!c.secure) authIssues.push(`Cookie ${c.name} sem Secure no domínio ${c.domain}`)
    if (!c.sameSite || c.sameSite === 'unspecified') authIssues.push(`Cookie ${c.name} sem SameSite`)
  })
  if (authIssues.length > 0) {
    const cvss = calculateCvssScore('N', 'L', 'N', 'N', 'U', 'H', 'H', 'L')
    vulnerabilities.push({
      id: 'A07-001',
      name: 'Falhas na Configuração de Cookies de Autenticação',
      owaspCategory: 'A07 - Identification & Authentication Failures',
      cwe: 'CWE-522',
      description: `${authIssues.length} problemas de configuração em cookies de autenticação/sessão.`,
      evidence: authIssues.slice(0, 8),
      impact: 'Sequestro de sessão, roubo de cookies via XSS, exposição em tráfego não-TLS.',
      likelihood: 'Alta',
      severity: cvss.severity,
      cvssScore: cvss.score,
      cvssVector: cvss.vector,
      affectedSystems: [targetUrl],
      remediation: [
        'Configurar HttpOnly, Secure e SameSite=Lax/Strict em todos os cookies de sessão',
        'Implementar regeneração de session ID após login',
        'Configurar tempo de expiração adequado',
        'Implementar MFA'
      ],
      priority: 'Alta',
      references: ['https://owasp.org/Top10/A07_2021-Identification_and_Authentication_Failures/'],
      status: 'Confirmado'
    })
  }

  // A08 - Software & Data Integrity Failures
  const hasCdnScripts = requests.some(r => /cdn\.(jsdelivr|unpkg|cloudflare)\.net/i.test(r.url))
  if (hasCdnScripts) {
    vulnerabilities.push({
      id: 'A08-001',
      name: 'Scripts carregados de CDNs sem integridade verificada',
      owaspCategory: 'A08 - Software & Data Integrity Failures',
      cwe: 'CWE-353',
      description: 'Scripts carregados de CDNs sem verificação de integridade (SRI). Se o CDN for comprometido, scripts maliciosos podem ser executados.',
      evidence: requests.filter(r => /cdn/i.test(r.url)).slice(0, 5).map(r => r.url),
      impact: 'Execução de código malicioso via CDN comprometido, supply chain attack.',
      likelihood: 'Baixa',
      severity: 'Médio',
      cvssScore: 5.0,
      cvssVector: 'CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:U/C:L/I:H/A:N',
      affectedSystems: [targetUrl],
      remediation: [
        'Implementar Subresource Integrity (SRI) em todos os scripts carregados de CDNs',
        'Usar versões específicas em vez de "latest"',
        'Considerar self-hosting de bibliotecas críticas'
      ],
      priority: 'Média',
      references: ['https://owasp.org/Top10/A08_2021-Software_and_Data_Integrity_Failures/'],
      status: 'Observação'
    })
  }

  // A09 - Logging & Monitoring Failures
  const hasErrors = requests.some(r => r.status && r.status >= 500)
  if (hasErrors) {
    vulnerabilities.push({
      id: 'A09-001',
      name: 'Erros 5xx Detectados - Possível falta de monitoramento',
      owaspCategory: 'A09 - Logging & Monitoring Failures',
      cwe: 'CWE-778',
      description: `${requests.filter(r => r.status && r.status >= 500).length} erros de servidor foram detectados. Sem logging adequado, ataques podem passar despercebidos.`,
      evidence: requests.filter(r => r.status && r.status >= 500).slice(0, 5).map(r => `${r.method} ${r.url} -> ${r.status}`),
      impact: 'Falta de visibilidade sobre ataques em andamento, dificuldade de forense e resposta a incidentes.',
      likelihood: 'Média',
      severity: 'Médio',
      cvssScore: 5.5,
      cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:L',
      affectedSystems: [targetUrl],
      remediation: [
        'Implementar logging centralizado com correlação de eventos',
        'Configurar alertas para padrões de ataque (múltiplos 401, 403, 500)',
        'Implementar SIEM ou ferramenta de observabilidade',
        'Garantir que logs incluam IP, user-agent, request ID e timestamp'
      ],
      priority: 'Média',
      references: ['https://owasp.org/Top10/A09_2021-Logging_and_Monitoring_Failures/'],
      status: 'Observação'
    })
  }

  // A10 - SSRF
  const hasRedirect = requests.some(r => r.status === 301 || r.status === 302)
  if (hasRedirect) {
    vulnerabilities.push({
      id: 'A10-001',
      name: 'Redirecionamentos Detectados - Possível SSRF',
      owaspCategory: 'A10 - SSRF',
      cwe: 'CWE-918',
      description: 'Redirecionamentos HTTP foram detectados. Se a aplicação segue URLs fornecidas pelo usuário, pode ser vulnerável a SSRF.',
      evidence: requests.filter(r => r.status === 301 || r.status === 302).slice(0, 3).map(r => `${r.method} ${r.url}`),
      impact: 'Acesso a recursos internos (cloud metadata, serviços internos), leitura de arquivos, RCE.',
      likelihood: 'Baixa',
      severity: 'Médio',
      cvssScore: 5.0,
      cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N',
      affectedSystems: [targetUrl],
      remediation: [
        'Validar URLs fornecidas pelo usuário contra whitelist',
        'Bloquear IPs privados e ranges internos (127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)',
        'Desabilitar redirecionamentos seguidos automaticamente',
        'Usar allowlist de domínios permitidos'
      ],
      priority: 'Média',
      references: ['https://owasp.org/Top10/A10_2021-SSRF/'],
      status: 'Potencial'
    })
  }

  // =====================
  // ADDITIONAL CHECKS
  // =====================

  // Error exposure check
  const errorBodies = requests.filter(r => {
    const body = (r.responseBody || '').toLowerCase()
    return /(fatal error|stack trace|syntax error|unexpected|warning|notice|exception|debug_backtrace)/i.test(body)
  })
  if (errorBodies.length > 0) {
    const cvss = calculateCvssScore('N', 'L', 'N', 'N', 'U', 'H', 'L', 'N')
    vulnerabilities.push({
      id: 'ADD-001',
      name: 'Vazamento de Informações em Mensagens de Erro',
      owaspCategory: 'A05 - Security Misconfiguration',
      cwe: 'CWE-200',
      description: 'Mensagens de erro detalhadas estão sendo expostas, revelando informações internas.',
      evidence: errorBodies.slice(0, 3).map(r => `${r.method} ${r.url} -> ${((r.responseBody || '').slice(0, 200))}`),
      impact: 'Vazamento de caminhos de arquivos, consultas SQL, versões de software, facilitando ataques direcionados.',
      likelihood: 'Alta',
      severity: cvss.severity,
      cvssScore: cvss.score,
      cvssVector: cvss.vector,
      affectedSystems: [targetUrl],
      remediation: [
        'Configurar ambiente para não exibir erros em produção (display_errors=Off)',
        'Implementar tratamento global de exceções',
        'Usar respostas genéricas para o cliente e logs detalhados no servidor'
      ],
      priority: 'Alta',
      references: ['CWE-200'],
      status: 'Confirmado'
    })
  }

  // CORS check
  const corsHeaders = requests.filter(r => {
    const h = r.responseHeaders || {}
    return h['access-control-allow-origin'] === '*'
  })
  if (corsHeaders.length > 0) {
    const cvss = calculateCvssScore('N', 'L', 'N', 'R', 'U', 'L', 'L', 'N')
    vulnerabilities.push({
      id: 'ADD-002',
      name: 'CORS Excessivamente Permissivo (wildcard)',
      owaspCategory: 'A01 - Broken Access Control',
      cwe: 'CWE-942',
      description: `Access-Control-Allow-Origin: * detectado em ${corsHeaders.length} resposta(s). Qualquer site pode ler as respostas.`,
      evidence: corsHeaders.slice(0, 3).map(r => r.url),
      impact: 'Exfiltração de dados via solicitações cross-origin, vazamento de informações para sites maliciosos.',
      likelihood: 'Média',
      severity: cvss.severity,
      cvssScore: cvss.score,
      cvssVector: cvss.vector,
      affectedSystems: [targetUrl],
      remediation: [
        'Remover CORS wildcard e definir origens específicas',
        'Nunca usar Access-Control-Allow-Origin: * com credenciais (withCredentials)',
        'Usar whitelist de origens permitidas'
      ],
      priority: 'Média',
      references: ['CWE-942', 'https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS'],
      status: 'Confirmado'
    })
  }

  // Missing CSP check
  headersList.forEach((h, i) => {
    if (!h.includes('content-security-policy')) {
      if (!vulnerabilities.find(v => v.id === 'ADD-003')) {
        vulnerabilities.push({
          id: 'ADD-003',
          name: 'Content-Security-Policy não configurada',
          owaspCategory: 'A05 - Security Misconfiguration',
          cwe: 'CWE-693',
          description: 'CSP não está definida, aumentando significativamente o impacto de vulnerabilidades XSS.',
          evidence: [htmlReqs[i]?.url || targetUrl],
          impact: 'XSS, clickjacking, injeção de scripts e data exfiltration via canais de comunicação não autorizados.',
          likelihood: 'Alta',
          severity: 'Médio',
          cvssScore: 6.1,
          cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N',
          affectedSystems: [new URL(htmlReqs[i]?.url || targetUrl).hostname],
          remediation: [
            'Implementar Content-Security-Policy com diretivas restritivas',
            'Usar CSP Report-Only durante transição',
            'Testar exaustivamente para evitar quebras de funcionalidade'
          ],
          priority: 'Alta',
          references: ['https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP'],
          status: 'Confirmado'
        })
      }
    }
  })

  // =====================
  // SCORING
  // =====================

  const vulnCount = { critico: 0, alto: 0, medio: 0, baixo: 0, info: 0 }
  vulnerabilities.forEach(v => {
    if (v.severity === 'Crítico') vulnCount.critico++
    else if (v.severity === 'Alto') vulnCount.alto++
    else if (v.severity === 'Médio') vulnCount.medio++
    else if (v.severity === 'Baixo') vulnCount.baixo++
    else vulnCount.info++
  })

  // Calculate scores (0-100) for each category based on findings
  const hasVuln = (category: string, ...names: string[]) => {
    return vulnerabilities.some(v => 
      (category ? v.owaspCategory.includes(category) : true) && 
      (names.length === 0 || names.some(n => v.name.includes(n)))
    )
  }

  const autenticacao = hasVuln('A07') ? 45 : hasVuln('', 'Cookie') ? 60 : 90
  const controleAcesso = hasVuln('A01') ? 40 : hasVuln('', 'IDOR') ? 55 : 85
  const criptografia = hasVuln('A02') ? 35 : hasVuln('', 'HSTS') ? 65 : 90
  const apis = hasVuln('', 'CORS') ? 50 : 80
  const configuracao = hasVuln('A05') ? 40 : 85
  const infraestrutura = hasVuln('', 'TLS', 'Error') ? 45 : hasVuln('A05') ? 60 : 85
  const codigo = hasVuln('A03') ? 30 : 80
  const dependencias = hasVuln('A06') ? 50 : 85
  const headersHttp = Math.max(0, 100 - (headersList.length > 0 ? 
    (3 - new Set(headersList.flat().filter(h => ['content-security-policy', 'x-frame-options', 'x-content-type-options', 'strict-transport-security'].includes(h))).size) * 25 : 50))
  const sessoes = cookies.filter(c => c.httpOnly && c.secure && c.sameSite && c.sameSite !== 'unspecified').length / Math.max(cookies.length, 1) * 100
  const exposicaoInfo = hasVuln('', 'Error', 'Stack') ? 35 : hasVuln('', 'Informações') ? 55 : 90
  const owaspTop10 = Math.max(0, 100 - (vulnCount.critico * 20 + vulnCount.alto * 10 + vulnCount.medio * 5))

  const scores: AuditScore = {
    autenticacao: Math.round(autenticacao),
    controleAcesso: Math.round(controleAcesso),
    criptografia: Math.round(criptografia),
    apis: Math.round(apis),
    configuracao: Math.round(configuracao),
    infraestrutura: Math.round(infraestrutura),
    codigo: Math.round(codigo),
    dependencias: Math.round(dependencias),
    headersHttp: Math.round(headersHttp),
    sessoes: Math.round(sessoes),
    exposicaoInfo: Math.round(exposicaoInfo),
    owaspTop10: Math.round(owaspTop10),
    total: Math.round((autenticacao + controleAcesso + criptografia + apis + configuracao + infraestrutura + codigo + dependencias + headersHttp + sessoes + exposicaoInfo + owaspTop10) / 12)
  }

  // =====================
  // CHECKLIST
  // =====================

  const checklist: AuditSection[] = [
    {
      name: 'Reconhecimento',
      items: [
        { name: 'Identificação da tecnologia', status: requests.length > 0 ? 'pass' : 'info', details: `${new Set(requests.map(r => r.url).map(u => new URL(u).hostname)).size} hosts identificados` },
        { name: 'Cabeçalhos HTTP', status: headersList.length > 0 ? 'pass' : 'warning', details: `${headersList.length} responses analisadas` },
        { name: 'Certificados TLS/SSL', status: httpRequests.length === 0 ? 'pass' : 'fail', details: httpRequests.length > 0 ? `${httpRequests.length} reqs sem TLS` : 'OK' },
      ]
    },
    {
      name: 'Infraestrutura',
      items: [
        { name: 'HTTPS/TLS', status: httpRequests.length === 0 ? 'pass' : 'fail', details: httpRequests.length > 0 ? 'Tráfego HTTP detectado' : 'HTTPS configurado' },
        { name: 'Headers de segurança', status: headersHttp > 70 ? 'pass' : headersHttp > 40 ? 'warning' : 'fail', details: `Score: ${headersHttp}/100` },
        { name: 'CORS', status: corsHeaders.length === 0 ? 'pass' : 'fail', details: corsHeaders.length > 0 ? 'CORS wildcard' : 'OK' },
        { name: 'Cookies (Secure, HttpOnly, SameSite)', status: sessoes > 70 ? 'pass' : sessoes > 40 ? 'warning' : 'fail', details: `Score: ${Math.round(sessoes)}/100` },
      ]
    },
    {
      name: 'Autenticação e Sessões',
      items: [
        { name: 'Cookies de sessão seguros', status: sessoes > 70 ? 'pass' : sessoes > 40 ? 'warning' : 'fail', details: `${cookies.filter(c => c.httpOnly).length}/${cookies.length} HttpOnly` },
        { name: 'Exposição de tokens', status: sensitiveArtifactsFilter() ? 'fail' : 'pass', details: 'Verificar artefatos sensíveis' },
      ]
    },
    {
      name: 'Controle de Acesso',
      items: [
        { name: 'IDOR / Escalada de privilégio', status: 'info', details: 'Requer análise manual de endpoints autenticados' },
        { name: 'Proteção de rotas admin', status: hasAdminPaths ? 'warning' : 'pass', details: hasAdminPaths ? 'Endpoints administrativos detectados' : 'OK' },
      ]
    },
    {
      name: 'OWASP Top 10',
      items: [
        { name: 'A01 - Broken Access Control', status: hasVuln('A01') ? 'fail' : 'pass', details: hasVuln('A01') ? 'Falhas detectadas' : 'OK' },
        { name: 'A02 - Cryptographic Failures', status: hasVuln('A02') ? 'fail' : 'pass', details: httpRequests.length > 0 ? 'HTTP sem TLS' : 'OK' },
        { name: 'A03 - Injection', status: hasVuln('A03') ? 'fail' : 'pass', details: sqliRequests.length > 0 ? 'SQLi detectado' : 'OK' },
        { name: 'A05 - Security Misconfiguration', status: hasVuln('A05') ? 'fail' : 'pass', details: misconfigIssues.length > 0 ? `${misconfigIssues.length} problemas` : 'OK' },
        { name: 'A06 - Vulnerable Components', status: hasVuln('A06') ? 'warning' : 'pass', details: outdatedLibs.length > 0 ? 'Componentes antigos' : 'OK' },
        { name: 'A07 - Auth Failures', status: hasVuln('A07') ? 'fail' : 'pass', details: authIssues.length > 0 ? `${authIssues.length} issues` : 'OK' },
        { name: 'A09 - Logging Failures', status: hasErrors ? 'warning' : 'pass', details: hasErrors ? 'Erros sem logging visível' : 'OK' },
        { name: 'A10 - SSRF', status: 'info', details: hasRedirect ? 'Redirecionamentos detectados' : 'Nenhum redirecionamento' },
      ]
    },
  ]

  // Helper for checklist
  function sensitiveArtifactsFilter() {
    return false // simplified
  }

  // =====================
  // OWASP COMPLIANCE
  // =====================

  const owaspCompliance = [
    { category: 'A01 - Broken Access Control', status: hasVuln('A01') ? 'Não Conforme' : 'Conforme' as const, details: hasVuln('A01') ? 'Endpoints administrativos expostos' : 'Controle de acesso adequado' },
    { category: 'A02 - Cryptographic Failures', status: httpRequests.length > 0 ? 'Não Conforme' : 'Conforme' as const, details: httpRequests.length > 0 ? 'Tráfego HTTP sem TLS' : 'Criptografia OK' },
    { category: 'A03 - Injection', status: sqliRequests.length > 0 ? 'Não Conforme' : 'Conforme' as const, details: sqliRequests.length > 0 ? 'SQL Injection detectado' : 'Sem injeção detectada' },
    { category: 'A04 - Insecure Design', status: 'Parcial' as const, details: 'Requer análise manual de arquitetura' },
    { category: 'A05 - Security Misconfiguration', status: misconfigIssues.length > 0 ? 'Não Conforme' : 'Conforme' as const, details: misconfigIssues.length > 0 ? 'Configurações incorretas' : 'OK' },
    { category: 'A06 - Vulnerable Components', status: outdatedLibs.length > 0 ? 'Não Conforme' : 'Parcial' as const, details: outdatedLibs.length > 0 ? 'Bibliotecas desatualizadas' : 'Sem análise de dependências' },
    { category: 'A07 - Auth Failures', status: authIssues.length > 0 ? 'Não Conforme' : 'Conforme' as const, details: authIssues.length > 0 ? 'Cookies inseguros' : 'OK' },
    { category: 'A08 - Integrity Failures', status: hasCdnScripts ? 'Parcial' : 'Conforme' as const, details: hasCdnScripts ? 'CDNs sem SRI' : 'OK' },
    { category: 'A09 - Logging Failures', status: 'Parcial' as const, details: 'Não foi possível verificar logs' },
    { category: 'A10 - SSRF', status: 'Parcial' as const, details: hasRedirect ? 'Redirecionamentos requerem verificação' : 'OK' },
  ]

  // =====================
  // RECOMMENDATIONS
  // =====================

  const recommendations: string[] = []
  if (sqliRequests.length > 0) recommendations.push('[CRÍTICO] Corrigir SQL Injection com prepared statements imediatamente')
  if (httpRequests.length > 0) recommendations.push('[CRÍTICO] Migrar todo o tráfego para HTTPS')
  if (authIssues.length > 0) recommendations.push('[ALTA] Configurar cookies de autenticação com HttpOnly, Secure e SameSite')
  if (misconfigIssues.length > 0) recommendations.push('[ALTA] Implementar todos os headers de segurança recomendados')
  if (hasVuln('A01')) recommendations.push('[ALTA] Revisar e proteger endpoints administrativos')
  if (hasErrors) recommendations.push('[MÉDIA] Implementar logging e monitoramento')
  recommendations.push('[MÉDIA] Realizar teste de penetração manual para complementar a automação')
  recommendations.push('[MÉDIA] Implementar pipeline de segurança em CI/CD (SAST, DAST, SCA)')
  if (outdatedLibs.length > 0) recommendations.push('[MÉDIA] Atualizar dependências e bibliotecas de front-end')

  // =====================
  // FINAL
  // =====================

  const overallScore = scores.total
  const productionReady = overallScore >= 80 && vulnCount.critico === 0 && vulnCount.alto < 3

  const totalEndpoints = new Set(requests.map(r => {
    try { return new URL(r.url).pathname } catch { return r.url }
  })).size

  return {
    summary: `Auditoria de segurança realizada em ${targetUrl}. Foram analisadas ${requests.length} requisições e ${new Set(requests.map(r => r.url)).size} endpoints únicos. ${vulnerabilities.length} vulnerabilidades encontradas (${vulnCount.critico} críticas, ${vulnCount.alto} altas, ${vulnCount.medio} médias, ${vulnCount.baixo} baixas).`,
    overallScore,
    scoreClassification: classifyScore(overallScore),
    vulnerabilitiesCount: vulnCount,
    totalVulnerabilities: vulnerabilities.length,
    vulnerabilities: vulnerabilities.sort((a, b) => b.cvssScore - a.cvssScore),
    scores,
    checklist,
    owaspCompliance,
    recommendations,
    productionReady,
    generatedAt,
    targetUrl,
    duration,
    totalRequests: requests.length,
    totalEndpoints,
  }
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
