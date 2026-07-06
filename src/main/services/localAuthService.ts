import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import crypto from 'crypto'

export interface LocalUser {
  id: string
  nome: string
  usuario: string
  senha: string
  createdAt: string
  updatedAt: string
}

interface LocalUsersData {
  users: LocalUser[]
  nextId: number
}

function getLocalAuthPath(): string {
  const userDataPath = app.getPath('userData')
  return path.join(userDataPath, 'local_users.json')
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex')
  return `${salt}:${hash}`
}

function verifyPassword(password: string, stored: string): boolean {
  try {
    const [salt, hash] = stored.split(':')
    const computed = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex')
    return hash === computed
  } catch {
    return false
  }
}

function loadUsersData(): LocalUsersData {
  const filePath = getLocalAuthPath()
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8')
      return JSON.parse(data)
    }
  } catch (err) {
    console.error('Error loading local users:', err)
  }
  return { users: [], nextId: 1 }
}

function saveUsersData(data: LocalUsersData): void {
  const filePath = getLocalAuthPath()
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

export function initLocalAuth(): { success: boolean; error?: string } {
  try {
    const filePath = getLocalAuthPath()
    if (!fs.existsSync(filePath)) {
      saveUsersData({ users: [], nextId: 1 })
    }
    return { success: true }
  } catch (err: any) {
    console.error('Init local auth error:', err)
    return { success: false, error: err.message }
  }
}

export function registerLocalUser(nome: string, usuario: string, senha: string): { success: boolean; user?: LocalUser; error?: string } {
  try {
    const data = loadUsersData()
    
    const existing = data.users.find(u => u.usuario.toLowerCase() === usuario.toLowerCase())
    if (existing) {
      return { success: false, error: 'Usuário já existe' }
    }

    const hashed = hashPassword(senha)
    const newUser: LocalUser = {
      id: `local_${data.nextId}`,
      nome,
      usuario,
      senha: hashed,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    data.users.push(newUser)
    data.nextId++
    saveUsersData(data)

    const { senha: _, ...userWithoutPassword } = newUser
    return { success: true, user: userWithoutPassword }
  } catch (err: any) {
    console.error('Register local user error:', err)
    return { success: false, error: err.message }
  }
}

export function loginLocalUser(usuario: string, senha: string): { success: boolean; user?: LocalUser; error?: string } {
  try {
    const data = loadUsersData()
    const user = data.users.find(u => u.usuario.toLowerCase() === usuario.toLowerCase())
    
    if (!user) {
      return { success: false, error: 'Usuário ou senha inválidos' }
    }

    if (!verifyPassword(senha, user.senha)) {
      return { success: false, error: 'Usuário ou senha inválidos' }
    }

    const { senha: _, ...userWithoutPassword } = user
    return { success: true, user: userWithoutPassword }
  } catch (err: any) {
    console.error('Login local user error:', err)
    return { success: false, error: err.message }
  }
}

export function listLocalUsers(): { success: boolean; users?: Pick<LocalUser, 'id' | 'nome' | 'usuario'>[]; error?: string } {
  try {
    const data = loadUsersData()
    const usersPublic = data.users.map(({ id, nome, usuario }) => ({ id, nome, usuario }))
    return { success: true, users: usersPublic }
  } catch (err: any) {
    console.error('List local users error:', err)
    return { success: false, error: err.message }
  }
}
