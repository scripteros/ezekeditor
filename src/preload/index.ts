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

  osShowItemInFolder: (path: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.OS_SHOW_ITEM_IN_FOLDER, path) as Promise<void>,

  aiSaveAndOpenDashboard: (htmlContent: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.AI_SAVE_AND_OPEN_DASHBOARD, htmlContent) as Promise<{ success: boolean; filePath?: string; filename?: string; error?: string }>,

  onAiStreamEvent: (callback: (event: any) => void) => {
    const handler = (_event: any, data: any) => callback(data)
    ipcRenderer.on('ai:streamEvent', handler)
    return () => ipcRenderer.removeListener('ai:streamEvent', handler)
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

  sqlExecuteQuery: (config: any, query: string, userId?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SQL_EXECUTE_QUERY, config, query, userId) as Promise<any>,

  sqlGetCache: (config: any, userId?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SQL_GET_CACHE, config, userId) as Promise<any[]>,

  sqlCancelQuery: (config: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.SQL_CANCEL_QUERY, config) as Promise<void>,

  securityStartProxy: (port: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.SECURITY_START_PROXY, port) as Promise<boolean>,

  securityStopProxy: () =>
    ipcRenderer.invoke(IPC_CHANNELS.SECURITY_STOP_PROXY) as Promise<boolean>,

  securityOpenBrowser: () =>
    ipcRenderer.invoke(IPC_CHANNELS.SECURITY_OPEN_BROWSER) as Promise<{ ok: boolean; partition: string }>,

  securityStartMonitoring: () =>
    ipcRenderer.invoke(IPC_CHANNELS.SECURITY_START_MONITORING) as Promise<{ ok: boolean; partition: string }>,

  securityStopMonitoring: () =>
    ipcRenderer.invoke(IPC_CHANNELS.SECURITY_STOP_MONITORING) as Promise<boolean>,

  securityGetCookies: (url?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SECURITY_GET_COOKIES, url) as Promise<any[]>,

  securityClearBrowserData: () =>
    ipcRenderer.invoke(IPC_CHANNELS.SECURITY_CLEAR_BROWSER_DATA) as Promise<boolean>,

  securityReplayRequest: (request: { method: string; url: string; headers?: Record<string, string>; body?: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.SECURITY_REPLAY_REQUEST, request) as Promise<any>,

  securityPentestRequest: (options: { url: string; method?: string; headers?: Record<string, string>; body?: string; timeout?: number }) =>
    ipcRenderer.invoke(IPC_CHANNELS.SECURITY_PENTEST_REQUEST, options) as Promise<{ status: number; statusText: string; headers: Record<string, string>; body: string; durationMs: number }>,

  securityStartMitm: (port?: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.SECURITY_START_MITM, port) as Promise<{ ok: boolean; port: number; caPath: string; proxyRules: string }>,

  securityStopMitm: () =>
    ipcRenderer.invoke(IPC_CHANNELS.SECURITY_STOP_MITM) as Promise<boolean>,

  securityOpenCaCert: () =>
    ipcRenderer.invoke(IPC_CHANNELS.SECURITY_OPEN_CA_CERT) as Promise<string | null>,

  securityOpenHtmlInBrowser: (htmlContent: string, filename?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SECURITY_OPEN_HTML_IN_BROWSER, htmlContent, filename) as Promise<string>,

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

  onSecurityBrowserEvent: (callback: (event: any) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: any) => callback(data)
    ipcRenderer.on(IPC_CHANNELS.SECURITY_BROWSER_EVENT, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.SECURITY_BROWSER_EVENT, handler)
  },

  securityInterceptEnable: () =>
    ipcRenderer.invoke(IPC_CHANNELS.SECURITY_INTERCEPT_ENABLE) as Promise<boolean>,

  securityInterceptDisable: () =>
    ipcRenderer.invoke(IPC_CHANNELS.SECURITY_INTERCEPT_DISABLE) as Promise<boolean>,

  securityInterceptAction: (action: { interceptId: string; type: 'forward' | 'drop'; method?: string; url?: string; headers?: Record<string, string>; body?: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.SECURITY_INTERCEPT_ACTION, action) as Promise<boolean>,

  onSecurityInterceptPending: (callback: (data: any) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: any) => callback(data)
    ipcRenderer.on(IPC_CHANNELS.SECURITY_INTERCEPT_PENDING, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.SECURITY_INTERCEPT_PENDING, handler)
  },

  ldapConnect: (config: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.LDAP_CONNECT, config) as Promise<{ success: boolean; error?: string }>,

  ldapDisconnect: () =>
    ipcRenderer.invoke(IPC_CHANNELS.LDAP_DISCONNECT) as Promise<{ success: boolean; error?: string }>,

  ldapSearchUsers: (filter?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.LDAP_SEARCH_USERS, filter) as Promise<{ success: boolean; data?: any[]; error?: string }>,

  ldapSearchGroups: (filter?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.LDAP_SEARCH_GROUPS, filter) as Promise<{ success: boolean; data?: any[]; error?: string }>,

  authInit: () =>
    ipcRenderer.invoke(IPC_CHANNELS.AUTH_INIT) as Promise<{ success: boolean; error?: string }>,

  authLogin: (data: { usuario: string; senha: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.AUTH_LOGIN, data) as Promise<{ success: boolean; user?: { id: number; nome: string; usuario: string }; error?: string }>,

  authRegister: (data: { nome: string; usuario: string; senha: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.AUTH_REGISTER, data) as Promise<{ success: boolean; user?: { nome: string; usuario: string }; error?: string }>,

  userSaveConfig: (userId: number, key: string, value: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.USER_SAVE_CONFIG, userId, key, value) as Promise<{ success: boolean; error?: string }>,

  userLoadConfigs: (userId: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.USER_LOAD_CONFIGS, userId) as Promise<{ success: boolean; configs?: Record<string, any>; error?: string }>,

  userSaveAiConfigs: (userId: number, data: {
    acquiredAPIs: string[]
    enabledAIProviders: string[]
    savedConfigs: any[]
    activeConfig: any
    activeConfigId: string | null
    chatHistories: Record<string, any[]>
  }) =>
    ipcRenderer.invoke(IPC_CHANNELS.USER_SAVE_AI_CONFIGS, userId, data) as Promise<{ success: boolean; error?: string }>,

  userLoadAiConfigs: (userId: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.USER_LOAD_AI_CONFIGS, userId) as Promise<{ success: boolean; configs?: Record<string, any>; error?: string }>,

  // Auto Update
  checkForUpdate: () =>
    ipcRenderer.invoke(IPC_CHANNELS.AUTO_UPDATE_CHECK) as Promise<{ updateAvailable: boolean; version?: string; error?: string }>,

  installUpdate: () =>
    ipcRenderer.invoke(IPC_CHANNELS.AUTO_UPDATE_INSTALL) as Promise<{ success: boolean; error?: string }>,

  onAutoUpdateAvailable: (callback: (info: any) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: any) => callback(data)
    ipcRenderer.on(IPC_CHANNELS.AUTO_UPDATE_AVAILABLE, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.AUTO_UPDATE_AVAILABLE, handler)
  },

  onAutoUpdateProgress: (callback: (progress: any) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: any) => callback(data)
    ipcRenderer.on(IPC_CHANNELS.AUTO_UPDATE_PROGRESS, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.AUTO_UPDATE_PROGRESS, handler)
  },

  onAutoUpdateDownloaded: (callback: (info: any) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: any) => callback(data)
    ipcRenderer.on(IPC_CHANNELS.AUTO_UPDATE_DOWNLOADED, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.AUTO_UPDATE_DOWNLOADED, handler)
  },

  // Online Users
  getOnlineCount: () =>
    ipcRenderer.invoke(IPC_CHANNELS.USERS_ONLINE_COUNT) as Promise<{ count: number; error?: string }>,

  onUsersOnlineChanged: (callback: (data: { count: number }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { count: number }) => callback(data)
    ipcRenderer.on(IPC_CHANNELS.USERS_ONLINE_EVENT, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.USERS_ONLINE_EVENT, handler)
  },

  // Docker
  dockerCheckHermes: () =>
    ipcRenderer.invoke(IPC_CHANNELS.DOCKER_CHECK_HERMES) as Promise<{ dockerInstalled: boolean }>,

  dockerRunHermes: () =>
    ipcRenderer.invoke(IPC_CHANNELS.DOCKER_RUN_HERMES) as Promise<{ success: boolean; message?: string; error?: string }>,
}


contextBridge.exposeInMainWorld('api', api)
