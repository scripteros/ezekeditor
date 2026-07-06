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

  // File Explorer
  READ_DIRECTORY: 'file:readDirectory',
  READ_FILE: 'file:readFile',
  WRITE_FILE: 'file:writeFile',
  DELETE_FILE: 'file:deleteFile',
  CREATE_FILE: 'file:createFile',
  CREATE_DIRECTORY: 'file:createDirectory',
  RENAME_FILE: 'file:renameFile',
  GET_FILE_INFO: 'file:getFileInfo',
  
  SELECT_FOLDER: 'dialog:selectFolder',
  GET_HOME_DIR: 'app:getHomeDir',
  
  GET_GIT_STATUS: 'git:getStatus',
  GIT_COMMIT: 'git:commit',
  GIT_INIT: 'git:init',
  IS_GIT_REPO: 'git:isRepo',
  
  CREATE_TERMINAL: 'terminal:create',
  WRITE_TERMINAL: 'terminal:write',
  RESIZE_TERMINAL: 'terminal:resize',
  KILL_TERMINAL: 'terminal:kill',
  
  MINIMIZE_WINDOW: 'window:minimize',
  MAXIMIZE_WINDOW: 'window:maximize',
  CLOSE_WINDOW: 'window:close',
  IS_MAXIMIZED: 'window:isMaximized',
  
  WATCH_DIRECTORY: 'watcher:watch',
  UNWATCH_DIRECTORY: 'watcher:unwatch',
  
  FILE_CHANGED: 'event:fileChanged',
  TERMINAL_DATA: 'event:terminalData',
  TERMINAL_EXIT: 'event:terminalExit',
} as const
