import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { baseLogger } from '@shared/lib/logger.js'

const execFileAsync = promisify(execFile)

const logger = baseLogger.child({ source: 'LspWorkspace' })

const LSP_TMP_ROOT = path.join(os.tmpdir(), 'vnext-lsp')

// ── .csproj template ──────────────────────────────────────────────────────────

function buildCsprojContent(): string {
  return `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <AllowUnsafeBlocks>true</AllowUnsafeBlocks>
    <OutputType>Library</OutputType>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="BBT.Workflow.Domain" Version="*" />
  </ItemGroup>
</Project>
`
}

function buildGlobalUsings(): string {
  return `global using System;
global using System.Threading.Tasks;
global using System.Collections.Generic;
global using System.Linq;
`
}


function buildNuGetConfig(feedUrl: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <packageSources>
    <clear />
    <add key="vnext-feed" value="${feedUrl}" />
    <add key="nuget.org" value="https://api.nuget.org/v3/index.json" />
  </packageSources>
</configuration>
`
}

// ── Workspace lifecycle ───────────────────────────────────────────────────────

export interface LspWorkspace {
  sessionId: string
  workspacePath: string
  scriptPath: string
}

/**
 * Creates a temporary C# project workspace for OmniSharp.
 * The workspace contains a .csproj referencing VNext.Scripting.Abstractions,
 * global usings, and a placeholder Script.cs for the active CSX content.
 */
export async function createLspWorkspace(sessionId: string): Promise<LspWorkspace> {
  const workspacePath = path.join(LSP_TMP_ROOT, sessionId)
  const scriptPath = path.join(workspacePath, 'Script.cs')

  await fs.mkdir(workspacePath, { recursive: true })

  // Write project files
  await Promise.all([
    fs.writeFile(path.join(workspacePath, 'session.csproj'), buildCsprojContent(), 'utf-8'),
    fs.writeFile(path.join(workspacePath, 'GlobalUsings.cs'), buildGlobalUsings(), 'utf-8'),
    fs.writeFile(scriptPath, '// Script placeholder\n', 'utf-8'),
  ])

  // Write NuGet.Config if a private feed is configured in addition to nuget.org
  const privateFeed = process.env.VNEXT_NUGET_FEED
  if (privateFeed) {
    await fs.writeFile(path.join(workspacePath, 'NuGet.Config'), buildNuGetConfig(privateFeed), 'utf-8')
    logger.info({ sessionId, feed: privateFeed }, 'Private NuGet feed configured')
  }

  logger.info({ sessionId, workspacePath }, 'LSP workspace created')

  // Restore NuGet packages (happens once per workspace)
  await runDotnetRestore(workspacePath, sessionId)

  return { sessionId, workspacePath, scriptPath }
}

/**
 * Writes the CSX script content into the workspace Script.cs file.
 * OmniSharp will pick up the file change automatically.
 */
export async function updateScriptContent(workspace: LspWorkspace, content: string): Promise<void> {
  // Wrap CSX content in a partial class so Roslyn can resolve ScriptBase / interfaces
  const wrappedContent = wrapCsxContent(content)
  await fs.writeFile(workspace.scriptPath, wrappedContent, 'utf-8')
}

/**
 * Removes the temporary workspace directory.
 */
export async function destroyLspWorkspace(workspace: LspWorkspace): Promise<void> {
  try {
    await fs.rm(workspace.workspacePath, { recursive: true, force: true })
    logger.info({ sessionId: workspace.sessionId }, 'LSP workspace destroyed')
  } catch (err) {
    logger.warn({ err, sessionId: workspace.sessionId }, 'Failed to destroy LSP workspace')
  }
}

/**
 * Runs `dotnet restore` in the workspace directory to download NuGet packages.
 */
export async function runDotnetRestore(workspacePath: string, sessionId: string): Promise<void> {
  logger.info({ sessionId }, 'Running dotnet restore for LSP workspace...')
  try {
    await execFileAsync('dotnet', ['restore', workspacePath], {
      cwd: workspacePath,
      timeout: 120_000, // 2 min timeout for first-time NuGet download
    })
    logger.info({ sessionId }, 'dotnet restore completed')
  } catch (err: any) {
    // Non-fatal: OmniSharp may still work with cached packages
    logger.warn({ err: err?.message, sessionId }, 'dotnet restore had warnings/errors')
  }
}

// ── CSX → CS wrapping ─────────────────────────────────────────────────────────

const IMPLICIT_USINGS_LINES = [
  'using System;',
  'using System.Threading.Tasks;',
  'using System.Collections.Generic;',
  'using System.Linq;',
  '',
  '#nullable enable',
  '',
]

/**
 * Number of lines prepended by wrapCsxContent when the script does not start
 * with a using directive or # directive. Used by the LSP bridge to shift
 * publishDiagnostics line numbers back to the original Monaco document.
 */
export const CSX_WRAP_OFFSET = IMPLICIT_USINGS_LINES.length

/**
 * Wraps raw CSX script content so it's valid as a .cs file.
 * This lets OmniSharp treat it as a regular C# file while still
 * providing full type resolution for ScriptBase / interface members.
 *
 * CSX files already contain a class definition (e.g. `public class MyMapping : ScriptBase, IMapping`),
 * so we only need to prepend missing using directives that are implicit in CSX.
 */
function wrapCsxContent(csxContent: string): string {
  const implicitUsings = IMPLICIT_USINGS_LINES.join('\n')

  // If the content already starts with using directives, don't double them
  const trimmed = csxContent.trimStart()
  if (trimmed.startsWith('using ') || trimmed.startsWith('#')) {
    return csxContent
  }

  return implicitUsings + csxContent
}

/**
 * Returns the line offset introduced by wrapCsxContent for the given content.
 * If wrapping was skipped (content starts with using/# ), returns 0.
 */
export function getWrapOffset(csxContent: string): number {
  const trimmed = csxContent.trimStart()
  if (trimmed.startsWith('using ') || trimmed.startsWith('#')) {
    return 0
  }
  return CSX_WRAP_OFFSET
}
