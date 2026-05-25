import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { Component, ReactNode } from 'react'
import { useLogStore } from './store/logStore'
import './styles/globals.css'

function safeStringify(arg: any): string {
  if (typeof arg === 'string') return arg
  if (arg instanceof Error) return `${arg.name}: ${arg.message}`
  try {
    const s = JSON.stringify(arg)
    if (s === undefined) return String(arg)
    if (s.length > 500) return s.substring(0, 500) + '...'
    return s
  } catch {
    return String(arg)
  }
}

function addLog(type: 'error' | 'warn' | 'info', args: any[]) {
  try {
    useLogStore.getState().addLog({ type, message: args.map(safeStringify).join(' ') })
  } catch {}
}

const originalError = console.error
console.error = (...args: any[]) => {
  originalError.apply(console, args)
  addLog('error', args)
}

const originalWarn = console.warn
console.warn = (...args: any[]) => {
  originalWarn.apply(console, args)
  addLog('warn', args)
}

const originalLog = console.log
console.log = (...args: any[]) => {
  originalLog.apply(console, args)
  addLog('info', args)
}

class ErrorBoundary extends Component<{children: ReactNode}, {hasError: boolean, error: any}> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error }
  }
  componentDidCatch(error: any, errorInfo: any) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, color: 'white', background: 'red', height: '100vh', overflow: 'auto' }}>
          <h1>Something went wrong.</h1>
          <pre>{this.state.error?.toString()}</pre>
          <pre>{this.state.error?.stack}</pre>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
