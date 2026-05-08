# Installation

## Prerequisites

- **VS Code** 1.85 or later
- A vNext workspace (folder with `vnext.config.json`)

## Installing the Extension

### From VSIX (Local)

1. Download or build the `.vsix` package.
2. In VS Code, open the Extensions panel (`Ctrl+Shift+X` / `Cmd+Shift+X`).
3. Click the `···` menu → **Install from VSIX…**
4. Select the downloaded file.

### From Source (Development)

```bash
git clone <repo-url>
cd vnext-forge-studio
pnpm install
pnpm build
```

Then press `F5` in VS Code to launch the Extension Development Host.

## Extension Activation

The extension activates automatically when:

- The workspace contains a `vnext.config.json` file.
- You open a `.csx` (C# Script) file.
- You run any `vnextForge.*` command from the Command Palette.

Once activated, the extension:

1. Sets the `vnextForge.isVnextWorkspace` context key (enables context menus).
2. Registers the **vNext Forge Tools** sidebar in the Activity Bar.
3. Starts background LSP installation (if `vnextForge.lsp.autoInstall` is enabled).

## Configuration

Open **Settings** → search for `vnextForge` to see all available options:

| Setting | Default | Description |
|---------|---------|-------------|
| `vnextForge.lsp.autoInstall` | `true` | Auto-install C# Language Server |
| `vnextForge.lsp.enableNativeEditor` | `true` | IntelliSense for `.csx` files |
| `vnextForge.vnextRuntimeUrl` | `http://localhost:4201` | Runtime engine base URL |
| `vnextForge.runtimeAllowedBaseUrls` | `[]` | Additional allowed runtime URLs |
| `vnextForge.quickRun.pollingRetryCount` | `6` | Quick Run polling retries |
| `vnextForge.quickRun.pollingIntervalMs` | `10` | Quick Run polling interval (ms) |
