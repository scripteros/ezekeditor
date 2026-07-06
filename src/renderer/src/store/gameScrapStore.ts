import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface TrackedElement {
  id: string
  selector: string
  label: string
  currentText: string
  currentValue: string
  currentAttribute: string
  attributeName: string
  history: Array<{ text: string; value: string; time: number }>
  enabled: boolean
  clickable: boolean
  clickInterval: number
  lastClicked: number
}

export interface ScrapedItem {
  id: string
  selector: string
  label: string
  value: string
  scrapedAt: number
  format: 'text' | 'html' | 'attribute'
}

interface ActiveActions {
  clicks: string[]
  extractions: string[]
  navigations: string[]
  inputs: Array<{ selector: string; value: string; time: number }>
}

interface GameScrapState {
  // Browser
  browserUrl: string
  isBrowserActive: boolean

  // Game tab
  trackedElements: TrackedElement[]
  selectedElementId: string | null
  editingElementId: string | null
  isWatching: boolean

  // Web Scrap tab
  scrapedItems: ScrapedItem[]
  scrapCodeOutput: string

  // Actions log (cliques, extrações, navegações)
  activeActions: ActiveActions

  // Navigation
  setBrowserUrl: (url: string) => void
  setBrowserActive: (active: boolean) => void

  // Tracked elements
  addTrackedElement: (el: Omit<TrackedElement, 'id' | 'currentText' | 'currentValue' | 'currentAttribute' | 'history' | 'lastClicked'>) => void
  updateTrackedElement: (id: string, updates: Partial<TrackedElement>) => void
  removeTrackedElement: (id: string) => void
  updateElementValue: (id: string, text: string, value: string, attr?: string) => void
  setSelectedElement: (id: string | null) => void
  setEditingElement: (id: string | null) => void
  setWatching: (watching: boolean) => void
  recordClick: (id: string) => void

  // Scrap
  addScrapedItem: (item: Omit<ScrapedItem, 'id' | 'scrapedAt'>) => void
  clearScrapedItems: () => void
  setScrapCodeOutput: (code: string) => void
  appendScrapCodeOutput: (code: string) => void

  // Actions log
  logClick: (selector: string) => void
  logExtraction: (selector: string) => void
  logNavigation: (url: string) => void
  logInput: (selector: string, value: string) => void
  clearActions: () => void

  // Context for AI
  getGameContextPrompt: () => string
  getScrapContextPrompt: () => string
}

function genId() { return `el-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }

export const useGameScrapStore = create<GameScrapState>()(
  persist(
    (set, get) => ({
      browserUrl: '',
      isBrowserActive: false,
      trackedElements: [],
      selectedElementId: null,
      editingElementId: null,
      isWatching: false,
      scrapedItems: [],
      scrapCodeOutput: '',
      activeActions: { clicks: [], extractions: [], navigations: [], inputs: [] },

      setBrowserUrl: (url) => set({ browserUrl: url }),
      setBrowserActive: (active) => set({ isBrowserActive: active }),

      addTrackedElement: (el) => {
        const elem: TrackedElement = {
          id: genId(),
          ...el,
          currentText: '',
          currentValue: '',
          currentAttribute: '',
          history: [],
          lastClicked: 0,
        }
        set(s => ({ trackedElements: [...s.trackedElements, elem] }))
      },

      updateTrackedElement: (id, updates) => {
        set(s => ({
          trackedElements: s.trackedElements.map(e => e.id === id ? { ...e, ...updates } : e),
          editingElementId: null,
        }))
      },

      removeTrackedElement: (id) => {
        set(s => ({
          trackedElements: s.trackedElements.filter(e => e.id !== id),
          selectedElementId: s.selectedElementId === id ? null : s.selectedElementId,
          editingElementId: s.editingElementId === id ? null : s.editingElementId,
        }))
      },

      updateElementValue: (id, text, value, attr) => {
        set(s => ({
          trackedElements: s.trackedElements.map(e => {
            if (e.id !== id) return e
            const changed = e.currentText !== text || e.currentValue !== value
            return {
              ...e,
              currentText: text,
              currentValue: value,
              currentAttribute: attr ?? e.currentAttribute,
              history: changed ? [
                ...e.history.slice(-49),
                { text: e.currentText, value: e.currentValue, time: Date.now() },
              ] : e.history,
            }
          })
        }))
      },

      setSelectedElement: (id) => set({ selectedElementId: id }),
      setEditingElement: (id) => set({ editingElementId: id }),
      setWatching: (watching) => set({ isWatching: watching }),

      recordClick: (id) => {
        set(s => ({
          trackedElements: s.trackedElements.map(e => e.id === id ? { ...e, lastClicked: Date.now() } : e),
        }))
      },

      addScrapedItem: (item) => {
        const scraped: ScrapedItem = {
          id: genId(),
          ...item,
          scrapedAt: Date.now(),
        }
        set(s => ({ scrapedItems: [...s.scrapedItems, scraped] }))
      },

      clearScrapedItems: () => set({ scrapedItems: [], scrapCodeOutput: '' }),

      setScrapCodeOutput: (code) => set({ scrapCodeOutput: code }),
      appendScrapCodeOutput: (code) => set(s => ({ scrapCodeOutput: s.scrapCodeOutput + '\n' + code })),

      logClick: (selector) => {
        set(s => ({
          activeActions: { ...s.activeActions, clicks: [selector, ...s.activeActions.clicks.slice(0, 49)] }
        }))
      },
      logExtraction: (selector) => {
        set(s => ({
          activeActions: { ...s.activeActions, extractions: [selector, ...s.activeActions.extractions.slice(0, 49)] }
        }))
      },
      logNavigation: (url) => {
        set(s => ({
          activeActions: { ...s.activeActions, navigations: [url, ...s.activeActions.navigations.slice(0, 19)] }
        }))
      },
      logInput: (selector, value) => {
        set(s => ({
          activeActions: { ...s.activeActions, inputs: [{ selector, value, time: Date.now() }, ...s.activeActions.inputs.slice(0, 49)] }
        }))
      },
      clearActions: () => set({ activeActions: { clicks: [], extractions: [], navigations: [], inputs: [] } }),

      getGameContextPrompt: () => {
        const { trackedElements, browserUrl, activeActions } = get()
        if (!browserUrl) return ''

        const enabledElements = trackedElements.filter(e => e.enabled)
        if (enabledElements.length === 0) return ''

        let prompt = `\n\n[🎮 CONTEXTO DO JOGO — TEMPO REAL]\n🌐 URL: ${browserUrl}\n\n## Elementos Monitorados:\n`

        for (const el of enabledElements) {
          prompt += `- **${el.label}** (selector: \`${el.selector}\`)`
          if (el.currentText) prompt += ` → "${el.currentText}"`
          if (el.currentValue) prompt += ` (valor: "${el.currentValue}")`
          if (el.currentAttribute) prompt += ` (attr: "${el.currentAttribute}")`
          if (el.clickable) prompt += ` [CLICÁVEL]`
          if (el.history.length > 0) {
            prompt += `\n  Histórico recente: ${el.history.slice(-3).map(h => `"${h.text || h.value}"`).join(' → ')}`
          }
          prompt += '\n'
        }

        if (activeActions.clicks.length > 0) {
          prompt += `\n## Ações Recentes:\n`
          prompt += `- Cliques: ${activeActions.clicks.slice(0, 5).join(', ')}\n`
        }

        prompt += `\n⚠️ Você pode usar ações JSON para interagir:\n`
        prompt += `- \`{"type":"click_element","selector":"..."}\` — Clicar em um elemento\n`
        prompt += `- \`{"type":"extract_element","selector":"..."}\` — Extrair texto de um elemento\n`
        prompt += `- \`{"type":"navigate_to","url":"..."}\` — Navegar para uma URL\n`
        prompt += `- \`{"type":"input_text","selector":"...","value":"..."}\` — Digitar em um campo\n`

        return prompt
      },

      getScrapContextPrompt: () => {
        const { scrapedItems, scrapCodeOutput, browserUrl } = get()
        if (!browserUrl && scrapedItems.length === 0) return ''

        let prompt = `\n\n[🕷️ CONTEXTO DE WEB SCRAPING]\n🌐 URL: ${browserUrl}\n\n## Itens Capturados (${scrapedItems.length}):\n`

        for (const item of scrapedItems.slice(0, 30)) {
          prompt += `- **${item.label}** (\`${item.selector}\`) [${item.format}]\n  Valor: "${item.value.slice(0, 200)}"\n`
        }

        if (scrapCodeOutput) {
          prompt += `\n## Código Acumulado:\n\`\`\`\n${scrapCodeOutput.slice(0, 2000)}\n\`\`\`\n`
        }

        return prompt
      },
    }),
    {
      name: 'ezek-gamescrap-storage',
      partialize: (state) => ({
        trackedElements: state.trackedElements,
        scrapedItems: state.scrapedItems,
        scrapCodeOutput: state.scrapCodeOutput,
      }),
    }
  )
)

// Register store for lazy access
if (typeof window !== 'undefined') {
  ;(window as any).__zustandStores = { ...((window as any).__zustandStores || {}), gameScrap: useGameScrapStore }
}
