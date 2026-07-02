export interface AIAttachment {
  id: string
  type: 'image' | 'file'
  name: string
  path: string
  size: number
  mimeType: string
  content?: string // Base64 para imagens ou conteúdo do arquivo
}

export interface AIMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  type?: 'plan' | 'action' | 'result' | 'error'
  attachments?: AIAttachment[]
  fileChanges?: { path: string, add: number, del: number, originalContent?: string, newContent?: string }[]
  parsedSteps?: any[]
  parsedActions?: any[]
  hidden?: boolean
  executedSqls?: string[]
}

export interface AIConfig {
  id?: string
  name?: string
  provider: 'ollama' | 'openrouter' | 'openai' | 'lmstudio' | 'deepseek' | 'custom' | 'routeway' | 'codebuff' | 'opencode' | 'groq'
  model: string
  apiKey: string
  baseUrl: string
  temperature: number
  maxTokens: number
  allowAutonomousSql?: boolean
}

export interface AIFileChange {
  filePath: string
  originalContent: string
  newContent: string
  changeType: 'create' | 'modify' | 'delete'
}

export interface AIActionPlan {
  steps: AIActionStep[]
}

export interface AIActionStep {
  id: string
  description: string
  type: 'read_file' | 'write_file' | 'delete_file' | 'create_file' | 'command' | 'analysis' | 'execute_sql'
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  filePath?: string
  content?: string
  command?: string
  result?: string
}

export interface IAiApi {
  sendMessage: (message: string, history: AIMessage[]) => Promise<string>
  cancelRequest: () => void
  testConnection: (config: AIConfig) => Promise<boolean>
}
