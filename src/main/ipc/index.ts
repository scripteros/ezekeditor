import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/constants'
import { registerFileExplorerHandlers } from './fileExplorer'
import { registerWindowHandlers } from './window'
import { registerGitHandlers } from './git'
import { registerTerminalHandlers } from './terminal'
import { registerAiHandlers } from './ai'
import { registerSqlHandlers } from './sql'
import { registerSecurityHandlers } from './security'
import { registerLdapHandlers } from './ldap'
import { watchDirectory, unwatchDirectory } from '../services/watcherService'

export function registerAllIpcHandlers(): void {
  registerFileExplorerHandlers()
  registerWindowHandlers()
  registerGitHandlers()
  registerTerminalHandlers()
  registerAiHandlers()
  registerSqlHandlers()
  registerSecurityHandlers()
  registerLdapHandlers()

  ipcMain.handle(IPC_CHANNELS.WATCH_DIRECTORY, (_event, dirPath: string) => {
    watchDirectory(dirPath)
  })

  ipcMain.handle(IPC_CHANNELS.UNWATCH_DIRECTORY, (_event, dirPath: string) => {
    unwatchDirectory(dirPath)
  })
}
