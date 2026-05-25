import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/constants'
import { DbConfig, SqlQueryResult } from '../../shared/types/sql'
import pg from 'pg'
import mysql from 'mysql2/promise'
import oracledb from 'oracledb'
import Redis from 'ioredis'

let isOracleClientInitialized = false

function initOracleClient(libDir?: string) {
  if (!libDir || isOracleClientInitialized) return
  try {
    oracledb.initOracleClient({ libDir })
    isOracleClientInitialized = true
  } catch (err: any) {
    if (err.message && err.message.includes('NJS-043')) {
      throw new Error('O Oracle já foi inicializado em modo Thin (básico) nesta sessão. Para ativar o Thick mode com o Oracle Client Path, você precisa reiniciar o projeto (feche o terminal e rode npm run dev novamente).')
    } else {
      throw err
    }
  }
}

async function saveToRedisCache(config: DbConfig, query: string, columns: string[]) {
  if (!config.redisUrl) return;
  try {
    const redis = new Redis(config.redisUrl, { 
      lazyConnect: true,
      maxRetriesPerRequest: 0,
      retryStrategy: () => null
    });
    redis.on('error', () => { /* ignore */ });
    
    await redis.connect();
    
    const key = `ezek:sql_cache:${config.id}`;
    
    const cacheEntry = {
      query,
      columns,
      timestamp: Date.now()
    };
    
    await redis.lpush(key, JSON.stringify(cacheEntry));
    // Keep only last 50 queries to prevent bloat
    await redis.ltrim(key, 0, 49);
    // Expire in 1 week (604800 seconds)
    await redis.expire(key, 604800);
    redis.disconnect();
  } catch (err) {
    console.error('Failed to save to Redis cache:', err);
  }
}

const activeConnections = new Map<string, any>()

export function registerSqlHandlers() {
  ipcMain.handle(IPC_CHANNELS.SQL_CANCEL_QUERY, async (_event, config: DbConfig) => {
    try {
      const conn = activeConnections.get(config.id)
      if (!conn) return { success: false, error: 'Nenhuma consulta em andamento encontrada.' }
      
      if (config.provider === 'postgres') {
        // node-postgres client
        await conn.end()
      } else if (config.provider === 'mysql') {
        // mysql2 connection
        conn.destroy()
      } else if (config.provider === 'oracle') {
        // oracledb connection
        await conn.break()
      }
      activeConnections.delete(config.id)
      return { success: true }
    } catch (err: any) {
      console.error('Error cancelling query:', err)
      return { success: false, error: err.message || String(err) }
    }
  })

  ipcMain.handle(IPC_CHANNELS.SQL_GET_CACHE, async (_event, config: DbConfig) => {
    if (!config || !config.redisUrl) return [];
    try {
      const redis = new Redis(config.redisUrl, { 
        lazyConnect: true,
        maxRetriesPerRequest: 0,
        retryStrategy: () => null 
      });
      redis.on('error', () => { /* ignore */ });
      
      await redis.connect();
      
      const key = `ezek:sql_cache:${config.id}`;
      const data = await redis.lrange(key, 0, -1);
      redis.disconnect();
      return data.map(d => JSON.parse(d));
    } catch (err) {
      console.error('Failed to get Redis cache:', err);
      return [];
    }
  });

  ipcMain.handle(IPC_CHANNELS.SQL_TEST_CONNECTION, async (_event, config: DbConfig) => {
    try {
      if (config.provider === 'postgres') {
        const client = new pg.Client({
          host: config.host,
          port: config.port,
          database: config.database,
          user: config.username,
          password: config.password,
          connectionTimeoutMillis: 5000,
        })
        await client.connect()
        await client.end()
        return { success: true }
      } else if (config.provider === 'mysql') {
        const connection = await mysql.createConnection({
          host: config.host,
          port: config.port,
          database: config.database,
          user: config.username,
          password: config.password,
          connectTimeout: 5000,
        })
        await connection.end()
        return { success: true }
      } else if (config.provider === 'oracle') {
        if (config.oracleClientLib) {
          initOracleClient(config.oracleClientLib)
        }
        const connection = await oracledb.getConnection({
          user: config.username,
          password: config.password,
          connectString: config.connectString || `${config.host}:${config.port}/${config.database}`,
        })
        await connection.close()
        return { success: true }
      }
      return { success: false, error: 'Provedor não suportado' }
    } catch (err: any) {
      return { success: false, error: err.message || String(err) }
    }
  })

  ipcMain.handle(IPC_CHANNELS.SQL_EXECUTE_QUERY, async (_event, config: DbConfig, query: string): Promise<SqlQueryResult> => {
    const startTime = Date.now()
    try {
      if (config.provider === 'postgres') {
        const client = new pg.Client({
          host: config.host,
          port: config.port,
          database: config.database,
          user: config.username,
          password: config.password,
        })
        await client.connect()
        activeConnections.set(config.id, client)
        const res = await client.query(query)
        await client.end()
        activeConnections.delete(config.id)
        
        let rows = []
        let columns: string[] = []
        let rowCount = 0
        
        if (Array.isArray(res)) {
          // Multiple queries executed
          const lastRes = res[res.length - 1]
          rows = lastRes.rows
          columns = lastRes.fields.map(f => f.name)
          rowCount = lastRes.rowCount || 0
        } else {
          rows = res.rows
          columns = res.fields ? res.fields.map(f => f.name) : []
          rowCount = res.rowCount || 0
        }
        
        const payload = {
          success: true,
          columns,
          rows,
          rowCount,
          executionTimeMs: Date.now() - startTime
        };
        saveToRedisCache(config, query, columns);
        return payload;
      } else if (config.provider === 'mysql') {
        const connection = await mysql.createConnection({
          host: config.host,
          port: config.port,
          database: config.database,
          user: config.username,
          password: config.password,
          multipleStatements: true,
        })
        activeConnections.set(config.id, connection)
        const [rows, fields] = await connection.query(query)
        await connection.end()
        activeConnections.delete(config.id)
        
        let formattedRows: any[] = []
        let columns: string[] = []
        let rowCount = 0
        
        if (Array.isArray(rows)) {
          if (rows.length > 0 && Array.isArray(rows[0])) {
            // multiple statements
            const lastRowSet = rows[rows.length - 1] as any[]
            formattedRows = lastRowSet
            const lastFieldSet = (fields as any[])[(fields as any[]).length - 1]
            columns = lastFieldSet ? lastFieldSet.map((f: any) => f.name) : []
            rowCount = lastRowSet.length
          } else {
            formattedRows = rows
            columns = fields ? (fields as any[]).map(f => f.name) : []
            rowCount = rows.length
          }
        } else {
          rowCount = (rows as any).affectedRows || 0
        }
        
        const payload = {
          success: true,
          columns,
          rows: formattedRows,
          rowCount,
          executionTimeMs: Date.now() - startTime
        };
        saveToRedisCache(config, query, columns);
        return payload;
      } else if (config.provider === 'oracle') {
        if (config.oracleClientLib) {
          initOracleClient(config.oracleClientLib)
        }
        const connection = await oracledb.getConnection({
          user: config.username,
          password: config.password,
          connectString: config.connectString || `${config.host}:${config.port}/${config.database}`,
        })
        
        activeConnections.set(config.id, connection)
        
        // Remove ponto e vírgula final se existir, pois o oracledb falha com ele
        let finalQuery = query.trim()
        if (finalQuery.endsWith(';')) {
          finalQuery = finalQuery.slice(0, -1)
        }

        const result = await connection.execute(finalQuery, [], { 
          outFormat: oracledb.OUT_FORMAT_OBJECT,
          maxRows: 100 
        })
        await connection.close()
        activeConnections.delete(config.id)
        
        const columns = result.metaData ? result.metaData.map(m => m.name) : []
        const rows = result.rows || []
        
        const payload = {
          success: true,
          columns,
          rows,
          rowCount: result.rowsAffected || rows.length,
          executionTimeMs: Date.now() - startTime
        };
        saveToRedisCache(config, query, columns);
        return payload;
      }
      return { success: false, error: 'Provedor não suportado' }
    } catch (err: any) {
      activeConnections.delete(config.id)
      return { success: false, error: err.message || String(err), executionTimeMs: Date.now() - startTime }
    }
  })
}
