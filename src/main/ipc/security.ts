import { app, BrowserWindow, ipcMain, net, session, shell } from 'electron'
import { randomUUID } from 'crypto'
import fs from 'fs'
import http from 'http'
import nodeNet from 'net'
import path from 'path'
import { URL } from 'url'
import { Proxy as MitmProxy } from 'http-mitm-proxy'
import { IPC_CHANNELS } from '../../shared/constants'

const SECURITY_PARTITION = 'persist:ezek-security-browser'

let proxyServer: http.Server | null = null
let mitmProxy: MitmProxy | null = null
let mitmPort: number | null = null
let mitmCaPath: string | null = null
let isMonitoring = false
let ownerWindow: BrowserWindow | null = null
let isInterceptEnabled = false
let interceptCounter = 0
const pendingInterceptions = new Map<string, {
  requestId: string
  ctx: any
  callback: Function
  method: string
  url: string
  headers: Record<string, string>
  body: string
  startedAt: number
  resolve: (action: { type: string; method?: string; url?: string; headers?: Record<string, string>; body?: string }) => void
}>()
const requestStartTimes = new Map<string, number>()
let cookieChangedHandler: ((event: Electron.Event, cookie: Electron.Cookie, cause: string, removed: boolean) => void) | null = null

function getSecuritySession() {
  return session.fromPartition(SECURITY_PARTITION)
}

function getMitmCaDir() {
  return path.join(app.getPath('userData'), 'security-mitm-ca')
}

function sendToRenderer(channel: string, payload: unknown) {
  if (!ownerWindow || ownerWindow.isDestroyed()) return
  ownerWindow.webContents.send(channel, payload)
}

function headersToRecord(headers?: Record<string, string | string[]>) {
  const output: Record<string, string> = {}
  Object.entries(headers || {}).forEach(([key, value]) => {
    output[key] = Array.isArray(value) ? value.join(', ') : String(value)
  })
  return output
}

function decodeUploadData(uploadData?: Electron.UploadData[]) {
  if (!uploadData?.length) return ''

  return uploadData
    .map((item) => {
      if ('bytes' in item && item.bytes) {
        return Buffer.from(item.bytes).toString('utf8')
      }
      if ('file' in item && item.file) {
        return `[arquivo enviado: ${item.file}]`
      }
      return ''
    })
    .filter(Boolean)
    .join('\n')
}

function emitBrowserEvent(type: string, payload: Record<string, unknown>) {
  sendToRenderer(IPC_CHANNELS.SECURITY_BROWSER_EVENT, {
    id: randomUUID(),
    type,
    timestamp: Date.now(),
    ...payload,
  })
}

function getMitmUrl(ctx: any) {
  const rawUrl = ctx.clientToProxyRequest.url || '/'
  if (/^https?:\/\//i.test(rawUrl)) return rawUrl
  const protocol = ctx.isSSL ? 'https' : 'http'
  const host = ctx.clientToProxyRequest.headers.host || ctx.hostname || 'unknown-host'
  return `${protocol}://${host}${rawUrl}`
}

async function applySecuritySessionProxy(port?: number | null) {
  const securitySession = getSecuritySession()
  
  // Sempre confiar em todos os certificados SSL (para sites internos com CA própria)
  securitySession.setCertificateVerifyProc((_request, callback) => {
    callback(0)
  })
  
  if (port) {
    await securitySession.setProxy({
      proxyRules: `http=127.0.0.1:${port};https=127.0.0.1:${port};ws=127.0.0.1:${port};wss=127.0.0.1:${port}`,
    })
  } else {
    await securitySession.setProxy({ proxyRules: '' })
  }
}

function startMitmCapture(port: number) {
  const sslCaDir = getMitmCaDir()
  fs.mkdirSync(sslCaDir, { recursive: true })

  const proxy = new MitmProxy()
  mitmProxy = proxy
  mitmPort = port
  mitmCaPath = path.join(sslCaDir, 'certs', 'ca.pem')

  proxy.onError((ctx, err, errorKind) => {
    emitBrowserEvent('mitm-error', {
      url: ctx ? getMitmUrl(ctx as any) : '',
      error: err?.message || String(err),
      errorKind,
    })
  })

  proxy.onRequest((ctx: any, callback) => {
    const requestId = randomUUID()
    const startedAt = Date.now()
    ctx.ezekRequestId = requestId
    ctx.ezekStartedAt = startedAt
    ctx.ezekRequestChunks = []
    ctx.ezekResponseChunks = []

    const url = getMitmUrl(ctx)
    const method = ctx.clientToProxyRequest.method
    const headers = headersToRecord(ctx.clientToProxyRequest.headers)

    sendToRenderer(IPC_CHANNELS.SECURITY_REQUEST_CAPTURED, {
      id: requestId,
      method,
      url,
      headers,
      body: '',
      timestamp: startedAt,
      protocol: ctx.isSSL ? 'HTTPS MITM' : 'HTTP MITM',
      resourceType: 'mitm',
    })

    // Se intercept está ativo, pausa a requisição e aguarda decisão do usuário
    if (isInterceptEnabled && mitmProxy) {
      interceptCounter++
      const interceptId = `intercept-${interceptCounter}`

      sendToRenderer(IPC_CHANNELS.SECURITY_INTERCEPT_PENDING, {
        interceptId,
        requestId,
        method,
        url,
        headers,
        body: '',
        capturedAt: Date.now(),
        type: 'request',
      })

      // Cria uma Promise que só resolve quando o usuário agir
      const promise = new Promise<{ type: string; method?: string; url?: string; headers?: Record<string, string>; body?: string }>((resolve) => {
        pendingInterceptions.set(interceptId, {
          requestId,
          ctx,
          callback,
          method,
          url,
          headers,
          body: '',
          startedAt,
          resolve,
        })
      })

      promise.then((action) => {
        pendingInterceptions.delete(interceptId)
        if (action.type === 'drop') {
          return callback({ statusCode: 403, headers: { 'x-ezek-intercepted': 'dropped' }, body: 'Requisition dropped by Ezek Interceptor' })
        }
        // Forward com possíveis modificações
        if (action.type === 'forward') {
          return callback()
        }
        return callback()
      })
      return // não chama callback ainda
    }

    return callback()
  })

  proxy.onRequestData((ctx: any, chunk, callback) => {
    ctx.ezekRequestChunks?.push(Buffer.from(chunk))
    return callback(null, chunk)
  })

  proxy.onRequestEnd((ctx: any, callback) => {
    const body = Buffer.concat(ctx.ezekRequestChunks || []).toString('utf8')
    if (ctx.ezekRequestId && body) {
      sendToRenderer(IPC_CHANNELS.SECURITY_REQUEST_CAPTURED, {
        id: ctx.ezekRequestId,
        method: ctx.clientToProxyRequest.method,
        url: getMitmUrl(ctx),
        headers: headersToRecord(ctx.clientToProxyRequest.headers),
        body,
        timestamp: ctx.ezekStartedAt || Date.now(),
        protocol: ctx.isSSL ? 'HTTPS MITM' : 'HTTP MITM',
        resourceType: 'mitm',
      })
    }
    return callback()
  })

  proxy.onResponse((ctx: any, callback) => {
    const headers = headersToRecord(ctx.serverToProxyResponse?.headers)
    const status = ctx.serverToProxyResponse?.statusCode
    const responseId = ctx.ezekRequestId

    sendToRenderer(IPC_CHANNELS.SECURITY_RESPONSE_CAPTURED, {
      id: responseId,
      status,
      responseHeaders: headers,
      durationMs: Date.now() - (ctx.ezekStartedAt || Date.now()),
    })

    // Se intercept está ativo, pausa a resposta
    if (isInterceptEnabled && responseId) {
      interceptCounter++
      const interceptId = `intercept-resp-${interceptCounter}`

      sendToRenderer(IPC_CHANNELS.SECURITY_INTERCEPT_PENDING, {
        interceptId,
        requestId: responseId,
        method: ctx.clientToProxyRequest?.method || 'GET',
        url: getMitmUrl(ctx),
        headers,
        body: '',
        capturedAt: Date.now(),
        type: 'response',
        status,
      })

      const promise = new Promise<{ type: string }>((resolve) => {
        pendingInterceptions.set(interceptId, {
          requestId: responseId,
          ctx,
          callback,
          method: '',
          url: '',
          headers: {},
          body: '',
          startedAt: Date.now(),
          resolve,
        })
      })

      promise.then((action) => {
        pendingInterceptions.delete(interceptId)
        if (action.type === 'drop') {
          return callback()
        }
        return callback()
      })
      return // não chama callback ainda
    }

    return callback()
  })

  proxy.onResponseData((ctx: any, chunk, callback) => {
    const chunks: Buffer[] = ctx.ezekResponseChunks || []
    const currentSize = chunks.reduce((sum, item) => sum + item.length, 0)
    if (currentSize < 1024 * 1024) {
      chunks.push(Buffer.from(chunk))
      ctx.ezekResponseChunks = chunks
    }
    return callback(null, chunk)
  })

  proxy.onResponseEnd((ctx: any, callback) => {
    const body = Buffer.concat(ctx.ezekResponseChunks || []).toString('utf8')
    sendToRenderer(IPC_CHANNELS.SECURITY_RESPONSE_CAPTURED, {
      id: ctx.ezekRequestId,
      status: ctx.serverToProxyResponse?.statusCode,
      responseHeaders: headersToRecord(ctx.serverToProxyResponse?.headers),
      responseBody: body,
      durationMs: Date.now() - (ctx.ezekStartedAt || Date.now()),
    })
    return callback()
  })

  proxy.onWebSocketConnection((ctx: any, callback) => {
    emitBrowserEvent('websocket-open', { url: getMitmUrl(ctx), isSSL: ctx.isSSL })
    return callback()
  })

  proxy.onWebSocketMessage((ctx: any, message, flags, callback) => {
    emitBrowserEvent('websocket-message', {
      url: getMitmUrl(ctx),
      direction: 'server-to-client',
      message: Buffer.isBuffer(message) ? message.toString('utf8').slice(0, 4000) : String(message).slice(0, 4000),
    })
    return callback(null, message, flags)
  })

  proxy.onWebSocketSend((ctx: any, message, flags, callback) => {
    emitBrowserEvent('websocket-message', {
      url: getMitmUrl(ctx),
      direction: 'client-to-server',
      message: Buffer.isBuffer(message) ? message.toString('utf8').slice(0, 4000) : String(message).slice(0, 4000),
    })
    return callback(null, message, flags)
  })

  return new Promise<void>((resolve, reject) => {
    proxy.listen({ port, host: '127.0.0.1', sslCaDir, forceSNI: true }, (err?: Error) => {
      if (err) {
        mitmProxy = null
        mitmPort = null
        reject(err)
        return
      }
      resolve()
    })
  })
}

function installSessionMonitoring() {
  if (isMonitoring) return

  const securitySession = getSecuritySession()
  const filter = { urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }

  // Bypass verificação de certificado SSL para permitir acesso a sites
  // com certificados auto-assinados ou de CA interna (comum em segurança)
  securitySession.setCertificateVerifyProc((_request, callback) => {
    callback(0) // 0 = trust the certificate
  })

  // Configurar NTLM/Kerberos para sites internos com autenticação Windows
  // Isso permite que sites corporativos (como apps.sepaco.org.br) funcionem
  const internalDomains = '.sepaco.org.br,.local,.intranet,.interno,.corp,.lan'
  securitySession.allowNTLMCredentialsForDomains(internalDomains)

  // User-Agent compatível com Chrome para sites que fazem sniffing de UA
  const chromeUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
  securitySession.setUserAgent(chromeUA)

  securitySession.webRequest.onBeforeRequest(filter, (details, callback) => {
    requestStartTimes.set(details.id.toString(), Date.now())

    sendToRenderer(IPC_CHANNELS.SECURITY_REQUEST_CAPTURED, {
      id: details.id.toString(),
      method: details.method,
      url: details.url,
      headers: {},
      body: decodeUploadData(details.uploadData),
      resourceType: details.resourceType,
      timestamp: Date.now(),
      protocol: details.url.split(':')[0].toUpperCase(),
    })

    callback({})
  })

  securitySession.webRequest.onBeforeSendHeaders(filter, (details, callback) => {
    sendToRenderer(IPC_CHANNELS.SECURITY_REQUEST_CAPTURED, {
      id: details.id.toString(),
      method: details.method,
      url: details.url,
      headers: headersToRecord(details.requestHeaders),
      resourceType: details.resourceType,
      timestamp: requestStartTimes.get(details.id.toString()) || Date.now(),
      protocol: details.url.split(':')[0].toUpperCase(),
    })

    callback({ requestHeaders: details.requestHeaders })
  })

  securitySession.webRequest.onHeadersReceived(filter, (details, callback) => {
    const startedAt = requestStartTimes.get(details.id.toString()) || Date.now()

    sendToRenderer(IPC_CHANNELS.SECURITY_RESPONSE_CAPTURED, {
      id: details.id.toString(),
      status: details.statusCode,
      responseHeaders: headersToRecord(details.responseHeaders),
      durationMs: Date.now() - startedAt,
    })

    callback({ responseHeaders: details.responseHeaders })
  })

  securitySession.webRequest.onCompleted(filter, (details) => {
    const startedAt = requestStartTimes.get(details.id.toString()) || Date.now()

    sendToRenderer(IPC_CHANNELS.SECURITY_RESPONSE_CAPTURED, {
      id: details.id.toString(),
      status: details.statusCode,
      fromCache: details.fromCache,
      ip: details.ip,
      durationMs: Date.now() - startedAt,
    })

    requestStartTimes.delete(details.id.toString())
  })

  securitySession.webRequest.onErrorOccurred(filter, (details) => {
    sendToRenderer(IPC_CHANNELS.SECURITY_RESPONSE_CAPTURED, {
      id: details.id.toString(),
      error: details.error,
      durationMs: Date.now() - (requestStartTimes.get(details.id.toString()) || Date.now()),
    })
    requestStartTimes.delete(details.id.toString())
  })

  cookieChangedHandler = (_event, cookie, cause, removed) => {
    emitBrowserEvent('cookie', {
      cause,
      removed,
      name: cookie.name,
      domain: cookie.domain,
      path: cookie.path,
      secure: cookie.secure,
      httpOnly: cookie.httpOnly,
      sameSite: cookie.sameSite,
      expirationDate: cookie.expirationDate,
    })
  }
  securitySession.cookies.on('changed', cookieChangedHandler)

  isMonitoring = true
}

function uninstallSessionMonitoring() {
  if (!isMonitoring) return

  const securitySession = getSecuritySession()
  securitySession.webRequest.onBeforeRequest(null)
  securitySession.webRequest.onBeforeSendHeaders(null)
  securitySession.webRequest.onHeadersReceived(null)
  securitySession.webRequest.onCompleted(null)
  securitySession.webRequest.onErrorOccurred(null)
  if (cookieChangedHandler) {
    securitySession.cookies.removeListener('changed', cookieChangedHandler)
    cookieChangedHandler = null
  }
  requestStartTimes.clear()
  isMonitoring = false
}

export function registerSecurityHandlers() {
  ipcMain.handle(IPC_CHANNELS.SECURITY_START_MONITORING, async (event) => {
    ownerWindow = BrowserWindow.fromWebContents(event.sender)
    installSessionMonitoring()
    return { ok: true, partition: SECURITY_PARTITION }
  })

  ipcMain.handle(IPC_CHANNELS.SECURITY_STOP_MONITORING, async () => {
    uninstallSessionMonitoring()
    return true
  })

  ipcMain.handle(IPC_CHANNELS.SECURITY_GET_COOKIES, async (_event, url?: string) => {
    const cookies = await getSecuritySession().cookies.get(url ? { url } : {})
    return cookies.map((cookie) => ({
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path,
      secure: cookie.secure,
      httpOnly: cookie.httpOnly,
      sameSite: cookie.sameSite,
      session: cookie.session,
      expirationDate: cookie.expirationDate,
    }))
  })

  ipcMain.handle(IPC_CHANNELS.SECURITY_CLEAR_BROWSER_DATA, async () => {
    const securitySession = getSecuritySession()
    await securitySession.clearStorageData()
    await securitySession.clearCache()
    return true
  })

  ipcMain.handle(IPC_CHANNELS.SECURITY_PENTEST_REQUEST, async (_event, options: {
    url: string
    method?: string
    headers?: Record<string, string>
    body?: string
    timeout?: number
  }) => {
    const { url, method = 'GET', headers = {}, body, timeout = 15000 } = options
    const startedAt = Date.now()
    try {
      const request = net.request({
        method,
        url,
        session: getSecuritySession(),
      })

      Object.entries(headers).forEach(([key, value]) => {
        if (key.toLowerCase() === 'host') return
        request.setHeader(key, value)
      })

      const response = await new Promise<{
        status: number
        statusText: string
        headers: Record<string, string>
        body: string
        durationMs: number
        redirected: boolean
      }>((resolve, reject) => {
        const timer = setTimeout(() => {
          request.abort()
          reject(new Error('Timeout'))
        }, timeout)

        request.on('response', (response) => {
          const chunks: Buffer[] = []
          response.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
          response.on('end', () => {
            clearTimeout(timer)
            resolve({
              status: response.statusCode,
              statusText: response.statusMessage || '',
              headers: headersToRecord(response.headers),
              body: Buffer.concat(chunks).toString('utf8'),
              durationMs: Date.now() - startedAt,
              redirected: false,
            })
          })
        })
        request.on('error', (err) => {
          clearTimeout(timer)
          reject(err)
        })
        if (body) request.write(body)
        request.end()
      })

      return response
    } catch (err) {
      return {
        status: 0,
        statusText: err instanceof Error ? err.message : 'Request failed',
        headers: {},
        body: '',
        durationMs: Date.now() - startedAt,
        redirected: false,
      }
    }
  })

  ipcMain.handle(IPC_CHANNELS.SECURITY_REPLAY_REQUEST, async (_event, input: {
    method: string
    url: string
    headers?: Record<string, string>
    body?: string
  }) => {
    const startedAt = Date.now()
    const request = net.request({
      method: input.method,
      url: input.url,
      session: getSecuritySession(),
    })

    Object.entries(input.headers || {}).forEach(([key, value]) => {
      if (key.toLowerCase() === 'host') return
      request.setHeader(key, value)
    })

    const response = await new Promise<{
      status: number
      headers: Record<string, string>
      body: string
      durationMs: number
    }>((resolve, reject) => {
      request.on('response', (response) => {
        const chunks: Buffer[] = []
        response.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
        response.on('end', () => {
          resolve({
            status: response.statusCode,
            headers: headersToRecord(response.headers),
            body: Buffer.concat(chunks).toString('utf8'),
            durationMs: Date.now() - startedAt,
          })
        })
      })
      request.on('error', reject)
      if (input.body) request.write(input.body)
      request.end()
    })

    return response
  })

  ipcMain.handle(IPC_CHANNELS.SECURITY_START_MITM, async (event, port = 8899) => {
    ownerWindow = BrowserWindow.fromWebContents(event.sender)
    installSessionMonitoring()

    if (!mitmProxy) {
      await startMitmCapture(port)
    }

    await applySecuritySessionProxy(mitmPort)
    emitBrowserEvent('mitm-started', {
      port: mitmPort,
      caPath: mitmCaPath,
      proxy: `127.0.0.1:${mitmPort}`,
    })

    return {
      ok: true,
      port: mitmPort,
      caPath: mitmCaPath,
      proxyRules: `127.0.0.1:${mitmPort}`,
    }
  })

  ipcMain.handle(IPC_CHANNELS.SECURITY_STOP_MITM, async () => {
    await applySecuritySessionProxy(null)
    if (mitmProxy) {
      mitmProxy.close()
      mitmProxy = null
    }
    const stoppedPort = mitmPort
    mitmPort = null
    emitBrowserEvent('mitm-stopped', { port: stoppedPort })
    return true
  })

  // Intercept handlers
  ipcMain.handle(IPC_CHANNELS.SECURITY_INTERCEPT_ENABLE, async () => {
    isInterceptEnabled = true
    emitBrowserEvent('intercept-enabled', { timestamp: Date.now() })
    return true
  })

  ipcMain.handle(IPC_CHANNELS.SECURITY_INTERCEPT_DISABLE, async () => {
    isInterceptEnabled = false
    // Libera todas as requisições pendentes
    for (const [id, pending] of pendingInterceptions) {
      pending.resolve({ type: 'forward' })
    }
    pendingInterceptions.clear()
    emitBrowserEvent('intercept-disabled', { timestamp: Date.now() })
    return true
  })

  ipcMain.handle(IPC_CHANNELS.SECURITY_INTERCEPT_ACTION, async (_event, action: {
    interceptId: string
    type: 'forward' | 'drop'
    method?: string
    url?: string
    headers?: Record<string, string>
    body?: string
  }) => {
    const pending = pendingInterceptions.get(action.interceptId)
    if (!pending) return false
    pending.resolve({ type: action.type, method: action.method, url: action.url, headers: action.headers, body: action.body })
    return true
  })

  ipcMain.handle(IPC_CHANNELS.SECURITY_OPEN_CA_CERT, async () => {
    const caPath = mitmCaPath || path.join(getMitmCaDir(), 'certs', 'ca.pem')
    if (fs.existsSync(caPath)) {
      shell.showItemInFolder(caPath)
      return caPath
    }
    return null
  })

  ipcMain.handle(IPC_CHANNELS.SECURITY_START_PROXY, async (event, port: number) => {
    if (proxyServer) return true
    ownerWindow = BrowserWindow.fromWebContents(event.sender)

    try {
      proxyServer = http.createServer((req, res) => {
        const requestId = randomUUID()
        const startTime = Date.now()
        const body: Buffer[] = []

        req.on('data', chunk => body.push(Buffer.from(chunk)))
        req.on('end', () => {
          const reqBodyStr = Buffer.concat(body).toString('utf8')

          sendToRenderer(IPC_CHANNELS.SECURITY_REQUEST_CAPTURED, {
            id: requestId,
            method: req.method,
            url: req.url,
            headers: headersToRecord(req.headers as Record<string, string | string[]>),
            body: reqBodyStr,
            timestamp: startTime,
            protocol: 'HTTP',
          })

          const options = {
            hostname: req.headers.host?.split(':')[0],
            port: req.headers.host?.split(':')[1] || 80,
            path: req.url,
            method: req.method,
            headers: req.headers
          }

          const proxyReq = http.request(options, (proxyRes) => {
            const resBody: Buffer[] = []
            proxyRes.on('data', chunk => resBody.push(Buffer.from(chunk)))
            proxyRes.on('end', () => {
              sendToRenderer(IPC_CHANNELS.SECURITY_RESPONSE_CAPTURED, {
                id: requestId,
                status: proxyRes.statusCode,
                responseHeaders: headersToRecord(proxyRes.headers as Record<string, string | string[]>),
                responseBody: Buffer.concat(resBody).toString('utf8'),
                durationMs: Date.now() - startTime
              })
            })

            res.writeHead(proxyRes.statusCode || 200, proxyRes.headers)
            proxyRes.pipe(res, { end: true })
          })

          proxyReq.on('error', () => {
            res.writeHead(500)
            res.end()
          })

          proxyReq.write(Buffer.concat(body))
          proxyReq.end()
        })
      })

      proxyServer.on('connect', (req, clientSocket, head) => {
        const { port, hostname } = new URL(`http://${req.url}`)
        const serverSocket = nodeNet.connect(Number(port) || 443, hostname, () => {
          clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n')
          serverSocket.write(head)
          serverSocket.pipe(clientSocket)
          clientSocket.pipe(serverSocket)
        })

        serverSocket.on('error', () => clientSocket.end())
        clientSocket.on('error', () => serverSocket.end())
      })

      await new Promise<void>((resolve, reject) => {
        proxyServer!.listen(port, () => resolve())
        proxyServer!.on('error', reject)
      })

      return true
    } catch (err) {
      console.error('Failed to start proxy:', err)
      proxyServer = null
      return false
    }
  })

  ipcMain.handle(IPC_CHANNELS.SECURITY_STOP_PROXY, async () => {
    if (proxyServer) {
      proxyServer.close()
      proxyServer = null
    }
    return true
  })

  ipcMain.handle(IPC_CHANNELS.SECURITY_OPEN_BROWSER, async () => {
    installSessionMonitoring()
    return { ok: true, partition: SECURITY_PARTITION }
  })

  ipcMain.handle(IPC_CHANNELS.SECURITY_OPEN_HTML_IN_BROWSER, async (_event, htmlContent: string, filename: string = 'report.html') => {
    const tempDir = app.getPath('temp')
    const filePath = path.join(tempDir, filename)
    fs.writeFileSync(filePath, htmlContent, 'utf-8')
    await shell.openPath(filePath)
    return filePath
  })
}
