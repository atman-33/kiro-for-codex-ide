# Kiro for Codex IDE

[![Visual Studio Marketplace](https://img.shields.io/vscode-marketplace/v/atman-dev.kiro-for-codex-ide.svg?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=atman-dev.kiro-for-codex-ide)
[![Downloads](https://img.shields.io/vscode-marketplace/d/atman-dev.kiro-for-codex-ide.svg?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=atman-dev.kiro-for-codex-ide)
[![GitHub stars](https://img.shields.io/github/stars/atman-33/kiro-for-codex-ide.svg?style=flat-square)](https://github.com/atman-33/kiro-for-codex-ide/stargazers)
[![GitHub issues](https://img.shields.io/github/issues/atman-33/kiro-for-codex-ide.svg?style=flat-square)](https://github.com/atman-33/kiro-for-codex-ide/issues)

A VS Code extension that brings spec-driven development to Codex CLI, leveraging the powerful AI capabilities of the [VS Code Codex extension](https://marketplace.visualstudio.com/items?itemName=openai.chatgpt). Manage your specs, steering documents, and custom prompts visually.

![Create new Spec](./screenshots/image.png)

## Feature Overview

### 📝 Spec Management

- Run `Kiro for Codex IDE: Create New Spec` (`kiro-codex-ide.spec.create`) to open the Create Spec dialog. Provide the required summary alongside optional product context, technical constraints, and open questions; drafts auto-save so you can resume later. Submitting sends the compiled request to the VS Code Codex extension's chat to finish generating the spec.
- Browse generated specs in the **Specs** view; each spec exposes Requirements, Design, and Tasks nodes with quick-open commands.
- Execute individual checklist items from `tasks.md` via the "Start Task" CodeLens, which marks the checklist and passes the task context to the VS Code Codex extension's chat. You can then interact with the chat to execute the task.

### 🎯 Steering Management

- The **Steering** view surfaces global (`~/.codex/AGENTS.md`) and project-level (`AGENTS.md`) rules and lets you open them instantly.
- Use the built-in commands to create global or project rules, initialize steering documents, refine existing files, or delete outdated guidance. These actions will pass the relevant context to the VS Code Codex extension's chat, allowing you to interact and manage your steering documents.

### 🧩 Prompts
- Maintain Markdown prompts under `.codex/prompts` (default paths configurable). 
- Create prompts from the tree view; the extension scaffolds the file and opens it for editing.
- Run prompts from the inline action or the command palette, which passes the document as context to the Codex Chat provided by the VS Code Codex extension.

## Installation

### Prerequisites
- Codex CLI 0.28.0 or later available on `PATH`.
- Visual Studio Code 1.84.0 or newer.
- Node.js 16+ for local builds.
- **[VS Code Codex extension](https://marketplace.visualstudio.com/items?itemName=openai.chatgpt) must be installed.** This extension utilizes the Codex Chat functionality provided by the ChatGPT extension to pass prompt contexts.

### Marketplace (when published)
Search for "Kiro for Codex IDE" in the VS Code Marketplace and install the extension.

### From Local VSIX
1. Build the package with `npm run package` (produces `kiro-for-codex-ide-<version>.vsix`).
2. Install via `code --install-extension kiro-for-codex-ide-<version>.vsix`.

## Usage

### Create a Spec
1. Open the Kiro for Codex IDE activity bar container.
2. Choose **Specs** → **Create New Spec**.
3. Fill out the Create Spec dialog: the summary is required, while product context, technical constraints, and open questions are optional. Drafts auto-save while you type, and closing the dialog prompts you to discard or resume later.
4. Press **Create Spec** to send the compiled prompt to the VS Code Codex extension's chat, then continue the guided flow there.
5. Review each generated document before moving to the next step.

### Execute Tasks from `tasks.md`
1. Open the generated `tasks.md` file.
2. Click the "Start Task" CodeLens next to a checklist item.
3. The extension checks off the task locally and passes the task context to the VS Code Codex extension's chat. You can then interact with the chat to execute the task.

### Manage Steering Documents
1. Open the **Steering** view to inspect global and project AGENTS.md files.
2. Use **Init Steering** to generate product, tech, and structure documents, or **Create Custom Steering** for ad-hoc guidance. These actions will pass the relevant context to the VS Code Codex extension's chat, allowing you to interact and manage your steering documents.
3. Refine or delete documents from the context menu; the extension keeps AGENTS.md synchronized.

### Work with Prompts
1. Open the **Prompts** view and press **Create Prompt** to scaffold a Markdown prompt.
2. Edit the file; Markdown frontmatter is optional.
3. Use **Run Prompt** to push the file into the Codex Chat (provided by the VS Code Codex extension). You can then interact with the chat to utilize the prompt.

## Configuration
All settings live under the `kiro-codex-ide` namespace.

| Setting | Type | Default | Purpose |
| --- | --- | --- | --- |
| `views.specs.visible` | boolean | `true` | Show or hide the Specs explorer. |
| `views.steering.visible` | boolean | `true` | Toggle the Steering explorer. |
| `views.prompts.visible` | boolean | `true` | Toggle the Prompts explorer. |
| `views.settings.visible` | boolean | `true` | Toggle the Settings overview. |
| `codex.specsPath` | string | `.codex/specs` | Workspace-relative path for generated specs. |
| `codex.steeringPath` | string | `.codex/steering` | Workspace-relative path for steering documents. |
| `codex.promptsPath` | string | `.codex/prompts` | Workspace-relative path for Markdown prompts. |

Paths accept custom locations inside the workspace; the extension mirrors watchers to match custom directories.

## Workspace Layout
```
.codex/
├── prompts/                # Markdown prompts consumed by Codex CLI
├── specs/
│   └── <spec>/
│       ├── requirements.md
│       ├── design.md
│       └── tasks.md
├── steering/
│   └── *.md                # Product / tech / structure guidance
LICENSE
src/
├── extension.ts            # Activation, command registration, tree providers
├── features/               # Spec and steering managers
├── providers/              # TreeDataProviders, CodeLens, webviews
├── services/               # Prompt loader (Handlebars templates)
├── utils/                  # Config manager, Codex chat helpers
└── prompts/                # Prompt source markdown and generated TypeScript
webview-ui/                 # React + Vite webview bundle
scripts/
└── build-prompts.js        # Markdown → TypeScript prompt compiler
```

## Development
1. Install dependencies for both the extension and webview UI:
   - `npm run install:all`
2. Build prompts and bundle the extension:
   - `npm run build` (runs prompt compilation, extension bundle, and webview build)
3. Launch the development host:
   - Press `F5` inside VS Code or run the `Extension` launch configuration.
4. Live development:
   - `npm run watch` (TypeScript watch + webview dev server)
   - `npm --prefix webview-ui run dev` (webview in isolation)
5. Generate prompt modules when editing markdown under `src/prompts`:
   - `npm run build-prompts`

### Testing and Quality
- Unit tests: `npm test`, `npm run test:watch`, or `npm run test:coverage` (Vitest).
- Linting, formatting, and static checks: `npm run lint`, `npm run format`, `npm run check` (Ultracite toolchain).

### Packaging
- Produce a VSIX with `npm run package` (requires `vsce`).
- The output bundle lives in `dist/extension.js`; webview assets emit to `dist/webview/app/`.

## License
MIT License. See [`LICENSE`](LICENSE).

## Credits
Inspired by the original Kiro project for Claude Code by @notdp, adapted here for Codex CLI workflows.

- Original project: https://github.com/notdp/kiro-for-cc
