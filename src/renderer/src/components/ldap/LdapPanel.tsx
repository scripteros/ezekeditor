import { useState, useEffect } from 'react'
import { Network, Users, User, Shield, Search, Power, PowerOff, RefreshCw } from 'lucide-react'
import { useLdapStore } from '../../store/ldapStore'

export default function LdapPanel() {
  const { isConnected, config, users, groups, isLoading, error, setConfig, connect, disconnect, searchUsers, searchGroups } = useLdapStore()
  const [activeTab, setActiveTab] = useState<'users' | 'groups'>('users')
  const [searchInput, setSearchInput] = useState('')

  useEffect(() => {
    if (isConnected) {
      if (activeTab === 'users') searchUsers(searchInput)
      if (activeTab === 'groups') searchGroups(searchInput)
    }
  }, [isConnected, activeTab])

  const handleSearch = () => {
    if (activeTab === 'users') searchUsers(searchInput)
    if (activeTab === 'groups') searchGroups(searchInput)
  }

  if (!isConnected) {
    return (
      <div className="h-full flex flex-col p-4 bg-nova-bg text-nova-text">
        <div className="flex items-center gap-2 mb-6">
          <Network size={20} className="text-nova-accent" />
          <h2 className="text-lg font-semibold">Active Directory / LDAP</h2>
        </div>
        
        {error && (
          <div className="mb-4 p-2 bg-nova-error/20 border border-nova-error/50 rounded text-nova-error text-xs">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1 text-nova-text-muted">LDAP URL</label>
            <input 
              type="text" 
              value={config.url} 
              onChange={e => setConfig({ url: e.target.value })}
              className="w-full bg-nova-input-bg border border-nova-border rounded p-2 text-sm focus:border-nova-accent focus:outline-none"
              placeholder="ldap://localhost:389"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1 text-nova-text-muted">Base DN</label>
            <input 
              type="text" 
              value={config.baseDN} 
              onChange={e => setConfig({ baseDN: e.target.value })}
              className="w-full bg-nova-input-bg border border-nova-border rounded p-2 text-sm focus:border-nova-accent focus:outline-none"
              placeholder="dc=example,dc=com"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1 text-nova-text-muted">Bind DN (User)</label>
            <input 
              type="text" 
              value={config.bindDN} 
              onChange={e => setConfig({ bindDN: e.target.value })}
              className="w-full bg-nova-input-bg border border-nova-border rounded p-2 text-sm focus:border-nova-accent focus:outline-none"
              placeholder="cn=admin,dc=example,dc=com"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1 text-nova-text-muted">Password</label>
            <input 
              type="password" 
              value={config.password} 
              onChange={e => setConfig({ password: e.target.value })}
              className="w-full bg-nova-input-bg border border-nova-border rounded p-2 text-sm focus:border-nova-accent focus:outline-none"
            />
          </div>
          
          <button 
            onClick={connect}
            disabled={isLoading}
            className="w-full mt-4 bg-nova-accent text-white py-2 rounded font-medium flex items-center justify-center gap-2 hover:bg-nova-accent/80 disabled:opacity-50"
          >
            {isLoading ? <RefreshCw size={16} className="animate-spin" /> : <Power size={16} />}
            Conectar Servidor
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-nova-bg text-nova-text text-xs">
      <div className="p-3 border-b border-nova-border flex items-center justify-between bg-nova-bg-secondary">
        <div className="flex items-center gap-2">
          <Network size={16} className="text-nova-success" />
          <span className="font-semibold truncate max-w-[150px]" title={config.url}>{config.url}</span>
        </div>
        <button 
          onClick={disconnect}
          className="p-1.5 text-nova-error hover:bg-nova-error/20 rounded transition-colors"
          title="Desconectar"
        >
          <PowerOff size={14} />
        </button>
      </div>

      <div className="flex border-b border-nova-border">
        <button 
          className={`flex-1 py-2 flex items-center justify-center gap-2 border-b-2 transition-colors ${activeTab === 'users' ? 'border-nova-accent text-nova-accent' : 'border-transparent text-nova-text-muted hover:text-nova-text'}`}
          onClick={() => setActiveTab('users')}
        >
          <User size={14} /> Usuários
        </button>
        <button 
          className={`flex-1 py-2 flex items-center justify-center gap-2 border-b-2 transition-colors ${activeTab === 'groups' ? 'border-nova-accent text-nova-accent' : 'border-transparent text-nova-text-muted hover:text-nova-text'}`}
          onClick={() => setActiveTab('groups')}
        >
          <Users size={14} /> Grupos
        </button>
      </div>

      <div className="p-2 border-b border-nova-border flex items-center gap-2 bg-nova-bg-secondary">
        <div className="flex-1 relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-nova-text-muted" />
          <input 
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder={`Buscar ${activeTab === 'users' ? 'usuários' : 'grupos'}...`}
            className="w-full pl-6 pr-2 py-1 bg-nova-input-bg border border-nova-border rounded text-nova-text focus:border-nova-accent focus:outline-none"
          />
        </div>
        <button 
          onClick={handleSearch}
          className="p-1 bg-nova-accent/20 text-nova-accent rounded hover:bg-nova-accent/30"
        >
          <Search size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-nova-text-muted">
            <RefreshCw size={16} className="animate-spin" />
          </div>
        ) : error ? (
          <div className="p-2 text-nova-error bg-nova-error/10 rounded">{error}</div>
        ) : activeTab === 'users' ? (
          users.map((user, idx) => (
            <div key={idx} className="p-2 bg-nova-bg-secondary border border-nova-border rounded hover:border-nova-accent/50 cursor-pointer">
              <div className="font-semibold text-nova-text flex items-center gap-1">
                <User size={12} className="text-nova-accent" /> {user.cn || user.sAMAccountName || user.uid || 'User'}
              </div>
              <div className="text-[10px] text-nova-text-muted mt-1 truncate">
                {user.mail ? `Email: ${user.mail}` : user.dn}
              </div>
            </div>
          ))
        ) : (
          groups.map((group, idx) => (
            <div key={idx} className="p-2 bg-nova-bg-secondary border border-nova-border rounded hover:border-nova-accent/50 cursor-pointer">
              <div className="font-semibold text-nova-text flex items-center gap-1">
                <Shield size={12} className="text-purple-400" /> {group.cn || 'Group'}
              </div>
              <div className="text-[10px] text-nova-text-muted mt-1 truncate">
                {group.description || group.dn}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
