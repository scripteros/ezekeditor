import { ipcMain, BrowserWindow } from 'electron'
import { IPty, spawn } from 'node-pty'
import os from 'os'
import { execSync } from 'child_process'
import { IPC_CHANNELS } from '../../shared/constants'
import { TERMINAL_SHELLS } from '../../shared/constants'

const terminals = new Map<string, IPty>()
let terminalCounter = 0

function getDefaultShell(): string {
  if (os.platform() === 'win32') {
    return process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe'
  }
  return process.env.SHELL || TERMINAL_SHELLS[os.platform()] || '/bin/bash'
}

function getUserEnv(): NodeJS.ProcessEnv {
  return { ...process.env }
}

export function registerTerminalHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.CREATE_TERMINAL, (event, shell?: string, cwd?: string) => {
    const id = `terminal-${++terminalCounter}`
    const shellPath = shell || getDefaultShell()
    const win = BrowserWindow.fromWebContents(event.sender)
    const userEnv = getUserEnv()

    const shellArgs = os.platform() === 'win32' ? ['/K'] : []
    const resolvedCwd = cwd || os.homedir()
    console.log(`[CREATE_TERMINAL] shell=${shellPath} cwd=${cwd} resolvedCwd=${resolvedCwd}`)
    const ptyProcess = spawn(shellPath, shellArgs, {
      name: 'xterm-color',
      cols: 80,
      rows: 24,
      cwd: resolvedCwd,
      env: {
        ...userEnv,
        TERM: 'xterm-256color',
      } as { [key: string]: string },
    })

    ptyProcess.onData((data: string) => {
      if (win && !win.isDestroyed()) {
        win.webContents.send(IPC_CHANNELS.TERMINAL_DATA, { terminalId: id, data })
      }
    })

    ptyProcess.onExit(({ exitCode }) => {
      terminals.delete(id)
      if (win && !win.isDestroyed()) {
        win.webContents.send(IPC_CHANNELS.TERMINAL_EXIT, { terminalId: id, code: exitCode })
      }
    })

    terminals.set(id, ptyProcess)

    return id
  })

  ipcMain.handle(IPC_CHANNELS.WRITE_TERMINAL, (_event, terminalId: string, data: string) => {
    const terminal = terminals.get(terminalId)
    if (terminal) {
      terminal.write(data)
    }
  })

  ipcMain.handle(IPC_CHANNELS.RESIZE_TERMINAL, (_event, terminalId: string, cols: number, rows: number) => {
    const terminal = terminals.get(terminalId)
    if (terminal) {
      terminal.resize(cols, rows)
    }
  })

  ipcMain.handle(IPC_CHANNELS.KILL_TERMINAL, (_event, terminalId: string) => {
    const terminal = terminals.get(terminalId)
    if (terminal) {
      terminal.kill()
      terminals.delete(terminalId)
    }
  })
}

export function killAllTerminals(): void {
  for (const [id, terminal] of terminals.entries()) {
    terminal.kill()
    terminals.delete(id)
  }
}
