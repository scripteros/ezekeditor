import { useState } from 'react'
import { ZoomIn, ZoomOut, RotateCw, Download, Info } from 'lucide-react'

interface ImageViewerProps {
  filePath: string
  fileName: string
}

export default function ImageViewer({ filePath, fileName }: ImageViewerProps) {
  const [zoom, setZoom] = useState(100)
  const [rotation, setRotation] = useState(0)
  const [showInfo, setShowInfo] = useState(false)
  const [imageData, setImageData] = useState<{ width: number, height: number, size: number } | null>(null)

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 25, 500))
  }

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 25, 25))
  }

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360)
  }

  const handleDownload = () => {
    const link = document.createElement('a')
    link.href = `ezek://${filePath}`
    link.download = fileName
    link.click()
  }

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.target as HTMLImageElement
    setImageData({
      width: img.naturalWidth,
      height: img.naturalHeight,
      size: 0 // Será calculado se necessário
    })
  }

  const isImageFile = (filename: string) => {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.tiff', '.ico']
    return imageExtensions.some(ext => filename.toLowerCase().endsWith(ext))
  }

  if (!isImageFile(fileName)) {
    return (
      <div className="h-full flex items-center justify-center bg-nova-bg">
        <div className="text-center">
          <div className="text-nova-error text-4xl mb-2">⚠️</div>
          <p className="text-nova-text-secondary">Formato de imagem não suportado</p>
          <p className="text-nova-text-muted text-xs mt-1">{fileName}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-nova-bg">
      {/* Barra de ferramentas */}
      <div className="flex items-center justify-between px-4 py-2 bg-nova-bg-secondary border-b border-nova-border">
        <div className="flex items-center gap-2">
          <button
            onClick={handleZoomOut}
            className="p-1.5 rounded text-nova-text-muted hover:text-emerald-400 hover:bg-emerald-600/10 transition-colors"
            title="Diminuir zoom"
          >
            <ZoomOut size={16} />
          </button>
          <span className="text-xs text-emerald-400 min-w-[60px] text-center font-medium">
            {zoom}%
          </span>
          <button
            onClick={handleZoomIn}
            className="p-1.5 rounded text-nova-text-muted hover:text-emerald-400 hover:bg-emerald-600/10 transition-colors"
            title="Aumentar zoom"
          >
            <ZoomIn size={16} />
          </button>
          <div className="w-px h-4 bg-emerald-600/20 mx-2" />
          <button
            onClick={handleRotate}
            className="p-1.5 rounded text-nova-text-muted hover:text-emerald-400 hover:bg-emerald-600/10 transition-colors"
            title="Rotacionar"
          >
            <RotateCw size={16} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowInfo(!showInfo)}
            className={`p-1.5 rounded transition-colors ${
              showInfo 
                ? 'bg-emerald-600/20 text-emerald-400' 
                : 'text-nova-text-muted hover:text-nova-text hover:bg-nova-hover'
            }`}
            title="Informações da imagem"
          >
            <Info size={16} />
          </button>
          <button
            onClick={handleDownload}
            className="p-1.5 rounded text-nova-text-muted hover:text-emerald-400 hover:bg-emerald-600/10 transition-colors"
            title="Baixar imagem"
          >
            <Download size={16} />
          </button>
        </div>
      </div>

      {/* Informações da imagem */}
      {showInfo && imageData && (
        <div className="px-4 py-2 bg-emerald-950/20 border-b border-emerald-600/20 text-xs">
          <div className="flex gap-4 text-emerald-400">
            <span><strong className="text-emerald-300">Arquivo:</strong> {fileName}</span>
            <span><strong className="text-emerald-300">Dimensões:</strong> {imageData.width} × {imageData.height}px</span>
            <span><strong className="text-emerald-300">Zoom:</strong> {zoom}%</span>
            {rotation !== 0 && <span><strong className="text-emerald-300">Rotação:</strong> {rotation}°</span>}
          </div>
        </div>
      )}

      {/* Área de visualização da imagem */}
      <div className="flex-1 overflow-auto bg-nova-bg flex items-center justify-center p-4">
        <div className="relative">
          <img
            src={`ezek://${filePath.replace(/\\/g, '/')}`}
            alt={fileName}
            className="max-w-none transition-transform duration-200 shadow-lg"
            style={{
              transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
              imageRendering: zoom > 200 ? 'pixelated' : 'auto'
            }}
            onLoad={handleImageLoad}
            onError={() => {
              console.error('Erro ao carregar imagem:', filePath)
            }}
          />
        </div>
      </div>

      {/* Atalhos de teclado (tooltip) */}
      <div className="px-4 py-1 bg-emerald-950/20 border-t border-emerald-600/20 text-[10px] text-emerald-400/70">
        <div className="flex justify-center gap-4">
          <span><kbd className="px-1 bg-emerald-600/20 text-emerald-300 rounded">Ctrl</kbd> + <kbd className="px-1 bg-emerald-600/20 text-emerald-300 rounded">+</kbd> Zoom in</span>
          <span><kbd className="px-1 bg-emerald-600/20 text-emerald-300 rounded">Ctrl</kbd> + <kbd className="px-1 bg-emerald-600/20 text-emerald-300 rounded">-</kbd> Zoom out</span>
          <span><kbd className="px-1 bg-emerald-600/20 text-emerald-300 rounded">R</kbd> Rotacionar</span>
        </div>
      </div>
    </div>
  )
}