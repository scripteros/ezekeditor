import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/constants'
import {
  ldapConnect as ldapConnectService,
  ldapDisconnect as ldapDisconnectService,
  ldapSearchUsers as ldapSearchUsersService,
  ldapSearchGroups as ldapSearchGroupsService,
  type LdapConfig
} from '../services/ldapService'

export function registerLdapHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.LDAP_CONNECT, async (_event, config: LdapConfig) => {
    try {
      await ldapConnectService(config)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle(IPC_CHANNELS.LDAP_DISCONNECT, async () => {
    try {
      await ldapDisconnectService()
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle(IPC_CHANNELS.LDAP_SEARCH_USERS, async (_event, filter?: string) => {
    try {
      const users = await ldapSearchUsersService(filter)
      return { success: true, data: users }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle(IPC_CHANNELS.LDAP_SEARCH_GROUPS, async (_event, filter?: string) => {
    try {
      const groups = await ldapSearchGroupsService(filter)
      return { success: true, data: groups }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })
}
