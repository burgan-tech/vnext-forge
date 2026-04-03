import path from 'node:path'
import { CONFIG_FILE } from '@paths/constants.js'

export function resolveConfigPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, CONFIG_FILE)
}

export function resolveComponentPath(
  workspaceRoot: string,
  domain: string,
  component: string,
): string {
  return path.join(workspaceRoot, domain, component)
}
