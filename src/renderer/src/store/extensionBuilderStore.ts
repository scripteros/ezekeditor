import { create } from 'zustand'

export interface PageElement {
  id: string
  tag: string
  text: string
  selector: string
  attributes: Record<string, string>
  rect?: { x: number; y: number; w: number; h: number }
  children: number
}

export interface BuildModification {
  id: string
  type: 'insert' | 'modify' | 'remove' | 'style' | 'script'
  selector: string
  description: string
  code: string
  applied: boolean
}

export interface ExtensionProject {
  name: string
  description: string
  targetUrl: string
  modifications: BuildModification[]
  contentScript: string
  manifest: Record<string, any>
  createdAt: string
  updatedAt: string
}

interface ExtensionBuilderState {
  // Browser
  browserUrl: string

  // Page analysis
  pageElements: PageElement[]
  pageTitle: string
  pageText: string
  isAnalyzing: boolean
  analyzedUrl: string

  // Modifications
  modifications: BuildModification[]
  selectedModId: string | null

  // Extension project
  project: ExtensionProject | null
  isGenerating: boolean
  lastGeneratedPath: string | null
  error: string | null

  // Chat context
  chatContext: string

  // Actions
  setBrowserUrl: (url: string) => void
  setPageElements: (elements: PageElement[]) => void
  setPageInfo: (title: string, text: string) => void
  setAnalyzing: (v: boolean) => void
  setAnalyzedUrl: (url: string) => void

  addModification: (mod: Omit<BuildModification, 'id' | 'applied'>) => void
  updateModification: (id: string, updates: Partial<BuildModification>) => void
  removeModification: (id: string) => void
  setSelectedModId: (id: string | null) => void
  clearModifications: () => void

  setProject: (project: ExtensionProject | null) => void
  setGenerating: (v: boolean) => void
  setLastGeneratedPath: (path: string | null) => void
  setError: (err: string | null) => void

  setChatContext: (ctx: string) => void
  reset: () => void
}

const initialState = {
  browserUrl: '',
  pageElements: [],
  pageTitle: '',
  pageText: '',
  isAnalyzing: false,
  analyzedUrl: '',
  modifications: [],
  selectedModId: null,
  project: null,
  isGenerating: false,
  lastGeneratedPath: null,
  error: null,
  chatContext: '',
}

function getApi() {
  return (window as any).api
}

export const useExtensionBuilderStore = create<ExtensionBuilderState>()((set, get) => ({
  ...initialState,

  setBrowserUrl: (url) => set({ browserUrl: url }),
  setPageElements: (elements) => set({ pageElements: elements }),
  setPageInfo: (title, text) => set({ pageTitle: title, pageText: text }),
  setAnalyzing: (v) => set({ isAnalyzing: v }),
  setAnalyzedUrl: (url) => set({ analyzedUrl: url }),

  addModification: (mod) => set((state) => ({
    modifications: [...state.modifications, { ...mod, id: crypto.randomUUID(), applied: false }],
  })),
  updateModification: (id, updates) => set((state) => ({
    modifications: state.modifications.map((m) => (m.id === id ? { ...m, ...updates } : m)),
  })),
  removeModification: (id) => set((state) => ({
    modifications: state.modifications.filter((m) => m.id !== id),
  })),
  setSelectedModId: (id) => set({ selectedModId: id }),
  clearModifications: () => set({ modifications: [], selectedModId: null }),

  setProject: (project) => set({ project }),
  setGenerating: (v) => set({ isGenerating: v }),
  setLastGeneratedPath: (path) => set({ lastGeneratedPath: path }),
  setError: (err) => set({ error: err }),

  setChatContext: (ctx) => set({ chatContext: ctx }),

  reset: () => set(initialState),
}))

// Helper: build the full content script from all modifications
export function buildContentScript(modifications: BuildModification[]): string {
  const applied = modifications.filter((m) => !m.code.includes('// pending'))
  if (applied.length === 0 && modifications.length > 0) {
    // If no modification has real code yet, use the descriptions as comments
    const comments = modifications.map((m) => `// ${m.type}: ${m.description} (${m.selector})`).join('\n')
    return `// Extension Builder - Content Script\n// Target modifications:\n${comments}\n\nconsole.log('[Ezek Extension] Loaded');\n`
  }

  const codes = modifications
    .filter((m) => m.code && m.code.trim())
    .map((m) => `  // ${m.type}: ${m.description}\n${m.code.split('\n').map((l) => '  ' + l).join('\n')}`)

  return `// Extension Builder - Auto-generated Content Script
// Generated at: ${new Date().toISOString()}

(function() {
  'use strict';
  
  console.log('[Ezek Extension] Content script loaded');
  
  // Wait for DOM ready
  function init() {
${codes.join('\n\n')}
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
`
}
