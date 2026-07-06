import { useState, useEffect } from 'react';
import { 
  FolderOpen, 
  FileCode, 
  Settings, 
  ChevronRight, 
  ChevronLeft,
  Github,
  FileText,
  Image,
  FileJson,
  File,
  Search,
  X,
  RefreshCw
} from 'lucide-react';
import { useEditorStore } from '../store/editorStore';
import { getFileIcon, isBinaryFile } from '../utils/fileIcons';
import { findFiles, readFileContent, saveFile } from '../utils/fileSystem';

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar({ isCollapsed, onToggleCollapse }: SidebarProps) {
  const { 
    files, 
    activeFileId, 
    openFiles, 
    openFile, 
    closeFile, 
    setActiveFile,
    updateFileContent,
    addFile,
    removeFile,
    setFiles,
    projectPath,
    setProjectPath
  } = useEditorStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<{ path: string; name: string }[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // Load project files when projectPath changes
  useEffect(() => {
    if (projectPath) {
      loadProjectFiles(projectPath);
    }
  }, [projectPath]);

  const loadProjectFiles = async (path: string) => {
    try {
      const fileList = await findFiles(path);
      setFiles(fileList);
      
      // Auto-expand root folder
      if (fileList.length > 0 && fileList[0].type === 'folder') {
        setExpandedFolders(prev => new Set(prev).add(fileList[0].path));
      }
    } catch (error) {
      console.error('Error loading project files:', error);
    }
  };

  const handleFileClick = async (filePath: string, fileName: string) => {
    try {
      // Check if file is already open
      const existingFile = openFiles.find(f => f.path === filePath);
      if (existingFile) {
        setActiveFile(existingFile.id);
        return;
      }

      // Read file content
      const content = await readFileContent(filePath);
      const isBinary = isBinaryFile(fileName);
      
      // Create new file in store
      const newFile = {
        id: `file-${Date.now()}`,
        name: fileName,
        path: filePath,
        content: isBinary ? '[Arquivo binário não pode ser exibido]' : content,
        language: getLanguageFromExtension(fileName),
        isDirty: false,
        isBinary
      };
      
      addFile(newFile);
      setActiveFile(newFile.id);
    } catch (error) {
      console.error('Error opening file:', error);
    }
  };

  const handleCloseFile = (fileId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    closeFile(fileId);
  };

  const getLanguageFromExtension = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'html': 'html',
      'css': 'css',
      'json': 'json',
      'md': 'markdown',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'go': 'go',
      'rs': 'rust',
      'php': 'php',
      'rb': 'ruby',
      'vue': 'vue',
      'svelte': 'svelte'
    };
    return languageMap[ext || ''] || 'plaintext';
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || !projectPath) return;
    
    setIsSearching(true);
    try {
      const results = await findFiles(projectPath, searchQuery);
      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
  };

  const toggleFolder = (folderPath: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderPath)) {
        newSet.delete(folderPath);
      } else {
        newSet.add(folderPath);
      }
      return newSet;
    });
  };

  const renderFileTree = (items: typeof files, level = 0) => {
    return items.map((item) => {
      const isExpanded = expandedFolders.has(item.path);
      
      if (item.type === 'folder') {
        return (
          <div key={item.path}>
            <div
              className="flex items-center gap-1 px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer rounded transition-colors"
              style={{ paddingLeft: `${level * 12 + 8}px` }}
              onClick={() => toggleFolder(item.path)}
            >
              <ChevronRight 
                size={14} 
                className={`transition-transform ${isExpanded ? 'rotate-90' : ''} text-gray-500`}
              />
              <FolderOpen size={14} className="text-blue-500" />
              <span className="text-sm truncate flex-1">{item.name}</span>
            </div>
            {isExpanded && item.children && (
              <div>{renderFileTree(item.children, level + 1)}</div>
            )}
          </div>
        );
      } else {
        const Icon = getFileIcon(item.name);
        return (
          <div
            key={item.path}
            className="flex items-center gap-2 px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer rounded transition-colors"
            style={{ paddingLeft: `${level * 12 + 20}px` }}
            onClick={() => handleFileClick(item.path, item.name)}
          >
            <Icon size={14} className="text-gray-500" />
            <span className="text-sm truncate flex-1">{item.name}</span>
          </div>
        );
      }
    });
  };

  if (isCollapsed) {
    return (
      <div className="w-12 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col items-center py-4 gap-2">
        <button
          onClick={onToggleCollapse}
          className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg transition-colors"
          title="Expandir barra lateral"
        >
          <ChevronRight size={20} />
        </button>
      </div>
    );
  }

  return (
    <div className="w-64 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Explorador</h2>
          <button
            onClick={onToggleCollapse}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-800 rounded transition-colors"
            title="Recolher barra lateral"
          >
            <ChevronLeft size={16} />
          </button>
        </div>
        
        {/* Search Bar */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Buscar arquivos..."
            className="w-full px-2 py-1 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {searchQuery && (
            <button
              onClick={clearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2">
        {searchResults.length > 0 ? (
          <div>
            <div className="text-xs text-gray-500 mb-2">
              {searchResults.length} resultado(s) encontrado(s)
            </div>
            {searchResults.map((result) => {
              const Icon = getFileIcon(result.name);
              return (
                <div
                  key={result.path}
                  className="flex items-center gap-2 px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer rounded transition-colors"
                  onClick={() => handleFileClick(result.path, result.name)}
                >
                  <Icon size={14} className="text-gray-500" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{result.name}</div>
                    <div className="text-xs text-gray-500 truncate">{result.path}</div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-1">
            {renderFileTree(files)}
          </div>
        )}
      </div>

      {/* Open Files Section */}
      {openFiles.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-800">
          <div className="p-2 text-xs font-semibold text-gray-500">ABERTOS</div>
          <div className="px-2 pb-2 space-y-1">
            {openFiles.map((file) => {
              const Icon = getFileIcon(file.name);
              const isActive = activeFileId === file.id;
              return (
                <div
                  key={file.id}
                  className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer transition-colors ${
                    isActive 
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' 
                      : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                  onClick={() => setActiveFile(file.id)}
                >
                  <Icon size={14} className="text-gray-500" />
                  <span className="text-sm truncate flex-1">{file.name}</span>
                  <button
                    onClick={(e) => handleCloseFile(file.id, e)}
                    className="p-0.5 hover:bg-gray-300 dark:hover:bg-gray-700 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ opacity: isActive ? 0.6 : 0 }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = isActive ? '0.6' : '0')}
                  >
                    <X size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
