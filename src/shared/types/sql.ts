export type DbProvider = 'postgres' | 'mysql' | 'oracle'
export type RedisServerMode = 'local' | 'cloud'

export interface RedisServerConfig {
  id: string
  name: string
  redisEnabled?: boolean
  redisMode?: RedisServerMode
  redisUrl?: string
  redisHost?: string
  redisPort?: number
  redisUsername?: string
  redisPassword?: string
  redisDatabase?: number
  redisTls?: boolean
}

export interface DbConfig {
  id: string
  name: string
  provider: DbProvider
  host?: string
  port?: number
  database?: string
  username?: string
  password?: string
  // Oracle might use a specific connect string instead of host/port
  connectString?: string
  // Oracle thick mode client library path
  oracleClientLib?: string
  // Redis memory used by the AI chat and SQL history. Kept for backward compatibility.
  redisUrl?: string
  redisEnabled?: boolean
  redisMode?: RedisServerMode
  redisHost?: string
  redisPort?: number
  redisUsername?: string
  redisPassword?: string
  redisDatabase?: number
  redisTls?: boolean
}

export interface SqlQueryResult {
  success: boolean
  columns?: string[]
  columnTypes?: Record<string, string>
  rows?: any[][]
  rowCount?: number
  error?: string
  executionTimeMs?: number
  query?: string
}
