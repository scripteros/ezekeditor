import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/constants'
import type { FileNode, GitStatus, FileChangeEvent } from '../shared/types'

const api = {
  readDirectory: (dirPath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.READ_DIRECTORY, dirPath) as Promise<FileNode[]>,

  readFile: (filePath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.READ_FILE, filePath) as Promise<string>,

  writeFile: (filePath: string, content: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.WRITE_FILE, filePath, content) as Promise<void>,

  deleteFile: (filePath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.DELETE_FILE, filePath) as Promise<void>,

  createFile: (filePath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.CREATE_FILE, filePath) as Promise<void>,

  createDirectory: (dirPath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.CREATE_DIRECTORY, dirPath) as Promise<void>,

  renameFile: (oldPath: string, newPath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.RENAME_FILE, oldPath, newPath) as Promise<void>,

  getFileInfo: (filePath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_FILE_INFO, filePath) as Promise<FileNode>,

  selectFolder: () =>
    ipcRenderer.invoke(IPC_CHANNELS.SELECT_FOLDER) as Promise<string | null>,

  getHomeDir: () =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_HOME_DIR) as Promise<string>,

  getRecentFiles: () =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_RECENT_FILES) as Promise<string[]>,

  getGitStatus: (repoPath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_GIT_STATUS, repoPath) as Promise<GitStatus | null>,

  gitCommit: (repoPath: string, message: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.GIT_COMMIT, repoPath, message) as Promise<void>,

  gitInit: (repoPath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.GIT_INIT, repoPath) as Promise<void>,

  isGitRepo: (repoPath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.IS_GIT_REPO, repoPath) as Promise<boolean>,

  gitAdd: (repoPath: string, files?: string[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.GIT_ADD, repoPath, files) as Promise<void>,

  gitPush: (repoPath: string, remote?: string, branch?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.GIT_PUSH, repoPath, remote, branch) as Promise<void>,

  gitPull: (repoPath: string, remote?: string, branch?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.GIT_PULL, repoPath, remote, branch) as Promise<void>,

  gitBranch: (repoPath: string, branchName?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.GIT_BRANCH, repoPath, branchName) as Promise<string[]>,

  gitCheckout: (repoPath: string, branch: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.GIT_CHECKOUT, repoPath, branch) as Promise<void>,

  gitLog: (repoPath: string, maxCount?: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.GIT_LOG, repoPath, maxCount) as Promise<any[]>,

  gitRemoteList: (repoPath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.GIT_REMOTE_LIST, repoPath) as Promise<{name: string, url: string}[]>,

  gitRemoteAdd: (repoPath: string, name: string, url: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.GIT_REMOTE_ADD, repoPath, name, url) as Promise<void>,

  gitRemoteRemove: (repoPath: string, name: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.GIT_REMOTE_REMOVE, repoPath, name) as Promise<void>,

  createTerminal: (shell?: string, cwd?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.CREATE_TERMINAL, shell, cwd) as Promise<string>,

  writeToTerminal: (terminalId: string, data: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.WRITE_TERMINAL, terminalId, data) as Promise<void>,

  resizeTerminal: (terminalId: string, cols: number, rows: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.RESIZE_TERMINAL, terminalId, cols, rows) as Promise<void>,

  killTerminal: (terminalId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.KILL_TERMINAL, terminalId) as Promise<void>,

  minimizeWindow: () =>
    ipcRenderer.invoke(IPC_CHANNELS.MINIMIZE_WINDOW) as Promise<void>,

  maximizeWindow: () =>
    ipcRenderer.invoke(IPC_CHANNELS.MAXIMIZE_WINDOW) as Promise<void>,

  closeWindow: () =>
    ipcRenderer.invoke(IPC_CHANNELS.CLOSE_WINDOW) as Promise<void>,

  isMaximized: () =>
    ipcRenderer.invoke(IPC_CHANNELS.IS_MAXIMIZED) as Promise<boolean>,

  // IA
  aiSendMessage: (message: string, history: any[], config: any, workspacePath: string, chatId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.AI_SEND_MESSAGE, message, history, config, workspacePath, chatId) as Promise<string>,

  aiCancelRequest: () =>
    ipcRenderer.invoke(IPC_CHANNELS.AI_CANCEL) as Promise<void>,

  aiTestConnection: (config: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.AI_TEST_CONNECTION, config) as Promise<{ ok: boolean; error?: string }>,

  aiListModels: (baseUrl?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.AI_LIST_MODELS, baseUrl) as Promise<string[]>,

  aiExecuteCommand: (command: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.AI_EXECUTE_COMMAND, command) as Promise<{ stdout: string; stderr: string }>,

  aiGetFile: (filePath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.AI_GET_FILE, filePath) as Promise<{ content: string; exists: boolean }>,

  aiWriteFile: (filePath: string, content: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.AI_WRITE_FILE, filePath, content) as Promise<{ success: boolean }>,

  aiListFiles: (dirPath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.AI_LIST_FILES, dirPath) as Promise<any[]>,

  aiListRouteWayModels: () =>
    ipcRenderer.invoke(IPC_CHANNELS.AI_LIST_ROUTEWAY_MODELS) as Promise<any[]>,

  aiListOpenRouterModels: () =>
    ipcRenderer.invoke(IPC_CHANNELS.AI_LIST_OPENROUTER_MODELS) as Promise<any[]>,

  aiStartVoiceServer: () =>
    ipcRenderer.invoke('ai:startVoiceServer') as Promise<{ success: boolean; error?: string }>,

  aiListDeepsProxyModels: () =>
    ipcRenderer.invoke(IPC_CHANNELS.AI_LIST_DEEPSPROXY_MODELS) as Promise<any[]>,

  aiCheckDeepsProxy: () =>
    ipcRenderer.invoke(IPC_CHANNELS.AI_CHECK_DEEPSPROXY) as Promise<{ installed: boolean, path: string }>,

  aiInstallDeepsProxy: () =>
    ipcRenderer.invoke(IPC_CHANNELS.AI_INSTALL_DEEPSPROXY) as Promise<boolean>,

  aiListKimiProxyModels: () =>
    ipcRenderer.invoke(IPC_CHANNELS.AI_LIST_KIMIPROXY_MODELS) as Promise<any[]>,

  aiCheckKimiProxyInstalled: () =>
    ipcRenderer.invoke(IPC_CHANNELS.AI_CHECK_KIMIPROXY) as Promise<{ installed: boolean, path: string }>,

  aiInstallKimiProxy: () =>
    ipcRenderer.invoke(IPC_CHANNELS.AI_INSTALL_KIMIPROXY) as Promise<boolean>,

  aiListGeminiProxyModels: () =>
    ipcRenderer.invoke(IPC_CHANNELS.AI_LIST_GEMINIPROXY_MODELS) as Promise<any[]>,

  aiCheckGeminiProxyInstalled: () =>
    ipcRenderer.invoke(IPC_CHANNELS.AI_CHECK_GEMINIPROXY) as Promise<{ installed: boolean, path: string }>,

  aiInstallGeminiProxy: () =>
    ipcRenderer.invoke(IPC_CHANNELS.AI_INSTALL_GEMINIPROXY) as Promise<boolean>,

  aiUninstallProxy: (proxyType: 'deepsproxy' | 'kimiproxy' | 'geminiproxy') =>
    ipcRenderer.invoke(IPC_CHANNELS.AI_UNINSTALL_PROXY, proxyType) as Promise<boolean>,

  aiStartProxy: (proxyType: 'deepsproxy' | 'kimiproxy' | 'geminiproxy') =>
    ipcRenderer.invoke(IPC_CHANNELS.AI_START_PROXY, proxyType) as Promise<boolean>,

  aiStopProxy: (proxyType: 'deepsproxy' | 'kimiproxy' | 'geminiproxy') =>
    ipcRenderer.invoke(IPC_CHANNELS.AI_STOP_PROXY, proxyType) as Promise<boolean>,

  osShowItemInFolder: (path: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.OS_SHOW_ITEM_IN_FOLDER, path) as Promise<void>,

  onAiInstallLog: (callback: (log: string) => void) => {
    const handler = (_event: any, log: string) => callback(log)
    ipcRenderer.on('ai:installLog', handler)
    return () => ipcRenderer.removeListener('ai:installLog', handler)
  },

  onAiStreamEvent: (callback: (event: any) => void) => {
    const handler = (_event: any, data: any) => callback(data)
    ipcRenderer.on('ai:streamEvent', handler)
    return () => ipcRenderer.removeListener('ai:streamEvent', handler)
  },

  onProxyStatusChange: (callback: (proxyType: string, status: 'online' | 'offline' | 'error') => void) => {
    const handler = (_event: any, proxyType: string, status: 'online' | 'offline' | 'error') => callback(proxyType, status)
    ipcRenderer.on('ai:proxyStatusChange', handler)
    return () => ipcRenderer.removeListener('ai:proxyStatusChange', handler)
  },

  watchDirectory: (dirPath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.WATCH_DIRECTORY, dirPath) as Promise<void>,

  unwatchDirectory: (dirPath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.UNWATCH_DIRECTORY, dirPath) as Promise<void>,

  onFileChanged: (callback: (event: FileChangeEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: FileChangeEvent) =>
      callback(data)
    ipcRenderer.on(IPC_CHANNELS.FILE_CHANGED, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.FILE_CHANGED, handler)
  },

  onTerminalData: (callback: (data: { terminalId: string; data: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { terminalId: string; data: string }) =>
      callback(data)
    ipcRenderer.on(IPC_CHANNELS.TERMINAL_DATA, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.TERMINAL_DATA, handler)
  },

  onTerminalExit: (callback: (data: { terminalId: string; code: number | null }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { terminalId: string; code: number | null }) =>
      callback(data)
    ipcRenderer.on(IPC_CHANNELS.TERMINAL_EXIT, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.TERMINAL_EXIT, handler)
  },

  sqlTestConnection: (config: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.SQL_TEST_CONNECTION, config) as Promise<{ success: boolean; error?: string }>,

  sqlTestRedisConnection: (config: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.SQL_TEST_REDIS_CONNECTION, config) as Promise<{ success: boolean; error?: string }>,

  sqlExecuteQuery: (config: any, query: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SQL_EXECUTE_QUERY, config, query) as Promise<any>,

  sqlGetCache: (config: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.SQL_GET_CACHE, config) as Promise<any[]>,

  sqlCancelQuery: (config: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.SQL_CANCEL_QUERY, config) as Promise<void>,

  securityStartProxy: (port: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.SECURITY_START_PROXY, port) as Promise<boolean>,

  securityStopProxy: () =>
    ipcRenderer.invoke(IPC_CHANNELS.SECURITY_STOP_PROXY) as Promise<boolean>,

  securityOpenBrowser: (port: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.SECURITY_OPEN_BROWSER, port) as Promise<boolean>,

  onSecurityRequestCaptured: (callback: (req: any) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: any) => callback(data)
    ipcRenderer.on(IPC_CHANNELS.SECURITY_REQUEST_CAPTURED, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.SECURITY_REQUEST_CAPTURED, handler)
  },

  onSecurityResponseCaptured: (callback: (res: any) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: any) => callback(data)
    ipcRenderer.on(IPC_CHANNELS.SECURITY_RESPONSE_CAPTURED, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.SECURITY_RESPONSE_CAPTURED, handler)
  },

  ldapConnect: (config: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.LDAP_CONNECT, config) as Promise<{ success: boolean; error?: string }>,

  ldapDisconnect: () =>
    ipcRenderer.invoke(IPC_CHANNELS.LDAP_DISCONNECT) as Promise<{ success: boolean; error?: string }>,

  ldapSearchUsers: (filter?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.LDAP_SEARCH_USERS, filter) as Promise<{ success: boolean; data?: any[]; error?: string }>,

  ldapSearchGroups: (filter?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.LDAP_SEARCH_GROUPS, filter) as Promise<{ success: boolean; data?: any[]; error?: string }>,
}


contextBridge.exposeInMainWorld('api', api)
