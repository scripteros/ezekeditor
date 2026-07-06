import { useMemo, useState } from 'react'
import { Shield, AlertTriangle, CheckCircle2, XCircle, Info, Bug, Download, ExternalLink, ChevronDown, ChevronRight, Globe, Copy, Check } from 'lucide-react'
import type { AuditReport, AuditVulnerability } from './SecurityAuditEngine'
import { getApi } from '../../utils/platform'

interface Props {
  report: AuditReport | null
  isRunning: boolean
  onStartAudit: () => void
  targetUrl: string
}

const severityColors: Record<string, string> = {
  'Crítico': 'text-red-400 bg-red-500/10 border-red-500/30',
  'Alto': 'text-orange-400 bg-orange-500/10 border-orange-500/30',
  'Médio': 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  'Baixo': 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  'Informativo': 'text-gray-400 bg-gray-500/10 border-gray-500/30',
}

const scoreColors = (score: number) => {
  if (score >= 90) return 'text-green-400'
  if (score >= 70) return 'text-yellow-400'
  if (score >= 50) return 'text-orange-400'
  return 'text-red-400'
}

const barColors = (score: number) => {
  if (score >= 90) return 'bg-green-500'
  if (score >= 70) return 'bg-yellow-500'
  if (score >= 50) return 'bg-orange-500'
  return 'bg-red-500'
}

function formatCvss(v: AuditVulnerability) {
  const colorClass = severityColors[v.severity] || severityColors['Informativo']
  return (
    <div className="flex items-center gap-2">
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${colorClass}`}>{v.severity.toUpperCase()}</span>
      <span className="text-[11px] font-mono text-nova-text-muted">CVSS {v.cvssScore.toFixed(1)}</span>
    </div>
  )
}

export default function AuditReportPanel({ report, isRunning, onStartAudit, targetUrl }: Props) {
  const [expandedVuln, setExpandedVuln] = useState<string | null>(null)
  const [expandedSection, setExpandedSection] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const getScoreBar = (label: string, score: number) => (
    <div className="mb-2">
      <div className="flex justify-between text-[11px] mb-0.5">
        <span className="text-nova-text-secondary">{label}</span>
        <span className={`font-bold ${scoreColors(score)}`}>{score}/100</span>
      </div>
      <div className="w-full h-2 bg-nova-border rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColors(score)}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  )

  const generateHtmlReport = () => {
    if (!report) return ''
    const now = new Date()
    const vulnsHtml = report.vulnerabilities.map(v => {
      const severityClass = v.severity === 'Crítico' ? 'crit' : v.severity === 'Alto' ? 'high' : v.severity === 'Médio' ? 'med' : v.severity === 'Baixo' ? 'low' : 'info'
      return `
      <div class="vuln">
        <div class="vuln-head">
          <span class="sev sev-${severityClass}">${v.severity}</span>
          <strong>${v.name}</strong>
          <span class="cvss">CVSS ${v.cvssScore}</span>
        </div>
        <div class="vuln-body">
          <p>${v.description}</p>
          <p><strong>Categoria OWASP:</strong> ${v.owaspCategory}</p>
          <p><strong>CWE:</strong> ${v.cwe}${v.cve ? ` | <strong>CVE:</strong> ${v.cve}` : ''}</p>
          ${v.evidence.length ? `<p><strong>Evidências:</strong></p><ul>${v.evidence.map(e => `<li>${e}</li>`).join('')}</ul>` : ''}
          <p><strong>Impacto:</strong> ${v.impact}</p>
          <p><strong>Probabilidade:</strong> ${v.likelihood} | <strong>Prioridade:</strong> ${v.priority}</p>
          <p><strong>Recomendações:</strong></p><ul>${v.remediation.map(r => `<li>${r}</li>`).join('')}</ul>
        </div>
      </div>`
    }).join('')

    const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Auditoria de Segurança - ${report.targetUrl}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0e0c; color: #e6e9ef; padding: 20px; }
  .wrap { max-width: 1000px; margin: 0 auto; }
  h1 { font-size: 22px; color: #59d27c; margin-bottom: 5px; }
  .meta { color: #889; font-size: 12px; margin-bottom: 20px; }
  .score-box { background: linear-gradient(135deg, #0f1a15, #0a0e0c); border: 1px solid #59d27c33; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 20px; }
  .score-value { font-size: 48px; font-weight: 800; }
  .score-label { font-size: 14px; color: #889; margin-top: 5px; }
  .score-class { font-size: 16px; color: #59d27c; margin-top: 5px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
  .card { background: #0f1a15; border: 1px solid #1a2a22; border-radius: 10px; padding: 16px; }
  .card-title { font-size: 12px; text-transform: uppercase; color: #889; letter-spacing: 0.5px; margin-bottom: 10px; }
  .card-value { font-size: 24px; font-weight: 700; }
  .bar { height: 6px; background: #1a2a22; border-radius: 3px; margin: 6px 0; overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 3px; }
  .vuln { background: #0f1a15; border: 1px solid #1a2a22; border-radius: 8px; margin-bottom: 10px; overflow: hidden; }
  .vuln-head { display: flex; align-items: center; gap: 10px; padding: 12px; border-bottom: 1px solid #1a2a22; }
  .sev { font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 999px; }
  .sev-crit { background: #ff000022; color: #ff4444; border: 1px solid #ff444444; }
  .sev-high { background: #ff880022; color: #ff8844; border: 1px solid #ff884444; }
  .sev-med { background: #ffcc0022; color: #ffcc44; border: 1px solid #ffcc4444; }
  .sev-low { background: #4488ff22; color: #4488ff; border: 1px solid #4488ff44; }
  .sev-info { background: #88888822; color: #888; border: 1px solid #88888844; }
  .cvss { margin-left: auto; font-family: monospace; font-size: 11px; color: #889; }
  .vuln-body { padding: 12px; font-size: 13px; line-height: 1.5; }
  .vuln-body p { margin-bottom: 8px; }
  .vuln-body ul { padding-left: 20px; margin-bottom: 8px; }
  .vuln-body li { margin-bottom: 4px; }
  .recs { margin-top: 20px; }
  .recs li { padding: 8px; border-bottom: 1px solid #1a2a22; font-size: 13px; }
  @media print { body { background: white; color: black; } .score-box { border-color: #ddd; } .vuln { border-color: #ddd; } }
</style></head><body>
<div class="wrap">
  <h1>🔒 Auditoria de Segurança</h1>
  <div class="meta">
    <div>Alvo: ${report.targetUrl}</div>
    <div>Data: ${report.generatedAt}</div>
    <div>Duração: ${report.duration}</div>
    <div>Total de requisições analisadas: ${report.totalRequests} | Endpoints: ${report.totalEndpoints}</div>
  </div>

  <div class="score-box">
    <div class="score-value" style="color: ${report.overallScore >= 80 ? '#59d27c' : report.overallScore >= 50 ? '#ffcc44' : '#ff4444'}">${report.overallScore}/100</div>
    <div class="score-class">${report.scoreClassification}</div>
    <div class="score-label" style="margin-top:10px">${report.productionReady ? '✅ APTA para produção' : '❌ Necessita correções antes da publicação'}</div>
  </div>

  <div class="grid">
    <div class="card"><div class="card-title">Críticas</div><div class="card-value" style="color:#ff4444">${report.vulnerabilitiesCount.critico}</div></div>
    <div class="card"><div class="card-title">Altas</div><div class="card-value" style="color:#ff8844">${report.vulnerabilitiesCount.alto}</div></div>
    <div class="card"><div class="card-title">Médias</div><div class="card-value" style="color:#ffcc44">${report.vulnerabilitiesCount.medio}</div></div>
    <div class="card"><div class="card-title">Baixas</div><div class="card-value" style="color:#4488ff">${report.vulnerabilitiesCount.baixo}</div></div>
  </div>

  <div class="card" style="margin-bottom:20px">
    <div class="card-title">Pontuação por Categoria</div>
    ${Object.entries(report.scores).filter(([k]) => k !== 'total').map(([k, v]) => ` 
      <div style="margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:2px">
          <span>${k}</span><span style="font-weight:700">${v}/100</span>
        </div>
        <div class="bar"><div class="bar-fill" style="width:${v}%;background:${v >= 80 ? '#59d27c' : v >= 50 ? '#ffcc44' : '#ff4444'}"></div></div>
      </div>
    `).join('')}
  </div>

  <h2 style="margin-bottom:10px;font-size:16px">Vulnerabilidades (${report.vulnerabilities.length})</h2>
  ${vulnsHtml}

  <div class="recs">
    <h2 style="margin-bottom:10px;font-size:16px">Recomendações Priorizadas</h2>
    <ul style="list-style:none;padding:0">${report.recommendations.map(r => `<li>• ${r}</li>`).join('')}</ul>
  </div>

  <div style="margin-top:30px;padding:16px;background:#0f1a15;border-radius:8px;border:1px solid #1a2a22">
    <div class="card-title">Checklist de Segurança</div>
    ${report.checklist.map(s => `<div style="margin-bottom:12px"><strong style="font-size:13px">${s.name}</strong>${s.items.map(i => `<div style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:12px"><span>${i.status === 'pass' ? '✅' : i.status === 'fail' ? '❌' : i.status === 'warning' ? '⚠️' : 'ℹ️'}</span>${i.name}: ${i.details}</div>`).join('')}</div>`).join('')}
  </div>
</div></body></html>`
    return html
  }

  const openReportInBrowser = () => {
    const html = generateHtmlReport()
    const api = getApi()
    if (api && api.securityOpenHtmlInBrowser) {
      api.securityOpenHtmlInBrowser(html, `audit-${Date.now()}.html`)
    }
  }

  const copyReport = async () => {
    const text = JSON.stringify(report, null, 2)
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (isRunning) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="animate-spin w-8 h-8 border-2 border-nova-accent border-t-transparent rounded-full mx-auto" />
          <p className="text-nova-text-secondary font-medium">Executando auditoria de segurança...</p>
          <p className="text-nova-text-muted text-xs">Analisando requisições, headers, cookies e padrões de ataque</p>
        </div>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md">
          <Shield size={48} className="mx-auto text-nova-text-muted/50" />
          <h3 className="text-lg font-semibold">Auditoria de Segurança</h3>
          <p className="text-nova-text-muted text-xs leading-relaxed">
            Execute uma auditoria completa baseada no OWASP Top 10 e metodologias de pentest profissional.
            A análise inclui verificação de headers, cookies, SQL Injection, XSS, configurações TLS, CORS e muito mais.
          </p>
          <button
            onClick={onStartAudit}
            disabled={!targetUrl || targetUrl === 'about:blank'}
            className="px-6 py-2 bg-nova-accent/20 border border-nova-accent/40 text-nova-accent rounded-lg hover:bg-nova-accent/30 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {!targetUrl || targetUrl === 'about:blank' ? 'Navegue para um site primeiro' : '▶ Iniciar Auditoria'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto scrollbar-thin bg-nova-bg">
      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Shield size={18} className="text-nova-accent" />
              Relatório de Auditoria
            </h2>
            <div className="text-[10px] text-nova-text-muted mt-0.5 space-y-0.5">
              <div>Alvo: <span className="text-nova-text">{report.targetUrl}</span></div>
              <div>Gerado: {report.generatedAt} | Duração: {report.duration}</div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={openReportInBrowser} className="flex items-center gap-1 px-3 py-1.5 bg-nova-accent/10 text-nova-accent rounded border border-nova-accent/30 text-[10px]">
              <ExternalLink size={12} /> Abrir no navegador
            </button>
            <button onClick={copyReport} className="flex items-center gap-1 px-3 py-1.5 bg-nova-bg-secondary text-nova-text-secondary rounded border border-nova-border text-[10px]">
              {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copiado' : 'Exportar JSON'}
            </button>
          </div>
        </div>

        {/* Score Card */}
        <div className="bg-gradient-to-br from-[#0f1a15] to-[#0a0e0c] border border-nova-border rounded-xl p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className={`text-5xl font-black ${scoreColors(report.overallScore)}`}>{report.overallScore}<span className="text-2xl text-nova-text-muted">/100</span></div>
              <div className="text-nova-accent font-semibold mt-1">{report.scoreClassification}</div>
              <div className="text-xs mt-2">
                {report.productionReady ? (
                  <span className="text-green-400 font-medium">✅ Aplicação apta para produção</span>
                ) : (
                  <span className="text-red-400 font-medium">❌ Necessita correções antes da publicação</span>
                )}
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Críticas', value: report.vulnerabilitiesCount.critico, color: 'text-red-400' },
                { label: 'Altas', value: report.vulnerabilitiesCount.alto, color: 'text-orange-400' },
                { label: 'Médias', value: report.vulnerabilitiesCount.medio, color: 'text-yellow-400' },
                { label: 'Baixas', value: report.vulnerabilitiesCount.baixo, color: 'text-blue-400' },
              ].map(item => (
                <div key={item.label} className="text-center p-3 bg-nova-bg/50 rounded-lg border border-nova-border/50">
                  <div className={`text-xl font-bold ${item.color}`}>{item.value}</div>
                  <div className="text-[9px] text-nova-text-muted mt-1 uppercase">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="border border-nova-border rounded-lg p-4 bg-nova-bg-secondary">
          <h3 className="text-xs font-semibold text-nova-text-secondary uppercase tracking-wider mb-2">Resumo Executivo</h3>
          <p className="text-sm text-nova-text leading-relaxed">{report.summary}</p>
        </div>

        {/* Scores by Category */}
        <div className="border border-nova-border rounded-lg p-4 bg-nova-bg-secondary">
          <h3 className="text-xs font-semibold text-nova-text-secondary uppercase tracking-wider mb-3">Pontuação por Categoria</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(report.scores).filter(([k]) => k !== 'total').map(([key, value]) => (
              <div key={key} className="bg-nova-bg rounded-lg p-3 border border-nova-border/50">
                <div className="text-[9px] uppercase text-nova-text-muted tracking-wider mb-1">
                  {key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}
                </div>
                <div className={`text-xl font-bold ${scoreColors(value)}`}>{value}</div>
                <div className="w-full h-1.5 bg-nova-border rounded-full mt-1 overflow-hidden">
                  <div className={`h-full rounded-full ${barColors(value)}`} style={{ width: `${value}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Vulnerabilities */}
        <div className="border border-nova-border rounded-lg overflow-hidden bg-nova-bg-secondary">
          <div className="px-4 py-3 border-b border-nova-border flex items-center justify-between">
            <h3 className="text-xs font-semibold text-nova-text-secondary uppercase tracking-wider">
              Vulnerabilidades ({report.vulnerabilities.length})
            </h3>
          </div>
          <div className="divide-y divide-nova-border/50">
            {report.vulnerabilities.map(vuln => (
              <div key={vuln.id}>
                <button
                  onClick={() => setExpandedVuln(expandedVuln === vuln.id ? null : vuln.id)}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-nova-hover/30 transition-colors text-left"
                >
                  {expandedVuln === vuln.id ? <ChevronDown size={14} className="shrink-0" /> : <ChevronRight size={14} className="shrink-0" />}
                  {formatCvss(vuln)}
                  <span className="flex-1 text-[12px] font-medium truncate">{vuln.name}</span>
                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${
                    vuln.priority === 'Imediata' ? 'bg-red-500/20 text-red-400' :
                    vuln.priority === 'Alta' ? 'bg-orange-500/20 text-orange-400' :
                    vuln.priority === 'Média' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-blue-500/20 text-blue-400'
                  }`}>{vuln.priority}</span>
                  <span className={`text-[9px] px-2 py-0.5 rounded-full ${
                    vuln.status === 'Confirmado' ? 'bg-green-500/20 text-green-400' :
                    vuln.status === 'Potencial' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>{vuln.status}</span>
                </button>
                {expandedVuln === vuln.id && (
                  <div className="px-4 pb-4 space-y-3">
                    <div className="pl-6 border-l-2 border-nova-border/50 space-y-2">
                      <p className="text-[12px] text-nova-text-secondary leading-relaxed">{vuln.description}</p>
                      
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div>
                          <span className="text-nova-text-muted">Categoria OWASP:</span>
                          <span className="text-nova-text ml-1">{vuln.owaspCategory}</span>
                        </div>
                        <div>
                          <span className="text-nova-text-muted">CWE:</span>
                          <span className="text-nova-text ml-1">{vuln.cwe}</span>
                          {vuln.cve && <><span className="text-nova-text-muted ml-2">CVE:</span><span className="text-nova-text ml-1">{vuln.cve}</span></>}
                        </div>
                        <div>
                          <span className="text-nova-text-muted">Impacto:</span>
                          <span className="text-nova-text ml-1">{vuln.impact.slice(0, 80)}...</span>
                        </div>
                        <div>
                          <span className="text-nova-text-muted">Probabilidade:</span>
                          <span className="text-nova-text ml-1">{vuln.likelihood}</span>
                        </div>
                      </div>

                      {vuln.evidence.length > 0 && (
                        <div>
                          <h4 className="text-[10px] font-semibold text-nova-text-muted uppercase mb-1">Evidências</h4>
                          <ul className="space-y-0.5">
                            {vuln.evidence.map((ev, i) => (
                              <li key={i} className="text-[10px] font-mono text-nova-text-secondary bg-nova-bg rounded px-2 py-1">{ev}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div>
                        <h4 className="text-[10px] font-semibold text-nova-text-muted uppercase mb-1">Recomendações de Correção</h4>
                        <ul className="space-y-0.5">
                          {vuln.remediation.map((rec, i) => (
                            <li key={i} className="text-[11px] text-nova-text-secondary flex items-start gap-1.5">
                              <span className="text-nova-accent mt-0.5">•</span>
                              {rec}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="flex items-center gap-2 text-[10px] text-nova-text-muted">
                        <span>Vector: <code className="text-[9px] font-mono bg-nova-bg px-1 py-0.5 rounded">{vuln.cvssVector}</code></span>
                        <a href={`https://nvd.nist.gov/vuln/detail/${vuln.cve || vuln.cwe}`} target="_blank" rel="noreferrer" className="text-nova-accent hover:underline inline-flex items-center gap-1">
                          Referência <ExternalLink size={9} />
                        </a>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Checklist */}
        <div className="border border-nova-border rounded-lg p-4 bg-nova-bg-secondary">
          <h3 className="text-xs font-semibold text-nova-text-secondary uppercase tracking-wider mb-3">Checklist de Controles Avaliados</h3>
          <div className="space-y-3">
            {report.checklist.map(section => (
              <div key={section.name}>
                <button
                  onClick={() => setExpandedSection(expandedSection === section.name ? null : section.name)}
                  className="flex items-center gap-2 text-sm font-medium text-nova-text w-full text-left"
                >
                  {expandedSection === section.name ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  {section.name}
                </button>
                {expandedSection === section.name && (
                  <div className="mt-2 pl-4 space-y-1">
                    {section.items.map(item => (
                      <div key={item.name} className="flex items-start gap-2 text-[11px]">
                        {item.status === 'pass' ? <CheckCircle2 size={12} className="text-green-400 mt-0.5 shrink-0" /> :
                         item.status === 'fail' ? <XCircle size={12} className="text-red-400 mt-0.5 shrink-0" /> :
                         item.status === 'warning' ? <AlertTriangle size={12} className="text-yellow-400 mt-0.5 shrink-0" /> :
                         <Info size={12} className="text-blue-400 mt-0.5 shrink-0" />}
                        <span className="text-nova-text-secondary">{item.name}: <span className="text-nova-text-muted">{item.details}</span></span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* OWASP Compliance */}
        <div className="border border-nova-border rounded-lg p-4 bg-nova-bg-secondary">
          <h3 className="text-xs font-semibold text-nova-text-secondary uppercase tracking-wider mb-3">Conformidade OWASP Top 10</h3>
          <div className="space-y-2">
            {report.owaspCompliance.map(item => (
              <div key={item.category} className="flex items-center gap-3 text-[11px]">
                {item.status === 'Conforme' ? <CheckCircle2 size={14} className="text-green-400 shrink-0" /> :
                 item.status === 'Não Conforme' ? <XCircle size={14} className="text-red-400 shrink-0" /> :
                 <AlertTriangle size={14} className="text-yellow-400 shrink-0" />}
                <span className="text-nova-text font-medium w-36">{item.category}</span>
                <span className={`px-2 py-0.5 rounded text-[9px] font-medium ${
                  item.status === 'Conforme' ? 'bg-green-500/20 text-green-400' :
                  item.status === 'Não Conforme' ? 'bg-red-500/20 text-red-400' :
                  'bg-yellow-500/20 text-yellow-400'
                }`}>{item.status}</span>
                <span className="text-nova-text-muted">{item.details}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recommendations */}
        <div className="border border-nova-border rounded-lg p-4 bg-nova-bg-secondary">
          <h3 className="text-xs font-semibold text-nova-text-secondary uppercase tracking-wider mb-3">Recomendações Priorizadas</h3>
          <ul className="space-y-1.5">
            {report.recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2 text-[12px] text-nova-text-secondary">
                <Bug size={12} className="text-nova-accent mt-0.5 shrink-0" />
                {rec}
              </li>
            ))}
          </ul>
        </div>

        {/* Conclusão */}
        <div className={`border rounded-lg p-4 ${report.productionReady ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-2">Conclusão Final</h3>
          <p className="text-sm leading-relaxed">
            {report.productionReady
              ? `✅ A aplicação obteve pontuação ${report.overallScore}/100 (${report.scoreClassification}) e pode ser considerada adequada para produção. Recomenda-se manter as boas práticas de segurança e realizar auditorias periódicas.`
              : `❌ A aplicação obteve pontuação ${report.overallScore}/100 (${report.scoreClassification}) e requer correções antes da publicação. Priorize a correção das vulnerabilidades críticas e altas antes de colocar em produção.`}
          </p>
        </div>
      </div>
    </div>
  )
}
