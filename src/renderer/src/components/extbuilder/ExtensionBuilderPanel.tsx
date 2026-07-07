import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Puzzle, Globe, Play, RefreshCw, Search, Code, Download,
  Plus, Trash2, Copy, Check, ChevronDown, ChevronRight,
  ExternalLink, Brain, Zap, Eye, Edit3, Layers, Save,
  FileCode, Package, X, ArrowLeft, ArrowRight, Terminal,
} from 'lucide-react'
import {
  useExtensionBuilderStore,
  type PageElement,
  type BuildModification,
  buildContentScript,
} from '../../store/extensionBuilderStore'
import { useAIStore } from '../../store/aiStore'
import { useSkillStore } from '../../store/skillStore'

const ELEMENT_TYPE_COLORS: Record<string, string> = {
  a: 'text-blue-400',
  button: 'text-green-400',
  input: 'text-yellow-400',
  textarea: 'text-yellow-400',
  select: 'text-yellow-400',
  form: 'text-purple-400',
  img: 'text-pink-400',
  div: 'text-nova-text-muted',
  span: 'text-nova-text-muted',
  p: 'text-nova-text-muted',
  h1: 'text-white font-bold',
  h2: 'text-white',
  h3: 'text-white',
  header: 'text-cyan-400',
  nav: 'text-cyan-400',
  footer: 'text-cyan-400',
  section: 'text-nova-text',
  article: 'text-nova-text',
}

function getElementColor(tag: string): string {
  return ELEMENT_TYPE_COLORS[tag.toLowerCase()] || 'text-nova-text-muted'
}

function generateSelector(el: PageElement): string {
  if (el.attributes?.id) return `#${el.attributes.id}`
  if (el.attributes?.class) return `.${el.attributes.class.split(' ')[0]}`
  return el.tag
}

export default function ExtensionBuilderPanel() {
  const {
    browserUrl, setBrowserUrl,
    pageElements, pageTitle, pageText, isAnalyzing, analyzedUrl,
    setPageElements, setPageInfo, setAnalyzing, setAnalyzedUrl,
    modifications, addModification, updateModification, removeModification,
    selectedModId, setSelectedModId, clearModifications,
    project, setProject, isGenerating, setGenerating,
    lastGeneratedPath, setLastGeneratedPath,
    error, setError, chatContext, setChatContext, reset,
  } = useExtensionBuilderStore()

  const { sendMessage, togglePanel, isPanelOpen } = useAIStore()
  const { hackerMode } = useSkillStore()

  const webviewRef = useRef<any>(null)
  const [webviewElement, setWebviewElement] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'browser' | 'elements' | 'modifications' | 'preview' | 'chat'>('browser')
  const [urlInput, setUrlInput] = useState('https://example.com')
  const [searchFilter, setSearchFilter] = useState('')
  const [editingModId, setEditingModId] = useState<string | null>(null)
  const [editingCode, setEditingCode] = useState('')
  const [newModType, setNewModType] = useState<BuildModification['type']>('insert')
  const [newModSelector, setNewModSelector] = useState('')
  const [newModDesc, setNewModDesc] = useState('')
  const [previewContent, setPreviewContent] = useState('')
  const [copiedModId, setCopiedModId] = useState<string | null>(null)

  const getApi = () => (window as any).api

  // Navigate browser
  const navigate = () => {
    let url = urlInput.trim()
    if (!url) return
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`
    setBrowserUrl(url)
    webviewRef.current?.loadURL(url)
  }

  // Analyze current page
  const analyzePage = async () => {
    const webview = webviewRef.current
    if (!webview) return

    setAnalyzing(true)
    setError(null)

    try {
      const script = `(() => {
        const elements = [];
        const interactiveTags = new Set(['a', 'button', 'input', 'textarea', 'select', 'option', 'form', 'img', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'div', 'header', 'nav', 'footer', 'section', 'article', 'main', 'label', 'li', 'ul', 'ol', 'table', 'th', 'td', 'tr', 'video', 'audio', 'iframe']);
        
        document.querySelectorAll('*').forEach(el => {
          const tag = el.tagName.toLowerCase();
          if (!interactiveTags.has(tag)) return;
          
          const text = (el.textContent || '').trim().slice(0, 200);
          const id = el.id || '';
          const cls = (el.className && typeof el.className === 'string') ? el.className.slice(0, 100) : '';
          const attrs = {};
          
          for (const attr of el.attributes) {
            if (attr.name === 'class') continue;
            attrs[attr.name] = attr.value.slice(0, 200);
          }
          
          const rect = el.getBoundingClientRect();
          const isVisible = rect.width > 0 && rect.height > 0;
          if (!isVisible && tag !== 'meta' && tag !== 'title') return;
          
          // Build selector
          let selector = '';
          if (id) selector = '#' + id;
          else if (cls) selector = tag + '.' + cls.split(' ')[0];
          else selector = tag;
          
          elements.push({
            id: (tag + '_' + (id || cls || Math.random().toString(36).slice(2, 8))).slice(0, 40),
            tag,
            text,
            selector,
            attributes: attrs,
            rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
            children: el.children.length,
          });
        });
        
        return {
          title: document.title,
          url: location.href,
          text: document.body?.innerText?.slice(0, 5000) || '',
          elements: elements.slice(0, 200),
        };
      })()`

      const result = await webview.executeJavaScript(script)
      if (result) {
        setPageElements(result.elements || [])
        setPageInfo(result.title || '', result.text || '')
        setAnalyzedUrl(result.url || browserUrl)
        setBrowserUrl(result.url || browserUrl)
      }
    } catch (err: any) {
      setError(`Falha ao analisar: ${err.message}`)
    } finally {
      setAnalyzing(false)
    }
  }

  // Add simple modification
  const handleAddModification = () => {
    if (!newModSelector) return
    const desc = newModDesc || `${newModType === 'insert' ? 'Inserir' : newModType === 'modify' ? 'Modificar' : newModType === 'remove' ? 'Remover' : newModType === 'style' ? 'Estilizar' : 'Script'} em ${newModSelector}`
    addModification({
      type: newModType,
      selector: newModSelector,
      description: desc,
      code: newModType === 'insert'
        ? `const el = document.createElement('div'); el.textContent = 'Novo elemento'; el.style.cssText = 'padding:8px; background:#333; color:#0f0; border:1px solid #0f0; margin:4px;'; document.body.prepend(el);`
        : newModType === 'modify'
        ? `const el = document.querySelector('${newModSelector}'); if(el) { el.textContent = 'Texto modificado pela extensão!'; el.style.outline = '2px solid #0f0'; }`
        : newModType === 'remove'
        ? `const el = document.querySelector('${newModSelector}'); if(el) el.remove();`
        : newModType === 'style'
        ? `const el = document.querySelector('${newModSelector}'); if(el) { el.style.cssText += '; border: 2px solid #0f0 !important; box-shadow: 0 0 10px rgba(0,255,0,0.5) !important;'; }`
        : `// Custom script for ${newModSelector}
const el = document.querySelector('${newModSelector}');
if (el) {
  console.log('[Ezek Ext] Found element:', el);
  // Your custom logic here
}`,
    })
    setNewModSelector('')
    setNewModDesc('')
  }

  // Pick element from page
  const pickElementForMod = (el: PageElement) => {
    setNewModSelector(el.selector)
    setNewModDesc(`${el.tag}: ${el.text.slice(0, 60)}`)
  }

  // Generate extension
  const generateExtension = async () => {
    const contentScript = buildContentScript(modifications)
    setPreviewContent(contentScript)

    setGenerating(true)
    setError(null)

    try {
      const api = getApi()
      if (!api?.extbuilderGenerateExtension) {
        setError('API de extensão não disponível')
        setGenerating(false)
        return
      }

      const result = await api.extbuilderGenerateExtension({
        name: project?.name || 'Ezek_Extension',
        description: project?.description || `Extensão para ${browserUrl}`,
        targetUrl: browserUrl || analyzedUrl || '*://*/*',
        contentScript,
        modifications: modifications.map((m) => ({
          type: m.type,
          selector: m.selector,
          description: m.description,
          code: m.code,
        })),
      })

      if (result.success) {
        setLastGeneratedPath(result.folderPath)
        setProject({
          name: project?.name || 'Ezek Extension',
          description: project?.description || '',
          targetUrl: browserUrl || analyzedUrl,
          modifications: [...modifications],
          contentScript,
          manifest: result.manifest,
          createdAt: project?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        setPreviewContent(contentScript)
      } else {
        setError(result.error || 'Falha ao gerar extensão')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  // Save extension to folder
  const saveExtension = async () => {
    const contentScript = buildContentScript(modifications)
    setGenerating(true)
    try {
      const api = getApi()
      const result = await api?.extbuilderSaveExtension({
        name: project?.name || 'Ezek Extension',
        description: project?.description || '',
        targetUrl: browserUrl || analyzedUrl || '*://*/*',
        contentScript,
        modifications: modifications.map((m) => ({
          type: m.type,
          selector: m.selector,
          description: m.description,
          code: m.code,
        })),
      })
      if (result?.success) {
        setLastGeneratedPath(result.folderPath)
      } else {
        setError(result?.error || 'Falha')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  // Open generated extension folder
  const openExtensionFolder = async () => {
    if (!lastGeneratedPath) return
    const api = getApi()
    await api?.extbuilderOpenFolder(lastGeneratedPath)
  }

  // Send to AI
  const sendToAI = () => {
    const elementsSummary = pageElements.slice(0, 50).map((el) =>
      `<${el.tag}${el.attributes?.id ? ` id="${el.attributes.id}"` : ''}${el.attributes?.class ? ` class="${el.attributes.class}"` : ''}> "${el.text.slice(0, 80)}" [${el.selector}]`
    ).join('\n')

    const modsSummary = modifications.map((m) =>
      `- [${m.type}] ${m.selector}: ${m.description}`
    ).join('\n')

    const msg = `🔧 **Extension Builder - ${pageTitle || browserUrl}**

**Página analisada:** ${analyzedUrl || browserUrl}
**Elementos encontrados:** ${pageElements.length}

**Resumo dos elementos:**
${elementsSummary || '(Analise a página primeiro)'}

**Modificações planejadas:**
${modsSummary || '(Nenhuma ainda)'}

**Me ajude com:**
${chatContext || 'Sugira modificações para esta página. Que elementos posso adicionar, modificar ou estilizar para criar uma extensão Chrome útil?'}

Responda com código JavaScript pronto para content script (use document.querySelector para selecionar elementos).`

    sendMessage(msg)
    if (!isPanelOpen) togglePanel()
    setActiveTab('chat')
  }

  // Apply modification live via webview
  const applyModification = async (mod: BuildModification) => {
    const webview = webviewRef.current
    if (!webview || !mod.code) return

    try {
      await webview.executeJavaScript(`(() => {
        try {
          ${mod.code}
          return { ok: true };
        } catch(e) {
          return { ok: false, error: e.message };
        }
      })()`)
      updateModification(mod.id, { applied: true })
    } catch (err: any) {
      setError(`Erro ao aplicar: ${err.message}`)
    }
  }

  // Apply all modifications
  const applyAllModifications = async () => {
    const webview = webviewRef.current
    if (!webview) return

    let allOk = true
    for (const mod of modifications) {
      if (!mod.code) continue
      try {
        await webview.executeJavaScript(`(() => { try { ${mod.code}; return {ok:true}; } catch(e) { return {ok:false, error:e.message}; } })()`)
        updateModification(mod.id, { applied: true })
      } catch {
        allOk = false
      }
    }
    if (allOk) setError(null)
  }

  // Webview handlers
  useEffect(() => {
    if (!webviewElement) return
    const onLoad = () => {
      const url = webviewElement.getURL()
      if (url) setBrowserUrl(url)
    }
    webviewElement.addEventListener('did-finish-load', onLoad)
    webviewElement.addEventListener('did-navigate', onLoad)
    return () => {
      webviewElement.removeEventListener('did-finish-load', onLoad)
      webviewElement.removeEventListener('did-navigate', onLoad)
    }
  }, [webviewElement])

  const filteredElements = pageElements.filter((el) => {
    if (!searchFilter) return true
    const q = searchFilter.toLowerCase()
    return el.tag.includes(q) || el.text.toLowerCase().includes(q) || el.selector.includes(q) || (el.attributes?.id || '').includes(q)
  })

  return (
    <div className="h-full flex flex-col bg-nova-bg">
      {/* Header */}
      <div className="border-b border-nova-border bg-nova-bg-secondary shrink-0">
        <div className="h-10 px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Puzzle size={15} className="text-orange-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-nova-text">
              Extension Builder
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={openExtensionFolder}
              disabled={!lastGeneratedPath}
              className="flex items-center gap-1 px-2 py-1 rounded text-[9px] bg-nova-hover text-nova-text-muted hover:text-nova-text disabled:opacity-30"
            >
              <ExternalLink size={10} /> Abrir Pasta
            </button>
            <button
              onClick={generateExtension}
              disabled={isGenerating || modifications.length === 0}
              className="flex items-center gap-1 px-3 py-1 rounded text-[9px] bg-orange-500/15 text-orange-400 hover:bg-orange-500/25 disabled:opacity-30 font-medium"
            >
              {isGenerating ? <RefreshCw size={11} className="animate-spin" /> : <Package size={11} />}
              Gerar Extensão
            </button>
          </div>
        </div>

        {/* URL Bar */}
        <div className="h-8 px-4 flex items-center gap-2 border-t border-nova-border">
          <Globe size={12} className="text-nova-text-muted flex-shrink-0" />
          <input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && navigate()}
            placeholder="https://..."
            className="flex-1 bg-nova-input-bg border border-nova-input-border rounded px-2 py-0.5 text-[10px] font-mono text-nova-text outline-none"
          />
          <button onClick={navigate} className="flex items-center gap-1 px-2 py-0.5 rounded bg-nova-accent/10 text-nova-accent hover:bg-nova-accent/20 text-[10px]">
            <Play size={10} /> Abrir
          </button>
          <button onClick={() => webviewRef.current?.goBack()} className="p-1 rounded hover:bg-nova-hover text-nova-text-muted"><ArrowLeft size={12} /></button>
          <button onClick={() => webviewRef.current?.goForward()} className="p-1 rounded hover:bg-nova-hover text-nova-text-muted"><ArrowRight size={12} /></button>
          <button onClick={() => webviewRef.current?.reload()} className="p-1 rounded hover:bg-nova-hover text-nova-text-muted"><RefreshCw size={12} /></button>
        </div>

        {/* Tabs */}
        <div className="h-8 px-2 flex items-center gap-0.5 border-t border-nova-border">
          {[
            ['browser', 'Navegador', Globe],
            ['elements', 'Elementos', Search],
            ['modifications', 'Modificações', Edit3],
            ['preview', 'Preview', Eye],
            ['chat', 'Chat IA', Brain],
          ].map(([tab, label, Icon]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`h-7 px-3 rounded-t text-[10px] font-medium flex items-center gap-1.5 transition-colors ${
                activeTab === tab
                  ? 'bg-nova-bg text-orange-400 border-t border-l border-r border-nova-border'
                  : 'text-nova-text-muted hover:text-nova-text'
              }`}
            >
              <Icon size={11} />
              {label}
              {tab === 'elements' && <span className="text-[9px] text-nova-text-muted">({pageElements.length})</span>}
              {tab === 'modifications' && <span className="text-[9px] text-nova-text-muted">({modifications.length})</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* BROWSER TAB */}
        <div className={`${activeTab === 'browser' ? 'flex' : 'hidden'} flex-1 flex-col bg-white`}>
          <webview
            ref={(node: any) => {
              webviewRef.current = node
              if (node && node !== webviewElement) setWebviewElement(node)
            }}
            src={browserUrl || 'about:blank'}
            allowpopups="true"
            className="flex-1"
          />
          {/* Browser toolbar overlay */}
          <div className="h-10 bg-nova-bg-secondary border-t border-nova-border flex items-center gap-2 px-3 shrink-0">
            <span className="text-[10px] text-nova-text-muted truncate flex-1">{browserUrl || 'about:blank'}</span>
            <button
              onClick={analyzePage}
              disabled={isAnalyzing}
              className="flex items-center gap-1 px-3 py-1 rounded text-[10px] bg-green-500/15 text-green-400 hover:bg-green-500/25 disabled:opacity-40 font-medium"
            >
              {isAnalyzing ? <RefreshCw size={11} className="animate-spin" /> : <Search size={11} />}
              {isAnalyzing ? 'Analisando...' : 'Analisar Página'}
            </button>
            {modifications.length > 0 && (
              <button
                onClick={applyAllModifications}
                className="flex items-center gap-1 px-3 py-1 rounded text-[10px] bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 font-medium"
              >
                <Zap size={11} /> Aplicar Todas
              </button>
            )}
          </div>
        </div>

        {/* ELEMENTS TAB */}
        <div className={`${activeTab === 'elements' ? 'flex' : 'hidden'} flex-1 flex-col min-h-0`}>
          <div className="h-10 px-2 border-b border-nova-border bg-nova-bg-secondary flex items-center gap-2 shrink-0">
            <input
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Filtrar elementos..."
              className="flex-1 bg-nova-input-bg border border-nova-input-border rounded px-2 py-1 text-[10px] text-nova-text outline-none"
            />
            <button
              onClick={analyzePage}
              disabled={isAnalyzing}
              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-green-500/10 text-green-400 hover:bg-green-500/20 disabled:opacity-40"
            >
              {isAnalyzing ? <RefreshCw size={10} className="animate-spin" /> : <RefreshCw size={10} />}
            </button>
            <button
              onClick={sendToAI}
              disabled={pageElements.length === 0}
              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 disabled:opacity-40"
            >
              <Brain size={10} /> Pedir pra IA
            </button>
          </div>

          <div className="flex-1 overflow-auto scrollbar-thin">
            {pageElements.length === 0 ? (
              <div className="flex items-center justify-center h-full text-nova-text-muted">
                <div className="text-center max-w-xs">
                  <Search size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-xs font-semibold text-nova-text mb-1">Nenhum elemento analisado</p>
                  <p className="text-[10px] leading-relaxed">
                    Navegue até uma página na aba <span className="text-orange-400">Navegador</span> e clique em <span className="text-green-400">Analisar Página</span>
                  </p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-nova-border">
                {filteredElements.map((el) => (
                  <div
                    key={el.id}
                    className={`px-3 py-2 hover:bg-nova-hover/50 cursor-pointer transition-colors ${
                      newModSelector === el.selector ? 'bg-orange-500/10 border-l-2 border-l-orange-400' : ''
                    }`}
                    onClick={() => pickElementForMod(el)}
                  >
                    <div className="flex items-center gap-2">
                      <code className={`text-[10px] font-bold ${getElementColor(el.tag)}`}>&lt;{el.tag}&gt;</code>
                      {el.attributes?.id && <span className="text-[9px] text-yellow-400/70">#{el.attributes.id}</span>}
                      {el.attributes?.class && <span className="text-[9px] text-nova-text-muted truncate max-w-[150px]">.{el.attributes.class.split(' ')[0]}</span>}
                      <span className="text-[9px] text-nova-text-muted ml-auto">{el.children} filhos</span>
                    </div>
                    <p className="text-[10px] text-nova-text/80 mt-0.5 truncate">{el.text}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <code className="text-[9px] font-mono text-nova-text-muted/50">{el.selector}</code>
                      {el.rect && (
                        <span className="text-[8px] text-nova-text-muted/40">{el.rect.w}x{el.rect.h}</span>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); pickElementForMod(el); setActiveTab('modifications') }}
                        className="ml-auto text-[9px] text-orange-400 hover:text-orange-300"
                      >
                        + modificar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* MODIFICATIONS TAB */}
        <div className={`${activeTab === 'modifications' ? 'flex' : 'hidden'} flex-1 flex-col min-h-0`}>
          {/* Add new modification */}
          <div className="p-3 border-b border-nova-border bg-nova-bg-secondary space-y-2 shrink-0">
            <div className="flex items-center gap-2">
              <select
                value={newModType}
                onChange={(e) => setNewModType(e.target.value as any)}
                className="bg-nova-input-bg border border-nova-input-border rounded px-2 py-1 text-[10px] text-nova-text outline-none"
              >
                <option value="insert">Inserir</option>
                <option value="modify">Modificar</option>
                <option value="remove">Remover</option>
                <option value="style">Estilizar</option>
                <option value="script">Script</option>
              </select>
              <input
                value={newModSelector}
                onChange={(e) => setNewModSelector(e.target.value)}
                placeholder="Seletor CSS (ex: .header, #main)"
                className="flex-1 bg-nova-input-bg border border-nova-input-border rounded px-2 py-1 text-[10px] font-mono text-nova-text outline-none"
              />
              <button
                onClick={handleAddModification}
                disabled={!newModSelector}
                className="flex items-center gap-1 px-3 py-1 rounded text-[10px] bg-orange-500/15 text-orange-400 hover:bg-orange-500/25 disabled:opacity-40 font-medium"
              >
                <Plus size={10} /> Adicionar
              </button>
            </div>
            <input
              value={newModDesc}
              onChange={(e) => setNewModDesc(e.target.value)}
              placeholder="Descrição (ex: 'Adicionar botão vermelho no header')"
              className="w-full bg-nova-input-bg border border-nova-input-border rounded px-2 py-1 text-[10px] text-nova-text outline-none"
            />
          </div>

          <div className="flex-1 overflow-auto scrollbar-thin">
            {modifications.length === 0 ? (
              <div className="flex items-center justify-center h-full text-nova-text-muted">
                <div className="text-center max-w-xs">
                  <Edit3 size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-xs font-semibold text-nova-text mb-1">Nenhuma modificação</p>
                  <p className="text-[10px] leading-relaxed">
                    Analise a página e selecione elementos para modificar, ou peça para a IA sugerir modificações.
                  </p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-nova-border">
                {modifications.map((mod) => (
                  <div
                    key={mod.id}
                    className={`${mod.applied ? 'bg-green-500/5' : ''}`}
                  >
                    <div
                      className="px-3 py-2 cursor-pointer hover:bg-nova-hover/30 flex items-start gap-2"
                      onClick={() => setEditingModId(editingModId === mod.id ? null : mod.id)}
                    >
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold flex-shrink-0 ${
                        mod.type === 'insert' ? 'bg-green-500/20 text-green-400' :
                        mod.type === 'modify' ? 'bg-blue-500/20 text-blue-400' :
                        mod.type === 'remove' ? 'bg-red-500/20 text-red-400' :
                        mod.type === 'style' ? 'bg-purple-500/20 text-purple-400' :
                        'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {mod.type.toUpperCase()}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-nova-text font-medium truncate">{mod.description}</p>
                        <code className="text-[9px] font-mono text-nova-text-muted/50">{mod.selector}</code>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {mod.applied && <Check size={10} className="text-green-400" />}
                        <button
                          onClick={(e) => { e.stopPropagation(); applyModification(mod) }}
                          className="p-1 rounded hover:bg-nova-hover text-nova-text-muted hover:text-blue-400"
                          title="Aplicar na página"
                        >
                          <Play size={10} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(mod.code); setCopiedModId(mod.id); setTimeout(() => setCopiedModId(null), 1500) }}
                          className="p-1 rounded hover:bg-nova-hover text-nova-text-muted hover:text-nova-accent"
                        >
                          {copiedModId === mod.id ? <Check size={10} className="text-green-400" /> : <Copy size={10} />}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeModification(mod.id) }}
                          className="p-1 rounded hover:bg-nova-hover text-nova-text-muted hover:text-red-400"
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    </div>

                    {/* Code editor for this mod */}
                    {editingModId === mod.id && (
                      <div className="px-3 pb-3 bg-nova-bg-secondary/50">
                        <textarea
                          value={mod.code}
                          onChange={(e) => updateModification(mod.id, { code: e.target.value })}
                          className="w-full h-[150px] bg-[#0a0f0d] border border-nova-border rounded p-2 text-[10px] font-mono text-green-400 outline-none resize-none"
                          spellCheck={false}
                        />
                        <div className="flex items-center gap-2 mt-1">
                          <button
                            onClick={() => applyModification(mod)}
                            className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
                          >
                            <Play size={9} /> Testar na página
                          </button>
                          <span className="text-[8px] text-nova-text-muted ml-auto">Ctrl+Enter para aplicar</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bottom actions */}
          {modifications.length > 0 && (
            <div className="p-2 border-t border-nova-border bg-nova-bg-secondary flex items-center gap-2 shrink-0">
              <button
                onClick={applyAllModifications}
                className="flex items-center gap-1 px-2 py-1 rounded text-[9px] bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
              >
                <Zap size={9} /> Aplicar Todas
              </button>
              <button
                onClick={clearModifications}
                className="flex items-center gap-1 px-2 py-1 rounded text-[9px] text-nova-text-muted hover:text-red-400"
              >
                <Trash2 size={9} /> Limpar
              </button>
              <button
                onClick={generateExtension}
                disabled={isGenerating}
                className="ml-auto flex items-center gap-1 px-3 py-1 rounded text-[9px] bg-orange-500/15 text-orange-400 hover:bg-orange-500/25 disabled:opacity-40 font-medium"
              >
                {isGenerating ? <RefreshCw size={9} className="animate-spin" /> : <Package size={9} />}
                Gerar Extensão
              </button>
            </div>
          )}
        </div>

        {/* PREVIEW TAB */}
        <div className={`${activeTab === 'preview' ? 'flex' : 'hidden'} flex-1 flex-col min-h-0`}>
          <div className="h-10 px-3 border-b border-nova-border bg-nova-bg-secondary flex items-center gap-2 shrink-0">
            <FileCode size={13} className="text-nova-accent" />
            <span className="text-xs font-semibold text-nova-text">Preview da Extensão</span>
            <span className="text-[9px] text-nova-text-muted">content.js</span>
            <button
              onClick={() => setPreviewContent(buildContentScript(modifications))}
              className="ml-auto flex items-center gap-1 px-2 py-1 rounded text-[9px] bg-nova-hover text-nova-text-muted hover:text-nova-text"
            >
              <RefreshCw size={9} /> Atualizar
            </button>
            <button
              onClick={() => navigator.clipboard.writeText(previewContent || buildContentScript(modifications))}
              className="flex items-center gap-1 px-2 py-1 rounded text-[9px] bg-nova-accent/10 text-nova-accent hover:bg-nova-accent/20"
            >
              <Copy size={9} /> Copiar
            </button>
          </div>

          <div className="flex-1 overflow-auto bg-[#0a0f0d]">
            <pre className="p-4 text-[11px] font-mono text-green-400 leading-relaxed whitespace-pre-wrap select-text">
              {previewContent || buildContentScript(modifications)}
            </pre>
          </div>

          {/* Extension info */}
          {project && (
            <div className="p-3 border-t border-nova-border bg-nova-bg-secondary grid grid-cols-2 gap-2 text-[10px] shrink-0">
              <div>
                <span className="text-nova-text-muted">Nome:</span>
                <span className="text-nova-text ml-1">{project.manifest?.name}</span>
              </div>
              <div>
                <span className="text-nova-text-muted">Versão:</span>
                <span className="text-nova-text ml-1">{project.manifest?.version}</span>
              </div>
              <div>
                <span className="text-nova-text-muted">Manifest:</span>
                <span className="text-nova-text ml-1">v{project.manifest?.manifest_version}</span>
              </div>
              <div>
                <span className="text-nova-text-muted">Modificações:</span>
                <span className="text-nova-text ml-1">{modifications.length}</span>
              </div>
              <div className="col-span-2 flex gap-2 mt-1">
                <button
                  onClick={generateExtension}
                  disabled={isGenerating}
                  className="flex items-center gap-1 px-3 py-1 rounded text-[9px] bg-orange-500/15 text-orange-400 hover:bg-orange-500/25 disabled:opacity-40"
                >
                  <Package size={10} /> Gerar .zip
                </button>
                <button
                  onClick={saveExtension}
                  disabled={isGenerating}
                  className="flex items-center gap-1 px-3 py-1 rounded text-[9px] bg-nova-accent/10 text-nova-accent hover:bg-nova-accent/20 disabled:opacity-40"
                >
                  <Save size={10} /> Salvar em...
                </button>
                <button
                  onClick={openExtensionFolder}
                  disabled={!lastGeneratedPath}
                  className="flex items-center gap-1 px-3 py-1 rounded text-[9px] bg-nova-hover text-nova-text-muted hover:text-nova-text disabled:opacity-30"
                >
                  <ExternalLink size={10} /> Abrir Pasta
                </button>
              </div>
            </div>
          )}
        </div>

        {/* CHAT TAB */}
        <div className={`${activeTab === 'chat' ? 'flex' : 'hidden'} flex-1 flex-col min-h-0`}>
          <div className="h-10 px-3 border-b border-nova-border bg-nova-bg-secondary flex items-center gap-2 shrink-0">
            <Brain size={13} className="text-purple-400" />
            <span className="text-xs font-semibold text-nova-text">Assistente IA para Extensões</span>
          </div>

          <div className="flex-1 p-3 space-y-3 overflow-auto scrollbar-thin">
            <textarea
              value={chatContext}
              onChange={(e) => setChatContext(e.target.value)}
              placeholder="Ex: 'Adicione um botão flutuante de voltar ao topo no canto inferior direito' ou 'Modifique todos os links para abrirem em nova aba' ou 'Crie um dark mode toggle' ..."
              className="w-full h-[100px] bg-nova-input-bg border border-nova-input-border rounded p-3 text-[11px] text-nova-text outline-none resize-none placeholder:text-nova-text-muted/40"
            />
            <button
              onClick={sendToAI}
              disabled={!browserUrl && !analyzedUrl}
              className="w-full flex items-center justify-center gap-2 p-3 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-400 hover:bg-purple-500/20 font-medium transition-colors text-[11px] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Brain size={16} />
              Pedir para IA criar modificações
            </button>

            {/* Quick suggestions */}
            <div className="space-y-1">
              <p className="text-[10px] text-nova-text-muted font-medium">Sugestões rápidas:</p>
              {[
                { label: 'Botão flutuante WhatsApp', prompt: 'Crie um botão flutuante de WhatsApp no canto inferior direito com link para wa.me/55...' },
                { label: 'Dark Mode Toggle', prompt: 'Crie um botão toggle de dark mode no topo da página que inverte as cores' },
                { label: 'Tradutor automático', prompt: 'Adicione um seletor de idioma e traduza todo o texto da página automaticamente' },
                { label: 'Remover anúncios', prompt: 'Encontre e remova todos os elementos que parecem ser anúncios ou banners' },
                { label: 'Auto-refresh a cada 30s', prompt: 'Adicione um script que recarrega a página a cada 30 segundos com um contador visível' },
              ].map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => setChatContext(suggestion.prompt)}
                  className="w-full text-left px-3 py-1.5 rounded text-[10px] text-nova-text-muted hover:bg-nova-hover hover:text-nova-text transition-colors"
                >
                  <Zap size={9} className="inline mr-1 text-yellow-400" />
                  {suggestion.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="h-6 px-3 border-t border-nova-border bg-nova-bg-secondary flex items-center justify-between shrink-0">
        <span className="text-[9px] text-nova-text-muted">
          {pageElements.length > 0 ? `${pageElements.length} elementos | ${pageTitle}` : 'Pronto'}
        </span>
        <span className="text-[9px] text-nova-text-muted">
          {modifications.length} modificações | {modifications.filter((m) => m.applied).length} aplicadas
        </span>
      </div>

      {/* Error toast */}
      {error && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-red-500/90 text-white text-[10px] px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 z-50">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-white/70 hover:text-white"><X size={12} /></button>
        </div>
      )}
    </div>
  )
}
