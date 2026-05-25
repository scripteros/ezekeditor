import { ipcMain, shell } from 'electron'
import { IPC_CHANNELS } from '../../shared/constants'
import {
  readDirectory as readDirService,
  readFile as readFileService,
  writeFile as writeFileService,
  deleteFile as deleteFileService,
  createFile as createFileService,
  createDirectory as createDirectoryService,
  renameFile as renameFileService,
  getFileInfo as getFileInfoService,
} from '../services/fileService'

export function registerFileExplorerHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.OS_SHOW_ITEM_IN_FOLDER, async (_event, filePath: string) => {
    shell.showItemInFolder(filePath)
  })

  ipcMain.handle(IPC_CHANNELS.READ_DIRECTORY, async (_event, dirPath: string) => {
    return await readDirService(dirPath)
  })

  ipcMain.handle(IPC_CHANNELS.READ_FILE, async (_event, filePath: string) => {
    return await readFileService(filePath)
  })

  ipcMain.handle(IPC_CHANNELS.WRITE_FILE, async (_event, filePath: string, content: string) => {
    await writeFileService(filePath, content)
  })

  ipcMain.handle(IPC_CHANNELS.DELETE_FILE, async (_event, filePath: string) => {
    await deleteFileService(filePath)
  })

  ipcMain.handle(IPC_CHANNELS.CREATE_FILE, async (_event, filePath: string) => {
    await createFileService(filePath)
  })

  ipcMain.handle(IPC_CHANNELS.CREATE_DIRECTORY, async (_event, dirPath: string) => {
    await createDirectoryService(dirPath)
  })

  ipcMain.handle(IPC_CHANNELS.RENAME_FILE, async (_event, oldPath: string, newPath: string) => {
    await renameFileService(oldPath, newPath)
  })

  ipcMain.handle(IPC_CHANNELS.GET_FILE_INFO, async (_event, filePath: string) => {
    return await getFileInfoService(filePath)
  })
}
