import { Client } from 'ldapts'

let client: Client | null = null
let currentBaseDN = ''

export interface LdapConfig {
  url: string
  baseDN: string
  bindDN: string
  password: string
}

export async function ldapConnect(config: LdapConfig): Promise<boolean> {
  try {
    if (client) {
      await ldapDisconnect()
    }
    
    client = new Client({
      url: config.url,
      timeout: 10000,
      connectTimeout: 10000
    })

    await client.bind(config.bindDN, config.password)
    currentBaseDN = config.baseDN
    return true
  } catch (error) {
    console.error('LDAP Connection Error:', error)
    throw error
  }
}

export async function ldapDisconnect(): Promise<void> {
  if (client) {
    try {
      await client.unbind()
    } catch (e) {
      console.error('Error unbinding LDAP:', e)
    } finally {
      client = null
    }
  }
}

export async function ldapSearchUsers(searchFilter?: string): Promise<any[]> {
  if (!client) throw new Error('Not connected to LDAP')
  
  try {
    const filter = searchFilter 
      ? `(&(objectClass=person)(|(cn=*${searchFilter}*)(sAMAccountName=*${searchFilter}*)(uid=*${searchFilter}*)))`
      : '(objectClass=person)'
      
    const { searchEntries } = await client.search(currentBaseDN, {
      filter,
      scope: 'sub',
      attributes: ['cn', 'sn', 'mail', 'uid', 'sAMAccountName', 'memberOf', 'title', 'department', 'company'],
      sizeLimit: 100
    })
    
    return searchEntries
  } catch (error) {
    console.error('LDAP Search Users Error:', error)
    throw error
  }
}

export async function ldapSearchGroups(searchFilter?: string): Promise<any[]> {
  if (!client) throw new Error('Not connected to LDAP')
  
  try {
    const filter = searchFilter 
      ? `(&(objectClass=group)(cn=*${searchFilter}*))`
      : '(objectClass=group)'
      
    const { searchEntries } = await client.search(currentBaseDN, {
      filter,
      scope: 'sub',
      attributes: ['cn', 'description', 'member'],
      sizeLimit: 100
    })
    
    return searchEntries
  } catch (error) {
    console.error('LDAP Search Groups Error:', error)
    throw error
  }
}
