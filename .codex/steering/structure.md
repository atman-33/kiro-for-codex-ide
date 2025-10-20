# Structure Guidance

- Treat `.codex/` as the workspace state root: keep prompts under `.codex/prompts`, specs under `.codex/specs/<spec>/`, steering docs under `.codex/steering/`, and respect the `tmp/` subdirectory for transient chat payloads.
- Preserve the extension source layout:
  - `src/extension.ts` owns activation, command registration, tree providers, and file watchers.
  - `src/features/spec` and `src/features/steering` encapsulate SpecManager and SteeringManager behavior; keep spec and steering logic isolated here.
  - `src/providers` hosts VS Code tree, CodeLens, and Codex integration providers; add new explorer views beside existing providers with matching naming.
  - `src/services/prompt-loader.ts` + `src/prompts` handle prompt ingestion; place Markdown templates in `src/prompts/**/*.md` to feed the build script.
  - `src/utils` centralizes helpers such as `config-manager`, `chat-prompt-runner`, and `notification-utils`; extend utilities here instead of inlining helpers inside features.
- Maintain generated artifacts in `dist/` (extension bundle + webview assets) and keep tests in `tests/` alongside Vitest config (`vitest.config.ts`, `vitest.setup.ts`).
- Recognize the separate `webview-ui/` React project (Tailwind + Vite); front-end components live in `webview-ui/src`, and its build outputs feed the extension via `npm run build:webview`.
