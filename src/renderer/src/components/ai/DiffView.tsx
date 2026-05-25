import { useAIStore } from '../../store/aiStore'
import { X, Check, FileCode, FilePlus, FileMinus } from 'lucide-react'

export default function DiffView() {
  const { pendingChanges, clearPendingChanges, activePlanSteps, clearPlan } = useAIStore()

  if (pendingChanges.length === 0 && activePlanSteps.length === 0) return null

  return (
    <div className="border-t border-nova-border bg-nova-bg">
      <div className="h-[35px] min-h-[35px] flex items-center justify-between px-3 bg-nova-bg-secondary border-b border-nova-border">
        <span className="text-xs font-semibold text-nova-text-secondary uppercase tracking-wider">Alterações</span>
        <button onClick={() => { clearPendingChanges(); clearPlan() }} className="p-1 text-nova-text-muted hover:text-nova-text">
          <X size={14} />
        </button>
      </div>
      <div className="max-h-[200px] overflow-y-auto scrollbar-thin">
        {activePlanSteps.map(step => (
          <div key={step.id} className="px-3 py-1.5 flex items-center gap-2 border-b border-nova-border/50">
            {step.status === 'completed' ? (
              <Check size={12} className="text-nova-success flex-shrink-0" />
            ) : step.status === 'in_progress' ? (
              <div className="w-3 h-3 border-2 border-nova-accent border-t-transparent rounded-full animate-spin flex-shrink-0" />
            ) : step.status === 'failed' ? (
              <X size={12} className="text-nova-error flex-shrink-0" />
            ) : (
              <div className="w-3 h-3 rounded-full border border-nova-text-muted flex-shrink-0" />
            )}
            <span className={`text-xs ${step.status === 'completed' ? 'text-nova-text' : 'text-nova-text-secondary'}`}>
              {step.description}
            </span>
          </div>
        ))}
        {pendingChanges.map((change, i) => (
          <div key={i} className="px-3 py-2 border-b border-nova-border/50">
            <div className="flex items-center gap-2 mb-1">
              {change.changeType === 'create' ? (
                <FilePlus size={14} className="text-nova-success" />
              ) : change.changeType === 'delete' ? (
                <FileMinus size={14} className="text-nova-error" />
              ) : (
                <FileCode size={14} className="text-nova-info" />
              )}
              <span className="text-xs text-nova-text truncate flex-1">{change.filePath}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                change.changeType === 'create' ? 'bg-nova-success/20 text-nova-success' :
                change.changeType === 'delete' ? 'bg-nova-error/20 text-nova-error' :
                'bg-nova-info/20 text-nova-info'
              }`}>
                {change.changeType}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
