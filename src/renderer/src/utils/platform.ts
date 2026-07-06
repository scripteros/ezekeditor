export function isElectron(): boolean {
  return typeof window !== 'undefined' && window.api !== undefined
}

export function getApi() {
  if (!isElectron()) {
    return null
  }
  return window.api
}
