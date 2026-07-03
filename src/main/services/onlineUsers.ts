import { ipcMain, BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '../../shared/constants'
import mysql from 'mysql2/promise'

let pool: mysql.Pool | null = null

async function getPool(): Promise<mysql.Pool | null> {
  if (pool) return pool
  try {
    const { MYSQL_HOST, MYSQL_DB, MYSQL_USER, MYSQL_PASS } = process.env
    pool = mysql.createPool({
      host: MYSQL_HOST || '10.200.200.126',
      database: MYSQL_DB || 'ezekcode',
      user: MYSQL_USER || 'ezekcode',
      password: MYSQL_PASS || 'ti53p@c0',
      waitForConnections: true,
      connectionLimit: 5,
    })
    return pool
  } catch {
    return null
  }
}

// Cria tabela de sessões ativas
async function ensureSessionsTable(): Promise<void> {
  const p = await getPool()
  if (!p) return
  const conn = await p.getConnection()
  try {
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        machine_id VARCHAR(255) NOT NULL,
        last_ping TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
  } finally {
    conn.release()
  }
}

// Broadcasting de usuários online
let broadcastInterval: NodeJS.Timeout | null = null
let lastCount = -1

async function broadcastOnlineCount(): Promise<void> {
  const p = await getPool()
  if (!p) return
  try {
    const [rows]: any = await p.execute(
      `SELECT COUNT(DISTINCT user_id) as count FROM user_sessions WHERE last_ping > DATE_SUB(NOW(), INTERVAL 5 MINUTE)`
    )
    const count = rows?.[0]?.count || 0
    if (count !== lastCount) {
      lastCount = count
      const windows = BrowserWindow.getAllWindows()
      windows.forEach(w => {
        if (!w.isDestroyed()) {
          w.webContents.send(IPC_CHANNELS.USERS_ONLINE_EVENT, { count })
        }
      })
    }
  } catch {
    // ignora erro silenciosamente
  }
}

// Remove sessões antigas (ping > 10 min)
async function cleanupExpiredSessions(): Promise<void> {
  const p = await getPool()
  if (!p) return
  try {
    await p.execute(`DELETE FROM user_sessions WHERE last_ping < DATE_SUB(NOW(), INTERVAL 10 MINUTE)`)
  } catch {
    // ignora
  }
}

// Atualiza ou insere sessão do usuário
async function pingSession(userId: number): Promise<void> {
  const p = await getPool()
  if (!p) return
  const machineId = `${process.platform}-${require('os').hostname()}`
  try {
    await p.execute(
      `INSERT INTO user_sessions (user_id, machine_id, last_ping)
       VALUES (?, ?, NOW())
       ON DUPLICATE KEY UPDATE last_ping = NOW()`,
      [userId, machineId]
    )
  } catch {
    // ignora
  }
}

export function registerOnlineUsersHandlers(): void {
  // Inicia tabela e polling
  ensureSessionsTable()

  // Polling a cada 10 segundos
  broadcastInterval = setInterval(async () => {
    await cleanupExpiredSessions()
    await broadcastOnlineCount()
  }, 10000)

  // IPC: obter contagem atual
  ipcMain.handle(IPC_CHANNELS.USERS_ONLINE_COUNT, async () => {
    try {
      const p = await getPool()
      if (!p) return { count: 0 }
      const [rows]: any = await p.execute(
        `SELECT COUNT(DISTINCT user_id) as count FROM user_sessions WHERE last_ping > DATE_SUB(NOW(), INTERVAL 5 MINUTE)`
      )
      return { count: rows?.[0]?.count || 0 }
    } catch {
      return { count: 0 }
    }
  })

  // IPC: ping da sessão (chamado pelo renderer periodicamente)
  ipcMain.handle('users:ping', async (_event, userId: number) => {
    if (!userId) return
    await pingSession(userId)
  })
}

export function unregisterOnlineUsers(): void {
  if (broadcastInterval) {
    clearInterval(broadcastInterval)
    broadcastInterval = null
  }
  if (pool) {
    pool.end().catch(() => {})
    pool = null
  }
}
