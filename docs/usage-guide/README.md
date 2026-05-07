# vNext Forge — Usage Guide

vNext Forge is a workflow design and management tool delivered as a VS Code extension. It provides a visual workflow designer, component editors, and project management capabilities for the vNext engine ecosystem.

## Table of Contents

1. [Installation](./01-installation.md)
2. [Getting Started](./02-getting-started.md)
3. [Project Management](./03-project-management.md)
4. [Workflow Designer](./04-workflow-designer.md)
5. [Component Editors](./05-component-editors.md)
6. [Code Editor](./06-code-editor.md)
7. [Validation](./07-validation.md)
8. [Runtime Connection](./08-runtime-connection.md)
9. [VS Code Integration](./09-vscode-integration.md)
10. [Troubleshooting](./10-troubleshooting.md)

## Quick Start

1. Install the **vNext Forge** extension from the VS Code Marketplace (or from `.vsix`).
2. Open a folder containing a `vnext.config.json` file — the extension activates automatically.
3. Right-click any workflow/component `.json` file → **Forge: Open with vNext Forge**.
4. Or use the Command Palette → **Open Designer** to launch the full designer panel.

## Two Shells

vNext Forge runs in two modes:

| Mode | How it works |
|------|-------------|
| **VS Code Extension** | Designer runs as a webview panel inside VS Code. File browsing uses the native Explorer. |
| **Web Shell (Development)** | Standalone React SPA at `localhost:3000` with its own file explorer, sidebar, and status bar. Used for UI development and testing. |

Both modes share the same React UI components and communicate with the same backend services via the same method registry.
