import { app, BrowserWindow, nativeTheme, protocol, net } from 'electron'
import path from 'path'
import { registerAllIpcHandlers } from './ipc'
import { unwatchAll } from './services/watcherService'
import { killAllTerminals } from './ipc/terminal'

const isDev = !app.isPackaged

// Use local directory for user data to avoid sandbox restrictions
app.setPath('userData', path.join(app.getAppPath(), '.nova-data'))

function createWindow(): BrowserWindow {
  nativeTheme.themeSource = 'dark'

  const iconPath = path.join(app.getAppPath(), isDev ? 'src/renderer/public/ico.png' : 'out/renderer/public/ico.png')

  const win = new BrowserWindow({
    title: 'Ezek',
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#1e1e1e',
    show: false,
    frame: false,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
      webviewTag: true,
    },
  })

  win.once('ready-to-show', () => {
    win.show()
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
  createWindow()

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
