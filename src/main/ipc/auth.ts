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
  // Auto-create users table on startup
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
}
