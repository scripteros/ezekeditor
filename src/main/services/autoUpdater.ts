import { autoUpdater } from 'electron-updater'
import { BrowserWindow, ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/constants'

export function registerAutoUpdateHandlers(): void {
  // Configura o autoUpdater para preservar dados do usuário
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  // Não deleta userData — as configs salvas em .nova-data permanecem

  // Verificar updates manualmente
  ipcMain.handle(IPC_CHANNELS.AUTO_UPDATE_CHECK, async () => {
    try {
      const result = await autoUpdater.checkForUpdates()
      return {
        updateAvailable: !!result?.updateInfo?.version,
        version: result?.updateInfo?.version || null
      }
    } catch (err: any) {
      console.error('Update check error:', err)
      return { updateAvailable: false, error: err.message }
    }
  })

  // Instalar update (reinicia o app mantendo dados)
  ipcMain.handle(IPC_CHANNELS.AUTO_UPDATE_INSTALL, async () => {
    try {
      autoUpdater.quitAndInstall(false, true)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Eventos do autoUpdater
  autoUpdater.on('update-available', (info) => {
    console.log('[AutoUpdate] Update available:', info.version)
    const windows = BrowserWindow.getAllWindows()
    windows.forEach(w => w.webContents.send(IPC_CHANNELS.AUTO_UPDATE_AVAILABLE, info))
  })

  autoUpdater.on('download-progress', (progress) => {
    const windows = BrowserWindow.getAllWindows()
    windows.forEach(w => w.webContents.send(IPC_CHANNELS.AUTO_UPDATE_PROGRESS, {
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total
    }))
  })

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[AutoUpdate] Update downloaded:', info.version)
    const windows = BrowserWindow.getAllWindows()
    windows.forEach(w => w.webContents.send(IPC_CHANNELS.AUTO_UPDATE_DOWNLOADED, info))
  })

  autoUpdater.on('error', (err) => {
    console.error('[AutoUpdate] Error:', err.message)
  })
}
