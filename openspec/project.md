# Project Context

## Purpose
Kiro for Codex IDE is a Visual Studio Code extension that gives Codex CLI users a guided, spec-driven workflow. It keeps specs, steering rules, and reusable prompts in sync with the Codex chat experience so teams can create, review, and execute change proposals without leaving the IDE.

## Tech Stack
- TypeScript for the extension runtime, prompt tooling, and shared utilities compiled with `esbuild` for Node 16 targets.
- VS Code Extension API plus `CodexProvider` helpers for activating commands and integrating with Codex chat.
- React 18 + Vite + Tailwind CSS 4 for the webview UI that powers the extension’s dialogs and explorers.
- Handlebars + gray-matter for compiling Markdown prompt templates via `scripts/build-prompts.js`.
- Vitest test runner with TypeScript configuration and `@vitest/ui` for interactive debugging.
- Ultracite + Biome for linting, formatting, and static checks across both extension and webview code.

## Project Conventions

### Code Style
- Follow the steering guidance in `.codex/steering/tech.md` and `.codex/steering/structure.md`; TypeScript source lives under `src/` with generated prompt modules relegated to `src/prompts/target`.
- Keep filenames in kebab-case, favor `const` declarations, and implement functions as arrow expressions (`const fn = () => {}`) per the project’s TypeScript guidelines.
- Format with Biome (tab indentation, double quotes, required semicolons) and run `ultracite` commands (`npm run lint`, `npm run format`, `npm run check`) before committing changes.
- Avoid bypassing shared managers—use `ConfigManager`, `PromptLoader`, `SpecManager`, `SteeringManager`, and `CodexProvider` entry points instead of bespoke file IO or prompt handling.

### Architecture Patterns
- `src/extension.ts` wires activation, registers VS Code commands, and instantiates tree providers for specs, steering, prompts, and settings.
- Spec and steering flows live in `src/features/spec` and `src/features/steering`, with managers responsible for reading/writing `.codex` assets and coordinating Codex chat interactions.
- Providers under `src/providers` expose tree views and CodeLens integrations that call manager methods, keeping UI logic thin and declarative.
- Prompt ingestion goes through `PromptLoader` (`src/services/prompt-loader.ts`), which compiles Markdown templates into TypeScript modules consumed by the extension.
- The `webview-ui/` React project (Vite build) renders modal workflows; compiled assets ship in `dist/webview/app` and are loaded via the extension runtime.

### Testing Strategy
- Use Vitest (`npm test`, `npm run test:watch`, `npm run test:coverage`) for unit and integration coverage of managers, providers, and utilities.
- Place tests in `tests/` with supporting configuration in `vitest.config.ts` and `vitest.setup.ts`.
- Mock VS Code APIs and Codex integrations via existing helpers; prefer deterministic fixtures for `.codex` data to keep tests hermetic.
- Run `ultracite` checks alongside tests to ensure linting and formatting stay aligned with steering expectations.

### Git Workflow
- Develop changes on feature branches, open pull requests, and merge into `main` once checks pass; releases run from a clean `main` history.
- Follow Conventional Commits (`feat:`, `fix:`, etc.) so automated changelog generation works inside the release pipeline.
- Trigger versioned releases via the GitHub Actions workflows documented in `docs/release-process.md` (`version-bump.yml`, `release.yml`, `release-only.yml`)—tags use the `vX.Y.Z` scheme and publish VSIX packages to both VS Code Marketplace and Open VSX.
- Keep `dist/` outputs build-generated; never commit manual edits to bundled artifacts.

## Domain Context
- The extension is purpose-built for OpenSpec workflows: it scaffolds proposals, tracks requirements/design/tasks, and keeps steering guides synchronized with Codex chat prompts.
- Specs, steering documents, and prompts reside under `.codex/`; the activity bar container exposes Specs, Steering, Prompts, and Settings views that mirror this layout.
- Codex CLI and the VS Code Codex (ChatGPT) extension must be installed so Codex chat can process generated prompts and execute tasks.
- Managers rely on Codex to refine content—e.g., `SpecManager` sends create/refine requests, while `SteeringManager` preserves AGENTS contracts when documents change.

## Important Constraints
- Honor product, tech, and structure rules captured in `.codex/steering/*.md`; deviations require updates through the documented steering workflows.
- Access steering, spec, and prompt paths via `ConfigManager` helpers; do not hardcode `.codex` paths or bypass VS Code `workspace.fs` APIs.
- Route all Codex interactions through `CodexProvider.invokeCodexSplitView`/`invokeCodexHeadless` to keep chat sessions consistent and temporary payloads under `.codex/tmp`.
- Avoid silently overwriting user-authored `.codex` content—manager methods guard against unintended deletions and must remain the single touchpoint for file mutations.
- Maintain separation between extension code and webview bundle; webview assets should be produced via `npm run build:webview` and loaded from `dist/`.

## External Dependencies
- VS Code 1.84+ runtime and extension API surface area.
- Codex CLI (≥0.28.0) and the VS Code Codex extension, which provide the chat backend consumed by `CodexProvider`.
- GitHub Actions workflows leveraging `vsce`, `HaaLeo/publish-vscode-extension`, and publish tokens (`VSCE_PAT`, `OPEN_VSX_TOKEN`) for marketplace releases.
- Node.js tooling: `esbuild` for bundling, Vite + Tailwind CSS for the webview, and `ultracite`/`biome` binaries for linting and formatting.
