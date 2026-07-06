import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'

interface LocalUserConfigs {
  [userId: string]: {
    ai?: {
      acquiredAPIs?: string[]
      enabledAIProviders?: string[]
      savedConfigs?: any[]
      activeConfig?: any
      activeConfigId?: string | null
      chatHistories?: Record<string, any[]>
      skills?: any[]
    }
    sql?: {
      connections?: any[]
      redisServers?: any[]
      editorLayout?: string
      resultView?: string
    }
    [key: string]: any
  }
}

function getLocalConfigsPath(): string {
  const userDataPath = app.getPath('userData')
  return path.join(userDataPath, 'local_configs.json')
}

function loadConfigs(): LocalUserConfigs {
  const filePath = getLocalConfigsPath()
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8')
      return JSON.parse(data)
    }
  } catch (err) {
    console.error('Error loading local configs:', err)
  }
  return {}
}

function saveConfigs(configs: LocalUserConfigs): void {
  const filePath = getLocalConfigsPath()
  fs.writeFileSync(filePath, JSON.stringify(configs, null, 2), 'utf-8')
}

export function initLocalConfigs(): { success: boolean; error?: string } {
  try {
    const filePath = getLocalConfigsPath()
    if (!fs.existsSync(filePath)) {
      saveConfigs({})
    }
    return { success: true }
  } catch (err: any) {
    console.error('Init local configs error:', err)
    return { success: false, error: err.message }
  }
}

export function saveLocalUserConfig(userId: string, key: string, data: any): { success: boolean; error?: string } {
  try {
    const configs = loadConfigs()
    if (!configs[userId]) {
      configs[userId] = {}
    }
    if (!configs[userId][key]) {
      configs[userId][key] = {}
    }
    configs[userId][key] = { ...configs[userId][key], ...data }
    saveConfigs(configs)
    return { success: true }
  } catch (err: any) {
    console.error('Save local user config error:', err)
    return { success: false, error: err.message }
  }
}

export function loadLocalUserConfigs(userId: string): { success: boolean; configs?: LocalUserConfigs[string]; error?: string } {
  try {
    const configs = loadConfigs()
    return { success: true, configs: configs[userId] }
  } catch (err: any) {
    console.error('Load local user configs error:', err)
    return { success: false, error: err.message }
  }
}

export function loadLocalUserAIConfigs(userId: string): { success: boolean; configs?: any; error?: string } {
  try {
    const configs = loadConfigs()
    const userConfigs = configs[userId]?.ai
    return { success: true, configs: userConfigs }
  } catch (err: any) {
    console.error('Load local user AI configs error:', err)
    return { success: false, error: err.message }
  }
}

export function saveLocalUserAIConfigs(userId: string, data: {
  acquiredAPIs?: string[]
  enabledAIProviders?: string[]
  savedConfigs?: any[]
  activeConfig?: any
  activeConfigId?: string | null
  chatHistories?: Record<string, any[]>
  skills?: any[]
}): { success: boolean; error?: string } {
  try {
    const configs = loadConfigs()
    if (!configs[userId]) {
      configs[userId] = {}
    }
    configs[userId].ai = {
      acquiredAPIs: data.acquiredAPIs ?? configs[userId]?.ai?.acquiredAPIs ?? [],
      enabledAIProviders: data.enabledAIProviders ?? configs[userId]?.ai?.enabledAIProviders ?? [],
      savedConfigs: data.savedConfigs ?? configs[userId]?.ai?.savedConfigs ?? [],
      activeConfig: data.activeConfig ?? configs[userId]?.ai?.activeConfig ?? {},
      activeConfigId: data.activeConfigId ?? configs[userId]?.ai?.activeConfigId ?? null,
      chatHistories: data.chatHistories ?? configs[userId]?.ai?.chatHistories ?? {},
      skills: data.skills ?? configs[userId]?.ai?.skills ?? [],
    }
    saveConfigs(configs)
    return { success: true }
  } catch (err: any) {
    console.error('Save local user AI configs error:', err)
    return { success: false, error: err.message }
  }
}

export function loadLocalUserSQLConfigs(userId: string): { success: boolean; configs?: any; error?: string } {
  try {
    const configs = loadConfigs()
    const userConfigs = configs[userId]?.sql
    return { success: true, configs: userConfigs }
  } catch (err: any) {
    console.error('Load local user SQL configs error:', err)
    return { success: false, error: err.message }
  }
}

export function saveLocalUserSQLConfigs(userId: string, data: {
  connections?: any[]
  redisServers?: any[]
  editorLayout?: string
  resultView?: string
}): { success: boolean; error?: string } {
  try {
    const configs = loadConfigs()
    if (!configs[userId]) {
      configs[userId] = {}
    }
    configs[userId].sql = {
      connections: data.connections ?? configs[userId]?.sql?.connections ?? [],
      redisServers: data.redisServers ?? configs[userId]?.sql?.redisServers ?? [],
      editorLayout: data.editorLayout ?? configs[userId]?.sql?.editorLayout ?? 'split',
      resultView: data.resultView ?? configs[userId]?.sql?.resultView ?? 'table',
    }
    saveConfigs(configs)
    return { success: true }
  } catch (err: any) {
    console.error('Save local user SQL configs error:', err)
    return { success: false, error: err.message }
  }
}
