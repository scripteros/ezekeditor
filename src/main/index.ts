import { app, BrowserWindow, nativeImage, nativeTheme, protocol, net } from 'electron'
import path from 'path'
import fs from 'fs'
import { registerAllIpcHandlers } from './ipc'
import { unwatchAll } from './services/watcherService'
import { killAllTerminals } from './ipc/terminal'

const isDev = !app.isPackaged

// Use local directory for user data to avoid sandbox restrictions
app.setPath('userData', path.join(app.getAppPath(), '.nova-data'))
app.setName('Ezek')
if (process.platform === 'win32') {
  app.setAppUserModelId('com.ezek.editor')
}

function resolveAssetPath(fileName: 'icon.ico' | 'ico.png' | 'logo.png'): string {
  const candidates = [
    path.join(app.getAppPath(), fileName),
    path.join(app.getAppPath(), 'src/renderer/public', fileName),
    path.join(app.getAppPath(), 'out/renderer', fileName),
  ]
  return candidates.find(candidate => fs.existsSync(candidate)) || candidates[0]
}

function createSplashWindow(iconPath: string, logoPath: string): BrowserWindow {
  const icon = nativeImage.createFromPath(iconPath)
  const logoData = fs.existsSync(logoPath)
    ? `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`
    : ''

  const splash = new BrowserWindow({
    width: 460,
    height: 300,
    resizable: false,
    movable: true,
    frame: false,
    show: false,
    transparent: false,
    alwaysOnTop: true,
    backgroundColor: '#06111f',
    icon,
  })

  const html = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            width: 100vw;
            height: 100vh;
            display: grid;
            place-items: center;
            overflow: hidden;
            color: #e8f3ff;
            font-family: "Segoe UI", Arial, sans-serif;
            background:
              radial-gradient(circle at 2px 2px, rgba(120, 144, 157, .28) 1px, transparent 1px),
              linear-gradient(145deg, #06111f 0%, #0b1b2b 100%);
            background-size: 18px 18px, auto;
            border: 1px solid #6757ff;
          }
          .wrap {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 18px;
          }
          img {
            width: 220px;
            max-height: 130px;
            object-fit: contain;
            filter: drop-shadow(0 18px 32px rgba(67, 230, 161, .18));
          }
          .bar {
            width: 180px;
            height: 3px;
            overflow: hidden;
            border-radius: 999px;
            background: rgba(174, 197, 207, .18);
          }
          .bar::before {
            content: "";
            display: block;
            width: 46%;
            height: 100%;
            border-radius: inherit;
            background: #43e6a1;
            animation: load 1.2s ease-in-out infinite;
          }
          .label {
            font-size: 11px;
            font-weight: 700;
            letter-spacing: .12em;
            text-transform: uppercase;
            color: #aec5cf;
          }
          @keyframes load {
            0% { transform: translateX(-110%); }
            100% { transform: translateX(230%); }
          }
        </style>
      </head>
      <body>
        <div class="wrap">
          <img src="${logoData}" alt="Ezek" />
          <div class="bar"></div>
          <div class="label">Inicializando Ezek</div>
        </div>
      </body>
    </html>
  `

  splash.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  splash.once('ready-to-show', () => splash.show())
  return splash
}

function resolveIconPath(): string {
  const icoPath = resolveAssetPath('icon.ico')
  return fs.existsSync(icoPath) ? icoPath : resolveAssetPath('ico.png')
}

function createWindow(splash?: BrowserWindow): BrowserWindow {
  nativeTheme.themeSource = 'dark'

  const iconPath = resolveIconPath()
  const icon = nativeImage.createFromPath(iconPath)

  const win = new BrowserWindow({
    title: 'Ezek',
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#1e1e1e',
    show: false,
    frame: false,
    icon,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
      webviewTag: true,
    },
  })
  win.setIcon(icon)

  win.once('ready-to-show', () => {
    setTimeout(() => {
      if (splash && !splash.isDestroyed()) {
        splash.close()
      }
      win.show()
    }, 650)
  })

  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  return win
}

protocol.registerSchemesAsPrivileged([
  { scheme: 'ezek', privileges: { bypassCSP: true, supportFetchAPI: true, secure: true, standard: true } }
])

app.whenReady().then(() => {
  protocol.handle('ezek', (request) => {
    let url = request.url.slice('ezek://'.length)
    // Handle Windows drive letters properly (e.g. ezek://C:/path -> C:/path)
    if (process.platform === 'win32' && url.startsWith('/')) {
      url = url.slice(1)
    }
    return net.fetch('file://' + decodeURIComponent(url))
  })

  registerAllIpcHandlers()
  const iconPath = resolveIconPath()
  const logoPath = resolveAssetPath('logo.png')
  const splash = createSplashWindow(iconPath, logoPath)
  createWindow(splash)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  unwatchAll()
  killAllTerminals()
})
