## Webview UI Workspace

This package hosts the React application that powers the VS Code webview surfaces. It is bundled with Vite and consumes messages from the extension host through the `bridge/vscode` helper.

### Getting Started

- `npm install` (at repo root) – installs all root and workspace dependencies.
- `npm run dev --workspace webview-ui` – launches the Vite dev server.
- `npm run build --workspace webview-ui` – generates production assets under `dist/webview/app`.

### Project Structure

```
webview-ui/
├── src/
│   ├── components/        # Shared visual components reused across features
│   │   └── ui/            # shadcn/ui component library
│   ├── hooks/             # Shared React hooks
│   ├── features/
│   │   └── {feature}/
│   │       ├── index.tsx  # Feature entry component rendered from routing
│   │       ├── components/# Feature-specific components
│   │       └── hooks/     # Feature-specific hooks
│   ├── bridge/            # Messaging helpers for VS Code <-> webview
│   └── index.tsx          # Runtime router that mounts the selected feature
├── public/                # Static assets copied verbatim by Vite
├── vite.config.ts         # Vite build configuration
└── README.md
```

### Coding Guidelines

- Prefer the shared modules under `src/components` and `src/hooks` before introducing feature-local code.
- Add feature-only utilities inside the nested `components/` or `hooks/` directories to keep boundaries clear.
- Keep styling in Tailwind-style utility classes (see `src/app.css` for base tokens) and avoid inline styles when reusable classes exist.
- Exchange messages with the extension via `vscode.postMessage` and subscribe through `window.addEventListener('message', …)` inside React effects.
- When adding new steering or config references, obtain paths through the shared `ConfigManager` utilities from the extension layer.

### Testing & Quality

- Use Playwright or Cypress style integration tests if adding complex interactions (tests live under the repo-level `tests/`).
- Run `npm run lint` and `npm run build` before committing to ensure TypeScript and bundler checks pass.
