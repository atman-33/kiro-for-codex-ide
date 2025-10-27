## ADDED Requirements
### Requirement: Custom Steering Creation Dialog
The extension MUST open a dedicated webview dialog with rich inputs whenever the `kiro-codex-ide.steering.create` command runs, providing parity with the Create New Spec experience and formatting the collected data for the `create-custom-steering` prompt.

#### Scenario: Launch With Draft Recovery
- **GIVEN** the user previously saved custom steering input via autosave
- **WHEN** they invoke `kiro-codex-ide.steering.create`
- **THEN** a `create-steering` webview panel opens in the active editor column with the saved form values loaded
- **AND** the primary summary textarea receives focus unless the user was editing a different field before the dialog closed.

#### Scenario: Submit Steering Prompt
- **GIVEN** the user completes all required fields in the custom steering dialog
- **WHEN** they submit the form
- **THEN** the dialog sends an aggregated guidance description to the `create-custom-steering` prompt through `PromptLoader`
- **AND** the extension clears the draft state, shows the existing chat notification, and closes the panel without leaving stray workspace state.
