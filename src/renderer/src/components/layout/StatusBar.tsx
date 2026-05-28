import { useEditorStore } from '../../store/editorStore'
import { useGitStore } from '../../store/gitStore'
import { useExplorerStore } from '../../store/explorerStore'
import { useEffect } from 'react'
import { GitBranch } from 'lucide-react'
import { getApi } from '../../utils/platform'
import { useAIStore } from '../../store/aiStore'

export default function StatusBar() {
  const { getActiveFile } = useEditorStore()
  const { status, refreshStatus, isGitRepo } = useGitStore()
  const { rootPath } = useExplorerStore()
  const { deepsProxyStatus, kimiProxyStatus, geminiProxyStatus } = useAIStore()
  const activeFile = getActiveFile()
  const api = getApi()

  useEffect(() => {
    if (rootPath && api) {
      refreshStatus(rootPath)
      const interval = setInterval(() => refreshStatus(rootPath), 5000)
      return () => clearInterval(interval)
    }
  }, [rootPath, refreshStatus])

  return (
    <div className="h-statusbar bg-nova-statusbar flex items-center justify-between px-3 text-status text-nova-statusbar-text select-none font-medium">
      <div className="flex items-center gap-4">
        {isGitRepo && status && (
          <div className="flex items-center gap-1">
            <GitBranch size={12} />
            <span>{status.currentBranch}</span>
          </div>
        )}
        {status?.changes && status.changes.length > 0 && (
          <span className="opacity-80">{status.changes.length} alterações</span>
        )}
        {!api && <span className="opacity-80">Modo Navegador</span>}
        <div className="flex items-center gap-3 border-l border-nova-statusbar-text/25 pl-4 ml-2">
          {deepsProxyStatus === 'online' && (
            <span className="flex items-center gap-1" title="DeepsProxy Online">
              <span className="w-2 h-2 rounded-full bg-green-400"></span> DeepsProxy
            </span>
          )}
          {kimiProxyStatus === 'online' && (
            <span className="flex items-center gap-1" title="KimiProxy Online">
              <span className="w-2 h-2 rounded-full bg-green-400"></span> KimiProxy
            </span>
          )}
          {geminiProxyStatus === 'online' && (
            <span className="flex items-center gap-1" title="GeminiProxy Online">
              <span className="w-2 h-2 rounded-full bg-green-400"></span> GeminiProxy
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-4">
        {activeFile && (
          <>
            <span className="opacity-80">{activeFile.language}</span>
            <span className="opacity-80">Ln 1, Col 1</span>
          </>
        )}
        <span className="opacity-80">UTF-8</span>
        <span className="opacity-80">Espaços: 2</span>
      </div>
    </div>
  )
}
