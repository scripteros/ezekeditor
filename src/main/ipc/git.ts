import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/constants'
import {
  getGitStatus as getGitStatusService,
  gitCommit as gitCommitService,
  gitInit as gitInitService,
  gitAdd as gitAddService,
  gitPush as gitPushService,
  gitPull as gitPullService,
  gitBranch as gitBranchService,
  gitCheckout as gitCheckoutService,
  gitLog as gitLogService,
  gitExecuteCommand as gitExecuteCommandService,
  isGitRepo as isGitRepoService,
  gitRemoteList as gitRemoteListService,
  gitRemoteAdd as gitRemoteAddService,
  gitRemoteRemove as gitRemoteRemoveService,
} from '../services/gitService'

export function registerGitHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.GET_GIT_STATUS, async (_event, repoPath: string) => {
    return await getGitStatusService(repoPath)
  })

  ipcMain.handle(IPC_CHANNELS.GIT_COMMIT, async (_event, repoPath: string, message: string) => {
    await gitCommitService(repoPath, message)
  })

  ipcMain.handle(IPC_CHANNELS.GIT_INIT, async (_event, repoPath: string) => {
    await gitInitService(repoPath)
  })

  ipcMain.handle(IPC_CHANNELS.GIT_ADD, async (_event, repoPath: string, files?: string[]) => {
    await gitAddService(repoPath, files)
  })

  ipcMain.handle(IPC_CHANNELS.GIT_PUSH, async (_event, repoPath: string, remote?: string, branch?: string) => {
    await gitPushService(repoPath, remote, branch)
  })

  ipcMain.handle(IPC_CHANNELS.GIT_PULL, async (_event, repoPath: string, remote?: string, branch?: string) => {
    await gitPullService(repoPath, remote, branch)
  })

  ipcMain.handle(IPC_CHANNELS.GIT_BRANCH, async (_event, repoPath: string, branchName?: string) => {
    return await gitBranchService(repoPath, branchName)
  })

  ipcMain.handle(IPC_CHANNELS.GIT_CHECKOUT, async (_event, repoPath: string, branch: string) => {
    await gitCheckoutService(repoPath, branch)
  })

  ipcMain.handle(IPC_CHANNELS.GIT_LOG, async (_event, repoPath: string, maxCount?: number) => {
    return await gitLogService(repoPath, maxCount)
  })

  ipcMain.handle(IPC_CHANNELS.GIT_EXECUTE_COMMAND, async (_event, repoPath: string, command: string) => {
    return await gitExecuteCommandService(repoPath, command)
  })

  ipcMain.handle(IPC_CHANNELS.IS_GIT_REPO, async (_event, repoPath: string) => {
    return await isGitRepoService(repoPath)
  })

  ipcMain.handle(IPC_CHANNELS.GIT_REMOTE_LIST, async (_event, repoPath: string) => {
    return await gitRemoteListService(repoPath)
  })

  ipcMain.handle(IPC_CHANNELS.GIT_REMOTE_ADD, async (_event, repoPath: string, name: string, url: string) => {
    return await gitRemoteAddService(repoPath, name, url)
  })

  ipcMain.handle(IPC_CHANNELS.GIT_REMOTE_REMOVE, async (_event, repoPath: string, name: string) => {
    return await gitRemoteRemoveService(repoPath, name)
  })
}
