import { useLogStore } from '../../store/logStore'
import { AlertCircle, AlertTriangle, Info, Bug } from 'lucide-react'
import { useEffect, useRef } from 'react'

export default function LogPanel() {
  const { logs } = useLogStore()
  const logEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  return (
    <div className="h-full flex-1 overflow-y-auto scrollbar-thin font-mono text-[11px] bg-nova-bg">
      {logs.length === 0 && (
        <div className="flex items-center justify-center h-full text-nova-text-muted text-[10px]">
          Sem logs
        </div>
      )}
      {logs.map(log => (
        <div key={log.id} className="flex items-start gap-1.5 px-2 py-0.5 hover:bg-nova-hover/30 border-b border-nova-border/20">
          <div className="flex-shrink-0 mt-0.5">
            {log.type === 'error' && <AlertCircle size={10} className="text-nova-error" />}
            {log.type === 'warn' && <AlertTriangle size={10} className="text-nova-warning" />}
            {log.type === 'info' && <Info size={10} className="text-nova-info" />}
            {log.type === 'debug' && <Bug size={10} className="text-nova-text-muted" />}
          </div>
          <span className="text-nova-text-muted flex-shrink-0 w-14">
            {new Date(log.timestamp).toLocaleTimeString()}
          </span>
          <span className={`flex-1 ${
            log.type === 'error' ? 'text-nova-error' :
            log.type === 'warn' ? 'text-nova-warning' :
            'text-nova-text-secondary'
          }`}>
            {log.message}
          </span>
        </div>
      ))}
      <div ref={logEndRef} />
    </div>
  )
}
