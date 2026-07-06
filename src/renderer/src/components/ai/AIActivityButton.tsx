import { Sparkles } from 'lucide-react'
import { useAIStore } from '../../store/aiStore'

export default function AIActivityButton() {
  const { isPanelOpen, togglePanel } = useAIStore()

  return (
    <button
      title="Chat IA"
      onClick={togglePanel}
      className={`w-10 h-10 flex items-center justify-center rounded transition-all relative ${
        isPanelOpen
          ? 'text-nova-text bg-nova-hover'
          : 'text-nova-text-muted hover:text-nova-text hover:bg-nova-hover'
      }`}
    >
      {isPanelOpen && (
        <div className="absolute left-0 w-[2px] h-5 bg-nova-accent rounded-r-full" />
      )}
      <Sparkles size={22} />
    </button>
  )
}
