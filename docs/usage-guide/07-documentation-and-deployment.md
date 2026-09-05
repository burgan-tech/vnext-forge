# Documentation and Deployment

vNext Forge Studio provides tools for generating project documentation and deploying workflows to the runtime.

## Workflow Documentation Preview

The workflow designer includes a live documentation preview that renders a read-only Markdown summary of the current workflow.

![Documentation Preview](./screenshots/component-document-preview.png)

### Opening the Preview

Click the **Preview Document** button (document icon) in the workflow designer top toolbar.

### What the Preview Shows

- **Workflow title** and description
- **Metadata table** — Key, Domain, Flow, Version, Flow Version, Type, Tags
- **State Lifecycle** — A Mermaid diagram visualizing the state machine
- **State details** — Each state with its tasks, transitions, and configuration

### Actions

- **Copy Markdown** — Copies the full Markdown content to clipboard for pasting into documentation
- **Close** — Dismiss the preview dialog

The preview is read-only and does not write to disk. For project-wide documentation generation, use the Generate Documents command.

## Generate Documents

The **Generate Documents** command creates comprehensive Markdown documentation for the entire project.

### Running

- From the Command Palette: **Forge: Generate Documents**
- From the Forge Tools sidebar: click **Generate Documents** under the Project section

A progress notification appears while generation is in progress.

### Output

![Generated Docs](./screenshots/generate-docs.png)

Documentation is written to a `docs/` folder at the project root:

```
docs/
├── extensions/     # One .md per extension
├── functions/      # One .md per function
├── schemas/        # One .md per schema
├── tasks/          # One .md per task
├── views/          # One .md per view
├── workflows/      # One .md per workflow
├── dependency-tree.md  # Cross-component dependency graph
└── index.md        # Project summary and component index
```

Each component document includes metadata, configuration details, and relationship information. The `dependency-tree.md` file maps how components reference each other.

## Package Deploy

The Package Deploy section in the Forge Tools sidebar manages deployment of workflows and scripts to the vNext runtime using the `wf` CLI tool.

### Prerequisites

The `wf` CLI (`@burgan-tech/vnext-workflow-cli`) must be installed globally. If it is not detected, the sidebar shows an **Install Workflow CLI** action that runs:

```bash
npm install -g @burgan-tech/vnext-workflow-cli
```

### Deploy Commands

| Command | CLI Equivalent | Description |
|---------|---------------|-------------|
| **Deploy All** | `wf update --all [--domain <d>]` | Deploy all component definitions to the runtime |
| **Deploy Changed** | `wf update [--domain <d>]` | Deploy only components with changes (git diff based) |
| **CSX Update All** | `wf csx --all [--domain <d>]` | Embed all CSX script files into their component JSON |

These commands run in the VS Code integrated terminal at the vNext workspace root. When
several vNext roots are open, Forge asks which one to deploy from first.

#### Multi-domain workspaces

A workspace root may hold several solution files (`vnext.config.json` plus
`vnext.<domain>.config.json`). With Workflow CLI **1.0.13 or newer**:

- Deploy commands first ask which domain to target: **All domains** runs the command once
  per solution file, sequentially (the CLI default); picking a domain appends
  `--domain <domain>` so only that solution is processed.
- Every solution's `domain` must match a CLI domain profile (`wf domain list`); a solution
  without a profile is skipped by the CLI with a warning.
- Every component JSON must carry a `domain` equal to its solution's `domain`, otherwise the
  CLI skips it with `DOMAIN_MISMATCH`. Forge flags such files in the Problems panel
  (`component.missingDomain`).

With an older CLI, Forge falls back to `wf domain use <domain> && wf …` (which also changes
the CLI's active profile) and shows an **Update Workflow CLI** notice once per session; the
"All domains" choice is not offered because older CLIs cannot iterate solution files.

### Per-File Publish

From the designer toolbar (**Publish**, upload icon) or the Explorer context menu
(**Forge: Publish**), a single component file is deployed from the workspace root that owns it:

```bash
wf update -f <path-to-component.json> --domain <domain>
```

The domain comes from the component's own `domain` field (falling back to the solution whose
`componentsRoot` contains the file). If the file sits under another solution's folder, the CLI
reports the conflict in the terminal.

## Build Commands

The Forge Tools sidebar Project section provides build commands:

| Command | Script | Description |
|---------|--------|-------------|
| **Validate Project** | `npm run validate` | Run schema validation across all component JSON files |
| **Build Runtime** | `npm run build:runtime` | Compile runtime artifacts |
| **Build Reference** | `npm run build:reference` | Generate reference documentation or type bindings |

These commands execute in the integrated terminal using the project's npm scripts.
