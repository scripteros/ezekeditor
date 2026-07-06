import { promises as fs } from 'fs'
import * as fsSync from 'fs'
import path from 'path'
import type { FileNode } from '../../shared/types'

export async function readDirectory(dirPath: string): Promise<FileNode[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true })
  const nodes: FileNode[] = []

  for (const entry of entries) {
    try {
      const fullPath = path.join(dirPath, entry.name)
      const stats = await fs.stat(fullPath)

      const node: FileNode = {
        name: entry.name,
        path: fullPath,
        isDirectory: entry.isDirectory(),
        size: stats.size,
        modifiedAt: stats.mtime,
      }

      if (entry.isDirectory()) {
        try {
          const subEntries = await fs.readdir(fullPath, { withFileTypes: true })
          node.children = subEntries.map((sub) => ({
            name: sub.name,
            path: path.join(fullPath, sub.name),
            isDirectory: sub.isDirectory(),
          }))
        } catch {
          node.children = []
        }
      }

      nodes.push(node)
    } catch {
      continue
    }
  }

  return nodes.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1
    if (!a.isDirectory && b.isDirectory) return 1
    return a.name.localeCompare(b.name)
  })
}

export async function readFile(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, 'utf-8')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`Failed to read file ${filePath}: ${message}`)
  }
}

export async function writeFile(filePath: string, content: string): Promise<void> {
  try {
    const dir = path.dirname(filePath)
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(filePath, content, 'utf-8')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`Failed to write file ${filePath}: ${message}`)
  }
}

export async function deleteFile(filePath: string): Promise<void> {
  try {
    const stats = await fs.stat(filePath)
    if (stats.isDirectory()) {
      await fs.rm(filePath, { recursive: true, force: true })
    } else {
      await fs.unlink(filePath)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`Failed to delete ${filePath}: ${message}`)
  }
}

export async function createFile(filePath: string): Promise<void> {
  try {
    const dir = path.dirname(filePath)
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(filePath, '', 'utf-8')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`Failed to create file ${filePath}: ${message}`)
  }
}

export async function createDirectory(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`Failed to create directory ${dirPath}: ${message}`)
  }
}

export async function renameFile(oldPath: string, newPath: string): Promise<void> {
  try {
    const dir = path.dirname(newPath)
    await fs.mkdir(dir, { recursive: true })
    await fs.rename(oldPath, newPath)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`Failed to rename ${oldPath} to ${newPath}: ${message}`)
  }
}

export async function getFileInfo(filePath: string): Promise<FileNode> {
  try {
    const stats = await fs.stat(filePath)
    return {
      name: path.basename(filePath),
      path: filePath,
      isDirectory: stats.isDirectory(),
      size: stats.size,
      modifiedAt: stats.mtime,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`Failed to get file info for ${filePath}: ${message}`)
  }
}

export function pathExists(filePath: string): boolean {
  return fsSync.existsSync(filePath)
}
