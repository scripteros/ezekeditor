import { useState, useCallback } from 'react'
import { ChevronRight, ChevronDown, File, Folder, FolderOpen, FileCode, FileJson, FileText, FileImage } from 'lucide-react'
import { useExplorerStore } from '../../store/explorerStore'
import type { FileNode } from '../../../../shared/types'
import { getApi } from '../../utils/platform'

function getFileIcon(name: string, isDirectory: boolean): React.ReactNode {
  if (isDirectory) return null
  
  const ext = name.split('.').pop()?.toLowerCase()
  const iconProps = { size: 14, className: 'flex-shrink-0' }
  
  switch (ext) {
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
      return <FileCode {...iconProps} className="text-blue-400 flex-shrink-0" />
    case 'json':
      return <FileJson {...iconProps} className="text-yellow-400 flex-shrink-0" />
    case 'css':
    case 'scss':
    case 'less':
      return <FileCode {...iconProps} className="text-pink-400 flex-shrink-0" />
    case 'md':
    case 'txt':
      return <FileText {...iconProps} className="text-gray-400 flex-shrink-0" />
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
      return <FileImage {...iconProps} className="text-green-400 flex-shrink-0" />
    default:
      return <File {...iconProps} className="text-nova-text-muted flex-shrink-0" />
  }
}

interface Props {
  node: FileNode
  depth: number
  onFileClick: (node: FileNode) => void
  onContextMenu: (e: React.MouseEvent, path: string) => void
}

export default function FileTreeNode({ node, depth, onFileClick, onContextMenu }: Props) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [children, setChildren] = useState<FileNode[] | undefined>(node.children)
  const { expandedPaths, toggleExpand, loadDirectory, selectedPath, selectFile, deleteEntry } = useExplorerStore()
  const isSelected = selectedPath === node.path

  const handleClick = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    selectFile(node.path)
    
    if (node.isDirectory) {
      const newExpanded = !isExpanded
      setIsExpanded(newExpanded)
      if (newExpanded && (!children || children.length === 0)) {
        const api = getApi()
        if (!api) return
        try {
          const files = await api.readDirectory(node.path)
          setChildren(files)
        } catch { /* ignore */ }
      }
    } else {
      onFileClick(node)
    }
  }, [node, isExpanded, children, selectFile, onFileClick])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleClick(e as any)
    } else if (e.key === 'Delete') {
      deleteEntry(node.path)
    }
  }

  return (
    <div>
      <div
        className={`flex items-center gap-1 py-[3px] px-2 cursor-pointer rounded-sm group transition-colors ${
          isSelected ? 'bg-nova-selection text-nova-text' : 'text-nova-text-secondary hover:bg-nova-hover'
        }`}
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
        onClick={handleClick}
        onContextMenu={(e) => onContextMenu(e, node.path)}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="treeitem"
        aria-expanded={node.isDirectory ? isExpanded : undefined}
      >
        {node.isDirectory ? (
          <>
            {isExpanded ? (
              <ChevronDown size={12} className="flex-shrink-0 text-nova-text-muted" />
            ) : (
              <ChevronRight size={12} className="flex-shrink-0 text-nova-text-muted" />
            )}
            {isExpanded ? (
              <FolderOpen size={14} className="flex-shrink-0 text-yellow-400" />
            ) : (
              <Folder size={14} className="flex-shrink-0 text-nova-text-muted" />
            )}
          </>
        ) : (
          <>
            <span className="w-3 flex-shrink-0" />
            {getFileIcon(node.name, false)}
          </>
        )}
        <span className={`text-xs truncate ${isSelected ? 'text-nova-text' : ''}`}>
          {node.name}
        </span>
      </div>
      {node.isDirectory && isExpanded && children && (
        <div>
          {children.map(child => (
            <FileTreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              onFileClick={onFileClick}
              onContextMenu={onContextMenu}
            />
          ))}
          {children.length === 0 && (
            <div className="text-xs text-nova-text-muted pl-8 py-1 italic">pasta vazia</div>
          )}
        </div>
      )}
    </div>
  )
}
