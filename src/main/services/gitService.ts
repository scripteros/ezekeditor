import simpleGit, { type SimpleGit, type StatusResult } from 'simple-git'
import path from 'path'
import fs from 'fs'
import type { GitStatus, GitChange } from '../../shared/types'

const gitCache = new Map<string, { status: GitStatus; timestamp: number }>()
const CACHE_TTL = 2000

function getGitInstance(repoPath: string): SimpleGit {
  return simpleGit(repoPath)
}

function isCacheValid(repoPath: string): boolean {
  const cached = gitCache.get(repoPath)
  if (!cached) return false
  return Date.now() - cached.timestamp < CACHE_TTL
}

function mapStatusToChangeType(status: string): GitChange['status'] {
  switch (status) {
    case 'M':
      return 'modified'
    case 'A':
      return 'added'
    case 'D':
      return 'deleted'
    case 'R':
      return 'renamed'
    case '?':
      return 'untracked'
    default:
      return 'modified'
  }
}

export async function getGitStatus(repoPath: string): Promise<GitStatus | null> {
  try {
    if (isCacheValid(repoPath)) {
      return gitCache.get(repoPath)!.status
    }

    const git = getGitInstance(repoPath)
    const status: StatusResult = await git.status()

    const changes: GitChange[] = [
      ...status.modified.map((file) => ({
        path: file,
        status: 'modified' as GitChange['status'],
      })),
      ...status.created.map((file) => ({
        path: file,
        status: 'added' as GitChange['status'],
      })),
      ...status.deleted.map((file) => ({
        path: file,
        status: 'deleted' as GitChange['status'],
      })),
      ...status.renamed.map((file) => ({
        path: file,
        status: 'renamed' as GitChange['status'],
      })),
      ...status.not_added.map((file) => ({
        path: file,
        status: 'untracked' as GitChange['status'],
      })),
    ]

    // Separar staged e unstaged
    const staged = changes.filter(change => 
      status.staged.includes(change.path) || 
      status.created.includes(change.path)
    )
    const unstaged = changes.filter(change => 
      !staged.some(s => s.path === change.path)
    )

    const result: GitStatus = {
      currentBranch: status.current || 'HEAD',
      changes,
      staged,
      unstaged,
      ahead: status.ahead,
      behind: status.behind,
    }

    gitCache.set(repoPath, { status: result, timestamp: Date.now() })
    return result
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error(`Git status error for ${repoPath}: ${message}`)
    return null
  }
}

export async function gitCommit(repoPath: string, message: string): Promise<void> {
  try {
    const git = getGitInstance(repoPath)
    await git.add('.')
    await git.commit(message)
    gitCache.delete(repoPath)
  } catch (error) {
    const err = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`Failed to commit: ${err}`)
  }
}

export async function gitInit(repoPath: string): Promise<void> {
  try {
    const git = getGitInstance(repoPath)
    await git.init()
    gitCache.delete(repoPath)
  } catch (error) {
    const err = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`Failed to init git: ${err}`)
  }
}

export async function isGitRepo(repoPath: string): Promise<boolean> {
  try {
    const gitDir = path.join(repoPath, '.git')
    return fs.existsSync(gitDir)
  } catch {
    return false
  }
}

export async function gitAdd(repoPath: string, files: string[] = ['.']): Promise<void> {
  try {
    const git = getGitInstance(repoPath)
    await git.add(files)
    clearCache(repoPath)
  } catch (error) {
    const err = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`Failed to add files: ${err}`)
  }
}

export async function gitPush(repoPath: string, remote = 'origin', branch = 'main'): Promise<void> {
  try {
    const git = getGitInstance(repoPath)
    await git.push(remote, branch)
    clearCache(repoPath)
  } catch (error) {
    const err = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`Failed to push: ${err}`)
  }
}

export async function gitPull(repoPath: string, remote = 'origin', branch = 'main'): Promise<void> {
  try {
    const git = getGitInstance(repoPath)
    await git.pull(remote, branch)
    clearCache(repoPath)
  } catch (error) {
    const err = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`Failed to pull: ${err}`)
  }
}

export async function gitBranch(repoPath: string, branchName?: string): Promise<string[]> {
  try {
    const git = getGitInstance(repoPath)
    if (branchName) {
      await git.checkoutLocalBranch(branchName)
      return []
    }
    const branches = await git.branchLocal()
    return branches.all
  } catch (error) {
    const err = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`Failed to list/create branches: ${err}`)
  }
}

export async function gitCheckout(repoPath: string, branch: string): Promise<void> {
  try {
    const git = getGitInstance(repoPath)
    await git.checkout(branch)
    clearCache(repoPath)
  } catch (error) {
    const err = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`Failed to checkout branch: ${err}`)
  }
}

export async function gitLog(repoPath: string, maxCount = 10): Promise<any[]> {
  try {
    const git = getGitInstance(repoPath)
    const log = await git.log({ maxCount })
    return log.all.map(commit => ({
      hash: commit.hash,
      date: commit.date,
      message: commit.message,
      author_name: commit.author_name,
      author_email: commit.author_email
    }))
  } catch (error) {
    const err = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`Failed to get log: ${err}`)
  }
}

export async function gitExecuteCommand(repoPath: string, command: string): Promise<string> {
  try {
    const git = getGitInstance(repoPath)
    const result = await git.raw(command.split(' '))
    clearCache(repoPath)
    return result
  } catch (error) {
    const err = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`Failed to execute git command: ${err}`)
  }
}

export async function gitRemoteList(repoPath: string): Promise<{name: string, url: string}[]> {
  try {
    const git = getGitInstance(repoPath)
    const remotes = await git.getRemotes(true)
    return remotes.map(r => ({ name: r.name, url: r.refs.push }))
  } catch (error) {
    const err = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`Failed to list remotes: ${err}`)
  }
}

export async function gitRemoteAdd(repoPath: string, name: string, url: string): Promise<void> {
  try {
    const git = getGitInstance(repoPath)
    await git.addRemote(name, url)
  } catch (error) {
    const err = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`Failed to add remote: ${err}`)
  }
}

export async function gitRemoteRemove(repoPath: string, name: string): Promise<void> {
  try {
    const git = getGitInstance(repoPath)
    await git.removeRemote(name)
  } catch (error) {
    const err = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`Failed to remove remote: ${err}`)
  }
}

export function clearCache(repoPath?: string): void {
  if (repoPath) {
    gitCache.delete(repoPath)
  } else {
    gitCache.clear()
  }
}
