import { useState, useEffect } from 'react'
import { Download, X, CheckCircle, AlertTriangle } from 'lucide-react'
import { useAuthStore } from '../store/authStore'

export default function UpdateNotification() {
  const [updateState, setUpdateState] = useState<'hidden' | 'available' | 'downloading' | 'downloaded'>('hidden')
  const [version, setVersion] = useState('')
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const api = (window as any).api
    if (!api) return

    const cleanup1 = api.onAutoUpdateAvailable((info: any) => {
      setUpdateState('available')
      setVersion(info.version || '')
    })

    const cleanup2 = api.onAutoUpdateProgress((prog: any) => {
      setUpdateState('downloading')
      setProgress(prog.percent || 0)
    })

    const cleanup3 = api.onAutoUpdateDownloaded((info: any) => {
      setUpdateState('downloaded')
      setVersion(info.version || '')
    })

    // Check inicial
    if (api.checkForUpdate) {
      api.checkForUpdate().then((result: any) => {
        if (result?.updateAvailable) {
          setUpdateState('available')
          setVersion(result.version || '')
        }
      }).catch(() => {})
    }

    return () => {
      cleanup1?.()
      cleanup2?.()
      cleanup3?.()
    }
  }, [])

  const handleInstall = async () => {
    const api = (window as any).api
    if (api) {
      await api.installUpdate()
    }
  }

  if (updateState === 'hidden') return null

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className={`rounded-xl border shadow-2xl p-4 min-w-[280px] max-w-[340px] ${
        updateState === 'downloaded' 
          ? 'bg-green-900/90 border-green-500/30' 
          : 'bg-nova-bg-secondary/95 border-nova-accent/30'
      }`}>
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
            updateState === 'downloaded' ? 'bg-green-500/20' : 'bg-nova-accent/20'
          }`}>
            {updateState === 'downloaded' ? (
              <CheckCircle size={18} className="text-green-400" />
            ) : updateState === 'downloading' ? (
              <Download size={18} className="text-nova-accent animate-bounce" />
            ) : (
              <AlertTriangle size={18} className="text-nova-accent" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h4 className="text-[12px] font-semibold text-nova-text">
              {updateState === 'downloaded'
                ? 'Atualização pronta!'
                : updateState === 'downloading'
                  ? `Baixando... ${Math.round(progress)}%`
                  : 'Nova versão disponível'}
            </h4>
            <p className="text-[11px] text-nova-text-muted mt-0.5">
              {version && `v${version} - `}
              {updateState === 'downloaded'
                ? 'Reinicie para aplicar'
                : updateState === 'downloading'
                  ? 'Suas configurações serão preservadas'
                  : 'Clique para instalar'}
            </p>

            {updateState === 'downloading' && (
              <div className="mt-2 w-full h-1.5 bg-nova-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-nova-accent rounded-full transition-all duration-300"
                  style={{ width: `${Math.round(progress)}%` }}
                />
              </div>
            )}

            {updateState === 'downloaded' && (
              <button
                onClick={handleInstall}
                className="mt-2 w-full flex items-center justify-center gap-1 bg-green-500 text-white text-[11px] font-medium rounded-lg py-1.5 hover:bg-green-400 transition-colors"
              >
                <Download size={12} />
                Reiniciar agora
              </button>
            )}

            {updateState === 'available' && (
              <button
                onClick={() => {
                  const api = (window as any).api
                  if (api) api.installUpdate?.()
                }}
                className="mt-2 w-full flex items-center justify-center gap-1 bg-nova-accent text-white text-[11px] font-medium rounded-lg py-1.5 hover:bg-nova-accent-hover transition-colors"
              >
                <Download size={12} />
                Baixar e instalar
              </button>
            )}
          </div>

          <button
            onClick={() => setUpdateState('hidden')}
            className="text-nova-text-muted hover:text-nova-text shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
