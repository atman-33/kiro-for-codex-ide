# Tech Guidance

- Target the VS Code extension runtime: bundle `src/extension.ts` via `esbuild` for Node 16 and ship webviews built with React + Vite from `webview-ui`.
- Rely on TypeScript across the repo; keep source under `src/` and ensure generated prompt modules live in `src/prompts/target` (compiled by `scripts/build-prompts.js`).
- Treat `PromptLoader` singletons as the source of truth for Markdown prompt templates; never load prompt files manually outside the loader to avoid desynchronizing the generated index.
- Manage dependencies with npm; run `npm run install:all` to install both extension and webview packages before builds.
- Use the documented scripts: `npm run build` (prompt compilation → extension bundle → webview build), `npm run watch` for iterative dev, `npm run build-prompts` when prompt Markdown changes, `npm run package` to emit a `.vsix` bundle, and `npm test` / `npm run test:watch` / `npm run test:coverage` for Vitest.
- Run linting and formatting through Ultracite (`npm run lint`, `npm run format`, `npm run check`); do not introduce alternative tooling without updating these commands.
- Respect the extension’s Codex integration: interact with Codex via `CodexProvider` utilities instead of spawning terminals yourself so prompt files are created under `context.globalStorageUri` and cleaned automatically.
