export type DbProvider = 'postgres' | 'mysql' | 'oracle'

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
  // Redis Cache URL for AI Schema tracking
  redisUrl?: string
}

export interface SqlQueryResult {
  success: boolean
  columns?: string[]
  rows?: any[][]
  rowCount?: number
  error?: string
  executionTimeMs?: number
  query?: string
}
