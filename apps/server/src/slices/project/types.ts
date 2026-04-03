export interface ProjectEntry {
  id: string
  domain: string
  description?: string
  rootPath: string
  version?: string
  workflowCount?: number
  linked?: boolean
}

export interface LinkFile {
  sourcePath: string
  domain: string
  importedAt: string
}
