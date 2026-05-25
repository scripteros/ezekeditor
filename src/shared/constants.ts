export const IPC_CHANNELS = {
  // IA
  AI_SEND_MESSAGE: 'ai:sendMessage',
  AI_CANCEL: 'ai:cancel',
  AI_TEST_CONNECTION: 'ai:testConnection',
  AI_LIST_MODELS: 'ai:listModels',
  AI_EXECUTE_COMMAND: 'ai:executeCommand',
  AI_GET_FILE: 'ai:getFile',
  AI_WRITE_FILE: 'ai:writeFile',
  AI_LIST_FILES: 'ai:listFiles',
  AI_LIST_ROUTEWAY_MODELS: 'ai:listRouteWayModels',
  AI_LIST_OPENROUTER_MODELS: 'ai:listOpenRouterModels',
  AI_LIST_DEEPSPROXY_MODELS: 'ai:listDeepsProxyModels',
  AI_CHECK_DEEPSPROXY: 'ai:checkDeepsProxy',
  AI_INSTALL_DEEPSPROXY: 'ai:installDeepsProxy',
  AI_LIST_KIMIPROXY_MODELS: 'ai:listKimiProxyModels',
  AI_CHECK_KIMIPROXY: 'ai:checkKimiProxy',
  AI_INSTALL_KIMIPROXY: 'ai:installKimiProxy',
  AI_START_PROXY: 'ai:startProxy',
  AI_STOP_PROXY: 'ai:stopProxy',

  // OS
  OS_SHOW_ITEM_IN_FOLDER: 'os:showItemInFolder',

  // File Explorer
  READ_DIRECTORY: 'file:readDirectory',
  READ_FILE: 'file:readFile',
  WRITE_FILE: 'file:writeFile',
  DELETE_FILE: 'file:deleteFile',
  CREATE_FILE: 'file:createFile',
  CREATE_DIRECTORY: 'file:createDirectory',
  RENAME_FILE: 'file:renameFile',
  GET_FILE_INFO: 'file:getFileInfo',
  
  // Dialog
  SELECT_FOLDER: 'dialog:selectFolder',
  GET_HOME_DIR: 'app:getHomeDir',
  
  // Editor
  GET_RECENT_FILES: 'editor:getRecentFiles',
  
  // SQL
  SQL_TEST_CONNECTION: 'sql:testConnection',
  SQL_EXECUTE_QUERY: 'sql:executeQuery',
  SQL_GET_CACHE: 'sql:getCache',
  SQL_CANCEL_QUERY: 'sql:cancelQuery',
  
  // Security
  SECURITY_START_PROXY: 'security:startProxy',
  SECURITY_STOP_PROXY: 'security:stopProxy',
  SECURITY_REQUEST_CAPTURED: 'security:requestCaptured',
  SECURITY_RESPONSE_CAPTURED: 'security:responseCaptured',
  SECURITY_OPEN_BROWSER: 'security:openBrowser',
  
  // LDAP
  LDAP_CONNECT: 'ldap:connect',
  LDAP_DISCONNECT: 'ldap:disconnect',
  LDAP_SEARCH_USERS: 'ldap:searchUsers',
  LDAP_SEARCH_GROUPS: 'ldap:searchGroups',
  
  // Git
  GET_GIT_STATUS: 'git:getStatus',
  GIT_COMMIT: 'git:commit',
  GIT_INIT: 'git:init',
  GIT_ADD: 'git:add',
  GIT_PUSH: 'git:push',
  GIT_PULL: 'git:pull',
  GIT_BRANCH: 'git:branch',
  GIT_CHECKOUT: 'git:checkout',
  GIT_LOG: 'git:log',
  GIT_EXECUTE_COMMAND: 'git:executeCommand',
  IS_GIT_REPO: 'git:isRepo',
  GIT_REMOTE_LIST: 'git:remoteList',
  GIT_REMOTE_ADD: 'git:remoteAdd',
  GIT_REMOTE_REMOVE: 'git:remoteRemove',
  
  // Terminal
  CREATE_TERMINAL: 'terminal:create',
  WRITE_TERMINAL: 'terminal:write',
  RESIZE_TERMINAL: 'terminal:resize',
  KILL_TERMINAL: 'terminal:kill',
  
  // Window Controls
  MINIMIZE_WINDOW: 'window:minimize',
  MAXIMIZE_WINDOW: 'window:maximize',
  CLOSE_WINDOW: 'window:close',
  IS_MAXIMIZED: 'window:isMaximized',
  
  // File Watcher
  WATCH_DIRECTORY: 'watcher:watch',
  UNWATCH_DIRECTORY: 'watcher:unwatch',
  
  // Events (main -> renderer)
  FILE_CHANGED: 'event:fileChanged',
  TERMINAL_DATA: 'event:terminalData',
  TERMINAL_EXIT: 'event:terminalExit',
} as const

export const DEFAULT_EDITOR_CONTENT = ''

export const LANGUAGE_MAP: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  json: 'json',
  html: 'html',
  css: 'css',
  scss: 'scss',
  less: 'less',
  md: 'markdown',
  py: 'python',
  rb: 'ruby',
  java: 'java',
  go: 'go',
  rs: 'rust',
  c: 'c',
  cpp: 'cpp',
  h: 'c',
  hpp: 'cpp',
  cs: 'csharp',
  php: 'php',
  swift: 'swift',
  kt: 'kotlin',
  sql: 'sql',
  sh: 'shell',
  bash: 'shell',
  yml: 'yaml',
  yaml: 'yaml',
  xml: 'xml',
  vue: 'html',
  svelte: 'html',
  graphql: 'graphql',
  dockerfile: 'dockerfile',
}

export const FILE_ICONS: Record<string, string> = {
  // Code
  js: 'FileCode',
  jsx: 'FileCode',
  ts: 'FileCode',
  tsx: 'FileCode',
  json: 'FileJson',
  html: 'FileCode',
  css: 'FileCss',
  scss: 'FileCss',
  md: 'FileText',
  py: 'FileCode',
  
  // Config
  gitignore: 'GitBranch',
  env: 'FileCog',
  
  // Media
  png: 'FileImage',
  jpg: 'FileImage',
  jpeg: 'FileImage',
  gif: 'FileImage',
  svg: 'FileImage',
  ico: 'FileImage',
  
  // Docs
  pdf: 'FileText',
  doc: 'FileText',
  docx: 'FileText',
}

export const TERMINAL_SHELLS: Record<string, string> = {
  win32: 'cmd.exe',
  linux: '/bin/bash',
  darwin: '/bin/zsh',
}
