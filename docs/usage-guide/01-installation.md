# Installation

## Prerequisites

- **VS Code** 1.85 or later
- A vNext project folder containing a `vnext.config.json` file (or use the Create Project command to scaffold one)

## Install Methods

### From VS Code Marketplace

Search for **vNext Forge Studio** (`burgan-tech.vnext-forge-studio`) in the Extensions view and click Install.

### From VSIX

1. Download the `.vsix` file from the release page.
2. In VS Code, open the Command Palette and run **Extensions: Install from VSIX…**
3. Select the downloaded file.

### From Source

```bash
git clone <repo-url>
cd vnext-forge
pnpm install
pnpm build
```

Then press `F5` in VS Code to launch the Extension Development Host.

## Activation

The extension activates automatically when any of the following occur:

| Trigger | Description |
|---------|-------------|
| `workspaceContains:vnext.config.json` | A folder in the workspace contains a `vnext.config.json` file |
| `onCommand:vnextForge.*` | Any Forge command is invoked (designer, project creation, component creation, Quick Run, etc.) |
| `onCustomEditor:vnextForge.componentEditor` | A component JSON file is opened with the Forge designer |
| `onView:vnextForge.tools.*` | Any Forge Tools sidebar view is opened (Settings, Project, Environments, etc.) |
| `onLanguage:csharp` | A `.csx` file is opened (for C# script support) |

Once activated, a **vNext Forge** status bar item appears at the bottom of the editor (shows "Ready" when initialization is complete).

## Extension Settings

All settings are under the `vnextForge` namespace. Access them via **File > Preferences > Settings** and search for "vnextForge".

| Setting | Default | Description |
|---------|---------|-------------|
| `vnextForge.lsp.autoInstall` | `true` | Automatically install the C# Language Server when a vNext workspace is detected |
| `vnextForge.lsp.enableNativeEditor` | `true` | Enable IntelliSense and diagnostics for `.csx` files in the VS Code editor |
| `vnextForge.vnextRuntimeUrl` | `""` | Default runtime base URL for the runtime proxy |
| `vnextForge.runtimeAllowedBaseUrls` | `[]` | Additional allowed base URLs for runtime proxy requests |
| `vnextForge.allowRuntimeUrlOverride` | `false` | Allow per-request runtime URL override (security note: enables SSRF if misused) |
| `vnextForge.runtimeRevalidationMinIntervalSeconds` | `30` | Minimum interval between background runtime health checks |
| `vnextForge.quickRun.pollingRetryCount` | `3` | Number of polling retries for Quick Run instance status |
| `vnextForge.quickRun.pollingIntervalMs` | `2000` | Polling interval in milliseconds for Quick Run |

## C# Language Server

The extension optionally installs an OmniSharp-based C# language server for `.csx` file editing. When `vnextForge.lsp.autoInstall` is enabled (default), the server is downloaded in the background on first activation. A progress notification appears during installation.

The language server provides:

- IntelliSense (completions, signatures, hover)
- Diagnostics (errors, warnings)
- Go-to-definition for vNext scripting APIs
