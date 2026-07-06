import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/constants'
import { DbConfig, SqlQueryResult } from '../../shared/types/sql'
import pg from 'pg'
import mysql from 'mysql2/promise'
import oracledb from 'oracledb'
import Redis from 'ioredis'

let isOracleClientInitialized = false
const REDIS_MEMORY_TTL_SECONDS = 60 * 60 * 24 * 7

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

function createRedisClient(config: DbConfig) {
  if (config.redisUrl) {
    return new Redis(config.redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 0,
      retryStrategy: () => null,
    })
  }

  if (!config.redisEnabled && !config.redisHost) return null

  return new Redis({
    host: config.redisHost || 'localhost',
    port: config.redisPort || 6379,
    username: config.redisUsername || undefined,
    password: config.redisPassword || undefined,
    db: config.redisDatabase || 0,
    tls: config.redisTls || config.redisMode === 'cloud' ? {} : undefined,
    lazyConnect: true,
    maxRetriesPerRequest: 0,
    retryStrategy: () => null,
  })
}

function getRedisMemoryKey(config: DbConfig) {
  return `ezek:ai_memory:${config.id}`
}

function getLegacyRedisMemoryKey(config: DbConfig) {
  return `ezek:sql_cache:${config.id}`
}

async function saveToRedisCache(config: DbConfig, query: string, columns: string[], columnTypes: Record<string, string>, rowCount: number, userId?: string) {
  const redis = createRedisClient(config)
  if (!redis) return
  try {
    redis.on('error', () => { /* ignore */ })
    
    await redis.connect()
    
    const key = getRedisMemoryKey(config)
    
    const cacheEntry: Record<string, any> = {
      connectionId: config.id,
      connectionName: config.name,
      provider: config.provider,
      database: config.database,
      query,
      columns,
      columnTypes,
      rowCount,
      timestamp: Date.now()
    }
    
    if (userId) {
      cacheEntry.userId = userId
    }
    
    await redis.lpush(key, JSON.stringify(cacheEntry))
    await redis.ltrim(key, 0, 99)
    await redis.expire(key, REDIS_MEMORY_TTL_SECONDS)
    redis.disconnect()
  } catch (err) {
    console.error('Failed to save to Redis cache:', err)
  }
}

const activeConnections = new Map<string, any>()

const POSTGRES_TYPE_NAMES: Record<number, string> = {
  16: 'bool',
  17: 'bytea',
  20: 'int8',
  21: 'int2',
  23: 'int4',
  25: 'text',
  700: 'float4',
  701: 'float8',
  1043: 'varchar',
  1082: 'date',
  1083: 'time',
  1114: 'timestamp',
  1184: 'timestamptz',
  1700: 'numeric',
  2950: 'uuid',
  3802: 'jsonb',
  114: 'json',
}

function mapPostgresColumnTypes(fields?: any[]) {
  return Object.fromEntries((fields || []).map(field => [
    field.name,
    POSTGRES_TYPE_NAMES[field.dataTypeID] || `oid:${field.dataTypeID}`
  ]))
}

function mapMySqlColumnTypes(fields?: any[]) {
  return Object.fromEntries((fields || []).map(field => [
    field.name,
    field.columnTypeName || field.typeName || field.type || `type:${field.columnType}`
  ]))
}

function mapOracleColumnTypes(metaData?: any[]) {
  return Object.fromEntries((metaData || []).map(field => [
    field.name,
    field.dbTypeName || field.fetchTypeName || field.dbType || 'unknown'
  ]))
}

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

  ipcMain.handle(IPC_CHANNELS.SQL_GET_CACHE, async (_event, config: DbConfig, userId?: string) => {
    if (!config) return []
    const redis = createRedisClient(config)
    if (!redis) return []
    try {
      redis.on('error', () => { /* ignore */ })
      
      await redis.connect()
      
      const key = getRedisMemoryKey(config)
      const legacyKey = getLegacyRedisMemoryKey(config)
      await redis.expire(key, REDIS_MEMORY_TTL_SECONDS)
      await redis.expire(legacyKey, REDIS_MEMORY_TTL_SECONDS)
      const data = [
        ...await redis.lrange(key, 0, 99),
        ...await redis.lrange(legacyKey, 0, 99),
      ].slice(0, 100)
      redis.disconnect()
      const parsed = data.map(d => JSON.parse(d))
      // Filtrar apenas entradas do usuário atual (se userId foi informado)
      if (userId) {
        return parsed.filter(entry => entry.userId === userId)
      }
      return parsed
    } catch (err) {
      console.error('Failed to get Redis cache:', err)
      return []
    }
  })

  ipcMain.handle(IPC_CHANNELS.SQL_TEST_REDIS_CONNECTION, async (_event, config: DbConfig) => {
    const redis = createRedisClient(config)
    if (!redis) return { success: false, error: 'Configure o Redis por URL ou por host/porta.' }
    try {
      redis.on('error', () => { /* handled by connect/ping */ })
      await redis.connect()
      await redis.ping()
      redis.disconnect()
      return { success: true }
    } catch (err: any) {
      try { redis.disconnect() } catch {}
      return { success: false, error: err.message || String(err) }
    }
  })

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

  ipcMain.handle(IPC_CHANNELS.SQL_EXECUTE_QUERY, async (_event, config: DbConfig, query: string, userId?: string): Promise<SqlQueryResult> => {
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
        let columnTypes: Record<string, string> = {}
        let rowCount = 0
        
        if (Array.isArray(res)) {
          // Multiple queries executed
          const lastRes = res[res.length - 1]
          rows = lastRes.rows
          columns = lastRes.fields.map(f => f.name)
          columnTypes = mapPostgresColumnTypes(lastRes.fields)
          rowCount = lastRes.rowCount || 0
        } else {
          rows = res.rows
          columns = res.fields ? res.fields.map(f => f.name) : []
          columnTypes = mapPostgresColumnTypes(res.fields)
          rowCount = res.rowCount || 0
        }
        
        const payload = {
          success: true,
          columns,
          columnTypes,
          rows,
          rowCount,
          executionTimeMs: Date.now() - startTime
        };
        saveToRedisCache(config, query, columns, columnTypes, rowCount, userId);
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
        let columnTypes: Record<string, string> = {}
        let rowCount = 0
        
        if (Array.isArray(rows)) {
          if (rows.length > 0 && Array.isArray(rows[0])) {
            // multiple statements
            const lastRowSet = rows[rows.length - 1] as any[]
            formattedRows = lastRowSet
            const lastFieldSet = (fields as any[])[(fields as any[]).length - 1]
            columns = lastFieldSet ? lastFieldSet.map((f: any) => f.name) : []
            columnTypes = mapMySqlColumnTypes(lastFieldSet)
            rowCount = lastRowSet.length
          } else {
            formattedRows = rows
            columns = fields ? (fields as any[]).map(f => f.name) : []
            columnTypes = mapMySqlColumnTypes(fields as any[])
            rowCount = rows.length
          }
        } else {
          rowCount = (rows as any).affectedRows || 0
        }
        
        const payload = {
          success: true,
          columns,
          columnTypes,
          rows: formattedRows,
          rowCount,
          executionTimeMs: Date.now() - startTime
        };
        saveToRedisCache(config, query, columns, columnTypes, rowCount, userId);
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
          maxRows: 10000
        })
        await connection.close()
        activeConnections.delete(config.id)
        
        const columns = result.metaData ? result.metaData.map(m => m.name) : []
        const columnTypes = mapOracleColumnTypes(result.metaData)
        const rows = result.rows || []
        
        const payload = {
          success: true,
          columns,
          columnTypes,
          rows,
          rowCount: result.rowsAffected || rows.length,
          executionTimeMs: Date.now() - startTime
        };
        saveToRedisCache(config, query, columns, columnTypes, rows.length, userId);
        return payload;
      }
      return { success: false, error: 'Provedor não suportado' }
    } catch (err: any) {
      activeConnections.delete(config.id)
      return { success: false, error: err.message || String(err), executionTimeMs: Date.now() - startTime }
    }
  })
}
