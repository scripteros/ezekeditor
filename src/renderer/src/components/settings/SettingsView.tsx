import React, { useEffect, useMemo, useState } from 'react'
import {
  Bot,
  Check,
  Code2,
  Keyboard,
  Monitor,
  Moon,
  Palette,
  RotateCw,
  Shield,
  Sparkles,
  Sun,
  Terminal,
} from 'lucide-react'
import { useSidebarStore } from '../../store/sidebarStore'
import { useThemeStore } from '../../store/themeStore'

const settingsMeta = {
  appearance: {
    title: 'Aparência',
    description: 'Ajuste tema, transparência e leitura visual da interface.',
    icon: Palette,
  },
  editor: {
    title: 'Editor',
    description: 'Controle fonte, cursor e sugestões exibidas no Monaco.',
    icon: Code2,
  },
  terminal: {
    title: 'Terminal',
    description: 'Preferências visuais e comportamentais do terminal integrado.',
    icon: Terminal,
  },
  keybindings: {
    title: 'Atalhos',
    description: 'Personalização dos comandos de teclado do editor.',
    icon: Keyboard,
  },
  sync: {
    title: 'Sincronização',
    description: 'Configurações futuras para sincronizar preferências e extensões.',
    icon: RotateCw,
  },
  security: {
    title: 'Segurança',
    description: 'Preferências de privacidade, proxy e execução local.',
    icon: Shield,
  },
} as const

type SettingsSection = keyof typeof settingsMeta

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      onClick={onChange}
      className={`w-9 h-5 rounded-full p-0.5 transition-colors relative flex items-center ${
        checked ? 'bg-nova-accent' : 'bg-nova-border'
      }`}
      aria-label={label}
      aria-pressed={checked}
    >
      <span
        className={`w-4 h-4 rounded-full bg-nova-bg transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

function SettingRow({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h4 className="text-xs font-bold text-nova-text mb-0.5">{title}</h4>
        <p className="text-[11px] text-nova-text-secondary">{description}</p>
      </div>
      {children}
    </div>
  )
}

function EmptySection({ section }: { section: SettingsSection }) {
  const meta = settingsMeta[section]
  const Icon = meta.icon

  return (
    <div className="glass-panel rounded-lg border border-nova-border/30 p-8 text-center">
      <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-lg border border-nova-accent/20 bg-nova-accent/10 text-nova-accent">
        <Icon size={20} />
      </div>
      <h2 className="text-sm font-bold text-nova-text">{meta.title}</h2>
      <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-nova-text-secondary">
        Esta área já está pronta na navegação. Os controles específicos entram aqui quando a funcionalidade correspondente for ligada ao app.
      </p>
    </div>
  )
}

export default function SettingsView() {
  const { theme, setTheme } = useThemeStore()
  const { activeSettingsSection } = useSidebarStore()
  const section = (activeSettingsSection in settingsMeta ? activeSettingsSection : 'appearance') as SettingsSection
  const meta = settingsMeta[section]
  const HeaderIcon = meta.icon

  const [colorTheme, setColorTheme] = useState(() =>
    localStorage.getItem('ezek-settings-theme') || 'dark-modern'
  )
  const [glassmorphism, setGlassmorphism] = useState(() =>
    localStorage.getItem('ezek-settings-glass') !== 'false'
  )
  const [opacity, setOpacity] = useState(() =>
    Number(localStorage.getItem('ezek-settings-opacity') || '80')
  )
  const [blurAmount, setBlurAmount] = useState(() =>
    Number(localStorage.getItem('ezek-settings-blur') || '12')
  )
  const [fontFamily, setFontFamily] = useState(() =>
    localStorage.getItem('ezek-settings-font') || "'JetBrains Mono', monospace"
  )
  const [codeEditorTheme, setCodeEditorTheme] = useState(() =>
    localStorage.getItem('ezek-settings-code-editor-theme') || 'auto'
  )
  const [pulseCursor, setPulseCursor] = useState(() =>
    localStorage.getItem('ezek-settings-pulse') !== 'false'
  )
  const [fontLigatures, setFontLigatures] = useState(() =>
    localStorage.getItem('ezek-settings-ligatures') === 'true'
  )
  const [ghostText, setGhostText] = useState(() =>
    localStorage.getItem('ezek-settings-ghost-text') !== 'false'
  )
  const [refactorLevel, setRefactorLevel] = useState(() =>
    localStorage.getItem('ezek-settings-refactor') || 'medium'
  )
  const [terminalFontSize, setTerminalFontSize] = useState(() =>
    Number(localStorage.getItem('ezek-settings-terminal-font-size') || '13')
  )
  const [terminalCursorBlink, setTerminalCursorBlink] = useState(() =>
    localStorage.getItem('ezek-settings-terminal-cursor-blink') !== 'false'
  )

  const selectedThemeId = useMemo(() => (theme.type === 'dark' ? 'dark-modern' : 'cyber-mint'), [theme.type])

  useEffect(() => {
    localStorage.setItem('ezek-settings-theme', colorTheme)
    localStorage.setItem('ezek-settings-glass', String(glassmorphism))
    localStorage.setItem('ezek-settings-opacity', String(opacity))
    localStorage.setItem('ezek-settings-blur', String(blurAmount))
    localStorage.setItem('ezek-settings-font', fontFamily)
    localStorage.setItem('ezek-settings-code-editor-theme', codeEditorTheme)
    localStorage.setItem('ezek-settings-pulse', String(pulseCursor))
    localStorage.setItem('ezek-settings-ligatures', String(fontLigatures))
    localStorage.setItem('ezek-settings-ghost-text', String(ghostText))
    localStorage.setItem('ezek-settings-refactor', refactorLevel)
    localStorage.setItem('ezek-settings-terminal-font-size', String(terminalFontSize))
    localStorage.setItem('ezek-settings-terminal-cursor-blink', String(terminalCursorBlink))

    const root = document.documentElement
    if (glassmorphism) {
      root.style.setProperty('--glass-opacity', `${opacity / 100}`)
      root.style.setProperty('--glass-blur', `${blurAmount}px`)
      root.style.setProperty('--glass-backdrop', 'blur(var(--glass-blur))')
    } else {
      root.style.setProperty('--glass-opacity', '0.95')
      root.style.setProperty('--glass-blur', '0px')
      root.style.setProperty('--glass-backdrop', 'none')
    }

    window.dispatchEvent(new Event('ezek-settings-changed'))
  }, [
    colorTheme,
    glassmorphism,
    opacity,
    blurAmount,
    fontFamily,
    codeEditorTheme,
    pulseCursor,
    fontLigatures,
    ghostText,
    refactorLevel,
    terminalFontSize,
    terminalCursorBlink,
  ])

  const renderAppearance = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="glass-panel p-6 rounded-lg border border-nova-border/30 flex flex-col min-h-[190px]">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-sm font-bold text-nova-text mb-0.5">Tema de cor</h3>
            <p className="text-[11px] text-nova-text-secondary">Escolha o contraste principal da interface.</p>
          </div>
          <Palette size={18} className="text-nova-text-secondary" />
        </div>

        <div className="grid grid-cols-2 gap-3 mt-auto">
          {[
            { id: 'dark-modern', label: 'Escuro', themeId: 'ezek-dark' },
            { id: 'cyber-mint', label: 'Claro', themeId: 'ezek-light' },
          ].map(item => {
            const active = selectedThemeId === item.id
            return (
              <button
                key={item.id}
                onClick={() => {
                  setColorTheme(item.id)
                  setTheme(item.themeId)
                }}
                className={`flex items-center justify-center gap-2 rounded border px-3 py-2 text-xs font-semibold transition-all ${
                  active
                    ? 'border-nova-accent text-nova-accent bg-nova-accent/10'
                    : 'border-nova-border text-nova-text-secondary hover:bg-nova-hover'
                }`}
              >
                {active && <Check size={13} />}
                {item.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="glass-panel p-6 rounded-lg border border-nova-border/30 flex flex-col min-h-[190px]">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-sm font-bold text-nova-text mb-0.5">Vidro</h3>
            <p className="text-[11px] text-nova-text-secondary">Aplica transparência e desfoque nos painéis.</p>
          </div>
          <Toggle checked={glassmorphism} onChange={() => setGlassmorphism(!glassmorphism)} label="Alternar efeito de vidro" />
        </div>

        <div className={`space-y-3 transition-opacity ${glassmorphism ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
          <div className="flex justify-between items-center text-xs">
            <span className="text-nova-text-secondary">Opacidade</span>
            <span className="font-semibold text-nova-text">{opacity}%</span>
          </div>
          <input
            type="range"
            min="10"
            max="100"
            value={opacity}
            onChange={e => setOpacity(Number(e.target.value))}
            className="w-full accent-nova-accent h-1 bg-nova-bg-tertiary rounded-lg appearance-none cursor-pointer"
          />

          <div className="flex justify-between items-center text-xs mt-1">
            <span className="text-nova-text-secondary">Desfoque</span>
            <span className="font-semibold text-nova-text">{blurAmount}px</span>
          </div>
          <input
            type="range"
            min="0"
            max="24"
            value={blurAmount}
            onChange={e => setBlurAmount(Number(e.target.value))}
            className="w-full accent-nova-accent h-1 bg-nova-bg-tertiary rounded-lg appearance-none cursor-pointer"
          />
        </div>
      </div>
    </div>
  )

  const renderEditor = () => (
    <div className="space-y-6">
      <div className="glass-panel rounded-lg border border-nova-border/30 divide-y divide-nova-border/20">
        <SettingRow title="Tema do editor de código" description="Muda somente o canvas onde os arquivos são editados.">
          <div className="flex bg-nova-input-bg border border-nova-input-border rounded p-1 w-fit">
            {[
              { id: 'auto', label: 'Auto', icon: Monitor },
              { id: 'dark', label: 'Escuro', icon: Moon },
              { id: 'light', label: 'Claro', icon: Sun },
            ].map(({ id, label, icon: Icon }) => {
              const isActive = codeEditorTheme === id
              return (
                <button
                  key={id}
                  onClick={() => setCodeEditorTheme(id)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-nova-accent text-nova-statusbar-text'
                      : 'text-nova-text-secondary hover:text-nova-text'
                  }`}
                >
                  <Icon size={13} />
                  {label}
                </button>
              )
            })}
          </div>
        </SettingRow>

        <SettingRow title="Fonte do editor" description="Fonte usada no canvas de código.">
          <select
            value={fontFamily}
            onChange={e => setFontFamily(e.target.value)}
            className="bg-nova-input-bg border border-nova-input-border rounded px-3 py-1.5 text-xs text-nova-text focus:ring-1 focus:ring-nova-accent focus:border-nova-accent outline-none"
          >
            <option value="'JetBrains Mono', monospace">JetBrains Mono</option>
            <option value="'Fira Code', monospace">Fira Code</option>
            <option value="Consolas, monospace">Consolas</option>
          </select>
        </SettingRow>

        <SettingRow title="Cursor pulsante" description="Ativa uma animacao discreta no cursor do editor.">
          <Toggle checked={pulseCursor} onChange={() => setPulseCursor(!pulseCursor)} label="Alternar cursor pulsante" />
        </SettingRow>

        <SettingRow title="Ligaduras de fonte" description="Combina caracteres como => e === quando a fonte suporta.">
          <Toggle checked={fontLigatures} onChange={() => setFontLigatures(!fontLigatures)} label="Alternar ligaduras" />
        </SettingRow>
      </div>

      <div className="glass-panel rounded-lg border border-nova-border/30 divide-y divide-nova-border/20">
        <SettingRow title="Sugestões fantasma" description="Mostra previsões inline de autocomplete em tempo real.">
          <Toggle checked={ghostText} onChange={() => setGhostText(!ghostText)} label="Alternar sugestões fantasma" />
        </SettingRow>

        <SettingRow title="Automação de refatoração" description="Equilibra velocidade de execução e profundidade de otimização.">
          <div className="flex bg-nova-input-bg border border-nova-input-border rounded p-1 w-fit">
            {(['low', 'medium', 'high'] as const).map(level => {
              const isActive = refactorLevel === level
              const label = level === 'low' ? 'Baixa' : level === 'medium' ? 'Media' : 'Alta'
              return (
                <button
                  key={level}
                  onClick={() => setRefactorLevel(level)}
                  className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-nova-accent text-nova-statusbar-text'
                      : 'text-nova-text-secondary hover:text-nova-text'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </SettingRow>
      </div>
    </div>
  )

  const renderTerminal = () => (
    <div className="glass-panel rounded-lg border border-nova-border/30 divide-y divide-nova-border/20">
      <SettingRow title="Tamanho da fonte" description="Tamanho base usado pelas novas sessões do terminal.">
        <div className="flex items-center gap-3">
          <input
            type="range"
            min="10"
            max="18"
            value={terminalFontSize}
            onChange={e => setTerminalFontSize(Number(e.target.value))}
            className="w-36 accent-nova-accent"
          />
          <span className="w-10 text-right text-xs font-semibold text-nova-text">{terminalFontSize}px</span>
        </div>
      </SettingRow>

      <SettingRow title="Cursor piscando" description="Ativa o piscar do cursor para facilitar localização no terminal.">
        <Toggle checked={terminalCursorBlink} onChange={() => setTerminalCursorBlink(!terminalCursorBlink)} label="Alternar cursor do terminal" />
      </SettingRow>
    </div>
  )

  const renderContent = () => {
    if (section === 'appearance') return renderAppearance()
    if (section === 'editor') return renderEditor()
    if (section === 'terminal') return renderTerminal()
    return <EmptySection section={section} />
  }

  return (
    <main className="flex-1 overflow-y-auto bg-nova-bg text-nova-text font-sans p-8 scrollbar-thin editor-bg">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-nova-accent/20 bg-nova-accent/10 text-nova-accent">
              <HeaderIcon size={19} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-nova-text mb-1">{meta.title}</h1>
            <p className="text-sm text-nova-text-secondary">{meta.description}</p>
          </div>
          {section === 'editor' && (
            <span className="hidden sm:flex items-center gap-1.5 rounded border border-nova-accent/30 bg-nova-accent/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-nova-accent">
              <Bot size={12} />
              IA ativa
            </span>
          )}
          {section === 'appearance' && (
            <span className="hidden sm:flex items-center gap-1.5 rounded border border-nova-accent/30 bg-nova-accent/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-nova-accent">
              <Sparkles size={12} />
              Visual
            </span>
          )}
        </header>

        {renderContent()}
      </div>
    </main>
  )
}
