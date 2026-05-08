# VS Code Integration

vNext Forge integrates deeply with VS Code through commands, context menus, sidebar views, and custom editors.

## Commands

Access via Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

| Command | Description | When Available |
|---------|-------------|----------------|
| **Open Designer** | Open the full designer panel | vNext workspace |
| **Create vnext Project** | Scaffold a new project | Always |
| **Create vnext Component** | Create a new component file | vNext workspace |
| **Quick Run** | Open Quick Run panel | vNext workspace |

> **Screenshot needed:** Command Palette showing vNext Forge commands.

## Context Menus

### Explorer Context Menu

Right-click a `.json` file inside a vNext workspace:

| Menu Item | Action |
|-----------|--------|
| **Forge: Open with vNext Forge** | Open in the visual designer |
| **Forge: Open with Text Editor** | Open as raw JSON |

Right-click a component folder (e.g., `Workflows/`):

| Menu Item | Action |
|-----------|--------|
| **Forge: Workflow Create** | Scaffold a new workflow in this folder |
| **Forge: Task Create** | Scaffold a new task |
| **Forge: Schema Create** | Scaffold a new schema |
| ... (one per component type) | |

> **Screenshot needed:** Explorer context menu on a workflow file.

### Editor Title Context Menu

When a component JSON file is open in the editor, the title bar context menu offers the same **Open with Forge / Open with Text Editor** options.

> **Screenshot needed:** Editor title bar context menu.

## Activity Bar — vNext Forge Tools

The extension contributes a dedicated sidebar container with multiple views:

> **Screenshot needed:** vNext Forge Tools sidebar with all sections expanded.

### Settings View

Manages designer preferences:

- Canvas layout algorithm
- Theme preferences
- Quick Run polling configuration

### Project View

Available in vNext workspaces:

| Action | Description |
|--------|-------------|
| **Validate Project** | Run full project validation |
| **Build Runtime** | Build runtime package |
| **Build Reference** | Build reference documentation |
| **Generate Documents** | Generate project documentation |

### Environments View

Manage runtime environment connections (see [Runtime Connection](./08-runtime-connection.md)).

### Package Deploy View

Deploy components to the runtime engine (see [Runtime Connection](./08-runtime-connection.md)).

### Quick Run View

Launch Quick Run from the sidebar (see [Runtime Connection](./08-runtime-connection.md)).

## Custom Editor

vNext Forge registers a custom editor (`vnextForge.componentEditor`) for `.json` files as an optional editor. Clicking a component JSON file opens the native text editor by default.

To open in the designer instead:

- Right-click → **Open with vNext Forge**
- Or use **Reopen Editor With...** and select **vnext-forge-studio Designer**

## Material Icon Associations

The extension can patch the Material Icon Theme to show vNext-specific icons for component folders:

- **Apply Material Icon Associations** — adds custom folder icons
- **Remove Material Icon Associations** — reverts to defaults

## C# Script IntelliSense

For `.csx` files in vNext workspaces, the extension provides:

- Background OmniSharp installation
- Full C# language features (completion, hover, diagnostics)
- Workspace-aware references (ScriptBase.cs, NuGet packages)

## Snippets

The extension ships C# Script snippets (`csx.code-snippets`) for common patterns:

- Mapping rule templates
- Task handler boilerplate
- Error boundary patterns
