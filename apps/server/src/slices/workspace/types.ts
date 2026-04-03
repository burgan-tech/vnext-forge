export interface SearchResult {
  path: string
  line: number
  text: string
}

export interface DirectoryEntry {
  name: string
  path: string
  type: 'file' | 'directory'
}
