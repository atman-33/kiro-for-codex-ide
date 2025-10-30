## Why
- The Prompts tree currently lists only project-local prompts from `.codex/prompts`, forcing users to switch contexts when they need global Codex prompts.
- Codex CLI users maintain reusable prompts under the global `.codex/prompts` directory, and the VS Code extension should expose them alongside project prompts for parity with the CLI.
- Separating prompt sources clarifies whether edits affect the workspace or global catalog, reducing accidental modifications in shared environments.

## What Changes
- Update the Prompts tree provider to render `Project` and `Global` group nodes so users can browse prompts from both sources without leaving the sidebar.
- Extend the prompt discovery logic to resolve the platform-specific global prompt directory (`~/.codex/prompts` on Linux/macOS, `%USERPROFILE%\.codex\prompts` on Windows) and label each prompt item with its source.
- Refresh prompt icons, context commands, and tests so global prompts remain read-only unless explicitly opened, matching existing manager/provider abstractions.

## Impact
- Improves discoverability of Codex CLI global prompts inside the IDE, keeping project and global libraries synchronized.
- Requires cross-platform filesystem handling but no schema or steering updates; existing prompt compilation flows remain unchanged.
- Introduces additional tree nodes and tests yet keeps backward compatibility for users without global prompt directories.
