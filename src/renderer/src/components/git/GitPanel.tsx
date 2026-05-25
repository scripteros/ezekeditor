import { useState, useEffect } from 'react'
import { FileText, Plus, Minus, GitCommit, RefreshCw, FolderPlus, Upload, Download, GitBranch, History, Terminal, Cloud, Trash2 } from 'lucide-react'
import { useGitStore } from '../../store/gitStore'
import { useExplorerStore } from '../../store/explorerStore'

export default function GitPanel() {
  const { 
    status, isGitRepo, refreshStatus, commit, initRepo, isLoading,
    branches, currentBranch, commits, addFiles, push, pull, getBranches, 
    createBranch, checkoutBranch, getCommits,
    remotes, currentRemote, getRemotes, addRemote, removeRemote, setCurrentRemote
  } = useGitStore()
  const { rootPath } = useExplorerStore()
  const [commitMessage, setCommitMessage] = useState('')
  const [showBranches, setShowBranches] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showRemotes, setShowRemotes] = useState(false)
  const [newBranchName, setNewBranchName] = useState('')
  const [newRemoteName, setNewRemoteName] = useState('origin')
  const [newRemoteUrl, setNewRemoteUrl] = useState('')
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncFeedback, setSyncFeedback] = useState<{type: 'success' | 'error', msg: string} | null>(null)

  useEffect(() => {
    if (rootPath) {
      refreshStatus(rootPath)
    }
  }, [rootPath, refreshStatus])

  const handleCommit = async () => {
    if (!rootPath || !commitMessage.trim()) return
    try {
      // Primeiro adicionar todos os arquivos
      await addFiles(rootPath)
      // Depois fazer commit
      await commit(rootPath, commitMessage)
      setCommitMessage('')
    } catch (error) {
      console.error('Erro ao fazer commit:', error)
    }
  }

  const handlePush = async () => {
    if (!rootPath) return
    setIsSyncing(true)
    setSyncFeedback(null)
    try {
      await push(rootPath, currentRemote || 'origin', currentBranch || 'main')
      setSyncFeedback({ type: 'success', msg: 'Push realizado com sucesso!' })
    } catch (error: any) {
      console.error('Erro ao fazer push:', error)
      setSyncFeedback({ type: 'error', msg: `Erro no Push: ${error.message || 'Verifique se você possui permissões.'}` })
    } finally {
      setIsSyncing(false)
      setTimeout(() => setSyncFeedback(null), 5000)
    }
  }

  const handlePull = async () => {
    if (!rootPath) return
    setIsSyncing(true)
    setSyncFeedback(null)
    try {
      await pull(rootPath, currentRemote || 'origin', currentBranch || 'main')
      setSyncFeedback({ type: 'success', msg: 'Pull realizado com sucesso!' })
    } catch (error: any) {
      console.error('Erro ao fazer pull:', error)
      setSyncFeedback({ type: 'error', msg: `Erro no Pull: ${error.message || 'Verifique se há conflitos.'}` })
    } finally {
      setIsSyncing(false)
      setTimeout(() => setSyncFeedback(null), 5000)
    }
  }

  const handleAddRemote = async () => {
    if (!rootPath || !newRemoteName.trim() || !newRemoteUrl.trim()) return
    try {
      await addRemote(rootPath, newRemoteName, newRemoteUrl)
      setNewRemoteName('origin')
      setNewRemoteUrl('')
    } catch (error: any) {
      console.error('Erro ao adicionar remote:', error)
      alert(`Erro: ${error.message}`)
    }
  }

  const handleRemoveRemote = async (name: string) => {
    if (!rootPath) return
    try {
      await removeRemote(rootPath, name)
    } catch (error: any) {
      console.error('Erro ao remover remote:', error)
      alert(`Erro: ${error.message}`)
    }
  }

  const handleCreateBranch = async () => {
    if (!rootPath || !newBranchName.trim()) return
    try {
      await createBranch(rootPath, newBranchName)
      setNewBranchName('')
      setShowBranches(false)
    } catch (error) {
      console.error('Erro ao criar branch:', error)
    }
  }

  const handleCheckoutBranch = async (branch: string) => {
    if (!rootPath) return
    try {
      await checkoutBranch(rootPath, branch)
      setShowBranches(false)
    } catch (error) {
      console.error('Erro ao mudar branch:', error)
    }
  }

  const handleInitRepo = async () => {
    if (!rootPath) return
    try {
      await initRepo(rootPath)
      await refreshStatus(rootPath)
    } catch (error) {
      console.error('Erro ao inicializar repositório:', error)
    }
  }

  if (!rootPath) {
    return (
      <div className="p-4 text-center">
        <p className="text-nova-text-secondary text-sm">Nenhuma pasta aberta</p>
      </div>
    )
  }

  if (!isGitRepo) {
    return (
      <div className="p-4">
        <div className="text-center mb-4">
          <FolderPlus size={48} className="text-nova-text-muted mx-auto mb-2" />
          <h3 className="text-nova-text font-medium mb-1">Git não inicializado</h3>
          <p className="text-nova-text-secondary text-sm mb-4">
            Esta pasta não é um repositório Git
          </p>
          <button
            onClick={handleInitRepo}
            className="bg-nova-accent text-white px-4 py-2 rounded-md hover:bg-nova-accent/80 transition-colors text-sm"
          >
            Inicializar Repositório
          </button>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="p-4 text-center">
        <RefreshCw size={24} className="text-nova-text-muted mx-auto mb-2 animate-spin" />
        <p className="text-nova-text-secondary text-sm">Carregando status...</p>
      </div>
    )
  }

  const stagedFiles = status?.staged || []
  const unstagedFiles = status?.unstaged || []
  const totalChanges = stagedFiles.length + unstagedFiles.length

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-nova-border">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-nova-text uppercase tracking-wider">Git</h2>
            {currentBranch && (
              <span className="text-xs bg-nova-accent/20 text-nova-accent px-1.5 py-0.5 rounded">
                {currentBranch}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                setShowRemotes(!showRemotes)
                if (!showRemotes && rootPath) getRemotes(rootPath)
              }}
              className={`p-1 rounded transition-colors ${showRemotes ? 'text-nova-text bg-nova-hover' : 'text-nova-text-muted hover:text-nova-text hover:bg-nova-hover'}`}
              title="Repositórios Remotos"
            >
              <Cloud size={14} />
            </button>
            <button
              onClick={() => {
                setShowHistory(!showHistory)
                if (!showHistory && rootPath) getCommits(rootPath)
              }}
              className={`p-1 rounded transition-colors ${showHistory ? 'text-nova-text bg-nova-hover' : 'text-nova-text-muted hover:text-nova-text hover:bg-nova-hover'}`}
              title="Histórico"
            >
              <History size={14} />
            </button>
            <button
              onClick={() => {
                setShowBranches(!showBranches)
                if (!showBranches && rootPath) getBranches(rootPath)
              }}
              className={`p-1 rounded transition-colors ${showBranches ? 'text-nova-text bg-nova-hover' : 'text-nova-text-muted hover:text-nova-text hover:bg-nova-hover'}`}
              title="Branches"
            >
              <GitBranch size={14} />
            </button>
            <button
              onClick={() => rootPath && refreshStatus(rootPath)}
              className="p-1 rounded text-nova-text-muted hover:text-nova-text hover:bg-nova-hover transition-colors"
              title="Atualizar"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* Remotes Management */}
        {showRemotes && (
          <div className="mb-3 p-2 bg-nova-bg-secondary rounded border border-nova-border">
            <h3 className="text-xs font-medium text-nova-text mb-2">Repositórios Remotos</h3>
            <div className="space-y-2">
              <div className="flex flex-col gap-1">
                <input
                  type="text"
                  value={newRemoteName}
                  onChange={(e) => setNewRemoteName(e.target.value)}
                  placeholder="Nome (ex: origin)"
                  className="w-full px-2 py-1 text-xs bg-nova-input border border-nova-border rounded text-nova-text"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newRemoteUrl}
                    onChange={(e) => setNewRemoteUrl(e.target.value)}
                    placeholder="URL (https://github.com/...)"
                    className="flex-1 px-2 py-1 text-xs bg-nova-input border border-nova-border rounded text-nova-text"
                  />
                  <button
                    onClick={handleAddRemote}
                    disabled={!newRemoteName.trim() || !newRemoteUrl.trim()}
                    className="px-2 py-1 text-xs bg-nova-accent text-white rounded hover:bg-nova-accent/80 disabled:opacity-50"
                  >
                    Adicionar
                  </button>
                </div>
              </div>
              <div className="max-h-32 overflow-y-auto mt-2">
                {remotes.length === 0 ? (
                  <p className="text-xs text-nova-text-muted text-center py-2">Nenhum remote configurado</p>
                ) : (
                  remotes.map(remote => (
                    <div
                      key={remote.name}
                      onClick={() => setCurrentRemote(remote.name)}
                      className={`group flex items-center justify-between px-2 py-1 text-xs rounded cursor-pointer hover:bg-nova-hover transition-colors ${
                        remote.name === currentRemote ? 'bg-nova-accent/20 text-nova-accent' : 'text-nova-text'
                      }`}
                    >
                      <div className="truncate flex-1 pr-2" title={remote.url}>
                        <span className="font-semibold">{remote.name}</span>: {remote.url} {remote.name === currentRemote && '(atual)'}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRemoveRemote(remote.name); }}
                        className="text-nova-error opacity-0 group-hover:opacity-100 hover:bg-nova-error/20 p-1 rounded transition-all"
                        title="Remover remote"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Branch Management */}
        {showBranches && (
          <div className="mb-3 p-2 bg-nova-bg-secondary rounded border border-nova-border">
            <h3 className="text-xs font-medium text-nova-text mb-2">Gerenciar Branches</h3>
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  placeholder="Nome do novo branch"
                  className="flex-1 px-2 py-1 text-xs bg-nova-input border border-nova-border rounded text-nova-text"
                />
                <button
                  onClick={handleCreateBranch}
                  disabled={!newBranchName.trim()}
                  className="px-2 py-1 text-xs bg-nova-accent text-white rounded hover:bg-nova-accent/80 disabled:opacity-50"
                >
                  Criar
                </button>
              </div>
              <div className="max-h-32 overflow-y-auto">
                {branches.map(branch => (
                  <button
                    key={branch}
                    onClick={() => handleCheckoutBranch(branch)}
                    className={`block w-full text-left px-2 py-1 text-xs rounded hover:bg-nova-hover transition-colors ${
                      branch === currentBranch ? 'bg-nova-accent/20 text-nova-accent' : 'text-nova-text'
                    }`}
                  >
                    {branch} {branch === currentBranch && '(atual)'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        
        {/* History */}
        {showHistory && (
          <div className="mb-3 p-2 bg-nova-bg-secondary rounded border border-nova-border">
            <h3 className="text-xs font-medium text-nova-text mb-2">Histórico de Commits</h3>
            <div className="max-h-48 overflow-y-auto space-y-2">
              {commits.map(commit => (
                <div key={commit.hash} className="p-2 bg-nova-bg border border-nova-border rounded">
                  <div className="text-xs text-nova-text truncate mb-1">{commit.message}</div>
                  <div className="text-[10px] text-nova-text-muted">
                    {commit.author_name} • {new Date(commit.date).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-nova-text-muted font-mono">
                    {commit.hash.substring(0, 8)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Push/Pull buttons */}
        {isGitRepo && (
          <div className="mb-3 flex flex-col gap-2">
            <div className="flex gap-2">
              <button
                onClick={handlePull}
                disabled={isSyncing}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs bg-nova-bg-secondary border border-nova-border rounded hover:bg-nova-hover transition-colors text-nova-text disabled:opacity-50"
                title="Pull (baixar mudanças)"
              >
                <Download size={12} />
                Pull
              </button>
              <button
                onClick={handlePush}
                disabled={isSyncing}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs bg-nova-bg-secondary border border-nova-border rounded hover:bg-nova-hover transition-colors text-nova-text disabled:opacity-50"
                title="Push (enviar mudanças)"
              >
                <Upload size={12} />
                Push
              </button>
            </div>
            {isSyncing && (
              <div className="flex items-center gap-2 text-nova-text-muted text-xs justify-center">
                <RefreshCw size={12} className="animate-spin" />
                Sincronizando com GitHub...
              </div>
            )}
            {syncFeedback && (
              <div className={`text-xs text-center p-1 rounded ${syncFeedback.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                {syncFeedback.msg}
              </div>
            )}
          </div>
        )}
        {totalChanges === 0 && (
          <p className="text-xs text-nova-text-secondary">Nenhuma alteração</p>
        )}
      </div>

      {/* Changes */}
      <div className="flex-1 overflow-auto">
        {/* Staged Files */}
        {stagedFiles.length > 0 && (
          <div className="border-b border-nova-border">
            <div className="px-3 py-2 bg-nova-bg-secondary">
              <h3 className="text-xs font-medium text-nova-text uppercase tracking-wider flex items-center gap-2">
                <Plus size={12} className="text-green-500" />
                Alterações preparadas ({stagedFiles.length})
              </h3>
            </div>
            <div className="py-1">
              {stagedFiles.map((file) => (
                <div key={file.path} className="flex items-center gap-2 px-3 py-1 hover:bg-nova-hover transition-colors">
                  <div className={`w-1 h-1 rounded-full ${
                    file.status === 'added' ? 'bg-green-500' :
                    file.status === 'modified' ? 'bg-yellow-500' :
                    file.status === 'deleted' ? 'bg-red-500' :
                    'bg-gray-500'
                  }`} />
                  <FileText size={14} className="text-nova-text-muted" />
                  <span className="text-xs text-nova-text flex-1 truncate" title={file.path}>
                    {file.path}
                  </span>
                  <span className="text-xs text-nova-text-muted uppercase">
                    {file.status === 'added' ? 'A' :
                     file.status === 'modified' ? 'M' :
                     file.status === 'deleted' ? 'D' : '?'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Unstaged Files */}
        {unstagedFiles.length > 0 && (
          <div>
            <div className="px-3 py-2 bg-nova-bg-secondary">
              <h3 className="text-xs font-medium text-nova-text uppercase tracking-wider flex items-center gap-2">
                <Minus size={12} className="text-orange-500" />
                Alterações não preparadas ({unstagedFiles.length})
              </h3>
            </div>
            <div className="py-1">
              {unstagedFiles.map((file) => (
                <div key={file.path} className="flex items-center gap-2 px-3 py-1 hover:bg-nova-hover transition-colors">
                  <div className={`w-1 h-1 rounded-full ${
                    file.status === 'added' ? 'bg-green-500' :
                    file.status === 'modified' ? 'bg-yellow-500' :
                    file.status === 'deleted' ? 'bg-red-500' :
                    'bg-gray-500'
                  }`} />
                  <FileText size={14} className="text-nova-text-muted" />
                  <span className="text-xs text-nova-text flex-1 truncate" title={file.path}>
                    {file.path}
                  </span>
                  <span className="text-xs text-nova-text-muted uppercase">
                    {file.status === 'added' ? 'A' :
                     file.status === 'modified' ? 'M' :
                     file.status === 'deleted' ? 'D' : '?'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Commit Section */}
      {totalChanges > 0 && (
        <div className="border-t border-nova-border p-3">
          <div className="space-y-2">
            <textarea
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="Mensagem do commit..."
              className="w-full p-2 text-sm bg-nova-input border border-nova-border rounded resize-none text-nova-text placeholder-nova-text-muted focus:outline-none focus:ring-1 focus:ring-nova-accent"
              rows={2}
            />
            <button
              onClick={handleCommit}
              disabled={!commitMessage.trim() || totalChanges === 0}
              className="w-full bg-nova-accent text-white px-3 py-1.5 rounded text-sm hover:bg-nova-accent/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <GitCommit size={14} />
              Commit ({totalChanges})
            </button>
          </div>
        </div>
      )}
    </div>
  )
}