import * as monaco from 'monaco-editor'
import { loader } from '@monaco-editor/react'

// Configure Monaco to use local installation
loader.config({ monaco })

// We need to create workers manually for Monaco in Vite
// This is required for the editor to work properly
export function setupMonacoWorkers() {
  // Monaco workers are handled by the @monaco-editor/react loader
  // when configured with the local monaco package
}
