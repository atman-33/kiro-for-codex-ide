## Why
- Updating Codex CLI settings requires editing the global `.codex/config.toml`, but the VS Code sidebar only links to workspace settings.
- Users switching between projects need a direct shortcut to open the shared config without hunting for the hidden home directory path.
- Aligning the extension with the CLI improves trust that Codex behavior matches the user's configured defaults.

## What Changes
- Add a `kiro-codex-ide.settings.openConfig` command that resolves the OS-specific path to the global `.codex/config.toml` and opens it in the editor, surfacing a notification if the file is missing.
- Surface a new "Open Global Config (config.toml)" action in the Settings view welcome panel alongside the existing settings and help commands.
- Share the home-directory resolution helper so the command covers Linux, macOS, and Windows paths consistently with other global Codex resources.

## Impact
- Gives Codex IDE users a single-click path to review or edit their global Codex configuration without leaving VS Code.
- Encourages consistent configuration between the CLI and extension while avoiding accidental edits when the file is absent.
- Adds one command and light UI copy changes with negligible performance or architectural risk.
