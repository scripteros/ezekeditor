import { ipcMain, BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '../../shared/constants'
import http from 'http'
import net from 'net'
import { URL } from 'url'
import { randomUUID } from 'crypto'

let proxyServer: http.Server | null = null

export function registerSecurityHandlers() {
  ipcMain.handle(IPC_CHANNELS.SECURITY_START_PROXY, async (event, port: number) => {
    if (proxyServer) return true
    const mainWindow = BrowserWindow.fromWebContents(event.sender)

    try {
      proxyServer = http.createServer((req, res) => {
        const requestId = randomUUID()
        const startTime = Date.now()
        
        let body: any[] = []
        req.on('data', chunk => body.push(chunk))
        req.on('end', () => {
          const reqBodyStr = Buffer.concat(body).toString('utf8')
          
          // Emit captured request to frontend
          mainWindow.webContents.send(IPC_CHANNELS.SECURITY_REQUEST_CAPTURED, {
            id: requestId,
            method: req.method,
            url: req.url,
            headers: req.headers,
            body: reqBodyStr,
            timestamp: startTime
          })

          const options = {
            hostname: req.headers.host?.split(':')[0],
            port: req.headers.host?.split(':')[1] || 80,
            path: req.url,
            method: req.method,
            headers: req.headers
          }

          const proxyReq = http.request(options, (proxyRes) => {
            let resBody: any[] = []
            proxyRes.on('data', chunk => resBody.push(chunk))
            proxyRes.on('end', () => {
              const resBodyStr = Buffer.concat(resBody).toString('utf8')
              
              // Emit response
              mainWindow.webContents.send(IPC_CHANNELS.SECURITY_RESPONSE_CAPTURED, {
                id: requestId,
                status: proxyRes.statusCode,
                responseHeaders: proxyRes.headers,
                responseBody: resBodyStr,
                durationMs: Date.now() - startTime
              })
            })
            
            res.writeHead(proxyRes.statusCode || 200, proxyRes.headers)
            proxyRes.pipe(res, { end: true })
          })

          proxyReq.on('error', (err) => {
            console.error('Proxy request error:', err)
            res.writeHead(500)
            res.end()
          })

          proxyReq.write(Buffer.concat(body))
          proxyReq.end()
        })
      })

      // Handle HTTPS CONNECT (tunneling) - For now just bypass to avoid cert errors
      proxyServer.on('connect', (req, clientSocket, head) => {
        const { port, hostname } = new URL(`http://${req.url}`)
        const serverSocket = net.connect(port || 443, hostname, () => {
          clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n')
          serverSocket.write(head)
          serverSocket.pipe(clientSocket)
          clientSocket.pipe(serverSocket)
        })

        serverSocket.on('error', () => {
          clientSocket.end()
        })
        clientSocket.on('error', () => {
          serverSocket.end()
        })
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

  ipcMain.handle(IPC_CHANNELS.SECURITY_OPEN_BROWSER, async (event, port: number) => {
    const { exec } = require('child_process')
    const os = require('os')
    const path = require('path')
    
    // Create a temporary user data dir to isolate the session
    const userDataDir = path.join(os.tmpdir(), `ezek_security_browser_${Date.now()}`)
    
    // In PowerShell/Windows, `start` has issues with nested quotes. Using direct executable or cmd /c
    const command = `cmd.exe /c "start chrome --proxy-server=http://127.0.0.1:${port} --ignore-certificate-errors --user-data-dir=${userDataDir}"`
    
    return new Promise((resolve) => {
      exec(command, (error: any) => {
        if (error) {
          console.error('Failed to open browser:', error)
          resolve(false)
        } else {
          resolve(true)
        }
      })
    })
  })
}
