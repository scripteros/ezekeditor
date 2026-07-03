import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/constants'
import mysql from 'mysql2/promise'
import crypto from 'crypto'

// Default auth database config — user's MySQL
const AUTH_DB = {
  host: '10.200.200.126',
  port: 3306,
  database: 'ezekcode',
  user: 'ezekcode',
  password: 'ti53p@c0',
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex')
  return `${salt}:${hash}`
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  const computed = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex')
  return hash === computed
}

async function getConnection() {
  return mysql.createConnection({
    host: AUTH_DB.host,
    port: AUTH_DB.port,
    database: AUTH_DB.database,
    user: AUTH_DB.user,
    password: AUTH_DB.password,
    connectTimeout: 10000,
  })
}

export function registerAuthHandlers() {
  // Auto-create users table and user_settings table on startup
  ipcMain.handle(IPC_CHANNELS.AUTH_INIT, async () => {
    try {
      const conn = await getConnection()
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS usuarios (
          id INT AUTO_INCREMENT PRIMARY KEY,
          nome VARCHAR(255) NOT NULL,
          usuario VARCHAR(100) NOT NULL UNIQUE,
          senha VARCHAR(512) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `)
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS user_settings (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          settings_key VARCHAR(100) NOT NULL,
          settings_value JSON NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY unique_user_key (user_id, settings_key),
          FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `)
      await conn.end()
      return { success: true }
    } catch (err: any) {
      console.error('Auth init error:', err)
      return { success: false, error: err.message }
    }
  })

  // Register new user
  ipcMain.handle(IPC_CHANNELS.AUTH_REGISTER, async (_event, data: { nome: string; usuario: string; senha: string }) => {
    try {
      const conn = await getConnection()

      // Check if user already exists
      const [existing]: any = await conn.execute(
        'SELECT id FROM usuarios WHERE usuario = ?',
        [data.usuario]
      )
      if ((existing as any[]).length > 0) {
        await conn.end()
        return { success: false, error: 'Usuário já existe' }
      }

      const hashed = hashPassword(data.senha)
      const [result]: any = await conn.execute(
        'INSERT INTO usuarios (nome, usuario, senha) VALUES (?, ?, ?)',
        [data.nome, data.usuario, hashed]
      )
      await conn.end()
      const insertId = (result as any).insertId
      return { success: true, user: { id: insertId, nome: data.nome, usuario: data.usuario } }
    } catch (err: any) {
      console.error('Auth register error:', err)
      return { success: false, error: err.message }
    }
  })

  // Login
  ipcMain.handle(IPC_CHANNELS.AUTH_LOGIN, async (_event, data: { usuario: string; senha: string }) => {
    try {
      const conn = await getConnection()
      const [rows]: any = await conn.execute(
        'SELECT id, nome, usuario, senha FROM usuarios WHERE usuario = ?',
        [data.usuario]
      )
      await conn.end()

      const users = rows as any[]
      if (users.length === 0) {
        return { success: false, error: 'Usuário ou senha inválidos' }
      }

      const user = users[0]
      if (!verifyPassword(data.senha, user.senha)) {
        return { success: false, error: 'Usuário ou senha inválidos' }
      }

      return {
        success: true,
        user: { id: user.id, nome: user.nome, usuario: user.usuario },
      }
    } catch (err: any) {
      console.error('Auth login error:', err)
      return { success: false, error: err.message }
    }
  })

  // ─── User Config Sync ─────────────────────────────

  // Save a specific config key for a user (upsert)
  ipcMain.handle(IPC_CHANNELS.USER_SAVE_CONFIG, async (_event, userId: number, key: string, value: any) => {
    try {
      const conn = await getConnection()
      const jsonValue = JSON.stringify(value)
      await conn.execute(
        `INSERT INTO user_settings (user_id, settings_key, settings_value)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE settings_value = VALUES(settings_value), updated_at = CURRENT_TIMESTAMP`,
        [userId, key, jsonValue]
      )
      await conn.end()
      return { success: true }
    } catch (err: any) {
      console.error('Save config error:', err)
      return { success: false, error: err.message }
    }
  })

  // Load all configs for a user
  ipcMain.handle(IPC_CHANNELS.USER_LOAD_CONFIGS, async (_event, userId: number) => {
    try {
      const conn = await getConnection()
      const [rows]: any = await conn.execute(
        'SELECT settings_key, settings_value FROM user_settings WHERE user_id = ?',
        [userId]
      )
      await conn.end()
      const configs: Record<string, any> = {}
      for (const row of rows as any[]) {
        try {
          configs[row.settings_key] = JSON.parse(row.settings_value)
        } catch {
          configs[row.settings_key] = row.settings_value
        }
      }
      return { success: true, configs }
    } catch (err: any) {
      console.error('Load configs error:', err)
      return { success: false, error: err.message }
    }
  })

  // Save all AI configs at once (batch upsert)
  ipcMain.handle(IPC_CHANNELS.USER_SAVE_AI_CONFIGS, async (_event, userId: number, data: {
    acquiredAPIs: string[]
    enabledAIProviders: string[]
    savedConfigs: any[]
    activeConfig: any
    activeConfigId: string | null
    chatHistories: Record<string, any[]>
  }) => {
    try {
      const conn = await getConnection()
      const keys = ['ai_acquired_apis', 'ai_enabled_providers', 'ai_saved_configs', 'ai_active_config', 'ai_active_config_id', 'ai_chat_histories']
      const values = [
        JSON.stringify(data.acquiredAPIs || []),
        JSON.stringify(data.enabledAIProviders || []),
        JSON.stringify(data.savedConfigs || []),
        JSON.stringify(data.activeConfig || {}),
        JSON.stringify(data.activeConfigId),
        JSON.stringify(data.chatHistories || {}),
      ]
      for (let i = 0; i < keys.length; i++) {
        await conn.execute(
          `INSERT INTO user_settings (user_id, settings_key, settings_value)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE settings_value = VALUES(settings_value), updated_at = CURRENT_TIMESTAMP`,
          [userId, keys[i], values[i]]
        )
      }
      await conn.end()
      return { success: true }
    } catch (err: any) {
      console.error('Save AI configs error:', err)
      return { success: false, error: err.message }
    }
  })

  // Load all AI configs for a user
  ipcMain.handle(IPC_CHANNELS.USER_LOAD_AI_CONFIGS, async (_event, userId: number) => {
    try {
      const conn = await getConnection()
      const [rows]: any = await conn.execute(
        `SELECT settings_key, settings_value FROM user_settings
         WHERE user_id = ? AND settings_key IN ('ai_acquired_apis','ai_enabled_providers','ai_saved_configs','ai_active_config','ai_active_config_id','ai_chat_histories')`,
        [userId]
      )
      await conn.end()
      const result: any = {}
      for (const row of rows as any[]) {
        try {
          result[row.settings_key.replace('ai_', '')] = JSON.parse(row.settings_value)
        } catch {
          result[row.settings_key.replace('ai_', '')] = row.settings_value
        }
      }
      return { success: true, configs: result }
    } catch (err: any) {
      console.error('Load AI configs error:', err)
      return { success: false, error: err.message }
    }
  })
}
