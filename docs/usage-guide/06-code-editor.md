# Code Editor

vNext Forge includes a Monaco-based code editor for editing C# script files (`.csx`) and viewing raw JSON definitions.

## Opening Files in the Code Editor

- Click any `.csx` file in the file tree.
- From the workflow designer, click a script-linked transition mapping.
- Use **Forge: Open with Text Editor** for the raw JSON view of any component.

## Features

### Syntax Highlighting

Full syntax highlighting for:

- C# Script (`.csx`)
- JSON
- JavaScript/TypeScript (for configuration files)

### IntelliSense (C# LSP)

When `vnextForge.lsp.autoInstall` is enabled, the extension installs OmniSharp in the background and provides:

- **Auto-completion** — context-aware suggestions for C# APIs
- **Hover documentation** — type and member documentation on hover
- **Signature help** — parameter hints for method calls
- **Go to definition** — navigate to symbol definitions
- **Error diagnostics** — real-time compilation error reporting

> **Note:** LSP features require the C# Language Server to be installed and connected. Check the status bar for connection state.

### Editor Toolbar

| Button | Action |
|--------|--------|
| **Save** | Save file to disk (Cmd+S / Ctrl+S) |
| **Undo** | Undo last edit |
| **Redo** | Redo undone edit |

## Script Tasks (C# Mapping/Rules)

Workflow transitions can have C# script mappings. These `.csx` files define:

- **Mapping rules** — transform data between states
- **Validation logic** — custom business rules
- **Computed fields** — derive values from instance data

The code editor provides full IntelliSense within these scripts, including awareness of the vNext runtime SDK types.

## Preview Document

From any component editor, click **Preview Document** (top-right toolbar) to see the generated JSON output in a read-only Monaco editor.
