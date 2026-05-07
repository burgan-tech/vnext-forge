/**
 * Map raw Node-style errno results to `VnextForgeError` codes.
 *
 * Adapter implementations throw the platform-native error (e.g. NodeJS
 * `ErrnoException`); services wrap it via these helpers so the same callsite
 * works for both the Node-fs adapter (web-server) and the VS Code FS adapter
 * (extension), which exposes `code` strings in a compatible format.
 */
import { ERROR_CODES, VnextForgeError } from '@vnext-forge-studio/app-contracts'
import type { ErrorCode } from '@vnext-forge-studio/app-contracts'

interface NodeStyleError {
  code?: string
  message?: string
}

export function getErrnoCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined
  const code = (error as NodeStyleError).code
  return typeof code === 'string' ? code : undefined
}

export function toFileVnextError(
  error: unknown,
  source: string,
  traceId: string | undefined,
  details: Record<string, unknown>,
  fallbackCode: ErrorCode = ERROR_CODES.FILE_READ_ERROR,
): VnextForgeError {
  if (error instanceof VnextForgeError) return error

  const code = getErrnoCode(error)
  if (code === 'ENOENT') {
    return new VnextForgeError(
      ERROR_CODES.FILE_NOT_FOUND,
      'Requested file or directory was not found',
      { source, layer: 'infrastructure', details },
      traceId,
    )
  }
  if (code === 'EACCES' || code === 'EPERM') {
    return new VnextForgeError(
      ERROR_CODES.FILE_PERMISSION_DENIED,
      'Insufficient permissions for file system operation',
      { source, layer: 'infrastructure', details },
      traceId,
    )
  }

  return new VnextForgeError(
    fallbackCode,
    error instanceof Error ? error.message : 'File system operation failed',
    { source, layer: 'infrastructure', details },
    traceId,
  )
}
