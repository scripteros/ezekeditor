import React, { useState } from 'react'
import { useAIStore } from '../../store/aiStore'
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Globe2,
  Info,
  Loader,
  MoreHorizontal,
  Search,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Trash2,
} from 'lucide-react'

interface ExtensionItem {
  id: string
  name: string
  description: string
  category: 'api'
  iconName: string
  iconColorClass: string
}

export default function MarketplaceCatalog() {
  const {
    acquiredAPIs,
    enabledAIProviders,
    enableAPIProvider,
    disableAPIProvider,
    acquireAPI,
    releaseAPI,
  } = useAIStore()

  const [installingId, setInstallingId] = useState<string | null>(null)
  const [installLogs, setInstallLogs] = useState<Record<string, string>>({})
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [showAcquiredPanel, setShowAcquiredPanel] = useState(true)

  const extensions: ExtensionItem[] = [
    {
      id: 'routeway',
      name: 'RouteWay',
      description: 'Provedor de IA via API RouteWay. Fornece modelos gratuitos para uso imediato.',
      category: 'api',
      iconName: 'sparkles',
      iconColorClass: 'text-primary',
    },
    {
      id: 'openrouter',
      name: 'OpenRouter',
      description: 'Provedor de IA via API OpenRouter. Requer sua chave de API nas configurações do chat.',
      category: 'api',
      iconName: 'sparkles',
      iconColorClass: 'text-[#4edea3]',
    },
    {
      id: 'opencode',
      name: 'Open Code',
      description: 'Provedor de IA via API Open Code. Fornece modelos gratuitos. Requer sua chave nas configurações.',
      category: 'api',
      iconName: 'sparkles',
      iconColorClass: 'text-[#4edea3]',
    },
    {
      id: 'groq',
      name: 'Groq',
      description: 'Provedor via API Groq. Inferência ultrarrápida com modelos Llama, Mixtral e Gemma. Requer chave no console.groq.com.',
      category: 'api',
      iconName: 'sparkles',
      iconColorClass: 'text-[#f43f5e]',
    },
    {
      id: 'openai',
      name: 'OpenAI',
      description: 'Provedor de IA via API OpenAI. Requer sua chave e modelo nas configurações do chat.',
      category: 'api',
      iconName: 'sparkles',
      iconColorClass: 'text-primary-fixed',
    },
    {
      id: 'lmstudio',
      name: 'LM Studio',
      description: 'Provedor local via LM Studio. Requer o LM Studio rodando com servidor local ativado.',
      category: 'api',
      iconName: 'sparkles',
      iconColorClass: 'text-primary-fixed',
    },
    {
      id: 'deepseek',
      name: 'DeepSeek',
      description: 'Provedor via API DeepSeek. Requer sua chave de API nas configurações do chat.',
      category: 'api',
      iconName: 'sparkles',
      iconColorClass: 'text-primary',
    },
    {
      id: 'codebuff',
      name: 'Codebuff',
      description: 'Agente nativo via API Codebuff. Requer chave própria para uso no chat.',
      category: 'api',
      iconName: 'sparkles',
      iconColorClass: 'text-primary',
    },
    {
      id: 'ollama',
      name: 'Ollama',
      description: 'Provedor local Ollama. Requer o Ollama configurado na máquina.',
      category: 'api',
      iconName: 'sparkles',
      iconColorClass: 'text-[#4edea3]',
    },
    {
      id: 'custom',
      name: 'API Personalizada',
      description: 'Conexão compatível com API customizada. Configure URL, modelo e chave no chat.',
      category: 'api',
      iconName: 'sparkles',
      iconColorClass: 'text-primary-fixed',
    },
  ]

  const isInstalled = (id: string) => true

  const isAcquired = (id: string) => acquiredAPIs.includes(id)

  const canUseInChat = (id: string) => isAcquired(id)

  const isEnabledForChat = (id: string) => enabledAIProviders.includes(id)

  const handleAcquire = (id: string) => {
    acquireAPI(id)
  }

  const handleToggleUse = (id: string) => {
    if (!canUseInChat(id)) return

    if (isEnabledForChat(id)) {
      disableAPIProvider(id)
      return
    }

    enableAPIProvider(id)
  }

  const filteredExtensions = extensions.filter(ext => {
    const matchesSearch = ext.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          ext.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || ext.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const categories = [
    { id: 'all', label: 'Todos', icon: Globe2 },
    { id: 'api', label: 'APIs de IA', icon: Sparkles },
  ] as const

  const acquiredExtensions = extensions.filter(ext => isAcquired(ext.id))

  return (
    <div className="flex-1 flex overflow-hidden bg-background">
      {/* Catalog Left sidebar */}
      <aside className="w-[260px] bg-surface-container border-r border-outline-variant flex flex-col shrink-0 select-none">
        <div className="p-4 border-b border-outline-variant flex justify-between items-center">
          <h2 className="font-label-xs text-label-xs uppercase tracking-widest text-on-surface-variant">Marketplace</h2>
          <button className="p-1 rounded text-on-surface-variant hover:text-primary hover:bg-surface-variant/30" title="Mais opções">
            <MoreHorizontal size={15} />
          </button>
        </div>
        <div className="p-4 space-y-6 flex-1 overflow-y-auto scrollbar-thin">
          <div className="relative">
            <input 
              className="w-full bg-surface-container-low border border-outline-variant rounded px-3 py-2 pr-9 text-label-xs font-label-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all placeholder:opacity-50 text-on-surface" 
              placeholder="Buscar extensões" 
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            <Search className="absolute right-3 top-2.5 text-on-surface-variant opacity-50" size={14} />
          </div>
          <nav className="flex flex-col gap-1">
            {categories.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setSelectedCategory(id)}
                className={`flex items-center gap-2 p-2 rounded text-xs font-semibold text-left transition-colors ${
                  selectedCategory === id ? 'text-primary bg-primary/5' : 'text-on-surface-variant hover:bg-surface-variant/30'
                }`}
              >
                <Icon size={14} />
                <span className="text-label-xs font-label-xs">{label}</span>
              </button>
            ))}
          </nav>
        </div>
      </aside>

      {/* Main Catalog View */}
      <main className="flex-1 overflow-y-auto editor-bg p-8 scrollbar-thin">
        <div className="max-w-5xl mx-auto">
          <header className="mb-8 flex items-start justify-between gap-4">
            <div>
              <h1 className="font-headline-lg text-headline-lg text-on-surface mb-2">Marketplace</h1>
              <p className="text-on-surface-variant max-w-2xl">Instale e gerencie extensões para melhorar seu ambiente de edição no Ezek.</p>
            </div>
            <button
              onClick={() => setShowAcquiredPanel(value => !value)}
              className="hidden xl:flex items-center gap-2 rounded border border-outline-variant bg-surface-container-low px-3 py-2 text-xs font-bold text-on-surface-variant hover:text-primary hover:border-primary/30 transition-colors"
              title={showAcquiredPanel ? 'Ocultar adquiridos' : 'Mostrar adquiridos'}
            >
              {showAcquiredPanel ? <EyeOff size={14} /> : <Eye size={14} />}
              {showAcquiredPanel ? 'Ocultar adquiridos' : 'Mostrar adquiridos'}
            </button>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-5">
            {filteredExtensions.map(ext => {
              const acquired = isAcquired(ext.id)
              const installed = isInstalled(ext.id)
              const isInstalling = installingId === ext.id
              const enabledForChat = isEnabledForChat(ext.id)

              return (
                <div
                  key={ext.id}
                  className="glass-panel p-5 rounded-lg group transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 flex flex-col min-h-[220px]"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 bg-surface-container-high rounded-lg flex items-center justify-center border border-outline-variant group-hover:border-primary/30">
                      <Sparkles size={22} className={ext.iconColorClass || 'text-primary'} />
                    </div>
                    <div className="flex items-center gap-1 text-primary text-[11px] font-bold bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                      {enabledForChat ? 'Em uso' : installed ? 'Instalado' : acquired ? 'Adquirido' : 'Disponível'}
                    </div>
                  </div>

                  <h3 className="font-headline-lg text-[18px] text-on-surface mb-1 flex items-center gap-1.5">
                    {ext.name}
                  </h3>

                  <p className="text-body-md text-on-surface-variant mb-6 text-sm h-10 overflow-hidden line-clamp-2">
                    {ext.description}
                  </p>

                  <div className="mb-5 flex items-start gap-2 rounded-md border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-[11px] leading-relaxed text-on-surface-variant">
                    <Info size={13} className="mt-0.5 shrink-0 text-primary" />
                    <span>Adquira e marque como utilizar para este provedor aparecer nas configurações da IA.</span>
                  </div>

                  <div className="flex items-center justify-between mt-auto">
                    <span className="text-label-xs text-on-tertiary-container">API de IA</span>

                    {acquired ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleUse(ext.id)}
                          className={`px-3 py-1.5 rounded text-xs font-bold transition-all active:scale-95 flex items-center gap-1 ${
                            enabledForChat
                              ? 'bg-primary/15 hover:bg-primary/25 text-primary border border-primary/30'
                              : 'bg-surface-variant/40 hover:bg-surface-variant/70 text-on-surface border border-outline-variant'
                          }`}
                          title={enabledForChat ? 'Remover das configurações do chat' : 'Mostrar nas configurações do chat'}
                        >
                          {enabledForChat ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
                          {enabledForChat ? 'Utilizando' : 'Utilizar'}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleAcquire(ext.id)}
                        className="bg-primary hover:bg-primary-container text-on-primary-container font-label-xs px-4 py-1.5 rounded transition-all active:scale-95 font-bold"
                      >
                        Adquirir
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </main>

      {/* Catalog Right workspace panel */}
      {showAcquiredPanel && (
      <aside className="w-72 bg-surface-container-lowest border-l border-outline-variant p-6 hidden xl:flex flex-col shrink-0 select-none">
        <div className="mb-6 flex items-center justify-between gap-2">
          <h2 className="font-label-xs text-label-xs uppercase tracking-widest text-on-surface-variant">Meus adquiridos</h2>
          <button
            onClick={() => setShowAcquiredPanel(false)}
            className="rounded p-1 text-on-surface-variant hover:text-primary hover:bg-surface-variant/30"
            title="Ocultar adquiridos"
          >
            <EyeOff size={14} />
          </button>
        </div>
        {acquiredExtensions.length === 0 ? (
          <div className="rounded-lg border border-outline-variant/30 bg-surface-container-low p-4 text-xs text-on-surface-variant">
            Nenhuma API adquirida ainda.
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-3 max-h-[calc(100vh-200px)] scrollbar-thin pr-2">
            {acquiredExtensions.map(ext => {
              const installed = isInstalled(ext.id)
              const enabledForChat = isEnabledForChat(ext.id)
              return (
                <div key={ext.id} className="rounded-lg border border-outline-variant bg-surface-container-high p-3 relative group">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <CheckCircle2 size={14} className="text-primary shrink-0" />
                      <span className="text-label-xs font-bold text-on-surface truncate">{ext.name}</span>
                    </div>
                    <span className={`h-2 w-2 rounded-full ${enabledForChat ? 'bg-primary' : 'bg-nova-text-muted'}`} />
                  </div>
                  <div className="mt-2 text-[10px] text-on-surface-variant">
                    {installed ? `Adquirido ${enabledForChat ? '- aparece nas configurações' : ''}` : 'Adquirido'}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => handleToggleUse(ext.id)}
                      className={`flex-1 rounded px-3 py-1.5 text-[10px] font-bold flex items-center justify-center gap-1.5 border ${
                        enabledForChat
                          ? 'border-primary/30 bg-primary/10 text-primary hover:bg-primary/20'
                          : 'border-outline-variant bg-surface-variant/40 text-on-surface hover:bg-surface-variant/70'
                      }`}
                    >
                      {enabledForChat ? <ToggleRight size={11} /> : <ToggleLeft size={11} />}
                      {enabledForChat ? 'Utilizando' : 'Utilizar'}
                    </button>
                    <button
                      onClick={() => { if(confirm(`Remover ${ext.name} dos adquiridos?`)) releaseAPI(ext.id) }}
                      className="px-3 py-1.5 rounded text-[10px] font-bold border border-outline-variant bg-surface-variant/40 text-on-surface-variant hover:bg-red-500/10 hover:text-red-400 hover:border-red-400/30 flex items-center justify-center"
                      title="Remover"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </aside>
      )}
    </div>
  )
}
