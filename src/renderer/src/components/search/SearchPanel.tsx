import { useState, useEffect } from 'react'
import { Search, FileText, X, ChevronDown, ChevronRight } from 'lucide-react'
import { useEditorStore } from '../../store/editorStore'
import { useExplorerStore } from '../../store/explorerStore'
import { getApi } from '../../utils/platform'

interface SearchResult {
  filePath: string
  fileName: string
  matches: {
    line: number
    text: string
    start: number
    end: number
  }[]
}

export default function SearchPanel() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [wholeWord, setWholeWord] = useState(false)
  const [useRegex, setUseRegex] = useState(false)
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set())
  
  const { openFile } = useEditorStore()
  const { rootPath } = useExplorerStore()
  const api = getApi()

  const searchFiles = async (searchQuery: string) => {
    if (!searchQuery.trim() || !rootPath || !api) {
      setResults([])
      return
    }

    setIsSearching(true)
    try {
      const files = await api.aiListFiles(rootPath)
      const searchResults: SearchResult[] = []

      for (const file of files) {
        if (file.isDirectory) continue
        
        // Skip binary files and common directories
        if (file.path.includes('node_modules') || 
            file.path.includes('.git') || 
            file.path.includes('dist') || 
            file.path.includes('build') ||
            file.path.match(/\.(jpg|jpeg|png|gif|pdf|exe|dll|so|dylib)$/i)) {
          continue
        }

        try {
          const fileContent = await api.aiGetFile(file.path)
          if (!fileContent.exists) continue

          const lines = fileContent.content.split('\n')
          const matches: SearchResult['matches'] = []

          lines.forEach((line, index) => {
            let searchText = line
            let queryToSearch = searchQuery

            if (!caseSensitive) {
              searchText = line.toLowerCase()
              queryToSearch = searchQuery.toLowerCase()
            }

            if (useRegex) {
              try {
                const flags = caseSensitive ? 'g' : 'gi'
                const regex = new RegExp(queryToSearch, flags)
                const match = regex.exec(searchText)
                if (match) {
                  matches.push({
                    line: index + 1,
                    text: line,
                    start: match.index,
                    end: match.index + match[0].length
                  })
                }
              } catch {
                // Invalid regex, fall back to normal search
              }
            } else if (wholeWord) {
              const wordRegex = new RegExp(`\\b${queryToSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, caseSensitive ? 'g' : 'gi')
              const match = wordRegex.exec(searchText)
              if (match) {
                matches.push({
                  line: index + 1,
                  text: line,
                  start: match.index,
                  end: match.index + match[0].length
                })
              }
            } else {
              const matchIndex = searchText.indexOf(queryToSearch)
              if (matchIndex !== -1) {
                matches.push({
                  line: index + 1,
                  text: line,
                  start: matchIndex,
                  end: matchIndex + queryToSearch.length
                })
              }
            }
          })

          if (matches.length > 0) {
            searchResults.push({
              filePath: file.path,
              fileName: file.path.split(/[/\\]/).pop() || file.path,
              matches
            })
          }
        } catch (error) {
          // Skip files that can't be read
          continue
        }
      }

      setResults(searchResults)
      // Auto-expand files with few matches
      const newExpanded = new Set<string>()
      searchResults.forEach(result => {
        if (result.matches.length <= 5) {
          newExpanded.add(result.filePath)
        }
      })
      setExpandedFiles(newExpanded)
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setIsSearching(false)
    }
  }

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchFiles(query)
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [query, caseSensitive, wholeWord, useRegex, rootPath])

  const toggleFileExpansion = (filePath: string) => {
    const newExpanded = new Set(expandedFiles)
    if (newExpanded.has(filePath)) {
      newExpanded.delete(filePath)
    } else {
      newExpanded.add(filePath)
    }
    setExpandedFiles(newExpanded)
  }

  const handleResultClick = (filePath: string, line?: number) => {
    openFile(filePath)
    // TODO: Jump to line when opening file
  }

  const highlightMatch = (text: string, start: number, end: number) => {
    return (
      <>
        {text.substring(0, start)}
        <span className="bg-nova-accent/30 text-nova-accent font-medium">
          {text.substring(start, end)}
        </span>
        {text.substring(end)}
      </>
    )
  }

  const totalResults = results.reduce((sum, result) => sum + result.matches.length, 0)

  return (
    <div className="flex flex-col h-full">
      {/* Search Input */}
      <div className="p-3 border-b border-nova-border">
        <div className="relative">
          <Search size={14} className="absolute left-2 top-2.5 text-nova-text-muted" />
          <input
            type="text"
            placeholder="Pesquisar nos arquivos..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-8 pr-8 py-2 bg-nova-input-bg border border-nova-input-border rounded text-nova-text text-sm outline-none focus:border-nova-accent"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2 top-2.5 text-nova-text-muted hover:text-nova-text"
            >
              <X size={14} />
            </button>
          )}
        </div>
        
        {/* Search Options */}
        <div className="flex items-center gap-1 mt-2">
          <button
            onClick={() => setCaseSensitive(!caseSensitive)}
            className={`px-2 py-1 text-xs rounded border ${
              caseSensitive 
                ? 'bg-nova-accent text-white border-nova-accent' 
                : 'border-nova-border text-nova-text-muted hover:text-nova-text hover:border-nova-accent'
            }`}
            title="Case Sensitive"
          >
            Aa
          </button>
          <button
            onClick={() => setWholeWord(!wholeWord)}
            className={`px-2 py-1 text-xs rounded border ${
              wholeWord 
                ? 'bg-nova-accent text-white border-nova-accent' 
                : 'border-nova-border text-nova-text-muted hover:text-nova-text hover:border-nova-accent'
            }`}
            title="Whole Word"
          >
            \\b
          </button>
          <button
            onClick={() => setUseRegex(!useRegex)}
            className={`px-2 py-1 text-xs rounded border ${
              useRegex 
                ? 'bg-nova-accent text-white border-nova-accent' 
                : 'border-nova-border text-nova-text-muted hover:text-nova-text hover:border-nova-accent'
            }`}
            title="Use Regular Expression"
          >
            .*
          </button>
        </div>

        {/* Results Summary */}
        {query && (
          <div className="text-xs text-nova-text-muted mt-2">
            {isSearching ? (
              'Pesquisando...'
            ) : (
              `${totalResults} resultado${totalResults !== 1 ? 's' : ''} em ${results.length} arquivo${results.length !== 1 ? 's' : ''}`
            )}
          </div>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {!query ? (
          <div className="p-4 text-center text-nova-text-muted text-sm">
            Digite algo para pesquisar nos arquivos do projeto
          </div>
        ) : results.length === 0 && !isSearching ? (
          <div className="p-4 text-center text-nova-text-muted text-sm">
            Nenhum resultado encontrado
          </div>
        ) : (
          <div className="p-2">
            {results.map((result) => (
              <div key={result.filePath} className="mb-3">
                {/* File Header */}
                <div
                  className="flex items-center gap-1 px-1 py-1 hover:bg-nova-hover rounded cursor-pointer"
                  onClick={() => toggleFileExpansion(result.filePath)}
                >
                  {expandedFiles.has(result.filePath) ? (
                    <ChevronDown size={12} className="text-nova-text-muted" />
                  ) : (
                    <ChevronRight size={12} className="text-nova-text-muted" />
                  )}
                  <FileText size={12} className="text-nova-text-muted" />
                  <span className="text-xs text-nova-text font-medium">
                    {result.fileName}
                  </span>
                  <span className="text-xs text-nova-text-muted">
                    ({result.matches.length})
                  </span>
                </div>

                {/* Matches */}
                {expandedFiles.has(result.filePath) && (
                  <div className="ml-4 mt-1">
                    {result.matches.map((match, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-2 px-1 py-1 hover:bg-nova-hover rounded cursor-pointer text-xs"
                        onClick={() => handleResultClick(result.filePath, match.line)}
                      >
                        <span className="text-nova-text-muted min-w-[2rem] text-right">
                          {match.line}
                        </span>
                        <span className="text-nova-text flex-1 font-mono">
                          {highlightMatch(match.text.trim(), match.start, match.end)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}