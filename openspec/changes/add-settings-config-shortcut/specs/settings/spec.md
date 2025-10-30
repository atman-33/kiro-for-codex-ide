## ADDED Requirements
### Requirement: Settings View Global Config Shortcut
The Settings view MUST expose a command that opens the global Codex configuration file so users can review or edit `config.toml` without leaving VS Code.

#### Scenario: Launch global config from Settings view
- **GIVEN** the Kiro for Codex IDE extension is active and the user opens the Settings view
- **WHEN** they invoke the "Open Global Config (config.toml)" action
- **THEN** the extension opens the file located at the platform-specific global path (`~/.codex/config.toml` on Linux/macOS or `%USERPROFILE%\.codex\config.toml` on Windows) in an editor tab
- **AND** it notifies the user if the file is missing so they know to create it manually.

### Requirement: Resolve Global Config Path
The extension MUST resolve the global Codex config path using the current user's home directory across supported platforms.

#### Scenario: Resolve config path for each platform
- **GIVEN** the user runs the extension on Linux, macOS, or Windows
- **WHEN** the new settings command resolves the global config path
- **THEN** it expands the user's home directory and joins `.codex/config.toml` using the platform's path separators before attempting to open the file.
