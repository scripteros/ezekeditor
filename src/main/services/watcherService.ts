import chokidar, { type FSWatcher } from 'chokidar'
import { BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '../../shared/constants'
import type { FileChangeEvent } from '../../shared/types'

const watchers = new Map<string, FSWatcher>()

export function watchDirectory(dirPath: string): void {
  if (watchers.has(dirPath)) {
    return
  }

  const watcher = chokidar.watch(dirPath, {
    ignored: [
      /(^|[\/\\])\../,
      /AppData/,
      /Cookies/,
      /Dados de Aplicativos/,
      /Configurações Locais/,
      /Ambiente de/,
      /Menu Iniciar/,
      /Meus Documentos/,
      /Minhas Imagens/,
      /Meus Vídeos/,
      /Temporary Internet/,
      /WindowsApps/,
    ],
    persistent: true,
    ignoreInitial: true,
    depth: 10,
    awaitWriteFinish: {
      stabilityThreshold: 300,
      pollInterval: 100,
    },
  })

  watcher
    .on('add', (filePath: string) => {
      sendEvent({ type: 'created', path: filePath })
    })
    .on('change', (filePath: string) => {
      sendEvent({ type: 'modified', path: filePath })
    })
    .on('unlink', (filePath: string) => {
      sendEvent({ type: 'deleted', path: filePath })
    })
    .on('addDir', (filePath: string) => {
      sendEvent({ type: 'created', path: filePath })
    })
    .on('unlinkDir', (filePath: string) => {
      sendEvent({ type: 'deleted', path: filePath })
    })
    .on('error', () => {
      // Silently ignore permission errors on Windows system folders
    })

  watchers.set(dirPath, watcher)
}

export function unwatchDirectory(dirPath: string): void {
  const watcher = watchers.get(dirPath)
  if (watcher) {
    watcher.close()
    watchers.delete(dirPath)
  }
}

export function unwatchAll(): void {
  for (const [dirPath, watcher] of watchers.entries()) {
    watcher.close()
    watchers.delete(dirPath)
  }
}

function sendEvent(event: FileChangeEvent): void {
  const windows = BrowserWindow.getAllWindows()
  for (const win of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send(IPC_CHANNELS.FILE_CHANGED, event)
    }
  }
}
