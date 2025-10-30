## 1. Implementation
- [ ] 1.1 Add a shared utility that returns the absolute path to the global Codex config (`~/.codex/config.toml` or `%USERPROFILE%\.codex\config.toml`) and cover edge cases when the home directory is unavailable.
- [ ] 1.2 Register the `kiro-codex-ide.settings.openConfig` command to open the resolved config path in the editor, showing a VS Code notification if the file cannot be found or read.
- [ ] 1.3 Extend the Settings view welcome panel copy to include an "Open Global Config (config.toml)" entry and ensure the new command appears in package contributions and command palette metadata.
- [ ] 1.4 Add unit coverage for the path helper and command behavior (success and missing-file scenarios) using existing mocking patterns for VS Code APIs.

## 2. Validation
- [ ] 2.1 Manually verify on one platform and stub tests for others that the command opens the config file when present and shows a descriptive error when absent.
- [ ] 2.2 Run `npm run lint`, `npm run test`, and `npm run check` to confirm compliance with steering linting, formatting, and type expectations.
