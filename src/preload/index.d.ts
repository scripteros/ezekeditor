import type { IPCApi } from '../shared/types'

declare global {
  interface Window {
    api: IPCApi
  }
}
