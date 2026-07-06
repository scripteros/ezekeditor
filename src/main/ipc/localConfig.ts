import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/constants'
import {
  initLocalConfigs,
  saveLocalUserAIConfigs,
  loadLocalUserAIConfigs,
  saveLocalUserSQLConfigs,
  loadLocalUserSQLConfigs,
} from '../services/localConfigService'

export function registerLocalConfigHandlers(): void {
  // Initialize local configs
  ipcMain.handle(IPC_CHANNELS.LOCAL_CONFIG_INIT, async () => {
    return initLocalConfigs()
  })

  // Save AI configs locally
  ipcMain.handle(IPC_CHANNELS.LOCAL_CONFIG_SAVE_AI, async (_event, userId: string, data: {
    acquiredAPIs?: string[]
    enabledAIProviders?: string[]
    savedConfigs?: any[]
    activeConfig?: any
    activeConfigId?: string | null
    chatHistories?: Record<string, any[]>
  }) => {
    return saveLocalUserAIConfigs(userId, data)
  })

  // Load AI configs locally
  ipcMain.handle(IPC_CHANNELS.LOCAL_CONFIG_LOAD_AI, async (_event, userId: string) => {
    return loadLocalUserAIConfigs(userId)
  })

  // Save SQL configs locally
  ipcMain.handle(IPC_CHANNELS.LOCAL_CONFIG_SAVE_SQL, async (_event, userId: string, data: {
    connections?: any[]
    redisServers?: any[]
    editorLayout?: string
    resultView?: string
  }) => {
    return saveLocalUserSQLConfigs(userId, data)
  })

  // Load SQL configs locally
  ipcMain.handle(IPC_CHANNELS.LOCAL_CONFIG_LOAD_SQL, async (_event, userId: string) => {
    return loadLocalUserSQLConfigs(userId)
  })
}
