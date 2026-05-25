import { useEffect, useRef } from 'react'
import { Terminal as XTerm } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { SearchAddon } from 'xterm-addon-search'
import { WebLinksAddon } from 'xterm-addon-web-links'
import { useTerminalStore } from '../../store/terminalStore'
import 'xterm/css/xterm.css'
import { getApi } from '../../utils/platform'

interface Props {
  terminalId: string
}

export default function TerminalComponent({ terminalId }: Props) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const { removeTerminal } = useTerminalStore()

  useEffect(() => {
    if (!terminalRef.current) return
    const api = getApi()
    if (!api) return

    const term = new XTerm({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 14,
      fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', Consolas, monospace",
      theme: {
        background: '#0f1a12',
        foreground: '#d4e6d4',
        cursor: '#aeafad',
        selectionBackground: '#1a3a2f',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#e5e5e5',
      },
      allowTransparency: false,
      scrollback: 5000,
      allowProposedApi: true,
      convertEol: true,
      rightClickSelectsWord: false,
    })

    const fitAddon = new FitAddon()
    const searchAddon = new SearchAddon()
    const webLinksAddon = new WebLinksAddon()

    term.loadAddon(fitAddon)
    term.loadAddon(searchAddon)
    term.loadAddon(webLinksAddon)

    term.open(terminalRef.current)

    fitAddonRef.current = fitAddon

    setTimeout(() => {
      fitAddon.fit()
    }, 50)

    term.onData((data) => {
      api.writeToTerminal(terminalId, data)
    })

    const cleanupData = api.onTerminalData(({ terminalId: id, data }) => {
      if (id === terminalId) {
        term.write(data)
      }
    })

    const cleanupExit = api.onTerminalExit(({ terminalId: id, code }) => {
      if (id === terminalId) {
        term.write(`\r\n\x1b[31mProcesso encerrado com código ${code}\x1b[0m\r\n`)
      }
    })

    const handleResize = () => {
      fitAddon.fit()
      const dims = fitAddon.proposeDimensions()
      if (dims) {
        api.resizeTerminal(terminalId, dims.cols, dims.rows)
      }
    }

    const resizeObserver = new ResizeObserver(() => {
      handleResize()
    })

    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current)
    }

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      const selection = term.getSelection()
      if (selection) {
        navigator.clipboard.writeText(selection)
        term.clearSelection()
      } else {
        navigator.clipboard.readText().then(text => {
          api.writeToTerminal(terminalId, text)
        }).catch(() => {})
      }
    }

    if (terminalRef.current) {
      terminalRef.current.addEventListener('contextmenu', handleContextMenu)
    }

    xtermRef.current = term

    return () => {
      cleanupData()
      cleanupExit()
      resizeObserver.disconnect()
      if (terminalRef.current) {
        terminalRef.current.removeEventListener('contextmenu', handleContextMenu)
      }
      term.dispose()
    }
  }, [terminalId])

  return (
    <div
      ref={terminalRef}
      className="h-full w-full bg-[#0f1a12]"
      style={{ padding: '4px' }}
    />
  )
}
