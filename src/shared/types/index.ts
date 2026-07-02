export interface FileNode {
  name: string
  path: string
  isDirectory: boolean
  children?: FileNode[]
  size?: number
  modifiedAt?: Date
}

export interface OpenTab {
  id: string
  filePath: string
  fileName: string
  isDirty: boolean
  content: string
  language: string
}

export interface TerminalInstance {
  id: string
  name: string
  shell: string
  cwd: string
}

export interface GitStatus {
  currentBranch: string
  changes: GitChange[]
  staged: GitChange[]
  unstaged: GitChange[]
  ahead: number
  behind: number
}

export interface GitCommit {
  hash: string
  date: string
  message: string
  author_name: string
  author_email: string
}

export interface GitChange {
  path: string
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked'
}

export interface ThemeConfig {
  id: string
  name: string
  type: 'dark' | 'light'
  colors: Record<string, string>
  tokenColors?: Record<string, string>
}

export interface Command {
  id: string
  label: string
  description?: string
  category?: string
  shortcut?: string
  icon?: string
  action: () => void
}

export interface ExtensionAPI {
  activate(): void
  deactivate(): void
}

export interface FileChangeEvent {
  type: 'created' | 'modified' | 'deleted'
  path: string
}

export interface IPCApi {
  // File Explorer
  readDirectory: (dirPath: string) => Promise<FileNode[]>
  readFile: (filePath: string) => Promise<string>
  writeFile: (filePath: string, content: string) => Promise<void>
  deleteFile: (filePath: string) => Promise<void>
  createFile: (filePath: string) => Promise<void>
  createDirectory: (dirPath: string) => Promise<void>
  renameFile: (oldPath: string, newPath: string) => Promise<void>
  getFileInfo: (filePath: string) => Promise<FileNode>
  
  // Dialog
  selectFolder: () => Promise<string | null>
  getHomeDir: () => Promise<string>
  
  // Editor
  getRecentFiles: () => Promise<string[]>
  
  // Git
  getGitStatus: (repoPath: string) => Promise<GitStatus | null>
  gitCommit: (repoPath: string, message: string) => Promise<void>
  gitInit: (repoPath: string) => Promise<void>
  gitAdd: (repoPath: string, files?: string[]) => Promise<void>
  gitPush: (repoPath: string, remote?: string, branch?: string) => Promise<void>
  gitPull: (repoPath: string, remote?: string, branch?: string) => Promise<void>
  gitBranch: (repoPath: string, branchName?: string) => Promise<string[]>
  gitCheckout: (repoPath: string, branch: string) => Promise<void>
  gitLog: (repoPath: string, maxCount?: number) => Promise<GitCommit[]>
  gitExecuteCommand: (repoPath: string, command: string) => Promise<string>
  isGitRepo: (repoPath: string) => Promise<boolean>
  
  // Terminal
  createTerminal: (shell?: string, cwd?: string) => Promise<string>
  writeToTerminal: (terminalId: string, data: string) => Promise<void>
  resizeTerminal: (terminalId: string, cols: number, rows: number) => Promise<void>
  killTerminal: (terminalId: string) => Promise<void>
  
  // Window
  minimizeWindow: () => void
  maximizeWindow: () => void
  closeWindow: () => void
  isMaximized: () => Promise<boolean>
  
  // File Watcher
  watchDirectory: (dirPath: string) => void
  unwatchDirectory: (dirPath: string) => void
  
  // IA
  aiSendMessage: (message: string, history: any[], config: any) => Promise<string>
  aiCancelRequest: () => Promise<void>
  aiTestConnection: (config: any) => Promise<boolean>
  aiExecuteCommand: (command: string) => Promise<{ stdout: string; stderr: string }>
  aiGetFile: (filePath: string) => Promise<{ content: string; exists: boolean }>
  aiWriteFile: (filePath: string, content: string) => Promise<{ success: boolean }>
  aiListFiles: (dirPath: string) => Promise<any[]>
  aiListModels: (baseUrl?: string) => Promise<string[]>
  aiListRouteWayModels: () => Promise<any[]>
  aiListOpenRouterModels: () => Promise<any[]>

  // SQL
  sqlTestConnection: (config: any) => Promise<{ success: boolean; error?: string }>
  sqlTestRedisConnection: (config: any) => Promise<{ success: boolean; error?: string }>
  sqlExecuteQuery: (config: any, query: string) => Promise<any>
  sqlGetCache: (config: any) => Promise<any[]>
  sqlCancelQuery: (config: any) => Promise<void>

  // Security
  securityStartProxy: (port: number) => Promise<boolean>
  securityStopProxy: () => Promise<boolean>
  securityOpenBrowser: () => Promise<{ ok: boolean; partition: string }>
  securityStartMonitoring: () => Promise<{ ok: boolean; partition: string }>
  securityStopMonitoring: () => Promise<boolean>
  securityGetCookies: (url?: string) => Promise<any[]>
  securityClearBrowserData: () => Promise<boolean>
  securityReplayRequest: (request: { method: string; url: string; headers?: Record<string, string>; body?: string }) => Promise<any>
  securityStartMitm: (port?: number) => Promise<{ ok: boolean; port: number; caPath: string; proxyRules: string }>
  securityStopMitm: () => Promise<boolean>
  securityOpenCaCert: () => Promise<string | null>
  onSecurityRequestCaptured: (callback: (req: any) => void) => () => void
  onSecurityResponseCaptured: (callback: (res: any) => void) => () => void
  onSecurityBrowserEvent: (callback: (event: any) => void) => () => void
  
  // OS
  osShowItemInFolder: (path: string) => Promise<void>
  
  // Auth
  authInit: () => Promise<{ success: boolean; error?: string }>
  authLogin: (data: { usuario: string; senha: string }) => Promise<{ success: boolean; user?: { id: number; nome: string; usuario: string }; error?: string }>
  authRegister: (data: { nome: string; usuario: string; senha: string }) => Promise<{ success: boolean; user?: { nome: string; usuario: string }; error?: string }>

  // AI
  aiSaveAndOpenDashboard: (htmlContent: string) => Promise<{ success: boolean; filePath?: string; filename?: string; error?: string }>
  
  // Events
  onFileChanged: (callback: (event: FileChangeEvent) => void) => () => void
  onTerminalData: (callback: (data: { terminalId: string; data: string }) => void) => () => void
  onTerminalExit: (callback: (data: { terminalId: string; code: number | null }) => void) => () => void
}

export * from './ai'

declare global {
  interface Window {
    api: IPCApi
  }
}
