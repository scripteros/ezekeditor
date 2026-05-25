import React, { useRef } from 'react'

interface ResizerProps {
  onResize: (deltaX: number) => void
}

export default function HorizontalResizer({ onResize }: ResizerProps) {
  const isResizing = useRef(false)
  const startX = useRef(0)

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    isResizing.current = true
    startX.current = e.clientX

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return
      const deltaX = e.clientX - startX.current
      startX.current = e.clientX
      onResize(deltaX)
    }

    const handleMouseUp = () => {
      isResizing.current = false
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'default'
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.body.style.cursor = 'col-resize'
  }

  return (
    <div
      className="w-1 cursor-col-resize hover:bg-nova-accent/50 transition-colors bg-transparent z-50 flex-shrink-0"
      onMouseDown={handleMouseDown}
    />
  )
}
