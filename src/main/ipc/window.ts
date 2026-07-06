import { ipcMain, BrowserWindow, dialog } from 'electron'
import os from 'os'
import { IPC_CHANNELS } from '../../shared/constants'

function getWindow(event: Electron.IpcMainInvokeEvent): BrowserWindow | null {
  const win = BrowserWindow.fromWebContents(event.sender)
  return win && !win.isDestroyed() ? win : null
}

export function registerWindowHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.MINIMIZE_WINDOW, (event) => {
    const win = getWindow(event)
    if (win) win.minimize()
  })

  ipcMain.handle(IPC_CHANNELS.MAXIMIZE_WINDOW, (event) => {
    const win = getWindow(event)
    if (!win) return
    if (win.isMaximized()) {
      win.unmaximize()
    } else {
      win.maximize()
    }
  })

  ipcMain.handle(IPC_CHANNELS.CLOSE_WINDOW, (event) => {
    const win = getWindow(event)
    if (win) win.close()
  })

  ipcMain.handle(IPC_CHANNELS.IS_MAXIMIZED, (event) => {
    const win = getWindow(event)
    return win ? win.isMaximized() : false
  })

  ipcMain.handle(IPC_CHANNELS.SELECT_FOLDER, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
    })
    if (result.canceled || result.filePaths.length === 0) {
      return null
    }
    return result.filePaths[0]
  })

  ipcMain.handle(IPC_CHANNELS.GET_HOME_DIR, () => {
    return os.homedir()
  })
}
