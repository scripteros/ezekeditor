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
import { registerAuthHandlers } from './auth'
import { registerLocalConfigHandlers } from './localConfig'
import { registerAutoUpdateHandlers } from '../services/autoUpdater'
import { registerOnlineUsersHandlers, unregisterOnlineUsers } from '../services/onlineUsers'
import { registerWinProcHandlers, setWinProcOwnerWindow } from './winproc'
import { watchDirectory, unwatchDirectory } from '../services/watcherService'
import { execSync, exec } from 'child_process'

export function registerAllIpcHandlers(): void {
  registerFileExplorerHandlers()
  registerWindowHandlers()
  registerGitHandlers()
  registerTerminalHandlers()
  registerAiHandlers()
  registerSqlHandlers()
  registerSecurityHandlers()
  registerLdapHandlers()
  registerAuthHandlers()
  registerLocalConfigHandlers()
  registerAutoUpdateHandlers()
  registerOnlineUsersHandlers()
  registerWinProcHandlers()

  ipcMain.handle(IPC_CHANNELS.WATCH_DIRECTORY, (_event, dirPath: string) => {
    watchDirectory(dirPath)
  })

  ipcMain.handle(IPC_CHANNELS.UNWATCH_DIRECTORY, (_event, dirPath: string) => {
    unwatchDirectory(dirPath)
  })

  // ─── Docker: Hermes Agent ─────────────────────────
  ipcMain.handle(IPC_CHANNELS.DOCKER_CHECK_HERMES, async () => {
    try {
      execSync('docker ps --format "{{.Names}}"', { timeout: 3000 })
      return { dockerInstalled: true }
    } catch {
      return { dockerInstalled: false }
    }
  })

  ipcMain.handle(IPC_CHANNELS.DOCKER_RUN_HERMES, async () => {
    try {
      // Verifica se Docker está disponível
      execSync('docker ps', { timeout: 3000 })
    } catch {
      return { success: false, error: 'Docker não encontrado. Instale o Docker Desktop primeiro.' }
    }

    // Verifica se já está rodando
    try {
      const running = execSync('docker ps --filter "name=hermes-agent" --format "{{.Names}}"', { timeout: 3000 }).toString().trim()
      if (running === 'hermes-agent') {
        return { success: true, message: 'Hermes Agent já está rodando!' }
      }
    } catch {} // ignore, container não existe

    // Verifica se o container existe mas está parado
    try {
      const exists = execSync('docker ps -a --filter "name=hermes-agent" --format "{{.Names}}"', { timeout: 3000 }).toString().trim()
      if (exists === 'hermes-agent') {
        execSync('docker start hermes-agent', { timeout: 10000 })
        return { success: true, message: 'Container hermes-agent iniciado!' }
      }
    } catch {} // não existe, criar novo

    // Pull e run
    return new Promise((resolve) => {
      exec('docker pull nvcr.io/nvidia/nim/nim-llm:latest', { timeout: 120000 }, (pullErr) => {
        if (pullErr) {
          // Fallback: tenta NVIDIA NIM com Hermes 3
          exec('docker run -d --name hermes-agent --runtime=nvidia --gpus all -p 1337:1337 nvcr.io/nvidia/nim/nim-llm:latest', { timeout: 60000 }, (runErr, stdout) => {
            if (runErr) {
              // Fallback: sem GPU
              exec('docker run -d --name hermes-agent -p 1337:1337 nvcr.io/nvidia/nim/nim-llm:latest', { timeout: 60000 }, (err2, out2) => {
                if (err2) resolve({ success: false, error: err2.message })
                else resolve({ success: true, message: `Container iniciado! ID: ${out2.trim().slice(0, 12)}` })
              })
            } else {
              resolve({ success: true, message: `Container iniciado! ID: ${stdout.trim().slice(0, 12)}` })
            }
          })
        } else {
          exec('docker run -d --name hermes-agent --runtime=nvidia --gpus all -p 1337:1337 nvcr.io/nvidia/nim/nim-llm:latest', { timeout: 60000 }, (runErr, stdout) => {
            if (runErr) {
              exec('docker run -d --name hermes-agent -p 1337:1337 nvcr.io/nvidia/nim/nim-llm:latest', { timeout: 60000 }, (err2, out2) => {
                if (err2) resolve({ success: false, error: err2.message })
                else resolve({ success: true, message: `Container iniciado! ${out2.trim().slice(0, 12)}` })
              })
            } else {
              resolve({ success: true, message: `Container iniciado! ${stdout.trim().slice(0, 12)}` })
            }
          })
        }
      })
    })
  })
}

export { unregisterOnlineUsers }
