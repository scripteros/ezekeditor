import { create } from 'zustand'
import type { GitStatus } from '../../../shared/types'
import { getApi } from '../utils/platform'

interface GitState {
  status: GitStatus | null
  isGitRepo: boolean
  isLoading: boolean
  branches: string[]
  currentBranch: string
  commits: any[]
  remotes: {name: string, url: string}[]
  currentRemote: string
  
  refreshStatus: (repoPath: string) => Promise<void>
  commit: (repoPath: string, message: string) => Promise<void>
  initRepo: (repoPath: string) => Promise<void>
  addFiles: (repoPath: string, files?: string[]) => Promise<void>
  push: (repoPath: string, remote?: string, branch?: string) => Promise<void>
  pull: (repoPath: string, remote?: string, branch?: string) => Promise<void>
  getBranches: (repoPath: string) => Promise<void>
  createBranch: (repoPath: string, branchName: string) => Promise<void>
  checkoutBranch: (repoPath: string, branch: string) => Promise<void>
  getCommits: (repoPath: string, maxCount?: number) => Promise<void>
  getRemotes: (repoPath: string) => Promise<void>
  addRemote: (repoPath: string, name: string, url: string) => Promise<void>
  removeRemote: (repoPath: string, name: string) => Promise<void>
  setCurrentRemote: (name: string) => void
}

export const useGitStore = create<GitState>((set, get) => ({
  status: null,
  isGitRepo: false,
  isLoading: false,
  branches: [],
  currentBranch: '',
  commits: [],
  remotes: [],
  currentRemote: 'origin',

  refreshStatus: async (repoPath) => {
    const api = getApi()
    if (!api) return
    set({ isLoading: true })
    try {
      const isRepo = await api.isGitRepo(repoPath)
      if (isRepo) {
        const status = await api.getGitStatus(repoPath)
        set({ 
          status, 
          isGitRepo: true, 
          isLoading: false,
          currentBranch: status?.currentBranch || ''
        })
        // Também buscar branches e remotes automaticamente
        get().getBranches(repoPath)
        get().getRemotes(repoPath)
      } else {
        set({ status: null, isGitRepo: false, isLoading: false })
      }
    } catch {
      set({ status: null, isGitRepo: false, isLoading: false })
    }
  },

  commit: async (repoPath, message) => {
    const api = getApi()
    if (!api) return
    await api.gitCommit(repoPath, message)
    // Refresh status após commit
    get().refreshStatus(repoPath)
  },

  initRepo: async (repoPath) => {
    const api = getApi()
    if (!api) return
    await api.gitInit(repoPath)
    set({ isGitRepo: true })
    get().refreshStatus(repoPath)
  },

  addFiles: async (repoPath, files) => {
    const api = getApi()
    if (!api) return
    await api.gitAdd(repoPath, files)
    get().refreshStatus(repoPath)
  },

  push: async (repoPath, remote, branch) => {
    const api = getApi()
    if (!api) return
    await api.gitPush(repoPath, remote, branch)
    get().refreshStatus(repoPath)
  },

  pull: async (repoPath, remote, branch) => {
    const api = getApi()
    if (!api) return
    await api.gitPull(repoPath, remote, branch)
    get().refreshStatus(repoPath)
  },

  getBranches: async (repoPath) => {
    const api = getApi()
    if (!api) return
    try {
      const branches = await api.gitBranch(repoPath)
      set({ branches })
    } catch {
      set({ branches: [] })
    }
  },

  createBranch: async (repoPath, branchName) => {
    const api = getApi()
    if (!api) return
    await api.gitBranch(repoPath, branchName)
    get().getBranches(repoPath)
    get().refreshStatus(repoPath)
  },

  checkoutBranch: async (repoPath, branch) => {
    const api = getApi()
    if (!api) return
    await api.gitCheckout(repoPath, branch)
    get().refreshStatus(repoPath)
  },

  getCommits: async (repoPath, maxCount) => {
    const api = getApi()
    if (!api) return
    try {
      const commits = await api.gitLog(repoPath, maxCount)
      set({ commits })
    } catch {
      set({ commits: [] })
    }
  },

  getRemotes: async (repoPath) => {
    const api = getApi()
    if (!api) return
    try {
      const remotes = await api.gitRemoteList(repoPath)
      set({ remotes })
      if (remotes.length > 0 && !get().currentRemote) {
        set({ currentRemote: remotes[0].name })
      }
    } catch {
      set({ remotes: [] })
    }
  },

  addRemote: async (repoPath, name, url) => {
    const api = getApi()
    if (!api) return
    await api.gitRemoteAdd(repoPath, name, url)
    get().getRemotes(repoPath)
  },

  removeRemote: async (repoPath, name) => {
    const api = getApi()
    if (!api) return
    await api.gitRemoteRemove(repoPath, name)
    get().getRemotes(repoPath)
  },

  setCurrentRemote: (name) => {
    set({ currentRemote: name })
  }
}))
